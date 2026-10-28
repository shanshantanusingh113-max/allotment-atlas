import math

import numpy as np
import pytest

from atlas.optimize import newsvendor as nv


def test_critical_ratio_formula():
    assert nv.critical_ratio(100, 60, 20) == pytest.approx(0.5)
    assert nv.critical_ratio(100, 100, 20) == 0.0
    assert nv.critical_ratio(100, 60, 120) == 0.0


def test_optimal_quantity_matches_closed_form():
    # CR = 0.5 means buy the median.
    assert nv.optimal_quantity(120, 30, 100, 60, 20) == pytest.approx(120, abs=1e-6)
    # Higher margin means buy above the mean.
    assert nv.optimal_quantity(120, 30, 100, 30, 20) > 120


def test_optimum_beats_neighbours():
    mu, sd, p, c, s = 500, 90, 8500, 6000, 1500
    q = nv.optimal_quantity(mu, sd, p, c, s)
    best = nv.evaluate(q, mu, sd, p, c, s).expected_profit
    for dq in (-40, -15, 15, 40):
        assert nv.evaluate(q + dq, mu, sd, p, c, s).expected_profit < best


def test_expected_profit_matches_monte_carlo():
    mu, sd, p, c, s, q = 300, 60, 9000, 6500, 2000, 280
    rng = np.random.default_rng(0)
    d = np.maximum(0, rng.normal(mu, sd, 400_000))
    sold = np.minimum(d, q)
    mc = (p * sold + s * (q - sold) - c * q).mean()
    assert nv.evaluate(q, mu, sd, p, c, s).expected_profit == pytest.approx(mc, rel=0.01)


def test_zero_quantity_is_zero_profit():
    o = nv.evaluate(0, 100, 20, 10, 6, 1)
    assert o.expected_profit == 0 and o.sell_through == 0 and math.isclose(o.stockout_prob, 1, abs_tol=0.01)
