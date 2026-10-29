"""Decision analysis on top of a plan.

sensitivity()  Which inputs move profit most. Each factor is pushed low and
               high; we report profit if the plan is kept fixed and profit if
               the optimiser re-plans. The gap is the value of re-planning.

replay()       One simulated season, played week by week, for three buying
               policies: Allotment Atlas, the simple greedy rule, and buying
               last year's volume. Cash goes out on the plan date and comes
               back as guests stay, so each policy dips first and then climbs.
"""

from __future__ import annotations

import math
from datetime import date, timedelta

import numpy as np

from .data.catalog import GLOBAL_CORRELATION, REGION_CORRELATION
from .optimize import newsvendor, portfolio
from .risk.montecarlo import DEST_CORRELATION

FACTORS = (
    # id, label, low label, high label, transform(c, sign) -> (mu, sigma, price, cost, salvage)
    ("demand", "Demand level", "−15%", "+15%",
     lambda c, s: (c["mu"] * (1 + 0.15 * s), c["sigma"] * (1 + 0.15 * s), c["price"], c["cost"], c["salvage"])),
    ("price", "Selling price", "−5%", "+5%",
     lambda c, s: (c["mu"], c["sigma"], c["price"] * (1 + 0.05 * s), c["cost"], c["salvage"])),
    ("cost", "Supplier rate", "+5%", "−5%",
     lambda c, s: (c["mu"], c["sigma"], c["price"], c["cost"] * (1 - 0.05 * s), c["salvage"])),
    ("sigma", "Forecast uncertainty", "+30%", "−30%",
     lambda c, s: (c["mu"], c["sigma"] * (1 - 0.30 * s), c["price"], c["cost"], c["salvage"])),
    ("salvage", "Recovery on unsold", "−50%", "+50%",
     lambda c, s: (c["mu"], c["sigma"], c["price"], c["cost"], c["salvage"] * (1 + 0.5 * s))),
    ("flights", "Flight seat costs", "+10%", "−10%",
     lambda c, s: (c["mu"], c["sigma"], c["price"],
                   c["cost"] * (1 - 0.10 * s) if c["kind"] == "flight" else c["cost"], c["salvage"])),
)


def rebuild(c: dict, mu: float, sigma: float, price: float, cost: float, salvage: float) -> dict:
    """Candidate with new economics, re-sized at its new newsvendor optimum."""
    cost = min(cost, price - 1)
    salvage = min(salvage, cost - 1)
    q = newsvendor.optimal_quantity(mu, sigma, price, cost, salvage)
    o = newsvendor.evaluate(q, mu, sigma, price, cost, salvage)
    return {**c, "mu": mu, "sigma": sigma, "price": price, "cost": cost, "salvage": salvage,
            "q_star": round(q), "expected_profit": o.expected_profit, "profit_sd": o.profit_sd}


def plan_profit(cands: list[dict], units: dict[str, int]) -> float:
    by_id = {c["id"]: c for c in cands}
    return sum(newsvendor.evaluate(u, by_id[b]["mu"], by_id[b]["sigma"], by_id[b]["price"],
                                   by_id[b]["cost"], by_id[b]["salvage"]).expected_profit
               for b, u in units.items())


def sensitivity(cands: list[dict], choices_fn, budget_lakh: int, risk_aversion: float,
                max_share: float) -> dict:
    base_sol = portfolio.solve(choices_fn(cands), budget_lakh, risk_aversion, max_share)
    units = {b: o.units for b, o in base_sol.picks.items()}
    base = plan_profit(cands, units)
    rows = []
    for fid, label, lo_lbl, hi_lbl, fn in FACTORS:
        out = {"id": fid, "label": label, "low_label": lo_lbl, "high_label": hi_lbl}
        for side, sign in (("low", -1), ("high", 1)):
            moved = [rebuild(c, *fn(c, sign)) for c in cands]
            fixed = plan_profit(moved, units)
            sol = portfolio.solve(choices_fn(moved), budget_lakh, risk_aversion, max_share)
            replanned = plan_profit(moved, {b: o.units for b, o in sol.picks.items()})
            out[f"{side}_fixed"] = round(fixed)
            out[f"{side}_replanned"] = round(replanned)
        out["swing"] = abs(out["high_fixed"] - out["low_fixed"])
        rows.append(out)
    rows.sort(key=lambda r: -r["swing"])
    return {"base_expected_profit": round(base), "factors": rows}


def _last_year_units(cands: list[dict], budget_lakh: int) -> dict[str, int]:
    units = {c["id"]: int(round(c.get("last_year", 0) / 10) * 10) for c in cands}
    by_id = {c["id"]: c for c in cands}
    total = sum(u * by_id[b]["cost"] for b, u in units.items())
    cap = budget_lakh * portfolio.LAKH
    if total > cap > 0:
        f = cap / total
        units = {b: int(math.floor(u * f / 10) * 10) for b, u in units.items()}
    return {b: u for b, u in units.items() if u > 0}


