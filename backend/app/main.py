"""Allotment Atlas HTTP API.

Run locally:
    uvicorn app.main:app --reload --port 8000
Interactive docs at http://localhost:8000/docs
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from atlas import __version__
from atlas.data.catalog import BLOCK_BY_ID, BLOCKS, DESTINATIONS, SHOCK_BY_ID, SHOCKS
from atlas.optimize import newsvendor
from atlas.pipeline import PLAN_DATE, OptimizeRequest, get_engine

from .schemas import Health, NewsvendorIn, NewsvendorOut, OptimizeIn


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_engine()  # train the forecaster once at startup (~10 s)
    yield


app = FastAPI(
    title="Allotment Atlas API",
    version=__version__,
    description="Forecast demand, size and time inventory pre-buys, and optimise a budget for TBO.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ATLAS_CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _shocks(raw: list[str]) -> tuple[str, ...]:
    unknown = [s for s in raw if s not in SHOCK_BY_ID]
    if unknown:
        raise HTTPException(422, f"Unknown shock ids: {', '.join(unknown)}. See /api/shocks.")
    return tuple(raw)


@app.get("/health", response_model=Health, tags=["meta"])
def health():
    return Health(status="ok", version=__version__, plan_date=str(PLAN_DATE),
                  destinations=len(DESTINATIONS), candidates=len(BLOCKS))


@app.get("/api/destinations", tags=["data"])
def destinations():
    return get_engine().destinations()


@app.get("/api/forecast/{dest}", tags=["forecast"])
def forecast(dest: str, history_weeks: int = Query(52, ge=0, le=104)):
    try:
        return get_engine().forecast_series(dest.upper(), history_weeks)
    except KeyError:
        raise HTTPException(404, f"Unknown destination '{dest}'.")


@app.get("/api/backtest", tags=["forecast"])
def backtest():
    return get_engine().backtest


@app.get("/api/shocks", tags=["data"])
def shocks():
    return [{"id": s.id, "label": s.label, "description": s.description} for s in SHOCKS]


@app.get("/api/candidates", tags=["optimize"])
def candidates(shocks: list[str] = Query(default=[])):
    return get_engine().candidates(_shocks(shocks))


@app.post("/api/optimize", tags=["optimize"])
def optimize(body: OptimizeIn):
    req = OptimizeRequest(body.budget_lakh, body.risk_aversion, body.max_share,
                          _shocks(body.shocks), body.simulations)
    return get_engine().optimize(req)


@app.get("/api/frontier", tags=["optimize"])
def frontier(budget_lakh: int = Query(800, ge=0, le=5000), shocks: list[str] = Query(default=[])):
    return get_engine().frontier(budget_lakh, _shocks(shocks))


@app.get("/api/timing/{block_id}", tags=["optimize"])
def timing(block_id: str, shocks: list[str] = Query(default=[])):
    if block_id not in BLOCK_BY_ID:
        raise HTTPException(404, f"Unknown block '{block_id}'.")
    return get_engine().timing(block_id, _shocks(shocks))


@app.post("/api/newsvendor", response_model=NewsvendorOut, tags=["optimize"])
def newsvendor_endpoint(body: NewsvendorIn):
    if body.cost >= body.price:
        raise HTTPException(422, "Cost must be below price, or every unit loses money.")
    if body.salvage >= body.cost:
        raise HTTPException(422, "Salvage must be below cost.")
    q_star = newsvendor.optimal_quantity(body.mu, body.sigma, body.price, body.cost, body.salvage)
    q = body.quantity if body.quantity is not None else q_star
    o = newsvendor.evaluate(q, body.mu, body.sigma, body.price, body.cost, body.salvage)
    return NewsvendorOut(
        critical_ratio=newsvendor.critical_ratio(body.price, body.cost, body.salvage),
        optimal_quantity=q_star, quantity=q, expected_profit=o.expected_profit,
        profit_sd=o.profit_sd, sell_through=o.sell_through, fill_rate=o.fill_rate,
        stockout_prob=o.stockout_prob, loss_prob=o.loss_prob,
        curve=newsvendor.profit_curve(body.mu, body.sigma, body.price, body.cost, body.salvage),
    )
