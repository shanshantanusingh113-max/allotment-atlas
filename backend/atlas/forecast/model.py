"""Weekly quantile demand forecaster.

Approach
--------
1. Target is *unconstrained* demand (bookings + searches lost to sold-out),
   not bookings, because bookings are capped by whatever inventory we held.
2. Each destination's series is normalised by its first-year level and a
   year-on-year growth factor, so one pooled model learns shared shapes
   (festivals, school holidays, weekly rhythm) across all destinations.
3. Three gradient-boosted models predict the P10, P50 and P90 of the
   normalised demand. Features are all known in advance: destination,
   week of year, month, festival intensity and last year's demand.
4. The median is blended 40/60 with an event-adjusted seasonal anchor
   (last year's smoothed demand, re-weighted when a festival moved), and the
   P10-P90 band is widened by split-conformal calibration to cover ~80%.
5. A walk-forward backtest compares P50 against a seasonal-naive baseline
   (last year's demand times growth) and checks P10–P90 coverage.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from ..data.catalog import DESTINATIONS
from ..data.generator import calendar_intensity

QUANTILES = (0.1, 0.5, 0.9)
BLEND_MODEL_WEIGHT = 0.4  # chosen on the walk-forward backtest
DEST_INDEX = {d.code: i for i, d in enumerate(DESTINATIONS)}
FEATURES = ["dest_idx", "woy_sin", "woy_cos", "month", "event_intensity", "lag52", "lag52_smooth"]


@dataclass
class Normaliser:
    level: dict[str, float]
    yoy: dict[str, float]
    origin: pd.Timestamp

    def factor(self, dest: str, week: pd.Timestamp) -> float:
        t = (week - self.origin).days / 7
        return self.level[dest] * self.yoy[dest] ** (t / 52)


def fit_normaliser(weekly: pd.DataFrame) -> Normaliser:
    origin = weekly["week"].min()
    level, yoy = {}, {}
    for dest, g in weekly.groupby("dest"):
        g = g.sort_values("week")
        y = g["observed_demand"].to_numpy(float)
        level[dest] = float(y[:52].mean()) if len(y) >= 52 else float(y.mean())
        if len(y) > 60:
            k = len(y) - 52
            ratio = y[52:].sum() / max(1.0, y[:k].sum())
            yoy[dest] = float(np.clip(ratio, 0.9, 1.45))
        else:
            yoy[dest] = 1.1
    return Normaliser(level, yoy, origin)


def _lags(by_week: dict, norm: "Normaliser", dest: str, week: pd.Timestamp) -> tuple[float, float]:
    """Last year's normalised demand for the same week, raw and 3-week smoothed."""
    vals = []
    for k in (-1, 0, 1):
        w = week - pd.Timedelta(weeks=52 - k)
        v = by_week.get(w)
        vals.append(v / norm.factor(dest, w) if v is not None else np.nan)
    raw = vals[1]
    good = [v for v in vals if not np.isnan(v)]
    smooth = float(np.mean(good)) if good else np.nan
    return raw, smooth


def _features(dest: str, week: pd.Timestamp, lags: tuple[float, float], intensity: float) -> list[float]:
    woy = week.isocalendar().week
    return [DEST_INDEX[dest], np.sin(2 * np.pi * woy / 52), np.cos(2 * np.pi * woy / 52),
            week.month, intensity, lags[0], lags[1]]


def build_frame(weekly: pd.DataFrame, norm: Normaliser) -> pd.DataFrame:
    rows = []
    for dest, g in weekly.groupby("dest"):
        g = g.sort_values("week").reset_index(drop=True)
        by_week = dict(zip(g["week"], g["observed_demand"]))
        for _, r in g.iterrows():
            lags = _lags(by_week, norm, dest, r["week"])
            target = r["observed_demand"] / norm.factor(dest, r["week"])
            rows.append([dest, r["week"], *_features(dest, r["week"], lags, r["event_intensity"]), target])
    return pd.DataFrame(rows, columns=["dest", "week", *FEATURES, "target"])


