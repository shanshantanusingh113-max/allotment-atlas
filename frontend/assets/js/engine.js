// Allotment Atlas browser engine.
// A faithful port of backend/atlas/{optimize,risk,explain}. It runs on the
// snapshot in data/atlas.json (forecasts made by the Python model) so the
// site works on static hosting. When the API is reachable, api.js uses it instead.

export const LAKH = 100000;
export const OPTION_FRACTIONS = [0, 0.25, 0.5, 0.75, 1.0, 1.25];
const Z90 = 1.2816;
const GLOBAL_CORRELATION = 0.15, REGION_CORRELATION = 0.35, DEST_CORRELATION = 0.25;

// ---------------------------------------------------------------- maths
export function normPpf(p) {
  // Acklam's rational approximation, |rel err| < 1.2e-9
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5])/((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q/(((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
const GRID = Float64Array.from({ length: 800 }, (_, i) => normPpf((i + 0.5) / 800));

/** Python's round(): half to even. */
export function pyRound(x, nd = 0) {
  const m = 10 ** nd, v = x * m, f = Math.floor(v), diff = v - f;
  let r;
  if (Math.abs(diff - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1; else r = Math.round(v);
  return r / m;
}

function mulberry32(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normals(rng, n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    let u = 0; while (u === 0) u = rng(); const v = rng();
    const r = Math.sqrt(-2 * Math.log(u)), t = 2 * Math.PI * v;
    out[i] = r * Math.cos(t); if (i + 1 < n) out[i + 1] = r * Math.sin(t);
  }
  return out;
}
function percentile(sorted, q) {
  const pos = (sorted.length - 1) * q / 100, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ------------------------------------------------------------ newsvendor
export function criticalRatio(p, c, s) { return p <= s ? 0 : Math.min(1, Math.max(0, (p - c) / (p - s))); }
export function optimalQuantity(mu, sd, p, c, s) {
  let cr = criticalRatio(p, c, s); if (cr <= 0) return 0; cr = Math.min(cr, 0.999);
  return Math.max(0, mu + sd * normPpf(cr));
}
export function evaluate(q, mu, sd, p, c, s) {
  let sum = 0, sum2 = 0, soldSum = 0, dSum = 0, stock = 0, loss = 0; const n = GRID.length;
  for (let i = 0; i < n; i++) {
    const d = Math.max(0, mu + sd * GRID[i]), sold = Math.min(d, q);
    const pr = p * sold + s * (q - sold) - c * q;
    sum += pr; sum2 += pr * pr; soldSum += sold; dSum += d; if (d > q) stock++; if (pr < 0) loss++;
  }
  const mean = sum / n, es = soldSum / n;
  return { quantity: q, expected_profit: mean, profit_sd: Math.sqrt(Math.max(0, sum2 / n - mean * mean)),
    expected_sold: es, sell_through: q > 0 ? es / q : 0, fill_rate: es / Math.max(1e-9, dSum / n),
    stockout_prob: stock / n, loss_prob: loss / n };
}

// ---------------------------------------------------------------- timing
const rateMult = L => 1 + 0.42 * Math.exp(-L / 26) + 0.07 * Math.max(0, L - 120) / 120;
const sigmaMult = (L, ref) => Math.sqrt((25 + L) / (25 + Math.max(1, ref)));
const availability = L => 1 - 0.82 * Math.exp(-L / 38);
export function timingCurve(mu, sd, p, baseCost, s, ref, step = 3) {
  const base = baseCost / rateMult(60), points = [];
  for (let L = 7; L <= ref; L += step) {
    const c = base * rateMult(L), sg = sd * sigmaMult(L, ref), q = optimalQuantity(mu, sg, p, c, s);
    const o = evaluate(q, mu, sg, p, c, s);
    points.push({ lead_days: L, rate: pyRound(c), sigma: pyRound(sg, 1), availability: pyRound(availability(L), 3),
      quantity: pyRound(q), expected_profit: pyRound(availability(L) * o.expected_profit) });
  }
  let best = null; for (const pt of points) if (!best || pt.expected_profit > best.expected_profit) best = pt;
  return { points, best };
}

// ------------------------------------------------------------- portfolio
const costLakh = o => Math.ceil(o.cost / LAKH - 1e-9);

export function buildChoices(cands) {
  return cands.map(c => {
    const options = [];
    for (const f of OPTION_FRACTIONS) {
      const units = pyRound(c.q_star * f / 10) * 10;
      if (f > 0 && units < 10) continue;
      const o = evaluate(units, c.mu, c.sigma, c.price, c.cost, c.salvage);
      options.push({ fraction: f, units, cost: units * c.cost, expected_profit: o.expected_profit, profit_sd: o.profit_sd });
    }
    return { block_id: c.id, dest: c.dest, options };
  });
}

export function solve(choices, budgetLakh, lam = 0.5, maxShare = 0.35) {
  const B = Math.max(0, Math.floor(budgetLakh));
  const cap = maxShare < 1 ? Math.floor(maxShare * B + 1e-9) : B;
  const groups = new Map();
  for (const ch of choices) { if (!groups.has(ch.dest)) groups.set(ch.dest, []); groups.get(ch.dest).push(ch); }
  const NEG = -1e18;
  let dp = new Float64Array(B + 1).fill(NEG); dp[0] = 0;
  const trace = [];
  for (const [dest, chs] of groups) {
    const best = new Map();
    const idx = new Array(chs.length).fill(0);
    const total = chs.reduce((m, c) => m * c.options.length, 1);
    for (let n = 0; n < total; n++) {
      let rem = n;
      for (let j = chs.length - 1; j >= 0; j--) { idx[j] = rem % chs[j].options.length; rem = Math.floor(rem / chs[j].options.length); }
      let cost = 0, value = 0;
      for (let j = 0; j < chs.length; j++) { const o = chs[j].options[idx[j]]; cost += costLakh(o); value += o.expected_profit - lam * o.profit_sd; }
      if (cost > cap || cost > B) continue;
      if (!best.has(cost) || value > best.get(cost).value) best.set(cost, { cost, value, idx: idx.slice() });
    }
    const combos = [...best.values()].sort((a, b) => a.cost - b.cost);
    const next = new Float64Array(B + 1).fill(NEG), arg = new Int32Array(B + 1).fill(-1);
    combos.forEach((cb, k) => {
      for (let b = cb.cost; b <= B; b++) {
        const v = dp[b - cb.cost] + cb.value;
        if (v > next[b]) { next[b] = v; arg[b] = k; }
      }
    });
    trace.push({ dest, combos, arg }); dp = next;
  }
  let b = 0; for (let i = 1; i <= B; i++) if (dp[i] > dp[b]) b = i;
  const picks = new Map();
  for (let t = trace.length - 1; t >= 0; t--) {
    const { dest, combos, arg } = trace[t], cb = combos[arg[b]];
    groups.get(dest).forEach((ch, j) => { const o = ch.options[cb.idx[j]]; if (o.units > 0) picks.set(ch.block_id, o); });
    b -= cb.cost;
  }
  return summarise(picks, B, lam);
}

export function greedy(choices, budgetLakh, lam = 0.5) {
  const full = [];
  for (const ch of choices) {
    const o = ch.options.find(x => x.fraction === 1.0);
    if (!o || o.units <= 0) continue;
    const score = o.expected_profit - lam * o.profit_sd;
    if (score > 0) full.push({ r: score / Math.max(1, costLakh(o)), id: ch.block_id, o });
  }
  full.sort((a, b) => b.r - a.r || (a.id < b.id ? 1 : -1));
  let left = budgetLakh; const picks = new Map();
  for (const f of full) if (costLakh(f.o) <= left) { picks.set(f.id, f.o); left -= costLakh(f.o); }
  return summarise(picks, budgetLakh, lam);
}

function summarise(picks, B, lam) {
  let spent = 0, exp = 0, pen = 0;
  for (const o of picks.values()) { spent += o.cost; exp += o.expected_profit; pen += lam * o.profit_sd; }
  return { picks, budget_lakh: B, spent, expected_profit: exp, risk_penalty: pen, objective: exp - pen };
}

// ------------------------------------------------------------ Monte Carlo
export function simulate(positions, n = 10000, seed = 11, bins = 40) {
  if (!positions.length) return { n, mean: 0, sd: 0, p5: 0, p10: 0, p50: 0, p90: 0, cvar5: 0, prob_loss: 0, histogram: [], by_block: {} };
  const rng = mulberry32(seed);
  const g = GLOBAL_CORRELATION, r = REGION_CORRELATION - GLOBAL_CORRELATION, dd = DEST_CORRELATION, idio = Math.max(0, 1 - g - r - dd);
  const zg = normals(rng, n), zr = {}, zd = {};
  for (const p of positions) { if (!zr[p.region]) zr[p.region] = normals(rng, n); if (!zd[p.dest]) zd[p.dest] = normals(rng, n); }
  const total = new Float64Array(n), by_block = {};
  for (const p of positions) {
    const e = normals(rng, n), a = Math.sqrt(g), br = Math.sqrt(r), bd = Math.sqrt(dd), bi = Math.sqrt(idio);
    let s = 0, sold = 0; const prof = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const z = a * zg[i] + br * zr[p.region][i] + bd * zd[p.dest][i] + bi * e[i];
      const dem = Math.max(0, p.mu + p.sigma * z), so = Math.min(dem, p.units);
      const pr = p.price * so + p.salvage * (p.units - so) - p.cost * p.units;
      prof[i] = pr; total[i] += pr; s += pr; sold += so;
    }
    const ps = Float64Array.from(prof).sort();
    by_block[p.block_id] = { mean: Math.round(s / n), p10: Math.round(percentile(ps, 10)), sell_through: pyRound(sold / n / Math.max(p.units, 1e-9), 3) };
  }
  const srt = Float64Array.from(total).sort();
  let mean = 0; for (const v of total) mean += v; mean /= n;
  let v2 = 0; for (const v of total) v2 += (v - mean) ** 2;
  const k = Math.max(1, Math.floor(0.05 * n)); let cv = 0; for (let i = 0; i < k; i++) cv += srt[i];
  const lo = srt[0], hi = srt[n - 1], w = (hi - lo) / bins || 1, counts = new Array(bins).fill(0);
  for (const v of total) counts[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  let loss = 0; for (const v of total) if (v < 0) loss++;
  return { n, mean: Math.round(mean), sd: Math.round(Math.sqrt(v2 / n)), p5: Math.round(percentile(srt, 5)),
    p10: Math.round(percentile(srt, 10)), p50: Math.round(percentile(srt, 50)), p90: Math.round(percentile(srt, 90)),
    cvar5: Math.round(cv / k), prob_loss: pyRound(loss / n, 4),
    histogram: counts.map((c, i) => ({ lo: Math.round(lo + i * w), hi: Math.round(lo + (i + 1) * w), count: c })), by_block };
}

// ---------------------------------------------------------------- explain
export function inr(v) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  return `${s}₹${Math.round(a).toLocaleString('en-IN')}`;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const addDays = (dt, k) => new Date(dt.getTime() + k * 864e5);
const iso = dt => dt.toISOString().slice(0, 10);
export const fmtDate = dt => `${dt.getUTCDate()} ${MON[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
const n0 = v => Math.round(v).toLocaleString('en-US');

export function explainPick(c, units, lead, planDate) {
  const unit = c.kind === 'hotel' ? 'room-nights' : 'seats';
  const parts = [`Buy ${n0(units)} ${unit} for ${c.label} (${c.window}).`,
    `Forecast demand is ${n0(c.mu)} (P10 ${n0(c.p10)} to P90 ${n0(c.p90)}), ${c.peak_index.toFixed(1)}× this destination's average.`];
  if (c.drivers) parts.push(`Driven by ${c.drivers}.`);
  parts.push(`Each sale earns ${inr(c.price - c.cost)} and each unsold unit loses ${inr(c.cost - c.salvage)}, so the critical ratio is ${c.critical_ratio.toFixed(2)}.`);
  if (lead) {
    const buyBy = addDays(parseDate(c.start), -lead);
    parts.push(buyBy <= parseDate(planDate) ? 'Buy now: waiting only raises the rate.'
      : `Best buy date is around ${fmtDate(buyBy)} (${lead} days before arrival).`);
  }
  return parts.join(' ');
}

// ----------------------------------------------------------------- engine
export function createLocalEngine(data) {
  const planDate = data.generated_for;
  const shockById = Object.fromEntries(data.shocks.map(s => [s.id, s]));

  function candidates(shocks = []) {
    const active = shocks.map(s => shockById[s]).filter(Boolean);
    return data.candidates.map(base => {
      let mu = base.mu, sigma = base.sigma, cost = base.cost;
      for (const s of active) {
        const dm = s.demand[base.dest] ?? 1, sm = s.sigma[base.dest] ?? 1;
        mu *= dm; sigma *= sm * dm; if (base.kind === 'flight') cost *= s.flight_cost;
      }
      if (!active.length) return { ...base };
      const q = optimalQuantity(mu, sigma, base.price, cost, base.salvage), o = evaluate(q, mu, sigma, base.price, cost, base.salvage);
      return { ...base, mu: pyRound(mu, 1), sigma: pyRound(sigma, 1), cost: pyRound(cost),
        p10: pyRound(Math.max(0, mu - Z90 * sigma), 1), p90: pyRound(mu + Z90 * sigma, 1),
        critical_ratio: pyRound(criticalRatio(base.price, cost, base.salvage), 3), q_star: pyRound(q),
        expected_profit: pyRound(o.expected_profit), profit_sd: pyRound(o.profit_sd), stockout_prob: pyRound(o.stockout_prob, 3) };
    });
  }

  function timing(blockId, shocks = []) {
    const c = candidates(shocks).find(x => x.id === blockId);
    if (!c) throw new Error(`Unknown block ${blockId}`);
    const res = timingCurve(c.mu, c.sigma, c.price, c.cost, c.salvage, Math.max(7, c.lead_days));
    return { ...res, block_id: blockId, reference_lead: c.lead_days };
  }

  const positionsFor = (picks, byId) => [...picks].map(([id, o]) => {
    const c = byId[id];
    return { block_id: id, dest: c.dest, region: c.region, units: o.units, mu: c.mu, sigma: c.sigma, price: c.price, cost: c.cost, salvage: c.salvage };
  });

  function optimize(req = {}) {
    const r = { budget_lakh: 800, risk_aversion: 0.5, max_share: 0.35, shocks: [], simulations: 10000, ...req };
    const cands = candidates(r.shocks), byId = Object.fromEntries(cands.map(c => [c.id, c]));
    const choices = buildChoices(cands);
    const sol = solve(choices, r.budget_lakh, r.risk_aversion, r.max_share);
    const base = greedy(choices, r.budget_lakh, r.risk_aversion);
    const picks = [...sol.picks].sort((a, b) => b[1].expected_profit - a[1].expected_profit).map(([id, o]) => {
      const c = byId[id], t = timing(id, r.shocks), lead = t.best ? t.best.lead_days : null;
      const buyBy = lead ? addDays(parseDate(c.start), -lead) : parseDate(planDate);
      return { id, dest: c.dest, dest_name: c.dest_name, label: c.label, kind: c.kind, window: c.window, units: o.units,
        fraction_of_optimum: o.fraction, cost: Math.round(o.cost), expected_profit: Math.round(o.expected_profit),
        profit_sd: Math.round(o.profit_sd), sell_price: c.price, buy_lead_days: lead,
        buy_by: iso(buyBy < parseDate(planDate) ? parseDate(planDate) : buyBy), explanation: explainPick(c, o.units, lead, planDate) };
    });
    const skipped = cands.filter(c => !sol.picks.has(c.id)).map(c => {
      let reason;
      if (c.expected_profit - r.risk_aversion * c.profit_sd <= 0) reason = 'the risk-adjusted profit is negative at any size.';
      else if (c.q_star * c.cost / 1e5 > r.budget_lakh * r.max_share) reason = 'even a partial block would exceed the per-destination cap.';
      else reason = 'other blocks earn more per rupee of budget.';
      return { id: c.id, label: c.label, dest_name: c.dest_name, explanation: `Skip ${c.label}: ${reason}` };
    });
    const risk = simulate(positionsFor(sol.picks, byId), r.simulations);
    return { plan_date: planDate, engine: 'browser',
      request: { budget_lakh: r.budget_lakh, risk_aversion: r.risk_aversion, max_share: r.max_share, shocks: r.shocks },
      summary: { spent: Math.round(sol.spent), budget: r.budget_lakh * LAKH, expected_profit: Math.round(sol.expected_profit),
        objective: Math.round(sol.objective), blocks: picks.length, roi: sol.spent ? pyRound(sol.expected_profit / sol.spent, 4) : 0,
        greedy_expected_profit: Math.round(base.expected_profit), greedy_objective: Math.round(base.objective),
        uplift_vs_greedy: Math.round(sol.objective - base.objective) },
      picks, skipped, risk };
  }

  function frontier(budget = 800, shocks = [], maxShare = 0.35) {
    const cands = candidates(shocks), byId = Object.fromEntries(cands.map(c => [c.id, c])), choices = buildChoices(cands);
    return [0, 0.25, 0.5, 0.75, 1, 1.5, 2].map(lam => {
      const sol = solve(choices, budget, lam, maxShare), r = simulate(positionsFor(sol.picks, byId), 4000);
      return { risk_aversion: lam, expected_profit: r.mean, sd: r.sd, p10: r.p10, spent: Math.round(sol.spent), blocks: sol.picks.size };
    });
  }

  return {
    mode: 'browser', planDate,
    destinations: async () => data.destinations,
    forecast: async dest => data.forecasts[dest],
    backtest: async () => data.backtest,
    shocks: async () => data.shocks,
    candidates: async (shocks = []) => candidates(shocks),
    optimize: async req => optimize(req),
    timing: async (id, shocks = []) => timing(id, shocks),
    frontier: async (budget, shocks = []) => frontier(budget, shocks),
    _sync: { candidates, optimize, timing, frontier },
  };
}
