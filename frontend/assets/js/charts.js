// Small SVG chart helpers for the planner. Colours come from CSS tokens via style attributes.
import { inr } from './engine.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
const t = s => Date.parse(s + 'T00:00:00Z');

export function niceTicks(min, max, n = 4) {
  const span = max - min || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= n) || mag * 10;
  const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const compact = v => {
  const a = Math.abs(v);
  if (a >= 1e7) return `${(v / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${(v / 1e5).toFixed(0)}L`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return `${Math.round(v)}`;
};
function tickFormat(ticks) {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(ticks[0]) || 1;
  const mx = Math.max(...ticks.map(Math.abs));
  const [unit, suf] = mx >= 1e7 ? [1e7, 'Cr'] : mx >= 1e5 ? [1e5, 'L'] : mx >= 1e3 ? [1e3, 'k'] : [1, ''];
  const dec = Math.min(2, Math.max(0, Math.ceil(-Math.log10(step / unit) - 1e-9)));
  return v => `${(v / unit).toFixed(dec)}${suf}`;
}
function yAxis(y, ticks, x0, x1, fmt = tickFormat(ticks)) {
  return ticks.map(v => `<line x1="${x0}" x2="${x1}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/>` +
    `<text x="${x0 - 6}" y="${y(v) + 3.5}" text-anchor="end">${fmt(v)}</text>`).join('');
}

/** Weekly history line, P10–P90 band and P50 line, with the block window shaded. */
export function forecastChart(svg, series, block, planDate) {
  const W = 560, H = 250, l = 46, r = 12, top = 14, b = 30;
  const hist = series.history.map(p => ({ x: t(p.week), y: p.demand }));
  const fc = series.forecast.map(p => ({ x: t(p.week), lo: p.p10, mid: p.p50, hi: p.p90 }));
  const xs = [...hist.map(p => p.x), ...fc.map(p => p.x)], ymax = Math.max(...hist.map(p => p.y), ...fc.map(p => p.hi)) * 1.08;
  const x = lin(Math.min(...xs), Math.max(...xs) + 6 * 864e5, l, W - r), y = lin(0, ymax, H - b, top);
  const path = (pts, k) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)} ${y(p[k]).toFixed(1)}`).join('');
  const band = path(fc, 'hi') + fc.slice().reverse().map(p => `L${x(p.x).toFixed(1)} ${y(p.lo).toFixed(1)}`).join('') + 'Z';
  let ticks = '';
  const d0 = new Date(Math.min(...xs)), d1 = new Date(Math.max(...xs));
  for (let d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1)); d <= d1; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 3, 1))) {
    ticks += `<text x="${x(d.getTime())}" y="${H - 10}" text-anchor="middle">${MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}</text>`;
  }
  const win = block ? `<rect x="${x(t(block.start))}" y="${top}" width="${Math.max(3, x(t(block.end)) - x(t(block.start)))}" height="${H - b - top}" style="fill:var(--gold);fill-opacity:.18"/>
    <text class="lbl" x="${Math.min(x(t(block.start)) + 4, W - 80)}" y="${top + 11}">${esc(block.short || 'block window')}</text>` : '';
  const today = x(t(planDate));
  svg.innerHTML = `${yAxis(y, niceTicks(0, ymax, 4), l, W - r)}${win}
    <path d="${band}" style="fill:var(--blue);fill-opacity:.16"/>
    <path d="${path(hist, 'y')}" style="fill:none;stroke:var(--ink);stroke-width:1.6"/>
    <path d="${path(fc, 'mid')}" style="fill:none;stroke:var(--blue);stroke-width:2.2"/>
    <line x1="${today}" x2="${today}" y1="${top}" y2="${H - b}" style="stroke:var(--ink);stroke-dasharray:3 4"/>
    <text x="${today - 4}" y="${H - b - 6}" text-anchor="end">history</text><text x="${today + 4}" y="${H - b - 6}">forecast</text>
    ${ticks}`;
}

/** Expected profit by buy day; far-out on the left, check-in on the right. */
export function timingChart(svg, timing) {
  const W = 560, H = 210, l = 46, r = 14, top = 16, b = 30, pts = timing.points;
  if (!pts.length) { svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="lbl">Arrival is under a week away: buy now or skip.</text>`; return; }
  const maxL = Math.max(...pts.map(p => p.lead_days)), ev = pts.map(p => p.expected_profit);
  const ymin = Math.min(0, ...ev), ymax = Math.max(...ev) * 1.12 || 1;
  const x = lin(maxL, 7, l, W - r), y = lin(ymin, ymax, H - b, top);
  const rates = pts.map(p => p.rate), rmin = Math.min(...rates), rmax = Math.max(...rates), yr = lin(rmin, rmax || rmin + 1, H - b - 6, top + 26);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.lead_days).toFixed(1)} ${y(p.expected_profit).toFixed(1)}`).join('');
  const rl = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.lead_days).toFixed(1)} ${yr(p.rate).toFixed(1)}`).join('');
  const bst = timing.best, xt = niceTicks(7, maxL, 5).filter(v => v >= 7);
  svg.innerHTML = `${yAxis(y, niceTicks(ymin, ymax, 4), l, W - r)}
    ${xt.map(v => `<text x="${x(v)}" y="${H - 10}" text-anchor="middle">${v}d</text>`).join('')}
    <path d="${rl}" style="fill:none;stroke:var(--coral);stroke-width:1.4;stroke-dasharray:5 4"/>
    <path d="${line}" style="fill:none;stroke:var(--gold);stroke-width:2.6"/>
    <circle cx="${x(bst.lead_days)}" cy="${y(bst.expected_profit)}" r="6" style="fill:var(--green);stroke:var(--panel);stroke-width:2"/>
    <text class="lbl" x="${Math.min(x(bst.lead_days) + 9, W - 120)}" y="${y(bst.expected_profit) - 8}">best: ${bst.lead_days} days out</text>
    <text x="${l}" y="${top - 3}" style="fill:var(--gold-ink)">expected profit</text>
    <text x="${W - r}" y="${top - 3}" text-anchor="end" style="fill:var(--coral)">supplier rate (dashed)</text>`;
}