def replay(cands: list[dict], choices_fn, plan_date: date, budget_lakh: int, risk_aversion: float,
           max_share: float, seed: int = 1, weeks: int = 52) -> dict:
    choices = choices_fn(cands)
    atlas = {b: o.units for b, o in portfolio.solve(choices, budget_lakh, risk_aversion, max_share).picks.items()}
    greedy = {b: o.units for b, o in portfolio.greedy(choices, budget_lakh, risk_aversion).picks.items()}
    last = _last_year_units(cands, budget_lakh)

    # One correlated draw of realised demand for every block.
    rng = np.random.default_rng(seed)
    g, r, d = GLOBAL_CORRELATION, REGION_CORRELATION - GLOBAL_CORRELATION, DEST_CORRELATION
    idio = max(0.0, 1 - g - r - d)
    zg = rng.standard_normal()
    zr: dict[str, float] = {}
    zd: dict[str, float] = {}
    realised = {}
    for c in cands:
        zr.setdefault(c["region"], rng.standard_normal())
        zd.setdefault(c["dest"], rng.standard_normal())
        z = math.sqrt(g) * zg + math.sqrt(r) * zr[c["region"]] + math.sqrt(d) * zd[c["dest"]] + math.sqrt(idio) * rng.standard_normal()
        realised[c["id"]] = max(0.0, c["mu"] + c["sigma"] * z)

    week_starts = [plan_date + timedelta(weeks=k) for k in range(weeks)]
    by_id = {c["id"]: c for c in cands}

    def run(units: dict[str, int]) -> dict:
        spent = sum(u * by_id[b]["cost"] for b, u in units.items())
        weekly = np.zeros(weeks)
        sold_total = unsold_total = 0.0
        for b, u in units.items():
            c = by_id[b]
            sold = min(realised[b], u)
            revenue = c["price"] * sold + c["salvage"] * (u - sold)
            sold_total += sold
            unsold_total += u - sold
            start, end = date.fromisoformat(str(c["start"])), date.fromisoformat(str(c["end"]))
            nights = (end - start).days + 1
            for k, ws in enumerate(week_starts):
                overlap = (min(ws + timedelta(days=6), end) - max(ws, start)).days + 1
                if overlap > 0:
                    weekly[k] += revenue * overlap / nights
        series = np.cumsum(weekly) - spent
        return {"spent": round(spent), "final": round(float(series[-1])),
                "series": [round(float(v)) for v in series],
                "units": int(sum(units.values())), "unsold": round(unsold_total),
                "sell_through": round(sold_total / max(1, sold_total + unsold_total), 4)}

    policies = [
        {"id": "atlas", "label": "Allotment Atlas", **run(atlas)},
        {"id": "greedy", "label": "Simple rule", **run(greedy)},
        {"id": "last_year", "label": "Last year's volume", **run(last)},
    ]
    # Scorecard over many seasons, so one lucky draw does not decide the story.
    score = _scorecard(cands, {"atlas": atlas, "greedy": greedy, "last_year": last}, seed)
    for p in policies:
        p.update(score[p["id"]])

    blocks = [{"id": c["id"], "label": c["label"], "forecast": round(c["mu"]), "realised": round(realised[c["id"]]),
               "surprise": round(realised[c["id"]] / max(1.0, c["mu"]) - 1, 3),
               "atlas_units": atlas.get(c["id"], 0), "last_year_units": last.get(c["id"], 0)} for c in cands]
    return {"seed": seed, "weeks": [str(w) for w in week_starts], "policies": policies, "blocks": blocks,
            "market": round(float(zg), 3)}


def _scorecard(cands: list[dict], plans: dict[str, dict[str, int]], seed: int, n: int = 2000) -> dict:
    rng = np.random.default_rng(10_000 + seed)
    g, r, d = GLOBAL_CORRELATION, REGION_CORRELATION - GLOBAL_CORRELATION, DEST_CORRELATION
    idio = max(0.0, 1 - g - r - d)
    zg = rng.standard_normal(n)
    zr = {reg: rng.standard_normal(n) for reg in sorted({c["region"] for c in cands})}
    zd = {dst: rng.standard_normal(n) for dst in sorted({c["dest"] for c in cands})}
    demand = {}
    for c in cands:
        z = np.sqrt(g) * zg + np.sqrt(r) * zr[c["region"]] + np.sqrt(d) * zd[c["dest"]] + np.sqrt(idio) * rng.standard_normal(n)
        demand[c["id"]] = np.maximum(0.0, c["mu"] + c["sigma"] * z)
    by_id = {c["id"]: c for c in cands}
    totals = {}
    for name, units in plans.items():
        t = np.zeros(n)
        for b, u in units.items():
            c = by_id[b]
            sold = np.minimum(demand[b], u)
            t += c["price"] * sold + c["salvage"] * (u - sold) - c["cost"] * u
        totals[name] = t
    stack = np.vstack([totals[k] for k in plans])
    winner = np.argmax(stack, axis=0)
    out = {}
    for i, name in enumerate(plans):
        t = totals[name]
        out[name] = {"avg_final": round(float(t.mean())), "p10_final": round(float(np.percentile(t, 10))),
                     "win_rate": round(float((winner == i).mean()), 4)}
    return out
