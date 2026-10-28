// Connects the UI to an engine: the live FastAPI service when reachable,
// otherwise the in-browser engine running on the exported model snapshot.
//
// Point the site at an API with ?api=https://your-host  (remembered per browser)
// or by setting window.ATLAS_API before this module loads. ?api=off forgets it.
import { createLocalEngine } from './engine.js';

const KEY = 'atlas.api';

function configuredBase() {
  const q = new URLSearchParams(location.search).get('api');
  try {
    if (q === 'off') { localStorage.removeItem(KEY); return null; }
    if (q) { localStorage.setItem(KEY, q); return q.replace(/\/$/, ''); }
    const saved = localStorage.getItem(KEY);
    if (saved) return saved.replace(/\/$/, '');
  } catch (_) { /* storage blocked */ if (q && q !== 'off') return q.replace(/\/$/, ''); }
  if (window.ATLAS_API) return String(window.ATLAS_API).replace(/\/$/, '');
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'http://localhost:8000';
  return null;
}

async function fetchJSON(url, opts = {}, timeout = 15000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

function remoteEngine(base, health) {
  const qs = shocks => shocks.map(s => `shocks=${encodeURIComponent(s)}`).join('&');
  return {
    mode: 'api', base, version: health.version, planDate: health.plan_date,
    destinations: () => fetchJSON(`${base}/api/destinations`),
    forecast: dest => fetchJSON(`${base}/api/forecast/${dest}`),
    backtest: () => fetchJSON(`${base}/api/backtest`, {}, 60000),
    shocks: () => fetchJSON(`${base}/api/shocks`),
    candidates: (shocks = []) => fetchJSON(`${base}/api/candidates?${qs(shocks)}`),
    optimize: req => fetchJSON(`${base}/api/optimize`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) }),
    timing: (id, shocks = []) => fetchJSON(`${base}/api/timing/${id}?${qs(shocks)}`),
    frontier: (budget, shocks = []) => fetchJSON(`${base}/api/frontier?budget_lakh=${budget}&${qs(shocks)}`, {}, 30000),
  };
}

export async function connect(snapshotUrl = 'data/atlas.json') {
  const snapshot = fetchJSON(snapshotUrl, {}, 20000);
  const base = configuredBase();
  if (base) {
    try {
      const health = await fetchJSON(`${base}/health`, {}, 2500);
      if (health.status === 'ok') return { engine: remoteEngine(base, health), snapshot: await snapshot };
    } catch (_) { /* fall back */ }
  }
  const data = await snapshot;
  const engine = createLocalEngine(data);
  engine.version = data.version;
  return { engine, snapshot: data, apiTried: base };
}
