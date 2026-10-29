"""Bring your own data.

The engine needs one table: daily stay-date history per destination.

Required columns
    date          stay date (YYYY-MM-DD)
    dest          destination code that exists in the catalog
    bookings      units sold on the platform for that stay date
    lost          searches that ended on "sold out" for that stay date (0 if unknown)

Optional columns (filled with sensible defaults when missing)
    searches, demand, cancellations, adr, event_intensity, events

Use it like this:

    from atlas.data.loaders import load_history_csv
    from atlas.pipeline import Engine
    engine = Engine(history=load_history_csv("my_history.csv"))
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from .catalog import DEST_BY_CODE
from .generator import event_intensity

REQUIRED = ("date", "dest", "bookings", "lost")


class HistoryError(ValueError):
    pass


def load_history_csv(path: str | Path, min_days: int = 400) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise HistoryError(f"Missing required columns: {', '.join(missing)}. Needed: {', '.join(REQUIRED)}.")
    df["date"] = pd.to_datetime(df["date"])
    unknown = sorted(set(df["dest"]) - set(DEST_BY_CODE))
    if unknown:
        raise HistoryError(f"Destinations not in the catalog: {', '.join(unknown)}. Add them to the catalog JSON first.")
    span = (df["date"].max() - df["date"].min()).days + 1
    if span < min_days:
        raise HistoryError(f"History covers {span} days; at least {min_days} are needed to learn a yearly pattern.")
    for col in ("bookings", "lost"):
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0).clip(lower=0).astype(int)
    df["demand"] = df.get("demand", df["bookings"] + df["lost"])
    df["searches"] = df.get("searches", (df["demand"] * 8).round().astype(int))
    df["cancellations"] = df.get("cancellations", 0)
    df["adr"] = df.get("adr", df["dest"].map(lambda c: DEST_BY_CODE[c].adr))
    if "event_intensity" not in df.columns or "events" not in df.columns:
        ev = [event_intensity(d, t.date()) for d, t in zip(df["dest"], df["date"])]
        df["event_intensity"] = [round(v, 3) for v, _ in ev]
        df["events"] = [n for _, n in ev]
    cols = ["date", "dest", "searches", "demand", "bookings", "lost", "cancellations", "adr", "event_intensity", "events"]
    return df[cols].sort_values(["dest", "date"]).reset_index(drop=True)
