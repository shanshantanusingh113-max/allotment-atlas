"""Synthetic history generator.

Produces two years of daily stay-date data per destination:

* ``searches``      agency searches for that stay date
* ``demand``        unconstrained room-night demand (hidden in real life)
* ``bookings``      what TBO could actually sell, capped by free-sale capacity
* ``lost``          demand that hit "sold out" (observable from search logs)
* ``cancellations`` bookings later cancelled
* ``adr``           average daily rate paid

The planted patterns (seasonality, festivals, growth, sell-outs, cancellation
rates by destination) are what the forecaster and optimizer must recover.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from .catalog import DESTINATIONS, EVENTS, Destination

HISTORY_START = date(2024, 11, 4)  # a Monday
HISTORY_END = date(2026, 11, 1)  # the Sunday before the planning horizon
ANNUAL_GROWTH = 0.16
WEEKDAY = np.array([0.88, 0.86, 0.9, 0.97, 1.12, 1.2, 1.07])  # Mon..Sun


def event_intensity(dest: str, day: date) -> tuple[float, str]:
    """Extra demand multiplier from events on a stay date, with a smooth ramp."""
    total, names = 0.0, []
    for ev in EVENTS:
        if ev.destinations and dest not in ev.destinations:
            continue
        if ev.start - timedelta(days=4) <= day <= ev.end + timedelta(days=2):
            span = max(1, (ev.end - ev.start).days)
            if day < ev.start:
                w = 1 - (ev.start - day).days / 5
            elif day > ev.end:
                w = 1 - (day - ev.end).days / 3
            else:
                mid = (day - ev.start).days / span
                w = 0.75 + 0.25 * np.sin(np.pi * mid)
            total += ev.intensity * max(0.0, w)
            names.append(ev.name)
    return total, ", ".join(dict.fromkeys(names))


def daily_mean(d: Destination, day: date, growth: float = ANNUAL_GROWTH) -> tuple[float, float, str]:
    """Expected unconstrained demand for a stay date, before noise."""
    years = (day - HISTORY_START).days / 365.25
    trend = (1 + growth) ** years
    month = d.profile[day.month - 1]
    ev, names = event_intensity(d.code, day)
    return d.base_daily * month * WEEKDAY[day.weekday()] * (1 + ev) * trend, ev, names


def generate_history(seed: int = 7, start: date = HISTORY_START, end: date = HISTORY_END) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    n_days = (end - start).days + 1
    for d in DESTINATIONS:
        # Free-sale capacity grows slower than demand, so peaks sell out more each year.
        for i in range(n_days):
            day = start + timedelta(days=i)
            mu, ev, names = daily_mean(d, day)
            demand = rng.poisson(mu * rng.lognormal(0, 0.14))
            years = i / 365.25
            capacity = d.base_daily * d.capacity_factor * (1.08 ** years) * WEEKDAY[day.weekday()] ** 0.5
            bookings = int(min(demand, capacity))
            lost = demand - bookings
            cancellations = int(rng.binomial(bookings, d.cancel_rate)) if bookings else 0
            searches = int(rng.poisson(max(1.0, demand * rng.uniform(6.5, 9.5))))
            month = d.profile[day.month - 1]
            adr = d.adr * (1 + 0.32 * (month - 1) + 0.25 * ev) * rng.uniform(0.96, 1.04)
            rows.append((day, d.code, searches, demand, bookings, lost, cancellations,
                         round(adr), round(ev, 3), names))
    df = pd.DataFrame(rows, columns=["date", "dest", "searches", "demand", "bookings", "lost",
                                     "cancellations", "adr", "event_intensity", "events"])
    df["date"] = pd.to_datetime(df["date"])
    return df


def weekly(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate daily rows to Monday-start weeks per destination."""
    w = df.copy()
    w["week"] = w["date"] - pd.to_timedelta(w["date"].dt.weekday, unit="D")
    agg = w.groupby(["dest", "week"], as_index=False).agg(
        searches=("searches", "sum"),
        demand=("demand", "sum"),
        bookings=("bookings", "sum"),
        lost=("lost", "sum"),
        cancellations=("cancellations", "sum"),
        adr=("adr", "mean"),
        event_intensity=("event_intensity", "mean"),
        days=("date", "count"),
    )
    agg = agg[agg["days"] == 7].drop(columns="days")
    # Observable unconstrained demand: bookings plus searches that ended on sold-out.
    agg["observed_demand"] = agg["bookings"] + agg["lost"]
    return agg.sort_values(["dest", "week"]).reset_index(drop=True)


def calendar_intensity(dest: str, week_start: date) -> tuple[float, str]:
    """Mean event intensity over a week, known in advance for any future week."""
    vals, names = [], []
    for k in range(7):
        v, n = event_intensity(dest, week_start + timedelta(days=k))
        vals.append(v)
        if n:
            names.append(n)
    return float(np.mean(vals)), ", ".join(dict.fromkeys(", ".join(names).split(", "))) if names else ""
