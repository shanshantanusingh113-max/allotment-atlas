"""Plain-language reasons for each recommendation.

Template-based by design: every number in the sentence comes straight from the
engine, so the explanation can never invent a figure. An LLM can rephrase the
output later, but it should never be the source of the numbers.
"""

from __future__ import annotations

from datetime import date, timedelta


def inr(v: float) -> str:
    a = abs(v)
    sign = "−" if v < 0 else ""
    if a >= 1e7:
        return f"{sign}₹{a / 1e7:.2f} Cr"
    if a >= 1e5:
        return f"{sign}₹{a / 1e5:.1f} L"
    return f"{sign}₹{a:,.0f}"


def fmt_date(d: date) -> str:
    return d.strftime("%-d %b %Y")


def explain_pick(c: dict, units: int, buy_lead: int | None, plan_date: date) -> str:
    unit = "room-nights" if c["kind"] == "hotel" else "seats"
    parts = [f"Buy {units:,} {unit} for {c['label']} ({c['window']})."]
    parts.append(
        f"Forecast demand is {c['mu']:,.0f} (P10 {c['p10']:,.0f} to P90 {c['p90']:,.0f}), "
        f"{c['peak_index']:.1f}× this destination's average."
    )
    if c.get("drivers"):
        parts.append(f"Driven by {c['drivers']}.")
    parts.append(
        f"Each sale earns {inr(c['price'] - c['cost'])} and each unsold unit loses "
        f"{inr(c['cost'] - c['salvage'])}, so the critical ratio is {c['critical_ratio']:.2f}."
    )
    if buy_lead:
        buy_by = c["start"] - timedelta(days=buy_lead)
        if buy_by <= plan_date:
            parts.append("Buy now: waiting only raises the rate.")
        else:
            parts.append(f"Best buy date is around {fmt_date(buy_by)} ({buy_lead} days before arrival).")
    return " ".join(parts)


def explain_skip(c: dict, reason: str) -> str:
    return f"Skip {c['label']}: {reason}"
