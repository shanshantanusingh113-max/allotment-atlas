// Data explorer: counts, downloads, destination table with sparklines, event calendar and blocks table.
import { inr } from './engine.js';
import * as charts from './charts.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REGION = { india: 'India', gulf: 'Gulf', sea: 'South-East Asia', india_ocean: 'Indian Ocean', europe: 'Europe', south_asia: 'South Asia', central_asia: 'Central Asia', east_asia: 'East Asia' };
let snap, profiles = {}, region = 'all', selected = null;

async function boot() {
  try { snap = await (await fetch('data/atlas.json')).json(); }
  catch (e) { $('counts').innerHTML = '<div class="err">Could not load data/atlas.json. Serve this folder over HTTP.</div>'; return; }
  // Monthly profile (Jan..Dec) from the destinations CSV.
  try {
    const csv = await (await fetch('data/destinations.csv')).text();
    const [head, ...rows] = csv.trim().split('\n'); const h = head.split(',');
    for (const r of rows) { const v = r.split(','); profiles[v[h.indexOf('code')]] = h.filter(k => /^m\d\d$/.test(k)).map(k => +v[h.indexOf(k)]); }
  } catch (_) { /* sparkline falls back to monthly forecast */ }
  renderCounts(); renderDownloads(); renderRegions(); renderDestinations(); renderEvents(); renderBlocks();
  select(snap.destinations[0].code);
}

function renderCounts() {
  const n = snap.destinations.length, ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const w = n < 10 ? ones[n] : n < 20 ? teens[n - 10] : n < 100 ? `${['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'][Math.floor(n / 10)]}${n % 10 ? '-' + ones[n % 10] : ''}` : String(n);
  $('nPlaces').textContent = w[0].toUpperCase() + w.slice(1);
  const daily = snap.datasets?.find(d => d.file === 'daily_history.csv');
  const items = [[snap.destinations.length, 'destinations'], [Object.keys(snap.hubs).length, 'departure hubs'],
    [snap.catalog.events.length, 'event dates'], [snap.candidates.length, 'inventory blocks'], [snap.shocks.length, 'market shocks'],
    [daily ? daily.rows.toLocaleString('en-IN') : '–', 'daily rows']];
  $('counts').innerHTML = items.map(([n, l]) => `<div><b>${n}</b><small>${l}</small></div>`).join('');
}

function renderDownloads() {
  const info = {
    'daily_history.csv': ['Daily history', 'searches, demand, bookings, sold-out, cancellations, ADR, events', 'var(--ink)'],
    'weekly_history.csv': ['Weekly history', 'the table the forecaster trains on', 'var(--blue)'],
    'forecast.csv': ['Forecast', 'P10, P50, P90 per destination-week with drivers', 'var(--violet)'],
    'destinations.csv': ['Destinations', 'hub, region, rates, cancellations, 12-month profile', 'var(--green)'],
    'events.csv': ['Event calendar', 'festivals, holidays and their intensity', 'var(--gold)'],
    'blocks.csv': ['Inventory blocks', 'stay windows, cost, price, recovery', 'var(--coral)'],
    'catalog.json': ['Catalog (JSON)', 'the full config the engine runs on', 'var(--ink)'],
  };
  const kb = b => b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
  $('dl').innerHTML = (snap.datasets || []).map(d => { const [t, sub, c] = info[d.file] || [d.file, '', 'var(--ink)'];
    return `<a href="data/${d.file}" download><i style="--c:${c}">${d.file.split('.').pop().toUpperCase()}</i><span><b>${t}</b><small>${d.rows != null ? d.rows.toLocaleString('en-IN') + ' rows · ' : ''}${kb(d.bytes)} · ${sub}</small></span></a>`; }).join('');
}

function renderRegions() {
  const regs = ['all', ...new Set(snap.destinations.map(d => d.region))];
  $('regions').innerHTML = regs.map(r => `<button type="button" data-r="${r}" aria-pressed="${r === region}">${r === 'all' ? 'All regions' : REGION[r] || r}</button>`).join('');
  $('regions').onclick = e => { const b = e.target.closest('button'); if (!b) return; region = b.dataset.r;
    $('regions').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderDestinations(); };
}