class DemandForecaster:
    """Pooled quantile gradient-boosting forecaster."""

    def __init__(self, seed: int = 0, calibrate: bool = True, target_coverage: float = 0.8):
        self.seed = seed
        self.calibrate = calibrate
        self.target_coverage = target_coverage
        self.width_scale = 1.0
        self.models: dict[float, HistGradientBoostingRegressor] = {}
        self.norm: Normaliser | None = None
        self.history: pd.DataFrame | None = None

    def fit(self, weekly: pd.DataFrame) -> "DemandForecaster":
        if self.calibrate:
            self.width_scale = self._calibrate_width(weekly)
        self._fit(weekly)
        return self

    def _calibrate_width(self, weekly: pd.DataFrame, holdout: int = 12) -> float:
        """Split-conformal scaling so the P10-P90 band covers ~80% out of sample."""
        cutoff = weekly["week"].max() - pd.Timedelta(weeks=holdout - 1)
        inner = DemandForecaster(self.seed, calibrate=False)._fit(weekly[weekly["week"] < cutoff])
        test = weekly[weekly["week"] >= cutoff]
        scores = []
        for dest, g in test.groupby("dest"):
            p = inner.predict(dest, list(g["week"]))
            a = g["observed_demand"].to_numpy(float)
            lo, mid, hi = p["p10"].to_numpy(), p["p50"].to_numpy(), p["p90"].to_numpy()
            # how much each half-band must stretch to contain the actual
            up = np.where(a >= mid, (a - mid) / np.maximum(hi - mid, 1e-6), 0)
            dn = np.where(a < mid, (mid - a) / np.maximum(mid - lo, 1e-6), 0)
            scores.extend(np.maximum(up, dn))
        return float(np.clip(np.quantile(scores, self.target_coverage), 1.0, 4.0))

    def _fit(self, weekly: pd.DataFrame) -> "DemandForecaster":
        self.history = weekly.copy()
        self.norm = fit_normaliser(weekly)
        frame = build_frame(weekly, self.norm)
        X, y = frame[FEATURES].to_numpy(float), frame["target"].to_numpy(float)
        for q in QUANTILES:
            m = HistGradientBoostingRegressor(
                loss="quantile", quantile=q, max_iter=350, learning_rate=0.05,
                max_leaf_nodes=24, min_samples_leaf=12, l2_regularization=0.5,
                categorical_features=[0], random_state=self.seed,
            )
            m.fit(X, y)
            self.models[q] = m
        return self

    def predict(self, dest: str, weeks: list[pd.Timestamp]) -> pd.DataFrame:
        """Forecast P10/P50/P90 for future Monday-start weeks of one destination."""
        assert self.norm is not None and self.history is not None
        hist = self.history[self.history["dest"] == dest]
        by_week = dict(zip(hist["week"], hist["observed_demand"]))
        rows, drivers = [], []
        anchors = []
        for w in weeks:
            lags = _lags(by_week, self.norm, dest, w)
            intensity, names = calendar_intensity(dest, w.date())
            rows.append(_features(dest, w, lags, intensity))
            drivers.append(names)
            # Event-adjusted seasonal anchor: last year's smoothed demand, re-weighted
            # for festivals that moved between years (Diwali, Ramadan).
            last_intensity, _ = calendar_intensity(dest, (w - pd.Timedelta(weeks=52)).date())
            anchors.append(lags[1] * (1 + intensity) / (1 + last_intensity))
        X = np.array(rows, float)
        preds = np.column_stack([self.models[q].predict(X) for q in QUANTILES])
        preds = np.sort(np.clip(preds, 0.02, None), axis=1)  # enforce P10 <= P50 <= P90
        # Blend the model's median with the anchor where last year is known.
        anchor = np.array(anchors, float)
        has = ~np.isnan(anchor)
        shift = np.where(has, (1 - BLEND_MODEL_WEIGHT) * (np.nan_to_num(anchor) - preds[:, 1]), 0.0)
        preds = preds + shift[:, None]
        mid = preds[:, 1:2]
        preds = mid + (preds - mid) * self.width_scale
        preds = np.clip(preds, 0.02, None)
        scale = np.array([self.norm.factor(dest, w) for w in weeks])
        out = pd.DataFrame({
            "week": weeks,
            "p10": preds[:, 0] * scale,
            "p50": preds[:, 1] * scale,
            "p90": preds[:, 2] * scale,
            "drivers": drivers,
        })
        out["dest"] = dest
        return out

    def forecast_all(self, start: date, n_weeks: int = 52) -> pd.DataFrame:
        monday = pd.Timestamp(start - timedelta(days=start.weekday()))
        weeks = [monday + pd.Timedelta(weeks=k) for k in range(n_weeks)]
        return pd.concat([self.predict(d.code, weeks) for d in DESTINATIONS], ignore_index=True)


def backtest(weekly: pd.DataFrame, holdout_weeks: int = 26, seed: int = 0) -> dict:
    """Train on everything except the last `holdout_weeks`, then score the holdout."""
    cutoff = weekly["week"].max() - pd.Timedelta(weeks=holdout_weeks - 1)
    train, test = weekly[weekly["week"] < cutoff], weekly[weekly["week"] >= cutoff]
    model = DemandForecaster(seed).fit(train)
    preds, naive = [], []
    for dest, g in test.groupby("dest"):
        p = model.predict(dest, list(g["week"]))
        p["actual"] = g["observed_demand"].to_numpy()
        preds.append(p)
        tr = train[train["dest"] == dest].set_index("week")["observed_demand"]
        for w, a in zip(g["week"], g["observed_demand"]):
            last = tr.get(w - pd.Timedelta(weeks=52))
            naive.append((last * model.norm.yoy[dest] if last is not None else np.nan, a))
    P = pd.concat(preds, ignore_index=True)
    n = np.array([x for x in naive if not np.isnan(x[0])])

    def wape(pred, act):
        return float(np.abs(pred - act).sum() / act.sum())

    def pinball(q, pred, act):
        d = act - pred
        return float(np.mean(np.maximum(q * d, (q - 1) * d)))

    per_dest = (
        P.groupby("dest")
        .apply(lambda g: wape(g["p50"].to_numpy(), g["actual"].to_numpy()), include_groups=False)
        .round(4).to_dict()
    )
    return {
        "holdout_weeks": holdout_weeks,
        "train_end": str((cutoff - pd.Timedelta(days=1)).date()),
        "model_wape": round(wape(P["p50"].to_numpy(), P["actual"].to_numpy()), 4),
        "naive_wape": round(wape(n[:, 0], n[:, 1]), 4) if len(n) else None,
        "interval_scale": round(model.width_scale, 3),
        "coverage_p10_p90": round(float(((P["actual"] >= P["p10"]) & (P["actual"] <= P["p90"])).mean()), 4),
        "pinball_p50": round(pinball(0.5, P["p50"].to_numpy(), P["actual"].to_numpy()), 2),
        "per_destination_wape": per_dest,
    }
