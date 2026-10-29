// Landing page: live numbers from the model snapshot, an auto-playing demand globe,
// and a small in-page planner that runs the real engine.
import { connect } from './api.js';
import { inr } from './engine.js';
import * as charts from './charts.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RISK = { 0: 'Bold', 0.5: 'Balanced', 1: 'Careful' };
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const inWords = n => n <= 20 ? WORDS[n] : n < 100 ? `${['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'][Math.floor(n / 10)]}${n % 10 ? '-' + WORDS[n % 10] : ''}` : String(n);
let engine, snap, globe;

async function boot() {
  const intro = document.documentElement.classList.contains('intro-pending') ? startIntro() : null;
  try { ({ engine, snapshot: snap } = await connect()); } catch (e) { console.error(e); finishIntro(); return; }
  if (intro) await intro(snap); else document.documentElement.classList.add('intro-done');
  fillNumbers();
  try { globe = initGlobe($('globe')); globe.enter(); } catch (e) { console.error(e); }
  bindTry(); runTry();
  charts.backtestChart($('bt'), snap.backtest, Object.fromEntries(snap.destinations.map(d => [d.code, d.name])));
  $('btCap').textContent = `model ${(snap.backtest.model_wape * 100).toFixed(1)}% vs naive ${(snap.backtest.naive_wape * 100).toFixed(1)}%`;
  runScore();
}

// ------------------------------------------------------------ opening sequence
let introDone = null;
function startIntro() {
  const el = $('intro'), arc = $('introArc'), plane = $('introPlane'), bar = $('introBar'), cap = $('introCap');
  const len = arc.getTotalLength(), t0 = performance.now();
  let raf;
  const fly = now => {
    const p = Math.min(1, (now - t0) / 2100), e = 1 - (1 - p) ** 2, pt = arc.getPointAtLength(e * len);
    plane.setAttribute('cx', pt.x); plane.setAttribute('cy', pt.y);
    arc.style.strokeDashoffset = `${-e * 60}`;
    bar.style.width = `${e * 100}%`;
    if (p < 1) raf = requestAnimationFrame(fly);
  };
  raf = requestAnimationFrame(fly);
  const done = new Promise(res => { introDone = res; });
  const skip = () => finishIntro();
  el.addEventListener('click', skip, { once: true });
  addEventListener('keydown', e => { if (e.key === 'Escape') skip(); }, { once: true });
  return async data => {
    const daily = data.datasets?.find(d => d.file === 'daily_history.csv');
    const steps = [
      `Reading <b>${daily ? daily.rows.toLocaleString('en-IN') : 'two years of'}</b> days of history`,
      `Forecasting <b>${data.destinations.length}</b> destinations`,
      `Sizing <b>${data.candidates.length}</b> inventory blocks`,
      `Simulating <b>10,000</b> seasons`,
      `Plan ready: <b>${inr(data.default_plan.summary.expected_profit)}</b> expected profit`,
    ];
    for (const [i, s] of steps.entries()) {
      if (!document.documentElement.classList.contains('intro-pending')) break;
      cap.innerHTML = s;
      await new Promise(r => setTimeout(r, i === steps.length - 1 ? 520 : 330));
    }
    cancelAnimationFrame(raf);
    finishIntro();
    return done;
  };
}
function finishIntro() {
  const el = $('intro'), root = document.documentElement;
  if (!root.classList.contains('intro-pending')) { introDone?.(); return; }
  try { sessionStorage.setItem('atlas.intro', '1'); } catch (_) { /* private mode */ }
  el.classList.add('out');
  root.classList.add('intro-done');
  setTimeout(() => { root.classList.remove('intro-pending'); introDone?.(); }, 420);
}

