"""When to buy a block.

Three forces trade off as the stay date approaches:

* Supplier rates fall from far-out list prices to a contract sweet spot
  around 45-90 days out, then climb steeply in the last month.
* Forecast uncertainty shrinks as bookings accumulate.
* The chance the block is still offered at a contract rate falls.

Expected value of buying L days ahead is
    P(block still offered at L) * E[profit at the newsvendor optimum for rate(L), sigma(L)].
"""

from __future__ import annotations

import math

from .newsvendor import evaluate, optimal_quantity


def rate_multiplier(lead_days: float) -> float:
    late = 0.42 * math.exp(-lead_days / 26)
    early = 0.07 * max(0.0, lead_days - 120) / 120
    return 1.0 + late + early


def sigma_multiplier(lead_days: float, reference_lead: float) -> float:
    return math.sqrt((25 + lead_days) / (25 + max(1.0, reference_lead)))


def availability(lead_days: float) -> float:
    return 1.0 - 0.82 * math.exp(-lead_days / 38)


def curve(mu: float, sigma: float, price: float, base_cost: float, salvage: float,
          reference_lead: int, max_lead: int | None = None, step: int = 3) -> dict:
    """Expected profit by buy day, from `reference_lead` (today) down to one week out."""
    max_lead = max_lead or reference_lead
    base = base_cost / rate_multiplier(60)  # catalog cost is quoted at ~60 days out
    points = []
    for lead in range(max(7, 1), max_lead + 1, step):
        c = base * rate_multiplier(lead)
        sd = sigma * sigma_multiplier(lead, reference_lead)
        q = optimal_quantity(mu, sd, price, c, salvage)
        o = evaluate(q, mu, sd, price, c, salvage)
        ev = availability(lead) * o.expected_profit
        points.append({"lead_days": lead, "rate": round(c), "sigma": round(sd, 1),
                       "availability": round(availability(lead), 3), "quantity": round(q),
                       "expected_profit": round(ev)})
    best = max(points, key=lambda p: p["expected_profit"]) if points else None
    return {"points": points, "best": best}
