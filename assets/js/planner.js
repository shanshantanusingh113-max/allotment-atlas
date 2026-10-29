// Buy Planner: wires the engine to the 3D globe, buy list, detail drawer and risk panels.
import { connect } from './api.js';
import { inr, fmtDate } from './engine.js';
import * as charts from './charts.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RISK_NAMES = { 0: 'Bold', 0.5: 'Balanced', 1: 'Careful', 2: 'Very careful' };
const crore = l => `₹${(l / 100).toFixed(2)} Cr`;
const parse = s => new Date(s + 'T00:00:00Z');
const shortDate = s => { const d = parse(s); return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

const DEFAULTS = { budget: 800, risk: 0.5, share: 0.35 };
const state = { ...DEFAULTS, shocks: new Set(), month: 1, block: null, plan: null, seq: 0, seed: 1 };
let engine, snap, globe, destByCode = {}, candById = {}, forecastCache = {};

// ------------------------------------------------------------------ boot
async function boot() {
  try {
    ({ engine, snapshot: snap } = await connect());
  } catch (err) {
    $('loading').innerHTML = `<div class="err">Could not load data/atlas.json. Serve this folder over HTTP (for example <span class="mono">python3 -m http.server</span>) rather than opening the file directly.</div>`;
    return;
  }
  destByCode = Object.fromEntries(snap.destinations.map(d => [d.code, d]));
  candById = Object.fromEntries(snap.candidates.map(c => [c.id, c]));
  const pill = $('engine');
  pill.dataset.mode = engine.mode;
  $('engineTxt').textContent = engine.mode === 'api' ? `Live API · v${engine.version}` : 'Browser engine';
  pill.title = engine.mode === 'api' ? `Answered by the Python service at ${engine.base}` : 'Running the exported model snapshot in your browser. Add ?api=<url> to use the live service.';
  $('apiState').textContent = engine.mode === 'api' ? `connected to ${engine.base}` : 'not connected · using the browser engine';
  $('planEyebrow').textContent = `Buy Planner · plan date ${fmtDate(parse(snap.generated_for))}`;

  const qp = new URLSearchParams(location.search);
  if (qp.has('budget')) state.budget = Math.max(100, Math.min(1500, Math.round(+qp.get('budget') / 10) * 10)) || DEFAULTS.budget;
  if (qp.has('risk') && [0, 0.5, 1, 2].includes(+qp.get('risk'))) state.risk = +qp.get('risk');
  if (qp.has('share')) state.share = Math.max(0.15, Math.min(1, +qp.get('share'))) || DEFAULTS.share;
  if (qp.get('shocks')) qp.get('shocks').split(',').filter(id => snap.shocks.some(s => s.id === id)).forEach(id => state.shocks.add(id));
  buildMonths(); buildShocks(); bindControls(); bindAsk(); bindFeatures();
  try { globe = initGlobe($('globe')); } catch (e) { console.error(e); $('globe').innerHTML = '<p class="muted" style="padding:24px">3D view could not start in this browser. Everything else still works.</p>'; }
  setMonth(state.month);
  renderBacktest();
  await replan();
  $('loading').classList.add('done');
}

// -------------------------------------------------------------- controls
function buildMonths() {
  const months = snap.destinations[0].monthly.map(m => m.month);
  const totals = months.map((_, i) => snap.destinations.reduce((s, d) => s + d.monthly[i].p50, 0));
  const mx = Math.max(...totals);
  const box = $('months');
  const play = document.createElement('button');
  play.className = 'play'; play.type = 'button'; play.textContent = '▶'; play.setAttribute('aria-label', 'Play through the year');
  box.appendChild(play);
  months.forEach((m, i) => {
    const [y, mm] = m.split('-').map(Number);
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.i = i; b.setAttribute('aria-pressed', i === state.month);
    b.innerHTML = `<i style="--h:${Math.round(totals[i] / mx * 100)}%"></i>${MON[mm - 1]}${mm === 1 || i === 0 ? ` ${String(y).slice(2)}` : ''}`;
    b.onclick = () => { stopPlay(); setMonth(i); };
    box.appendChild(b);
  });
  let timer = null;
  const stopPlay = () => { clearInterval(timer); timer = null; play.textContent = '▶'; };
  play.onclick = () => {
    if (timer) return stopPlay();
    play.textContent = '❚❚';
    timer = setInterval(() => setMonth((state.month + 1) % months.length), 1400);
  };
  state.months = months;
}
function setMonth(i) {
  state.month = i;
  [...$('months').querySelectorAll('button[data-i]')].forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === i));
  const [y, m] = state.months[i].split('-').map(Number);
  $('gMonth').textContent = `${MON[m - 1]} ${y}`;
  globe?.setMonth(i);
}
function buildShocks() {
  const colors = { gulf_advisory: 'var(--coral)', vietnam_visa: 'var(--green)', cyclone: 'var(--coral)', bangkok_concert: 'var(--green)', fuel_spike: 'var(--coral)' };
  for (const s of snap.shocks) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tog'; b.dataset.id = s.id; b.title = s.description;
    b.style.setProperty('--c', colors[s.id] || 'var(--violet)'); b.setAttribute('aria-pressed', 'false'); b.textContent = s.label;
    b.onclick = () => { state.shocks.has(s.id) ? state.shocks.delete(s.id) : state.shocks.add(s.id); b.setAttribute('aria-pressed', state.shocks.has(s.id)); schedule(); };
    $('shocks').appendChild(b);
  }
}
function syncControls() {
  $('budget').value = state.budget; $('share').value = state.share;
  $('oBudget').textContent = crore(state.budget);
  $('h1Budget').textContent = `₹${(state.budget / 100).toFixed(state.budget % 100 ? 1 : 0)} Cr`;
  $('oShare').textContent = `${Math.round(state.share * 100)}%`;
  $('risk').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.v === state.risk));
  $('shocks').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', state.shocks.has(x.dataset.id)));
}
function resetState() { Object.assign(state, DEFAULTS); state.shocks.clear(); }
function bindControls() {
  $('budget').oninput = e => { state.budget = +e.target.value; syncControls(); schedule(); };
  $('share').oninput = e => { state.share = +e.target.value; syncControls(); schedule(); };
  $('risk').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    state.risk = +b.dataset.v; syncControls(); schedule();
  };
  $('reset').onclick = () => { resetState(); syncControls(); schedule(); };
  syncControls();
}
let timer = null, frontierTimer = null, analysisTimer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(replan, engine.mode === 'api' ? 320 : 90); }

