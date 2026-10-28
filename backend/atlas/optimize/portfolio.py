"""Budget-constrained portfolio optimiser.

Each candidate block offers a few quantity options (0, 25%, ... 125% of its
newsvendor optimum). We choose one option per block to maximise

    sum_i  E[profit_i] - lambda * SD[profit_i]

subject to total cost <= budget and, for each destination, cost <= max_share * budget.

Solved exactly as a grouped multiple-choice knapsack:

1. Within each destination, enumerate every combination of its blocks'
   options (at most a few hundred) and drop combinations over the
   destination cap.
2. Run a vectorised dynamic programme over destinations on a 1-lakh cost grid.

The additive risk term sums each block's standalone profit SD, which is an
upper bound on portfolio SD; the Monte Carlo reports the true correlated risk.
"""

from __future__ import annotations

import itertools
import math
from dataclasses import dataclass, field

import numpy as np

LAKH = 100_000
OPTION_FRACTIONS = (0.0, 0.25, 0.5, 0.75, 1.0, 1.25)


@dataclass
class Option:
    fraction: float  # share of the newsvendor optimum
    units: int
    cost: float  # INR
    expected_profit: float  # INR
    profit_sd: float  # INR

    @property
    def cost_lakh(self) -> int:
        return int(math.ceil(self.cost / LAKH - 1e-9))


@dataclass
class Choice:
    block_id: str
    dest: str
    options: list[Option] = field(default_factory=list)


@dataclass
class Solution:
    picks: dict[str, Option]  # block_id -> chosen option (units > 0 only)
    budget_lakh: int
    spent: float
    expected_profit: float
    risk_penalty: float
    objective: float


def solve(choices: list[Choice], budget_lakh: int, risk_aversion: float = 0.5,
          max_share: float = 0.35) -> Solution:
    B = int(max(0, budget_lakh))
    cap = int(math.floor(max_share * B + 1e-9)) if max_share < 1 else B

    # Group blocks by destination and build combination options per group.
    groups: dict[str, list[Choice]] = {}
    for ch in choices:
        groups.setdefault(ch.dest, []).append(ch)

    NEG = -1e18
    dp = np.full(B + 1, NEG)
    dp[0] = 0.0
    trace: list[tuple[str, list[tuple[int, float, tuple[int, ...]]], np.ndarray]] = []

    for dest, chs in groups.items():
        combos = []
        for idx in itertools.product(*[range(len(c.options)) for c in chs]):
            opts = [c.options[i] for c, i in zip(chs, idx)]
            cost = sum(o.cost_lakh for o in opts)
            if cost > cap or cost > B:
                continue
            value = sum(o.expected_profit - risk_aversion * o.profit_sd for o in opts)
            combos.append((cost, value, idx))
        # Keep only the best value for each cost (dominance pruning).
        best: dict[int, tuple[int, float, tuple[int, ...]]] = {}
        for cost, value, idx in combos:
            if cost not in best or value > best[cost][1]:
                best[cost] = (cost, value, idx)
        combos = sorted(best.values())
        new = np.full(B + 1, NEG)
        arg = np.full(B + 1, -1, dtype=int)
        for k, (cost, value, _) in enumerate(combos):
            shifted = np.full(B + 1, NEG)
            shifted[cost:] = dp[: B + 1 - cost] + value
            better = shifted > new
            new[better] = shifted[better]
            arg[better] = k
        trace.append((dest, combos, arg))
        dp = new

    # Backtrack from the best end state.
    b = int(np.argmax(dp))
    picks: dict[str, Option] = {}
    for dest, combos, arg in reversed(trace):
        k = arg[b]
        cost, _, idx = combos[k]
        for ch, i in zip(groups[dest], idx):
            opt = ch.options[i]
            if opt.units > 0:
                picks[ch.block_id] = opt
        b -= cost

    spent = sum(o.cost for o in picks.values())
    exp = sum(o.expected_profit for o in picks.values())
    pen = sum(risk_aversion * o.profit_sd for o in picks.values())
    return Solution(picks, B, spent, exp, pen, exp - pen)


def greedy(choices: list[Choice], budget_lakh: int, risk_aversion: float = 0.5) -> Solution:
    """Ratio heuristic used as a baseline to show what exact optimisation adds."""
    full = []
    for ch in choices:
        o = next((o for o in ch.options if o.fraction == 1.0), None)
        if o is None or o.units <= 0:
            continue
        score = o.expected_profit - risk_aversion * o.profit_sd
        if score > 0:
            full.append((score / max(1, o.cost_lakh), ch.block_id, o))
    full.sort(reverse=True)
    left, picks = budget_lakh, {}
    for _, bid, o in full:
        if o.cost_lakh <= left:
            picks[bid] = o
            left -= o.cost_lakh
    spent = sum(o.cost for o in picks.values())
    exp = sum(o.expected_profit for o in picks.values())
    pen = sum(risk_aversion * o.profit_sd for o in picks.values())
    return Solution(picks, budget_lakh, spent, exp, pen, exp - pen)
