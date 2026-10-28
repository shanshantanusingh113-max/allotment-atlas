import itertools

import pytest

from atlas.optimize.portfolio import LAKH, Choice, Option, greedy, solve


def _choice(bid, dest, rows):
    return Choice(bid, dest, [Option(f, u, c * LAKH, e * LAKH, sd * LAKH) for f, u, c, e, sd in rows])


@pytest.fixture
def toy():
    return [
        _choice("A", "X", [(0, 0, 0, 0, 0), (0.5, 50, 4, 2.0, 0.4), (1, 100, 8, 3.2, 1.0)]),
        _choice("B", "X", [(0, 0, 0, 0, 0), (0.5, 50, 3, 1.5, 0.2), (1, 100, 6, 2.6, 0.6)]),
        _choice("C", "Y", [(0, 0, 0, 0, 0), (0.5, 50, 5, 2.2, 0.3), (1, 100, 10, 3.9, 0.9)]),
        _choice("D", "Z", [(0, 0, 0, 0, 0), (1, 100, 7, 2.4, 0.5)]),
    ]


def _brute(choices, budget, lam, max_share):
    best = None
    for idx in itertools.product(*[range(len(c.options)) for c in choices]):
        opts = [c.options[i] for c, i in zip(choices, idx)]
        if sum(o.cost_lakh for o in opts) > budget:
            continue
        per_dest = {}
        for c, o in zip(choices, opts):
            per_dest[c.dest] = per_dest.get(c.dest, 0) + o.cost_lakh
        if any(v > max_share * budget for v in per_dest.values()):
            continue
        val = sum(o.expected_profit - lam * o.profit_sd for o in opts)
        best = val if best is None or val > best else best
    return best


@pytest.mark.parametrize("budget", [5, 10, 15, 20, 30])
@pytest.mark.parametrize("lam", [0.0, 0.5, 1.5])
@pytest.mark.parametrize("share", [0.5, 1.0])
def test_dp_matches_brute_force(toy, budget, lam, share):
    sol = solve(toy, budget, lam, share)
    assert sol.objective == pytest.approx(_brute(toy, budget, lam, share), abs=1)
    assert sum(o.cost_lakh for o in sol.picks.values()) <= budget


def test_exact_never_worse_than_greedy(toy):
    for budget in (6, 11, 17, 25):
        assert solve(toy, budget, 0.5, 1.0).objective >= greedy(toy, budget, 0.5).objective - 1


def test_zero_budget_buys_nothing(toy):
    assert solve(toy, 0).picks == {}