function spark(vals, w = 120, h = 26) {
  const mx = Math.max(...vals), mn = Math.min(...vals), x = i => 2 + i * (w - 4) / (vals.length - 1), y = v => h - 3 - (v - mn) / ((mx - mn) || 1) * (h - 6);
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const pk = vals.indexOf(mx);
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-label="Peak in ${MON[pk]}"><path d="${d} L${x(vals.length - 1)} ${h} L${x(0)} ${h}Z" style="fill:var(--gold);fill-opacity:.18"/><path d="${d}" style="fill:none;stroke:var(--gold-ink);stroke-width:1.6"/><circle cx="${x(pk)}" cy="${y(mx)}" r="2.6" style="fill:var(--coral)"/></svg>`;
}

function renderDestinations() {
  const list = snap.destinations.filter(d => region === 'all' || d.region === region).sort((a, b) => b.last_year - a.last_year);
  $('dRows').innerHTML = list.map(d => `<tr data-c="${d.code}" aria-selected="${d.code === selected}" tabindex="0">
    <td class="blk"><b>${esc(d.name)}</b><small>${d.code} · ${REGION[d.region] || d.region}</small></td>
    <td>${esc(d.hub_name)}</td><td class="r num">${d.last_year.toLocaleString('en-IN')}</td>
    <td class="r num ${d.growth >= 0 ? 'up' : 'down'}">${d.growth >= 0 ? '+' : ''}${(d.growth * 100).toFixed(0)}%</td>
    <td class="r num">${(d.sellout_share * 100).toFixed(1)}%</td><td class="r num">${inr(d.adr)}</td>
    <td>${spark(profiles[d.code] || d.monthly.map(m => m.p50))}</td></tr>`).join('');
  $('dRows').querySelectorAll('tr').forEach(tr => { const go = () => select(tr.dataset.c); tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });
}

function select(code) {
  selected = code;
  $('dRows').querySelectorAll('tr').forEach(tr => tr.setAttribute('aria-selected', tr.dataset.c === code));
  const d = snap.destinations.find(x => x.code === code), blocks = snap.candidates.filter(c => c.dest === code);
  const evs = snap.catalog.events.filter(e => !e.destinations.length || e.destinations.includes(code)).map(e => e.name);
  $('dDetail').innerHTML = `<div class="eyebrow">${code} · ${REGION[d.region] || d.region} · via ${esc(d.hub_name)}</div><h3>${esc(d.name)}</h3>
    <div class="chips"><div><small>Last year</small><b>${d.last_year.toLocaleString('en-IN')}</b></div><div><small>Next year P50</small><b>${d.forecast_year.toLocaleString('en-IN')}</b></div>
    <div><small>Sold out</small><b>${(d.sellout_share * 100).toFixed(1)}%</b></div><div><small>Blocks</small><b>${blocks.length}</b></div></div>
    <div class="cap"><b>Weekly demand</b><span>history and P10–P90 forecast</span></div>
    <svg class="chart" id="dChart" viewBox="0 0 560 250" role="img" aria-label="Weekly history and forecast"></svg>
    <div class="why" style="border-left-color:var(--blue)"><b>Events:</b> ${esc([...new Set(evs)].join(', ') || 'none')}.<br><b>Blocks:</b> ${blocks.map(b => esc(b.label)).join(', ') || 'none'}.</div>`;
  charts.forecastChart($('dChart'), snap.forecasts[code], null, snap.generated_for);
}

function renderEvents() {
  const evs = snap.catalog.events, names = [...new Set(evs.slice().sort((a, b) => a.start.localeCompare(b.start)).map(e => e.name))];
  const W = 900, l = 210, r = 12, top = 24, rowH = 22, H = top + names.length * rowH + 24, svg = $('evChart');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const t0 = Date.parse('2024-11-01'), t1 = Date.parse('2027-11-30'), x = t => l + (t - t0) / (t1 - t0) * (W - l - r);
  let grid = '';
  for (let y = 2024; y <= 2027; y++) for (const m of [0, 3, 6, 9]) { const t = Date.UTC(y, m, 1); if (t < t0 || t > t1) continue;
    grid += `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${H - 20}" style="stroke:var(--line)"/><text x="${x(t) + 3}" y="${top - 10}">${MON[m]} ${String(y).slice(2)}</text>`; }
  const plan = Date.parse(snap.generated_for);
  grid += `<rect x="${x(plan)}" y="${top - 6}" width="${W - r - x(plan)}" height="${H - top - 14}" style="fill:var(--blue);fill-opacity:.05"/>
    <line x1="${x(plan)}" x2="${x(plan)}" y1="${top - 6}" y2="${H - 20}" style="stroke:var(--coral);stroke-width:2"/><text x="${x(plan) + 4}" y="${H - 6}" style="fill:var(--coral)">plan date · forecast horizon →</text>`;
  const rows = names.map((n, i) => {
    const y = top + i * rowH, bars = evs.filter(e => e.name === n && Date.parse(e.end) >= t0 && Date.parse(e.start) <= t1).map(e => {
      const a = Math.max(t0, Date.parse(e.start)), b = Math.min(t1, Date.parse(e.end) + 864e5);
      return `<rect x="${x(a)}" y="${y + 4}" width="${Math.max(3, x(b) - x(a))}" height="${rowH - 8}" rx="2" style="fill:var(--gold-ink);fill-opacity:${(0.25 + e.intensity * 0.9).toFixed(2)}"><title>${esc(n)}: ${e.start} to ${e.end}, +${Math.round(e.intensity * 100)}%</title></rect>`;
    }).join('');
    return `<text x="${l - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" class="lbl">${esc(n)}</text>${bars}`;
  }).join('');
  svg.innerHTML = grid + rows;
}

let sortKey = 'expected_profit', sortDir = -1;
function renderBlocks() {
  const rows = snap.candidates.map(c => ({ ...c, window_start: c.start })).sort((a, b) => (a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0) * sortDir);
  $('bRows').innerHTML = rows.map(c => `<tr><td class="blk"><b>${esc(c.label)}</b><small>${esc(c.dest_name)} · <span class="pill ${c.kind === 'hotel' ? 'h' : 'f'}">${c.kind}</span></small></td>
    <td>${esc(c.window)}</td><td class="r num">${Math.round(c.mu).toLocaleString('en-IN')}</td><td class="r num">${inr(c.cost)}</td><td class="r num">${inr(c.price)}</td>
    <td class="r num">${inr(c.salvage)}</td><td class="r num">${c.critical_ratio.toFixed(2)}</td><td class="r num">${c.q_star.toLocaleString('en-IN')}</td><td class="r num"><b>${inr(c.expected_profit)}</b></td></tr>`).join('');
  document.querySelectorAll('#bTable th[data-k]').forEach(th => {
    th.toggleAttribute('aria-sort', th.dataset.k === sortKey);
    if (th.dataset.k === sortKey) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
    th.onclick = () => { sortDir = sortKey === th.dataset.k ? -sortDir : -1; sortKey = th.dataset.k; renderBlocks(); };
  });
}

boot();
