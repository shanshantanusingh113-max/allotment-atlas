"""Newsvendor model for one perishable inventory block.

A pre-bought block of Q units costs ``c`` each, sells at ``p`` and recovers
``s`` per unsold unit. With demand D ~ Normal(mu, sigma) truncated at zero,

    profit(Q, D) = p * min(D, Q) + s * max(Q - D, 0) - c * Q
    critical ratio = (p - c) / (p - s)
    Q* = mu + sigma * Phi^-1(critical ratio)

Moments are computed on a deterministic grid of normal quantiles, so results
are exact to about 0.1% and reproducible.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.stats import norm

_GRID = norm.ppf((np.arange(800) + 0.5) / 800)


def critical_ratio(price: float, cost: float, salvage: float) -> float:
    if price <= salvage:
        return 0.0
    return float(np.clip((price - cost) / (price - salvage), 0.0, 1.0))


def optimal_quantity(mu: float, sigma: float, price: float, cost: float, salvage: float) -> float:
    cr = critical_ratio(price, cost, salvage)
    if cr <= 0:
        return 0.0
    cr = min(cr, 0.999)
    return float(max(0.0, mu + sigma * norm.ppf(cr)))


@dataclass(frozen=True)
class Outcome:
    quantity: float
    expected_profit: float
    profit_sd: float
    expected_sold: float
    sell_through: float  # expected sold / quantity
    fill_rate: float  # expected sold / expected demand
    stockout_prob: float  # P(D > Q)
    loss_prob: float  # P(profit < 0)


def evaluate(q: float, mu: float, sigma: float, price: float, cost: float, salvage: float) -> Outcome:
    d = np.maximum(0.0, mu + sigma * _GRID)
    sold = np.minimum(d, q)
    profit = price * sold + salvage * (q - sold) - cost * q
    exp_sold = float(sold.mean())
    return Outcome(
        quantity=float(q),
        expected_profit=float(profit.mean()),
        profit_sd=float(profit.std()),
        expected_sold=exp_sold,
        sell_through=exp_sold / q if q > 0 else 0.0,
        fill_rate=exp_sold / max(1e-9, float(d.mean())),
        stockout_prob=float((d > q).mean()),
        loss_prob=float((profit < 0).mean()),
    )


def profit_curve(mu: float, sigma: float, price: float, cost: float, salvage: float,
                 q_max: float | None = None, points: int = 60) -> list[dict]:
    q_max = q_max or max(10.0, mu + 3 * sigma)
    out = []
    for q in np.linspace(0, q_max, points):
        o = evaluate(q, mu, sigma, price, cost, salvage)
        out.append({"q": round(float(q), 1), "expected_profit": round(o.expected_profit),
                    "profit_sd": round(o.profit_sd)})
    return out