// ----------------------------------------------------------------- plan
async function replan() {
  const seq = ++state.seq;
  $('status').textContent = 'Re-planning…';
  let plan;
  try {
    plan = await engine.optimize({ budget_lakh: state.budget, risk_aversion: state.risk, max_share: state.share, shocks: [...state.shocks], simulations: 10000 });
  } catch (err) {
    $('status').textContent = 'The engine did not answer. Check the API and try again.'; console.error(err); return;
  }
  if (seq !== state.seq) return;
  state.plan = plan;
  const s = plan.summary, r = plan.risk;
  $('kSpend').textContent = inr(s.spent); $('kSpendSub').textContent = `of ${inr(s.budget)} budget · ${s.blocks} blocks`;
  $('kProfit').textContent = inr(s.expected_profit); $('kRoi').textContent = `${(s.roi * 100).toFixed(1)}% return on spend`;
  $('kP10').textContent = inr(r.p10); $('kCvar').textContent = inr(r.cvar5);
  $('kLoss').textContent = `${(r.prob_loss * 100).toFixed(1)}% chance of a loss`;
  $('kUplift').textContent = (s.uplift_vs_greedy >= 0 ? '+' : '') + inr(s.uplift_vs_greedy);
  const hotel = plan.picks.filter(p => p.kind === 'hotel').reduce((a, p) => a + p.cost, 0), flight = s.spent - hotel;
  $('alloc').innerHTML = `<i style="width:${hotel / s.budget * 100}%;background:var(--gold)"></i><i style="width:${flight / s.budget * 100}%;background:var(--blue)"></i>`;
  $('status').textContent = `${engine.mode === 'api' ? 'API' : 'Browser'} · ${plan.picks.length} blocks · ${new Date().toLocaleTimeString()}`;

  renderRows(); renderRisk(); renderSkips(); renderCalendar(); renderScenarios();
  clearTimeout(analysisTimer); analysisTimer = setTimeout(runAnalysis, engine.mode === 'api' ? 500 : 250);
  globe?.setPlan(plan);
  if (!state.block || !candById[state.block]) state.block = plan.picks[0]?.id ?? snap.candidates[0].id;
  renderDetail(state.block, false);
  clearTimeout(frontierTimer); frontierTimer = setTimeout(renderFrontier, 250);
}

function renderRows() {
  const plan = state.plan, by = plan.risk.by_block || {};
  $('rows').innerHTML = plan.picks.map(p => {
    const st = by[p.id]?.sell_through ?? 0;
    return `<tr data-id="${p.id}" aria-selected="${p.id === state.block}" tabindex="0">
      <td class="blk"><b>${esc(p.label)}</b><small>${esc(p.dest_name)} · <span class="pill ${p.kind === 'hotel' ? 'h' : 'f'}">${p.kind}</span> ${Math.round(p.fraction_of_optimum * 100)}% of Q*</small></td>
      <td>${esc(p.window)}</td>
      <td class="r num">${p.units.toLocaleString('en-IN')}</td>
      <td class="r num">${inr(p.cost)}</td>
      <td class="r num"><b>${inr(p.expected_profit)}</b></td>
      <td class="num">${p.buy_by === state.plan.plan_date ? '<b>Now</b>' : shortDate(p.buy_by)}</td>
      <td><span class="st"><i style="width:${Math.round(st * 60)}px"></i><span class="num">${Math.round(st * 100)}%</span></span></td></tr>`;
  }).join('') || `<tr><td colspan="7" class="muted">The budget is too small for any block. Raise it above ₹1 Cr.</td></tr>`;
  $('rows').querySelectorAll('tr[data-id]').forEach(tr => {
    const go = () => { renderDetail(tr.dataset.id, true); };
    tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } };
  });
}

