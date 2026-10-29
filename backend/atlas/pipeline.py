"""End-to-end engine: data -> forecast -> candidates -> optimise -> simulate -> explain."""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import date, timedelta
from functools import cached_property
from pathlib import Path

import numpy as np
import pandas as pd

from . import __version__
from . import analysis
from .data.catalog import (BLOCK_BY_ID, BLOCKS, DEST_BY_CODE, DESTINATIONS, EVENTS, HUBS, META, SHOCK_BY_ID,
                           SHOCKS, Block)
from .data.generator import generate_history, weekly
from .explain import explain_pick, explain_skip
from .forecast.model import DemandForecaster, backtest
from .optimize import newsvendor, portfolio, timing
from .risk.montecarlo import Position, simulate

PLAN_DATE = date.fromisoformat(META.get("plan_date", "2026-11-02"))
HORIZON_WEEKS = 56
Z90 = 1.2816
MARKET_CV_BASE = 0.10
MARKET_CV_SLOPE = 0.14


@dataclass
class OptimizeRequest:
    budget_lakh: int = 800
    risk_aversion: float = 0.5
    max_share: float = 0.35
    shocks: tuple[str, ...] = ()
    simulations: int = 10_000


class Engine:
    def __init__(self, seed: int = 7, history: pd.DataFrame | None = None):
        """Build the engine on synthetic history, or on your own daily history (see data/loaders.py)."""
        self.seed = seed
        self.history = history if history is not None else generate_history(seed)
        self.weekly = weekly(self.history)
        self.forecaster = DemandForecaster().fit(self.weekly)
        self.forecast = self.forecaster.forecast_all(PLAN_DATE, HORIZON_WEEKS)

    # ------------------------------------------------------------------ data
    @cached_property
    def backtest(self) -> dict:
        return backtest(self.weekly)

    def destinations(self) -> list[dict]:
        out = []
        for d in DESTINATIONS:
            f = self.forecast[self.forecast["dest"] == d.code]
            f52 = f.iloc[:52]
            monthly = (f52.assign(m=f52["week"].dt.strftime("%Y-%m"))
                       .groupby("m", sort=True)["p50"].sum().round().astype(int))
            peak = f52.loc[f52["p50"].idxmax()]
            hist = self.weekly[self.weekly["dest"] == d.code]
            last = hist.tail(52)
            out.append({
                "code": d.code, "name": d.name, "lat": d.lat, "lng": d.lng, "hub": d.hub,
                "hub_name": HUBS[d.hub][0], "region": d.region, "adr": d.adr,
                "forecast_year": int(round(f52["p50"].sum())),
                "last_year": int(last["observed_demand"].sum()),
                "growth": round(float(f52["p50"].sum() / max(1, last["observed_demand"].sum()) - 1), 3),
                "sellout_share": round(float(last["lost"].sum() / max(1, last["observed_demand"].sum())), 3),
                "peak_week": str(peak["week"].date()),
                "peak_drivers": peak["drivers"],
                "monthly": [{"month": m, "p50": int(v)} for m, v in monthly.items()],
            })
        return out

    def forecast_series(self, dest: str, history_weeks: int = 52) -> dict:
        if dest not in DEST_BY_CODE:
            raise KeyError(dest)
        h = self.weekly[self.weekly["dest"] == dest].tail(history_weeks)
        f = self.forecast[self.forecast["dest"] == dest]
        return {
            "dest": dest,
            "name": DEST_BY_CODE[dest].name,
            "history": [{"week": str(w.date()), "demand": int(v), "lost": int(l)}
                        for w, v, l in zip(h["week"], h["observed_demand"], h["lost"])],
            "forecast": [{"week": str(r.week.date()), "p10": round(r.p10), "p50": round(r.p50),
                          "p90": round(r.p90), "drivers": r.drivers} for r in f.itertuples()],
        }

    # ------------------------------------------------------------ candidates
    def _block_demand(self, b: Block) -> tuple[float, float, float, float, str]:
        d = DEST_BY_CODE[b.dest]
        f = self.forecast[self.forecast["dest"] == b.dest]
        mu = lo = hi = 0.0
        sds, drivers = [], []
        for r in f.itertuples():
            ws = r.week.date()
            we = ws + timedelta(days=6)
            overlap = (min(we, b.end) - max(ws, b.start)).days + 1
            if overlap <= 0:
                continue
            frac = overlap / 7
            mu += frac * r.p50
            lo += frac * r.p10
            hi += frac * r.p90
            sds.append(frac * (r.p90 - r.p10) / (2 * Z90))
            if r.drivers:
                drivers.extend(r.drivers.split(", "))
        sds = np.array(sds)
        rho = 0.5  # adjacent weeks share shocks
        sigma = math.sqrt((1 - rho) * float((sds ** 2).sum()) + rho * float(sds.sum()) ** 2)
        net = b.share * (1 - 0.5 * d.cancel_rate)  # cancellations free stock that partly resells
        daily_avg = float(f.iloc[:52]["p50"].sum()) / 364
        peak_index = (mu / max(1, b.nights)) / max(1e-9, daily_avg)
        return mu * net, sigma * net, peak_index, lo * net, ", ".join(dict.fromkeys(drivers))

    def _last_year(self, b: Block) -> float:
        """Demand this block would have served over the same window 52 weeks earlier."""
        h = self.history
        lo, hi = pd.Timestamp(b.start - timedelta(days=364)), pd.Timestamp(b.end - timedelta(days=364))
        rows = h[(h["dest"] == b.dest) & (h["date"] >= lo) & (h["date"] <= hi)]
        net = b.share * (1 - 0.5 * DEST_BY_CODE[b.dest].cancel_rate)
        return round(float((rows["bookings"] + rows["lost"]).sum()) * net, 1)

    def candidates(self, shocks: tuple[str, ...] = ()) -> list[dict]:
        active = [SHOCK_BY_ID[s] for s in shocks if s in SHOCK_BY_ID]
        out = []
        for b in BLOCKS:
            d = DEST_BY_CODE[b.dest]
            mu, sigma, peak_index, _, drivers = self._block_demand(b)
            # The model's band covers statistical noise. Market risk the calendar cannot
            # see (competitor dumping, macro shocks, unlisted events) grows with lead time.
            lead = (b.start - PLAN_DATE).days
            cv = MARKET_CV_BASE + MARKET_CV_SLOPE * min(1.0, lead / 240)
            sigma = math.sqrt(sigma ** 2 + (cv * mu) ** 2)
            cost = float(b.cost)
            for s in active:
                mu *= s.demand.get(b.dest, 1.0)
                sigma *= s.sigma.get(b.dest, 1.0) * s.demand.get(b.dest, 1.0)
                if b.kind == "flight":
                    cost *= s.flight_cost
            q = newsvendor.optimal_quantity(mu, sigma, b.price, cost, b.salvage)
            o = newsvendor.evaluate(q, mu, sigma, b.price, cost, b.salvage)
            out.append({
                "last_year": self._last_year(b),
                "id": b.id, "dest": b.dest, "dest_name": d.name, "label": b.label, "kind": b.kind,
                "contract": b.contract, "region": d.region, "hub": d.hub,
                "start": b.start, "end": b.end, "nights": b.nights,
                "window": f"{b.start.strftime('%-d %b')} – {b.end.strftime('%-d %b %Y')}",
                "lead_days": (b.start - PLAN_DATE).days,
                "mu": round(mu, 1), "sigma": round(sigma, 1),
                "p10": round(max(0.0, mu - Z90 * sigma), 1), "p90": round(mu + Z90 * sigma, 1),
                "price": b.price, "cost": round(cost), "salvage": b.salvage,
                "critical_ratio": round(newsvendor.critical_ratio(b.price, cost, b.salvage), 3),
                "q_star": round(q), "expected_profit": round(o.expected_profit),
                "profit_sd": round(o.profit_sd), "stockout_prob": round(o.stockout_prob, 3),
                "peak_index": round(peak_index, 2), "drivers": drivers,
            })
        return out

    @staticmethod
    def _choices(cands: list[dict]) -> list[portfolio.Choice]:
        choices = []
        for c in cands:
            opts = []
            for frac in portfolio.OPTION_FRACTIONS:
                units = int(round(c["q_star"] * frac / 10) * 10)
                if frac > 0 and units < 10:
                    continue
                o = newsvendor.evaluate(units, c["mu"], c["sigma"], c["price"], c["cost"], c["salvage"])
                opts.append(portfolio.Option(frac, units, units * c["cost"], o.expected_profit, o.profit_sd))
            choices.append(portfolio.Choice(c["id"], c["dest"], opts))
        return choices

    # -------------------------------------------------------------- optimise
    def optimize(self, req: OptimizeRequest) -> dict:
        cands = self.candidates(tuple(req.shocks))
        by_id = {c["id"]: c for c in cands}
        choices = self._choices(cands)
        sol = portfolio.solve(choices, req.budget_lakh, req.risk_aversion, req.max_share)
        base = portfolio.greedy(choices, req.budget_lakh, req.risk_aversion)

        picks, positions = [], []
        for bid, opt in sorted(sol.picks.items(), key=lambda kv: -kv[1].expected_profit):
            c = by_id[bid]
            t = self.timing(bid, req.shocks)
            lead = t["best"]["lead_days"] if t["best"] else None
            buy_by = c["start"] - timedelta(days=lead) if lead else PLAN_DATE
            picks.append({
                "id": bid, "dest": c["dest"], "dest_name": c["dest_name"], "label": c["label"],
                "kind": c["kind"], "window": c["window"], "units": opt.units,
                "fraction_of_optimum": opt.fraction, "cost": round(opt.cost),
                "expected_profit": round(opt.expected_profit), "profit_sd": round(opt.profit_sd),
                "sell_price": c["price"], "buy_lead_days": lead,
                "buy_by": str(max(buy_by, PLAN_DATE)),
                "explanation": explain_pick(c, opt.units, lead, PLAN_DATE),
            })
            positions.append(Position(bid, c["dest"], c["region"], opt.units, c["mu"], c["sigma"],
                                      c["price"], c["cost"], c["salvage"]))

        skipped = []
        for c in cands:
            if c["id"] in sol.picks:
                continue
            if c["expected_profit"] - req.risk_aversion * c["profit_sd"] <= 0:
                reason = "the risk-adjusted profit is negative at any size."
            elif c["q_star"] * c["cost"] / 1e5 > req.budget_lakh * req.max_share:
                reason = "even a partial block would exceed the per-destination cap."
            else:
                reason = "other blocks earn more per rupee of budget."
            skipped.append({"id": c["id"], "label": c["label"], "dest_name": c["dest_name"],
                            "explanation": explain_skip(c, reason)})

        risk = simulate(positions, n=req.simulations)
        return {
            "plan_date": str(PLAN_DATE),
            "request": {"budget_lakh": req.budget_lakh, "risk_aversion": req.risk_aversion,
                        "max_share": req.max_share, "shocks": list(req.shocks)},
            "summary": {
                "spent": round(sol.spent), "budget": req.budget_lakh * portfolio.LAKH,
                "expected_profit": round(sol.expected_profit), "objective": round(sol.objective),
                "blocks": len(picks), "roi": round(sol.expected_profit / sol.spent, 4) if sol.spent else 0,
                "greedy_expected_profit": round(base.expected_profit),
                "greedy_objective": round(base.objective),
                "uplift_vs_greedy": round(sol.objective - base.objective),
            },
            "picks": picks,
            "skipped": skipped,
            "risk": risk,
        }

    def frontier(self, budget_lakh: int, shocks: tuple[str, ...] = (), max_share: float = 0.35) -> list[dict]:
        cands = self.candidates(shocks)
        choices = self._choices(cands)
        pts = []
        for lam in (0.0, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0):
            sol = portfolio.solve(choices, budget_lakh, lam, max_share)
            by_id = {c["id"]: c for c in cands}
            pos = [Position(b, by_id[b]["dest"], by_id[b]["region"], o.units, by_id[b]["mu"],
                            by_id[b]["sigma"], by_id[b]["price"], by_id[b]["cost"], by_id[b]["salvage"])
                   for b, o in sol.picks.items()]
            r = simulate(pos, n=4000)
            pts.append({"risk_aversion": lam, "expected_profit": r["mean"], "sd": r["sd"],
                        "p10": r["p10"], "spent": round(sol.spent), "blocks": len(sol.picks)})
        return pts

    def sensitivity(self, req: OptimizeRequest) -> dict:
        return analysis.sensitivity(self.candidates(tuple(req.shocks)), self._choices,
                                    req.budget_lakh, req.risk_aversion, req.max_share)

    def replay(self, req: OptimizeRequest, seed: int = 1) -> dict:
        return analysis.replay(self.candidates(tuple(req.shocks)), self._choices, PLAN_DATE,
                               req.budget_lakh, req.risk_aversion, req.max_share, seed)

    def timing(self, block_id: str, shocks: tuple[str, ...] = ()) -> dict:
        if block_id not in BLOCK_BY_ID:
            raise KeyError(block_id)
        c = next(c for c in self.candidates(tuple(shocks)) if c["id"] == block_id)
        ref = max(7, c["lead_days"])
        res = timing.curve(c["mu"], c["sigma"], c["price"], c["cost"], c["salvage"], reference_lead=ref)
        res["block_id"] = block_id
        res["reference_lead"] = c["lead_days"]
        return res

    # ---------------------------------------------------------------- export
    def export(self, path: Path) -> dict:
        """Write the snapshot the static frontend runs on when no API is reachable."""
        cands = self.candidates()
        for c in cands:
            c["start"], c["end"] = str(c["start"]), str(c["end"])
        default = self.optimize(OptimizeRequest())
        payload = {
            "version": __version__,
            "generated_for": str(PLAN_DATE),
            "hubs": {k: {"name": v[0], "lat": v[1], "lng": v[2]} for k, v in HUBS.items()},
            "destinations": self.destinations(),
            "candidates": cands,
            "shocks": [{"id": s.id, "label": s.label, "description": s.description,
                        "demand": s.demand, "sigma": s.sigma, "flight_cost": s.flight_cost} for s in SHOCKS],
            "forecasts": {d.code: self.forecast_series(d.code) for d in DESTINATIONS},
            "backtest": self.backtest,
            "default_plan": default,
            "default_sensitivity": self.sensitivity(OptimizeRequest()),
            "catalog": {
                "meta": META,
                "events": [{"name": e.name, "start": str(e.start), "end": str(e.end), "intensity": e.intensity,
                            "destinations": list(e.destinations)} for e in EVENTS],
            },
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, separators=(",", ":"), default=str))
        return payload


_ENGINE: Engine | None = None


def get_engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = Engine()
    return _ENGINE
