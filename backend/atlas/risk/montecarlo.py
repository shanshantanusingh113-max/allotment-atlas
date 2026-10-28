"""Correlated Monte Carlo simulation of portfolio profit.

Demand shocks are layered so blocks that share a destination or region move
together, which a sum of standalone risks cannot capture:

    z_i = sqrt(g) * Z_global + sqrt(r) * Z_region(i) + sqrt(d) * Z_dest(i) + sqrt(1-g-r-d) * e_i
    D_i = max(0, mu_i + sigma_i * z_i)
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..data.catalog import GLOBAL_CORRELATION, REGION_CORRELATION

DEST_CORRELATION = 0.25


@dataclass
class Position:
    block_id: str
    dest: str
    region: str
    units: float
    mu: float
    sigma: float
    price: float
    cost: float
    salvage: float


def simulate(positions: list[Position], n: int = 10_000, seed: int = 11, bins: int = 40) -> dict:
    if not positions:
        return {"n": n, "mean": 0, "sd": 0, "p5": 0, "p10": 0, "p50": 0, "p90": 0,
                "cvar5": 0, "prob_loss": 0, "histogram": [], "by_block": {}}
    rng = np.random.default_rng(seed)
    regions = sorted({p.region for p in positions})
    dests = sorted({p.dest for p in positions})
    zg = rng.standard_normal(n)
    zr = {r: rng.standard_normal(n) for r in regions}
    zd = {d: rng.standard_normal(n) for d in dests}
    g, r, d = GLOBAL_CORRELATION, REGION_CORRELATION - GLOBAL_CORRELATION, DEST_CORRELATION
    idio = max(0.0, 1 - g - r - d)
    total = np.zeros(n)
    by_block = {}
    for p in positions:
        z = (np.sqrt(g) * zg + np.sqrt(r) * zr[p.region] + np.sqrt(d) * zd[p.dest]
             + np.sqrt(idio) * rng.standard_normal(n))
        demand = np.maximum(0.0, p.mu + p.sigma * z)
        sold = np.minimum(demand, p.units)
        profit = p.price * sold + p.salvage * (p.units - sold) - p.cost * p.units
        total += profit
        by_block[p.block_id] = {"mean": round(float(profit.mean())),
                                "p10": round(float(np.percentile(profit, 10))),
                                "sell_through": round(float(sold.mean() / max(p.units, 1e-9)), 3)}
    srt = np.sort(total)
    k = max(1, int(0.05 * n))
    counts, edges = np.histogram(total, bins=bins)
    return {
        "n": n,
        "mean": round(float(total.mean())),
        "sd": round(float(total.std())),
        "p5": round(float(np.percentile(total, 5))),
        "p10": round(float(np.percentile(total, 10))),
        "p50": round(float(np.percentile(total, 50))),
        "p90": round(float(np.percentile(total, 90))),
        "cvar5": round(float(srt[:k].mean())),
        "prob_loss": round(float((total < 0).mean()), 4),
        "histogram": [{"lo": round(float(edges[i])), "hi": round(float(edges[i + 1])), "count": int(c)}
                      for i, c in enumerate(counts)],
        "by_block": by_block,
    }