async function renderDetail(id, focus) {
  state.block = id;
  $('rows').querySelectorAll('tr[data-id]').forEach(tr => tr.setAttribute('aria-selected', tr.dataset.id === id));
  if (state.plan && $('cal').innerHTML) { charts.calendarChart($('cal'), state.plan.picks, candById, snap.generated_for, id); $('cal').querySelectorAll('g[data-id]').forEach(g => { g.onclick = () => renderDetail(g.dataset.id, true); }); }
  const c = candById[id], pick = state.plan.picks.find(p => p.id === id), skip = state.plan.skipped.find(s => s.id === id);
  if (focus) globe?.focus(c.dest);
  globe?.select(c.dest);
  const box = $('detail');
  const sell = state.plan.risk.by_block?.[id]?.sell_through;
  box.innerHTML = `<div class="eyebrow">${pick ? 'In the plan' : 'Not in the plan'} · ${id}</div>
    <h3>${esc(c.label)}</h3>
    <div class="muted" style="font-size:.88rem">${esc(c.window)} · ${esc(c.dest_name)} · ${c.kind === 'hotel' ? 'room-nights' : 'seats'}</div>
    <div class="why">${esc(pick ? pick.explanation : skip?.explanation || '')}</div>
    <div class="chips">
      <div><small>Units</small><b>${pick ? pick.units.toLocaleString('en-IN') : '0'}</b></div>
      <div><small>Demand P50</small><b>${Math.round(c.mu).toLocaleString('en-IN')}</b></div>
      <div><small>Critical ratio</small><b>${c.critical_ratio.toFixed(2)}</b></div>
      <div><small>Sell-through</small><b>${sell != null ? Math.round(sell * 100) + '%' : '–'}</b></div>
    </div>
    <div class="cap"><b>Demand forecast · ${esc(c.dest_name)}</b><span>weekly room-nights, P10–P90 band</span></div>
    <svg class="chart" id="fcChart" viewBox="0 0 560 250" role="img" aria-label="Weekly demand history and forecast"></svg>
    <div class="cap"><b>Best day to buy</b><span>expected profit by days before arrival</span></div>
    <svg class="chart" id="tmChart" viewBox="0 0 560 210" role="img" aria-label="Expected profit by buy day"></svg>`;
  try {
    const [series, tm] = await Promise.all([
      forecastCache[c.dest] ?? (forecastCache[c.dest] = engine.forecast(c.dest)),
      engine.timing(id, [...state.shocks]),
    ]);
    if (state.block !== id) return;
    charts.forecastChart($('fcChart'), series, { start: c.start, end: c.end, short: c.label }, snap.generated_for);
    charts.timingChart($('tmChart'), tm);
  } catch (e) { console.error(e); }
}

function renderRisk() {
  const r = state.plan.risk;
  charts.histogram($('hist'), r);
  $('histCap').textContent = `${r.n.toLocaleString('en-IN')} simulated seasons`;
  $('rP10').textContent = inr(r.p10); $('rP50').textContent = inr(r.p50); $('rP90').textContent = inr(r.p90); $('rSd').textContent = inr(r.sd);
}
async function renderFrontier() {
  try {
    const pts = await engine.frontier(state.budget, [...state.shocks]);
    charts.frontierChart($('front'), pts, state.risk);
    const cur = pts.find(p => Math.abs(p.risk_aversion - state.risk) < 1e-9), bold = pts[0];
    if (cur && bold) {
      const giveUp = bold.expected_profit - cur.expected_profit, cut = bold.sd - cur.sd;
      $('frontNote').textContent = state.risk === 0
        ? 'Bold maximises expected profit and accepts the widest spread.'
        : `${RISK_NAMES[state.risk] ?? 'This setting'} gives up ${inr(Math.max(0, giveUp))} of expected profit to cut the spread by ${inr(Math.max(0, cut))} compared with Bold.`;
    }
  } catch (e) { console.error(e); }
}
function renderSkips() {
  const sk = state.plan.skipped;
  $('skipCap').textContent = `${sk.length} of ${snap.candidates.length}`;
  $('skips').innerHTML = sk.length ? sk.map(s => `<div><b>${esc(s.label)}</b> · ${esc(s.dest_name)}<br>${esc(s.explanation.replace(/^Skip [^:]+: /, ''))}</div>`).join('')
    : '<div>Every candidate block is in the plan at some size.</div>';
}
async function renderBacktest() {
  const bt = await engine.backtest();
  charts.backtestChart($('bt'), bt, Object.fromEntries(snap.destinations.map(d => [d.code, d.name])));
  $('btCap').textContent = `model ${(bt.model_wape * 100).toFixed(1)}% vs naive ${(bt.naive_wape * 100).toFixed(1)}% · ${(bt.coverage_p10_p90 * 100).toFixed(0)}% inside P10–P90`;
}