/** Histogram of simulated portfolio profit with P10 / P50 / P90 markers. */
export function histogram(svg, risk) {
  const W = 560, H = 260, l = 14, r = 14, top = 30, b = 34, hs = risk.histogram;
  if (!hs.length) { svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" class="lbl">Nothing bought, so no risk to show.</text>`; return; }
  const lo = hs[0].lo, hi = hs[hs.length - 1].hi, mx = Math.max(...hs.map(h => h.count));
  const x = lin(lo, hi, l, W - r), y = lin(0, mx, H - b, top);
  const bars = hs.map(h => `<rect x="${x(h.lo) + .5}" y="${y(h.count)}" width="${Math.max(1, x(h.hi) - x(h.lo) - 1)}" height="${H - b - y(h.count)}" style="fill:${h.hi <= 0 ? 'var(--coral)' : 'var(--gold)'}"/>`).join('');
  const marks = [[risk.p10, 'P10', 'var(--coral)'], [risk.p50, 'P50', 'var(--ink)'], [risk.p90, 'P90', 'var(--green)']];
  let lastX = -1e9, lvl = 0;
  const mk = marks.map(([v, name, c]) => {
    if (v < lo || v > hi) return '';
    const xx = x(v); lvl = xx - lastX < 34 ? lvl + 1 : 0; lastX = xx;
    const ty = top - 8 + lvl * 13, anchor = xx > W - 40 ? 'end' : xx < 40 ? 'start' : 'middle';
    return `<line x1="${xx}" x2="${xx}" y1="${ty + 3}" y2="${H - b}" style="stroke:${c};stroke-width:2"/><text class="lbl" x="${xx + (anchor === 'end' ? -4 : anchor === 'start' ? 4 : 0)}" y="${ty}" text-anchor="${anchor}">${name}</text>`;
  }).join('');
  svg.innerHTML = `<line x1="${l}" x2="${W - r}" y1="${H - b}" y2="${H - b}" style="stroke:var(--line2)"/>${bars}
    ${mk}
    <text x="${l}" y="${H - 12}">${inr(lo)}</text><text x="${W - r}" y="${H - 12}" text-anchor="end">${inr(hi)}</text>
    <text x="${W / 2}" y="${H - 12}" text-anchor="middle">profit per season</text>`;
}

/** Expected profit against standard deviation for each risk setting. */
export function frontierChart(svg, pts, currentLam) {
  const W = 560, H = 260, l = 50, r = 16, top = 20, b = 34;
  const xs = pts.map(p => p.sd), ys = pts.map(p => p.expected_profit);
  const x = lin(Math.min(...xs) * 0.9, Math.max(...xs) * 1.08 || 1, l, W - r);
  const ymin = Math.min(...ys) * 0.97, ymax = Math.max(...ys) * 1.03 || 1, y = lin(ymin, ymax, H - b, top);
  const name = { 0: 'Bold', 0.5: 'Balanced', 1: 'Careful', 2: 'Very careful' };
  let prevY = null;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.sd).toFixed(1)} ${y(p.expected_profit).toFixed(1)}`).join('');
  const dots = pts.map(p => {
    const cur = Math.abs(p.risk_aversion - currentLam) < 1e-9;
    return `<circle cx="${x(p.sd)}" cy="${y(p.expected_profit)}" r="${cur ? 8 : 5}" style="fill:${cur ? 'var(--coral)' : 'var(--panel)'};stroke:var(--coral);stroke-width:2"/>` +
      (name[p.risk_aversion] !== undefined ? (() => { let ty = y(p.expected_profit) + 4; if (prevY !== null && Math.abs(ty - prevY) < 12) ty = prevY + 13; prevY = ty;
        return `<text class="${cur ? 'lbl' : ''}" x="${x(p.sd) + 10}" y="${ty}">${name[p.risk_aversion]}</text>`; })() : '');
  }).join('');
  svg.innerHTML = `${yAxis(y, niceTicks(ymin, ymax, 4), l, W - r)}
    ${(() => { const tk = niceTicks(Math.min(...xs) * 0.9, Math.max(...xs) * 1.08, 4), f = tickFormat(tk); return tk.map(v => `<text x="${x(v)}" y="${H - 14}" text-anchor="middle">${f(v)}</text>`).join(''); })()}
    <path d="${line}" style="fill:none;stroke:var(--coral);stroke-width:1.6"/>${dots}
    <text x="${W - r}" y="${H - 1}" text-anchor="end">risk: std. dev. of profit (₹) →</text>
    <text x="${l}" y="${top - 6}">expected profit (₹)</text>`;
}

/** Horizontal bars of forecast error per destination, with the naive baseline marked. */
export function backtestChart(svg, bt, names) {
  const rows = Object.entries(bt.per_destination_wape).sort((a, b) => a[1] - b[1]);
  const W = 560, rowH = 16, l = 104, r = 54, top = 20, H = top + rows.length * rowH + 26;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const mx = Math.max(bt.naive_wape, ...rows.map(r => r[1])) * 1.1, x = lin(0, mx, l, W - r);
  const bars = rows.map(([d, v], i) => {
    const yy = top + i * rowH;
    return `<text x="${l - 8}" y="${yy + 11}" text-anchor="end" class="lbl">${esc(names[d] || d)}</text>
      <rect x="${l}" y="${yy + 2}" width="${x(v) - l}" height="${rowH - 5}" rx="2" style="fill:${v <= bt.naive_wape ? 'var(--blue)' : 'var(--coral)'}"/>
      <text x="${x(v) + 6}" y="${yy + 11}">${(v * 100).toFixed(1)}%</text>`;
  }).join('');
  const nx = x(bt.naive_wape), mxm = x(bt.model_wape);
  svg.innerHTML = `${bars}
    <line x1="${nx}" x2="${nx}" y1="${top - 6}" y2="${H - 22}" style="stroke:var(--coral);stroke-width:2;stroke-dasharray:4 3"/>
    <text x="${nx}" y="${top - 9}" text-anchor="middle" style="fill:var(--coral)">naive ${(bt.naive_wape * 100).toFixed(1)}%</text>
    <line x1="${mxm}" x2="${mxm}" y1="${top - 6}" y2="${H - 22}" style="stroke:var(--ink);stroke-width:2"/>
    <text x="${mxm}" y="${H - 8}" text-anchor="middle" class="lbl">model ${(bt.model_wape * 100).toFixed(1)}%</text>`;
}