// ------------------------------------------------------------ numbers
function countUp(el, to, fmt) {
  if (reduce) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1200;
  const step = now => { const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3; el.textContent = fmt(to * e); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function fillNumbers() {
  $('nDest').textContent = inWords(snap.destinations.length);
  const plan = snap.default_plan, s = plan.summary, r = plan.risk, bt = snap.backtest;
  const q = sel => document.querySelector(`[data-count="${sel}"]`);
  countUp(q('expected_profit'), s.expected_profit, inr);
  countUp(q('wape'), bt.model_wape * 100, v => `${v.toFixed(1)}%`);
  q('wape').nextElementSibling.textContent = `forecast error, vs ${(bt.naive_wape * 100).toFixed(1)}% for last year + growth`;
  countUp(q('uplift'), s.uplift_vs_greedy, v => `+${inr(v)}`);
  countUp(q('loss'), r.prob_loss * 100, v => `${v.toFixed(1)}%`);

  const ds = snap.destinations, w = ds.reduce((a, d) => a + d.last_year, 0);
  const sold = ds.reduce((a, d) => a + d.sellout_share * d.last_year, 0) / w;
  $('pSold').textContent = `${(sold * 100).toFixed(1)}%`;
  const goa = snap.candidates.find(c => c.id === 'GOI-NYE');
  $('pUnsold').textContent = inr(goa.cost - goa.salvage);
  const rate = L => 1 + 0.42 * Math.exp(-L / 26) + 0.07 * Math.max(0, L - 120) / 120;
  $('pRate').textContent = `+${Math.round((rate(7) / rate(60) - 1) * 100)}%`;

  const planDate = Date.parse(snap.generated_for + 'T00:00:00Z');
  const due = plan.picks.filter(p => (Date.parse(p.buy_by + 'T00:00:00Z') - planDate) / 864e5 <= 7).length;
  $('h1').textContent = `${(bt.model_wape * 100).toFixed(1)}% error on unseen weeks`;
  $('h2').textContent = `${snap.candidates.length} candidate blocks sized`;
  $('h3').textContent = `${due} contracts to sign this week`;
  $('h4').textContent = `+${inr(s.uplift_vs_greedy)} vs a simple rule`;
  $('h5').textContent = `bad season ${inr(r.p10)}`;
}

// ------------------------------------------------------------ try it
const tState = { budget: 800, risk: 0.5, seq: 0 };
function bindTry() {
  let t = null;
  $('tBudget').oninput = e => { tState.budget = +e.target.value; $('oBudget').textContent = `₹${(tState.budget / 100).toFixed(2)} Cr`; clearTimeout(t); t = setTimeout(runTry, 80); };
  $('tRisk').onclick = e => { const b = e.target.closest('button'); if (!b) return;
    $('tRisk').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); tState.risk = +b.dataset.v; runTry(); };
}
async function runTry() {
  const seq = ++tState.seq;
  const plan = await engine.optimize({ budget_lakh: tState.budget, risk_aversion: tState.risk, max_share: 0.35, shocks: [], simulations: 3000 });
  if (seq !== tState.seq) return;
  const s = plan.summary;
  $('tProfit').textContent = inr(s.expected_profit); $('tSpend').textContent = inr(s.spent);
  $('tP10').textContent = inr(plan.risk.p10); $('tBlocks').textContent = s.blocks;
  $('tPicks').innerHTML = plan.picks.slice(0, 3).map((p, i) => `<div class="pick"><i>${i + 1}</i><span><b>${esc(p.label)}</b><small>${p.units.toLocaleString('en-IN')} ${p.kind === 'hotel' ? 'room-nights' : 'seats'} · ${esc(p.window)} · ${inr(p.cost)}</small></span><strong>+${inr(p.expected_profit)}</strong><p>${esc(p.explanation.split('. ').slice(1, 3).join('. '))}.</p></div>`).join('')
    + (plan.picks.length > 3 ? `<div class="muted small">…and ${plan.picks.length - 3} more blocks in the full plan.</div>` : '');
  $('openPlan').href = `planner.html?budget=${tState.budget}&risk=${tState.risk}`;
  $('openPlan').textContent = `Open this ${RISK[tState.risk].toLowerCase()} ₹${(tState.budget / 100).toFixed(tState.budget % 100 ? 1 : 0)} Cr plan in the full planner`;
}

// ------------------------------------------------------------ proof
async function runScore() {
  try {
    const rep = await engine.replay({ budget_lakh: 800, risk_aversion: 0.5, max_share: 0.35, shocks: [] }, 1);
    const colors = { atlas: 'var(--gold)', greedy: 'var(--blue)', last_year: 'var(--violet)' };
    $('score').innerHTML = rep.policies.map(p => `<div><i style="--c:${colors[p.id]}"></i><span><b>${esc(p.label)}</b><small>average ${inr(p.avg_final)} · bad season ${inr(p.p10_final)}</small></span><strong>${Math.round(p.win_rate * 100)}%</strong></div>`).join('');
    const a = rep.policies.find(p => p.id === 'atlas'), g = rep.policies.find(p => p.id === 'greedy');
    $('scoreNote').textContent = `Same budget, same seasons. Atlas averages ${inr(a.avg_final - g.avg_final)} more than the simple rule and its bad season is ${inr(a.p10_final - g.p10_final)} better.`;
  } catch (e) { console.error(e); }
}

// ------------------------------------------------------------ globe
function initGlobe(host) {
  if (typeof THREE === 'undefined' || !THREE.OrbitControls) throw new Error('three.js did not load');
  const R = 2, renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0xffffff, 0);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 1.2, 8.2);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enableZoom: false, enablePan: false, autoRotate: !reduce, autoRotateSpeed: 0.5 });
  scene.add(new THREE.AmbientLight(0xffffff, 0.72));
  const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(5, 8, 7); scene.add(dl);
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
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 48, 32), new THREE.MeshBasicMaterial({ color: 0x2F5BD3, transparent: true, opacity: 0.05, side: THREE.BackSide })));
  for (const h of Object.values(snap.hubs)) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), new THREE.MeshBasicMaterial({ color: 0x0F1B33 })); m.position.copy(ll(h.lat, h.lng, R * 1.005)); earth.add(m); }

  const plan = snap.default_plan, kinds = {}, spend = {};
  for (const p of plan.picks) { (kinds[p.dest] ||= new Set()).add(p.kind); spend[p.dest] = (spend[p.dest] || 0) + p.cost; }
  const maxP = Math.max(...snap.destinations.flatMap(d => d.monthly.map(m => m.p50))), maxS = Math.max(...Object.values(spend));
  const up = new THREE.Vector3(0, 1, 0), geo = new THREE.CylinderGeometry(0.045, 0.045, 1, 18); geo.translate(0, 0.5, 0);
  const bars = snap.destinations.map(d => {
    const n = ll(d.lat, d.lng, 1).normalize(), k = kinds[d.code];
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: !k ? 0xC5CEDD : k.has('hotel') ? 0xF2A922 : 0x2F5BD3, roughness: 0.45, emissive: k ? 0x1a1000 : 0 }));
    mesh.position.copy(n.clone().multiplyScalar(R)); mesh.quaternion.setFromUnitVectors(up, n); earth.add(mesh);
    return { d, mesh, h: 0.05, target: 0.05 };
  });
  const packets = [];
  for (const d of snap.destinations) {
    if (!spend[d.code]) continue;
    const hub = snap.hubs[d.hub], a = ll(hub.lat, hub.lng, R * 1.005), z = ll(d.lat, d.lng, R * 1.005), w = spend[d.code] / maxS;
    const mid = a.clone().add(z).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.005 + Math.max(0.15, a.distanceTo(z) * 0.42));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, z);
    earth.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.006 + 0.012 * w, 6, false), new THREE.MeshBasicMaterial({ color: kinds[d.code].has('hotel') ? 0xE39A0B : 0x2F5BD3, transparent: true, opacity: 0.35 + 0.4 * w })));
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), new THREE.MeshBasicMaterial({ color: 0x0F1B33 })); earth.add(m);
    packets.push({ m, curve, t: Math.random(), sp: 0.22 + 0.15 * w });
  }
  earth.quaternion.setFromUnitVectors(ll(20, 78, 1).normalize(), new THREE.Vector3(0, 0.2, 1).normalize());

  const arcs = earth.children.filter(o => o.geometry && o.geometry.type === 'TubeGeometry');
  arcs.forEach(a => a.geometry.setDrawRange(0, 0));
  let entering = null;
  const enter = () => { entering = performance.now(); };
  earth.scale.setScalar(reduce ? 1 : 0.35);
  const restQ = earth.quaternion.clone();
  const months = snap.destinations[0].monthly.map(m => m.month);
  let mi = 1, last = performance.now(), acc = 0;
  const setMonth = i => { mi = i; const [y, m] = months[i].split('-').map(Number); $('gMonth').textContent = `${MON[m - 1]} ${y}`;
    for (const b of bars) b.target = 0.04 + 0.7 * b.d.monthly[i].p50 / maxP; };
  setMonth(mi);
  const fit = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(host); fit();
  let visible = true; new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; })).observe(host);
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (entering !== null) {
      const p = Math.min(1, (now - entering) / 1600), e = 1 - (1 - p) ** 3;
      earth.scale.setScalar(0.35 + 0.65 * e);
      earth.quaternion.copy(restQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (1 - e) * -2.2));
      const draw = Math.min(1, Math.max(0, (now - entering - 500) / 1400));
      arcs.forEach(a => a.geometry.setDrawRange(0, Math.floor(a.geometry.index.count * draw / 3) * 3));
      if (p >= 1 && draw >= 1) entering = null;
    }
    if (visible) {
      acc += dt; if (!reduce && acc > 1.8) { acc = 0; setMonth((mi + 1) % months.length); }
      for (const b of bars) { b.h += (b.target - b.h) * Math.min(1, dt * (reduce ? 60 : 4)); b.mesh.scale.set(1, Math.max(0.01, b.h), 1); }
      for (const p of packets) { p.t = (p.t + dt * p.sp) % 1; p.m.position.copy(p.curve.getPoint(p.t)); }
      controls.update(); renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  })(last);
  return { enter: () => (reduce ? arcs.forEach(a => a.geometry.setDrawRange(0, Infinity)) : enter()) };
}

boot();