// ----------------------------------------------------------------- globe
function initGlobe(host) {
  if (typeof THREE === 'undefined' || !THREE.OrbitControls) throw new Error('three.js did not load');
  const R = 2;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0xffffff, 0);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100); camera.position.set(0, 1.1, 7.2);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enableZoom = false; controls.enablePan = false;
  controls.autoRotate = !reduce; controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { controls.autoRotate = false; });
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(5, 8, 7); scene.add(dl);
  const rim = new THREE.DirectionalLight(0xBFD0FF, 0.35); rim.position.set(-6, 2, -5); scene.add(rim);

  const earth = new THREE.Group(); scene.add(earth);
  const ll = (lat, lng, r = R) => { const p = (90 - lat) * Math.PI / 180, t = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t)); };
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 64, 48), new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xD9E1EE, shininess: 18 })));
  const N = 4200, pts = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i;
    pts.set([Math.cos(th) * r * R * 1.002, y * R * 1.002, Math.sin(th) * r * R * 1.002], i * 3); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  earth.add(new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xA7B4CB, size: 0.022 })));
  const gm = new THREE.LineBasicMaterial({ color: 0xCCD5E4, transparent: true, opacity: 0.8 });
  for (let lat = -60; lat <= 60; lat += 30) { const p = []; for (let l = 0; l <= 360; l += 6) p.push(ll(lat, l, R * 1.001)); earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), gm)); }
  for (let lng = 0; lng < 360; lng += 30) { const p = []; for (let la = -90; la <= 90; la += 6) p.push(ll(la, lng, R * 1.001)); earth.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), gm)); }
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 48, 32), new THREE.MeshBasicMaterial({ color: 0x2F5BD3, transparent: true, opacity: 0.05, side: THREE.BackSide })));

  function label(text, color = '#0F1B33', size = 0.11) {
    const c = document.createElement('canvas'), x = c.getContext('2d'), fs = 44;
    x.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`; const w = Math.ceil(x.measureText(text).width) + 26;
    c.width = w; c.height = fs + 20; x.font = `600 ${fs}px "IBM Plex Mono", ui-monospace, monospace`;
    x.fillStyle = 'rgba(255,255,255,.94)'; const rr = 12;
    x.beginPath(); x.moveTo(rr, 0); x.arcTo(w, 0, w, c.height, rr); x.arcTo(w, c.height, 0, c.height, rr); x.arcTo(0, c.height, 0, 0, rr); x.arcTo(0, 0, w, 0, rr); x.fill();
    x.fillStyle = color; x.textBaseline = 'middle'; x.fillText(text, 13, c.height / 2 + 2);
    const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(size * w / c.height, size, 1); return s;
  }

  for (const [code, h] of Object.entries(snap.hubs)) {
    const v = ll(h.lat, h.lng, R * 1.005);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0F1B33 })); m.position.copy(v); earth.add(m);
    const lb = label(code, '#0F1B33', 0.1); lb.position.copy(ll(h.lat, h.lng, R * 1.09)); earth.add(lb);
  }

  const maxP = Math.max(...snap.destinations.flatMap(d => d.monthly.map(m => m.p50)));
  const up = new THREE.Vector3(0, 1, 0), barGeo = new THREE.CylinderGeometry(0.042, 0.042, 1, 18); barGeo.translate(0, 0.5, 0);
  const ringGeo = new THREE.RingGeometry(0.07, 0.095, 32);
  const bars = snap.destinations.map(d => {
    const n = ll(d.lat, d.lng, 1).normalize(), base = n.clone().multiplyScalar(R);
    const mat = new THREE.MeshStandardMaterial({ color: 0xC5CEDD, roughness: 0.45, metalness: 0.05, emissive: 0x000000 });
    const mesh = new THREE.Mesh(barGeo, mat); mesh.position.copy(base); mesh.quaternion.setFromUnitVectors(up, n); mesh.userData.code = d.code; earth.add(mesh);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x0F1B33, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    ring.position.copy(n.clone().multiplyScalar(R * 1.003)); ring.lookAt(n.clone().multiplyScalar(3)); earth.add(ring);
    const lb = label(d.name, '#0F1B33', 0.085); earth.add(lb);
    return { d, n, mesh, ring, lb, h: 0.05, target: 0.05, spend: 0, kind: null };
  });
  const barByCode = Object.fromEntries(bars.map(b => [b.code = b.d.code, b]));

  // arcs and packets for bought destinations
  let arcs = new THREE.Group(); earth.add(arcs); let packets = [];
  function setPlan(plan) {
    earth.remove(arcs); arcs.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); arcs = new THREE.Group(); earth.add(arcs); packets = [];
    const spend = {}, kinds = {};
    for (const p of plan.picks) { spend[p.dest] = (spend[p.dest] || 0) + p.cost; (kinds[p.dest] ||= new Set()).add(p.kind); }
    const maxS = Math.max(1, ...Object.values(spend));
    for (const b of bars) {
      b.spend = spend[b.code] || 0;
      const k = kinds[b.code];
      b.mesh.material.color.setHex(!k ? 0xC5CEDD : k.has('hotel') ? 0xF2A922 : 0x2F5BD3);
      b.mesh.material.emissive.setHex(!k ? 0x000000 : k.has('hotel') ? 0x2a1700 : 0x05102a);
      if (!b.spend) continue;
      const hub = snap.hubs[b.d.hub], a = ll(hub.lat, hub.lng, R * 1.005), z = b.n.clone().multiplyScalar(R * 1.005);
      const mid = a.clone().add(z).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.005 + Math.max(0.15, a.distanceTo(z) * 0.42));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, z), w = b.spend / maxS;
      arcs.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.006 + 0.012 * w, 6, false),
        new THREE.MeshBasicMaterial({ color: k.has('hotel') ? 0xE39A0B : 0x2F5BD3, transparent: true, opacity: 0.35 + 0.4 * w })));
      const count = 1 + Math.round(w * 3);
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: 0x0F1B33 }));
        arcs.add(m); packets.push({ m, curve, t: i / count, sp: 0.22 + 0.1 * w });
      }
    }
  }
  function setMonthIdx(i) {
    for (const b of bars) b.target = 0.04 + 0.62 * b.d.monthly[i].p50 / maxP;
  }
  let selected = null;
  function select(code) {
    selected = code;
    for (const b of bars) b.ring.material.opacity = b.code === code ? 0.9 : 0;
  }
  let targetQ = null;
  function focus(code) {
    const b = barByCode[code]; if (!b) return;
    controls.autoRotate = false;
    const camDir = camera.position.clone().sub(controls.target).normalize();
    const cur = b.n.clone().applyQuaternion(earth.quaternion);
    targetQ = new THREE.Quaternion().setFromUnitVectors(cur, camDir).multiply(earth.quaternion);
  }
  // Start with India facing the viewer.
  earth.quaternion.setFromUnitVectors(ll(20, 78, 1).normalize(), new THREE.Vector3(0, 0.22, 1).normalize());

  // hover + click
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(), tip = $('gTip');
  let downAt = null;
  const pick = e => {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(bars.map(b => b.mesh))[0];
    return hit ? barByCode[hit.object.userData.code] : null;
  };
  renderer.domElement.addEventListener('pointermove', e => {
    const b = pick(e);
    if (!b) { tip.classList.remove('on'); renderer.domElement.style.cursor = 'grab'; return; }
    renderer.domElement.style.cursor = 'pointer';
    const r = renderer.domElement.getBoundingClientRect(), m = state.months[state.month].split('-').map(Number);
    tip.innerHTML = `<b>${esc(b.d.name)}</b>${MON[m[1] - 1]} demand ${b.d.monthly[state.month].p50.toLocaleString('en-IN')}<br>${b.spend ? 'Plan spends ' + inr(b.spend) : 'Not in the plan'}`;
    tip.style.left = `${e.clientX - r.left}px`; tip.style.top = `${e.clientY - r.top}px`; tip.classList.add('on');
  });
  renderer.domElement.addEventListener('pointerleave', () => tip.classList.remove('on'));
  renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
    const b = pick(e); if (!b) return;
    const inPlan = state.plan.picks.find(p => p.dest === b.code);
    const id = inPlan ? inPlan.id : snap.candidates.find(c => c.dest === b.code)?.id;
    if (id) { renderDetail(id, true); }
  });

  const fit = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.position.z = w / h < 1 ? 9.2 : 8.4; camera.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(host); fit();
  let visible = true;
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })).observe(host);

  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (visible) {
      for (const b of bars) {
        b.h += (b.target - b.h) * Math.min(1, dt * (reduce ? 60 : 5));
        b.mesh.scale.set(1, Math.max(0.01, b.h), 1);
        b.lb.position.copy(b.n.clone().multiplyScalar(R + b.h + 0.13));
        const facing = b.n.clone().applyQuaternion(earth.quaternion).dot(camera.position.clone().normalize());
        b.lb.visible = facing > 0.35;
      }
      for (const p of packets) { p.t = (p.t + dt * p.sp) % 1; p.m.position.copy(p.curve.getPoint(p.t)); }
      if (targetQ) { earth.quaternion.slerp(targetQ, Math.min(1, dt * 4)); if (earth.quaternion.angleTo(targetQ) < 0.002) targetQ = null; }
      controls.update(); renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  })(last);

  setMonthIdx(state.month);
  return { setPlan, setMonth: setMonthIdx, select, focus };
}

// ------------------------------------------------------------ command bar
const MONTH_WORDS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SHOCK_WORDS = [
  [/gulf|dubai|advisory/, 'gulf_advisory'], [/vietnam|visa|da ?nang/, 'vietnam_visa'],
  [/cyclone|storm|typhoon/, 'cyclone'], [/concert|stadium|bangkok/, 'bangkok_concert'], [/fuel|oil|jet/, 'fuel_spike'],
];
const toLakh = (n, unit) => /^l/.test(unit) ? n : n * 100;
const clampBudget = l => Math.max(100, Math.min(1500, Math.round(l / 10) * 10));

export function interpret(text) {
  const t = ` ${text.toLowerCase().replace(/[,;]+/g, ' , ')} `, said = [], fx = [];
  if (/\b(reset|start over|defaults?)\b/.test(t)) { fx.push(() => resetState()); said.push('Reset to defaults'); }
  const amt = '(\\d+(?:\\.\\d+)?)\\s*(cr|crore|crores|l|lakh|lakhs)\\b';
  const add = t.match(new RegExp(`(?:add|plus|\\+|increase(?: by)?|raise(?: by)?|more)\\s*₹?\\s*${amt}`));
  const cut = t.match(new RegExp(`(?:cut(?: by)?|minus|reduce(?: by)?|less|lower(?: by)?|remove)\\s*₹?\\s*${amt}`));
  const set = t.match(new RegExp(`₹?\\s*${amt}`)) || t.match(/budget\s*(?:of|to|=)?\s*₹?\s*(\d+(?:\.\d+)?)\b(?!\s*%)/);
  if (add) { const d = toLakh(+add[1], add[2]); fx.push(() => { state.budget = clampBudget(state.budget + d); }); said.push(`Budget +${crore(d)}`); }
  else if (cut) { const d = toLakh(+cut[1], cut[2]); fx.push(() => { state.budget = clampBudget(state.budget - d); }); said.push(`Budget −${crore(d)}`); }
  else if (set) {
    const n = +set[1], unit = set[2] || (n <= 15 ? 'cr' : 'l'), l = clampBudget(toLakh(n, unit));
    fx.push(() => { state.budget = l; }); said.push(`Budget ${crore(l)}`);
  }
  const risk = /very (careful|safe|cautious)/.test(t) ? 2 : /\b(careful|cautious|safe|conservative)\b/.test(t) ? 1
    : /\b(balanced|moderate|normal)\b/.test(t) ? 0.5 : /\b(bold|aggressive|risky|max(imum)? profit)\b/.test(t) ? 0 : null;
  if (risk !== null) { fx.push(() => { state.risk = risk; }); said.push(`Risk: ${RISK_NAMES[risk]}`); }
  const cap = t.match(/(\d{1,3})\s*%\s*(?:cap|share|max|per destination)|(?:cap|share|max(?:imum)?)\D{0,20}?(\d{1,3})\s*%/);
  if (cap) { const v = Math.max(15, Math.min(100, +(cap[1] || cap[2]))) / 100; fx.push(() => { state.share = Math.round(v * 20) / 20; }); said.push(`Cap ${Math.round(v * 100)}% per destination`); }
  if (/\b(no|clear|remove all|without any) shocks?\b|calm market/.test(t)) { fx.push(() => state.shocks.clear()); said.push('All shocks off'); }
  else for (const [re, id] of SHOCK_WORDS) {
    const m = t.match(re); if (!m) continue;
    const before = t.slice(Math.max(0, m.index - 24), m.index);
    const off = /\b(no|without|remove|clear|drop|undo|end|lift|cancel)\b[^,]*$/.test(before);
    const label = snap.shocks.find(s => s.id === id).label;
    fx.push(() => off ? state.shocks.delete(id) : state.shocks.add(id)); said.push(`${label} ${off ? 'off' : 'on'}`);
  }
  const mon = t.match(/\b(?:show|in|month|play)\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  let monthIdx = null;
  if (mon) { const mi = MONTH_WORDS.indexOf(mon[1]) + 1; monthIdx = state.months.findIndex(m => +m.split('-')[1] === mi); if (monthIdx >= 0) said.push(`Showing ${MON[mi - 1]}`); else monthIdx = null; }
  const why = t.match(/\b(?:why|explain|open|show)\s+([a-z][a-z ]+?)(?:\s*[,?.]|\s*$)/);
  let focusId = null;
  if (why) {
    const name = why[1].trim();
    const c = snap.candidates.find(c => c.dest_name.toLowerCase() === name || c.dest_name.toLowerCase().startsWith(name) || c.label.toLowerCase().includes(name));
    if (c) { focusId = c.id; said.push(`Opening ${c.dest_name}`); }
  }
  return { said, apply: () => fx.forEach(f => f()), monthIdx, focusId };
}

function bindAsk() {
  const examples = ['budget 12 crore, bold', 'gulf advisory and fuel spike', 'careful, cap 25%', 'cut 3 crore', 'show July', 'why Makkah', 'reset'];
  $('askChips').innerHTML = examples.map(e => `<button type="button">${esc(e)}</button>`).join('');
  $('askChips').onclick = e => { const b = e.target.closest('button'); if (b) { $('ask').value = b.textContent; run(); } };
  $('askForm').onsubmit = e => { e.preventDefault(); run(); };
  function run() {
    const text = $('ask').value.trim(); if (!text) return;
    const r = interpret(text);
    if (!r.said.length) {
      $('askOut').innerHTML = `<span class="no">I didn't catch that.</span> Try "budget 6 crore", "careful", "add Vietnam visa" or "show March".`;
      return;
    }
    r.apply(); syncControls();
    if (r.monthIdx !== null) setMonth(r.monthIdx);
    $('askOut').innerHTML = `<b>Done:</b> ${r.said.map(esc).join(' · ')}`;
    schedule();
    if (r.focusId) setTimeout(() => { renderDetail(r.focusId, true); $('buys').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }, 400);
  }
}

