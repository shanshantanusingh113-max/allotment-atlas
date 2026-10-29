from atlas.data.catalog import BLOCKS, DESTINATIONS
from atlas.pipeline import OptimizeRequest


def test_history_has_planted_patterns(engine):
    w = engine.weekly
    goa = w[w["dest"] == "GOI"].set_index("week")["observed_demand"]
    december = goa[goa.index.month == 12].mean()
    july = goa[goa.index.month == 7].mean()
    assert december > 2.5 * july, "Goa should peak in December and dip in monsoon"
    assert (w["lost"] > 0).any(), "some weeks should sell out"


def test_forecast_beats_seasonal_naive(engine):
    bt = engine.backtest
    assert bt["model_wape"] < bt["naive_wape"]
    assert 0.7 <= bt["coverage_p10_p90"] <= 0.95


def test_forecast_quantiles_are_ordered(engine):
    f = engine.forecast
    assert ((f["p10"] <= f["p50"]) & (f["p50"] <= f["p90"])).all()
    assert len(f) >= 52 * len(DESTINATIONS)


def test_candidates_cover_every_block(engine):
    cands = engine.candidates()
    assert {c["id"] for c in cands} == {b.id for b in BLOCKS}
    assert all(c["mu"] > 0 and c["sigma"] > 0 for c in cands)


def test_plan_respects_budget_and_cap(engine):
    req = OptimizeRequest(budget_lakh=500, risk_aversion=0.5, max_share=0.3, simulations=2000)
    plan = engine.optimize(req)
    assert plan["summary"]["spent"] <= 500 * 1e5
    by_dest = {}
    for p in plan["picks"]:
        by_dest[p["dest"]] = by_dest.get(p["dest"], 0) + p["cost"]
    assert max(by_dest.values()) <= 0.3 * 500 * 1e5 + 1e5
    assert plan["summary"]["uplift_vs_greedy"] >= 0
    assert all(p["explanation"].startswith("Buy") for p in plan["picks"])


def test_shock_moves_money_out_of_dubai(engine):
    base = engine.optimize(OptimizeRequest(simulations=1000))
    shocked = engine.optimize(OptimizeRequest(shocks=("gulf_advisory",), simulations=1000))
    spend = lambda plan: sum(p["cost"] for p in plan["picks"] if p["dest"] == "DXB")
    assert spend(shocked) < spend(base)


def test_more_risk_aversion_lowers_spread(engine):
    lo = engine.optimize(OptimizeRequest(budget_lakh=1200, risk_aversion=0.0, simulations=4000))
    hi = engine.optimize(OptimizeRequest(budget_lakh=1200, risk_aversion=2.0, simulations=4000))
    assert hi["risk"]["sd"] <= lo["risk"]["sd"]


def test_timing_curve_has_best_point(engine):
    t = engine.timing("DPS-SUM")
    assert t["best"] is not None
    assert 7 <= t["best"]["lead_days"] <= t["reference_lead"]


def test_sensitivity_ranks_factors(engine):
    s = engine.sensitivity(OptimizeRequest())
    swings = [f["swing"] for f in s["factors"]]
    assert swings == sorted(swings, reverse=True)
    price = next(f for f in s["factors"] if f["id"] == "price")
    assert price["high_fixed"] > s["base_expected_profit"] > price["low_fixed"]


def test_replay_is_reproducible_and_scored(engine):
    a = engine.replay(OptimizeRequest(), seed=3)
    b = engine.replay(OptimizeRequest(), seed=3)
    assert a == b
    assert {p["id"] for p in a["policies"]} == {"atlas", "greedy", "last_year"}
    for p in a["policies"]:
        assert len(p["series"]) == len(a["weeks"]) == 52
        assert p["series"][0] <= 0 < p["spent"]  # cash goes out first
    wins = sum(p["win_rate"] for p in a["policies"])
    assert abs(wins - 1) < 1e-6
    atlas = next(p for p in a["policies"] if p["id"] == "atlas")
    assert atlas["win_rate"] == max(p["win_rate"] for p in a["policies"])


def test_last_year_volume_is_populated(engine):
    assert all(c["last_year"] > 0 for c in engine.candidates())
