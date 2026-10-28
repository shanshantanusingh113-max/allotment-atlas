"""Request and response models for the HTTP API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class OptimizeIn(BaseModel):
    budget_lakh: int = Field(800, ge=0, le=5000, description="Maximum spend in INR lakh (100 = ₹1 Cr)")
    risk_aversion: float = Field(0.5, ge=0, le=3, description="λ: penalty per rupee of profit SD")
    max_share: float = Field(0.35, gt=0, le=1, description="Max share of budget in one destination")
    shocks: list[str] = Field(default_factory=list, description="Scenario ids from /api/shocks")
    simulations: int = Field(10_000, ge=500, le=50_000)


class NewsvendorIn(BaseModel):
    mu: float = Field(..., ge=0, description="Mean demand in units")
    sigma: float = Field(..., gt=0, description="Demand standard deviation")
    price: float = Field(..., gt=0)
    cost: float = Field(..., gt=0)
    salvage: float = Field(0, ge=0)
    quantity: float | None = Field(None, ge=0, description="Evaluate this quantity instead of the optimum")


class NewsvendorOut(BaseModel):
    critical_ratio: float
    optimal_quantity: float
    quantity: float
    expected_profit: float
    profit_sd: float
    sell_through: float
    fill_rate: float
    stockout_prob: float
    loss_prob: float
    curve: list[dict]


class Health(BaseModel):
    status: str
    version: str
    plan_date: str
    destinations: int
    candidates: int