// ------------------------------------------------ calendar, alerts, CSV
const daysUntil = iso => Math.round((parse(iso) - parse(snap.generated_for)) / 864e5);
function renderCalendar() {
  const picks = state.plan.picks;
  charts.calendarChart($('cal'), picks, candById, snap.generated_for, state.block);
  $('cal').querySelectorAll('g[data-id]').forEach(g => { g.onclick = () => { renderDetail(g.dataset.id, true); renderCalendar(); }; });
  const sorted = picks.slice().sort((a, b) => daysUntil(a.buy_by) - daysUntil(b.buy_by));
  const now = sorted.filter(p => daysUntil(p.buy_by) <= 7), month = sorted.filter(p => daysUntil(p.buy_by) > 7 && daysUntil(p.buy_by) <= 45);
  const later = sorted.filter(p => daysUntil(p.buy_by) > 45).slice(0, 3);
  $('alertCap').textContent = `${now.length} due this week`;
  const item = (p, cls, tag) => `<button type="button" class="alert ${cls}" data-id="${p.id}"><i>${tag}</i><span><b>${esc(p.label)}</b> · ${p.units.toLocaleString('en-IN')} ${p.kind === 'hotel' ? 'room-nights' : 'seats'}<small>Sign by ${shortDate(p.buy_by)} · ${inr(p.cost)} · stay ${esc(p.window)}</small></span></button>`;
  $('alerts').innerHTML = [
    now.length ? now.map(p => item(p, 'now', 'THIS WEEK')).join('') : '<div class="alert" style="cursor:default">Nothing due this week.</div>',
    ...month.map(p => item(p, 'soon', `IN ${daysUntil(p.buy_by)}D`)),
    ...later.map(p => item(p, '', shortDate(p.buy_by).toUpperCase())),
  ].join('');
  $('alerts').querySelectorAll('button[data-id]').forEach(b => { b.onclick = () => { renderDetail(b.dataset.id, true); $('buys').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); }; });
}

