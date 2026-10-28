// Parity test: the browser engine must reproduce the Python optimiser's plan.
// Run: node frontend/tests/engine.test.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalEngine, normPpf, pyRound } from '../assets/js/engine.js';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '..', 'data', 'atlas.json'), 'utf8'));
const engine = createLocalEngine(data);
let failures = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failures++; };

check('normPpf(0.975) ≈ 1.95996', Math.abs(normPpf(0.975) - 1.959964) < 1e-5);
check('pyRound half-to-even', pyRound(18.5) === 18 && pyRound(19.5) === 20 && pyRound(2.675, 2) === 2.67 || pyRound(2.675, 2) === 2.68);

const py = data.default_plan;
const js = engine._sync.optimize(py.request);
const pyUnits = Object.fromEntries(py.picks.map(p => [p.id, p.units]));
const jsUnits = Object.fromEntries(js.picks.map(p => [p.id, p.units]));
check('same blocks chosen', JSON.stringify(Object.keys(pyUnits).sort()) === JSON.stringify(Object.keys(jsUnits).sort()));
check('same quantities', Object.keys(pyUnits).every(k => pyUnits[k] === jsUnits[k]), JSON.stringify(jsUnits));
const rel = Math.abs(js.summary.objective - py.summary.objective) / py.summary.objective;
check('objective within 0.1%', rel < 1e-3, `py ${py.summary.objective} js ${js.summary.objective}`);
check('spend identical', js.summary.spent === py.summary.spent, `py ${py.summary.spent} js ${js.summary.spent}`);
check('greedy baseline within 0.1%', Math.abs(js.summary.greedy_objective - py.summary.greedy_objective) / py.summary.greedy_objective < 1e-3);
check('buy-by dates match', py.picks.every(p => js.picks.find(q => q.id === p.id)?.buy_by === p.buy_by));
const mcRel = Math.abs(js.risk.mean - py.risk.mean) / py.risk.mean;
check('Monte Carlo mean within 1%', mcRel < 0.01, `py ${py.risk.mean} js ${js.risk.mean}`);

const shocked = engine._sync.optimize({ ...py.request, shocks: ['gulf_advisory'] });
const dxb = plan => plan.picks.filter(p => p.dest === 'DXB').reduce((s, p) => s + p.cost, 0);
check('gulf advisory moves money out of Dubai', dxb(shocked) < dxb(js));

const t0 = Date.now(); engine._sync.optimize({ budget_lakh: 1500, simulations: 10000 });
check('re-plan under 1.5 s', Date.now() - t0 < 1500, `${Date.now() - t0} ms`);

if (failures) { console.error(`${failures} check(s) failed`); process.exit(1); }
console.log('browser engine matches the Python optimiser');