function downloadCSV() {
  const cols = ['id', 'label', 'destination', 'kind', 'stay_window', 'units', 'cost_inr', 'expected_profit_inr', 'sell_price_inr', 'buy_by', 'explanation'];
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = state.plan.picks.map(p => [p.id, p.label, p.dest_name, p.kind, p.window, p.units, p.cost, p.expected_profit, p.sell_price, p.buy_by, p.explanation].map(q).join(','));
  const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `atlas-plan-${state.budget}L-${RISK_NAMES[state.risk].toLowerCase().replace(' ', '-')}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  $('csvNote').textContent = `${rows.length} rows exported`;
}

// --------------------------------------------- sensitivity and replay
async function runAnalysis() {
  const req = { budget_lakh: state.budget, risk_aversion: state.risk, max_share: state.share, shocks: [...state.shocks] };
  const seq = state.seq;
  try {
    const sens = await engine.sensitivity(req);
    if (seq !== state.seq) return;
    charts.tornadoChart($('tornado'), sens);
    const top = sens.factors[0], least = sens.factors[sens.factors.length - 1];
    $('tornadoNote').textContent = `${top.label} is the biggest lever: moving it from ${top.low_label} to ${top.high_label} swings profit by ${inr(top.swing)}. ${least.label} barely matters (${inr(least.swing)}), because the plan already holds a buffer against it.`;
  } catch (e) { console.error(e); }
  await runReplay(req, seq);
}
let raceFrame = null;
async function runReplay(req, seq = state.seq) {
  req ||= { budget_lakh: state.budget, risk_aversion: state.risk, max_share: state.share, shocks: [...state.shocks] };
  $('raceStatus').textContent = 'Simulating…';
  let rep;
  try { rep = await engine.replay(req, state.seed); } catch (e) { $('raceStatus').textContent = 'Replay failed.'; console.error(e); return; }
  if (seq !== state.seq) return;
  const ranked = rep.policies.slice().sort((a, b) => b.final - a.final), atlas = rep.policies.find(p => p.id === 'atlas');
  const place = ['first', 'second', 'third'][ranked.findIndex(p => p.id === 'atlas')];
  $('raceTitle').textContent = `Season #${rep.seed}`;
  $('raceSub').textContent = `${rep.market >= 0 ? 'Strong' : 'Soft'} travel market · Atlas finished ${place}`;
  $('raceStatus').textContent = `Atlas sold ${(atlas.sell_through * 100).toFixed(1)}% of what it bought`;
  cancelAnimationFrame(raceFrame);
  const t0 = performance.now(), dur = reduce ? 0 : 2600;
  const step = now => { const p = dur ? Math.min(1, (now - t0) / dur) : 1; charts.raceChart($('race'), rep, p); if (p < 1) raceFrame = requestAnimationFrame(step); };
  raceFrame = requestAnimationFrame(step);
  const colors = { atlas: 'var(--gold)', greedy: 'var(--blue)', last_year: 'var(--violet)' };
  $('score').innerHTML = rep.policies.map(p => `<div><i style="--c:${colors[p.id]}"></i><span><b>${esc(p.label)}</b><small>average ${inr(p.avg_final)} · bad season ${inr(p.p10_final)}</small></span><strong>${Math.round(p.win_rate * 100)}%</strong></div>`).join('')
    + `<p class="muted" style="font-size:.82rem;margin:0">${scoreNote(rep.policies)}</p>`;
  const surprises = rep.blocks.filter(b => b.atlas_units > 0).sort((a, b) => Math.abs(b.surprise) - Math.abs(a.surprise)).slice(0, 4);
  $('surprises').innerHTML = surprises.map(b => `<div><span>${esc(b.label)}</span><span class="${b.surprise >= 0 ? 'up' : 'down'}">${b.surprise >= 0 ? '+' : '−'}${Math.abs(Math.round(b.surprise * 100))}% vs forecast</span></div>`).join('');
}
function scoreNote(ps) {
  const a = ps.find(p => p.id === 'atlas'), others = ps.filter(p => p.id !== 'atlas');
  const bestAvg = others.reduce((m, p) => p.avg_final > m.avg_final ? p : m, others[0]);
  const topWin = ps.reduce((m, p) => p.win_rate > m.win_rate ? p : m, ps[0]);
  if (a.avg_final >= bestAvg.avg_final) return `Percentages are how often each plan finishes first. Atlas earns the most on average and ${a.p10_final >= Math.max(...others.map(p => p.p10_final)) ? 'has the best bad season too' : 'stays competitive in bad seasons'}${topWin.id !== 'atlas' ? `; ${topWin.label.toLowerCase()} wins more often, but only by small margins in lucky seasons` : ''}.`;
  return `At this budget ${bestAvg.label.toLowerCase()} earns ${inr(bestAvg.avg_final - a.avg_final)} more on average, but Atlas ${a.p10_final >= bestAvg.p10_final ? 'protects the bad season better' : 'is set to trade profit for safety'}. Choose Bold to chase the average.`;
}

// ----------------------------------------------------------- scenarios
const SKEY = 'atlas.scenarios';
let memScenarios = [];
const loadScenarios = () => { try { return JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (_) { return memScenarios; } };
const storeScenarios = list => { memScenarios = list; try { localStorage.setItem(SKEY, JSON.stringify(list)); } catch (_) { /* private mode */ } };
function snapshotScenario(name) {
  const p = state.plan;
  return { id: Date.now().toString(36), name, req: { budget: state.budget, risk: state.risk, share: state.share, shocks: [...state.shocks] },
    s: { spent: p.summary.spent, profit: p.summary.expected_profit, roi: p.summary.roi, blocks: p.summary.blocks, uplift: p.summary.uplift_vs_greedy },
    r: { p10: p.risk.p10, cvar5: p.risk.cvar5, loss: p.risk.prob_loss }, units: Object.fromEntries(p.picks.map(x => [x.id, x.units])) };
}
function renderScenarios() {
  const list = loadScenarios(), cur = snapshotScenario('Current');
  const cols = [cur, ...list];
  if (!list.length) {
    $('scnBox').innerHTML = `<div class="empty-box">No saved scenarios yet. Press <b>Save scenario</b> under the controls, change something (try a shock or a new budget), and the comparison appears here.</div>`;
    return;
  }
  const shockNames = ids => ids.length ? ids.map(id => snap.shocks.find(s => s.id === id)?.label.split(' ')[0]).join(', ') : 'none';
  const best = (vals, hi = true) => { const m = hi ? Math.max(...vals) : Math.min(...vals); return vals.map(v => v === m); };
  const row = (label, f, fmt, hi) => { const v = cols.map(f), b = hi === undefined ? v.map(() => false) : best(v, hi);
    return `<tr><th>${label}</th>${v.map((x, i) => `<td class="r num ${i === 0 ? 'cur' : ''} ${b[i] ? 'best' : ''}">${fmt(x)}</td>`).join('')}</tr>`; };
  const diff = sc => { const a = Object.keys(cur.units).filter(k => !(k in sc.units)).length, d = Object.keys(sc.units).filter(k => !(k in cur.units)).length;
    let ch = 0; for (const k in cur.units) if (k in sc.units && sc.units[k] !== cur.units[k]) ch++; return a + d + ch ? `${a} added · ${d} dropped · ${ch} resized` : 'same blocks'; };
  $('scnBox').innerHTML = `<table><thead><tr><th></th>${cols.map((c, i) => `<th class="r ${i === 0 ? 'cur' : ''}">${esc(c.name)}${i ? `<br><button class="mini" data-load="${c.id}">Load</button><button class="mini del" data-del="${c.id}">Delete</button>` : ''}</th>`).join('')}</tr></thead><tbody>
    ${row('Budget', c => c.req.budget, v => crore(v))}
    ${row('Risk appetite', c => RISK_NAMES[c.req.risk], v => v)}
    ${row('Shocks', c => shockNames(c.req.shocks), v => esc(v))}
    ${row('Blocks', c => c.s.blocks, v => v)}
    ${row('Spend', c => c.s.spent, inr)}
    ${row('Expected profit', c => c.s.profit, inr, true)}
    ${row('Return on spend', c => c.s.roi, v => `${(v * 100).toFixed(1)}%`, true)}
    ${row('Bad season (P10)', c => c.r.p10, inr, true)}
    ${row('Worst 5% average', c => c.r.cvar5, inr, true)}
    ${row('Chance of a loss', c => c.r.loss, v => `${(v * 100).toFixed(1)}%`, false)}
    <tr><th>Versus current</th>${cols.map((c, i) => `<td class="r ${i === 0 ? 'cur' : ''}">${i ? diff(c) : '–'}</td>`).join('')}</tr>
  </tbody></table>`;
  $('scnBox').querySelectorAll('[data-load]').forEach(b => { b.onclick = () => {
    const sc = list.find(x => x.id === b.dataset.load); if (!sc) return;
    Object.assign(state, { budget: sc.req.budget, risk: sc.req.risk, share: sc.req.share }); state.shocks = new Set(sc.req.shocks);
    syncControls(); schedule(); }; });
  $('scnBox').querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { storeScenarios(list.filter(x => x.id !== b.dataset.del)); renderScenarios(); }; });
}
function saveScenario() {
  const list = loadScenarios();
  const letter = 'ABCDEFGH'[list.length % 8];
  const tag = [crore(state.budget), RISK_NAMES[state.risk], ...[...state.shocks].map(id => snap.shocks.find(s => s.id === id).label.split(' ')[0])].join(' · ');
  list.push(snapshotScenario(`${letter}: ${tag}`));
  while (list.length > 4) list.shift();
  storeScenarios(list); renderScenarios();
  $('status').textContent = `Saved scenario ${letter}. Change something to compare.`;
}

function bindFeatures() {
  $('csv').onclick = downloadCSV;
  $('saveScn').onclick = saveScenario;
  $('replayBtn').onclick = () => { state.seed += 1; runReplay(); };
}

boot();
