"""Run the full pipeline and write the snapshot the static frontend uses.

    python -m scripts.export_frontend            # writes ../frontend/data/atlas.json
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from atlas.pipeline import Engine  # noqa: E402

OUT = ROOT.parent / "frontend" / "data" / "atlas.json"


def write_datasets(engine: Engine, folder: Path) -> list[Path]:
    """Downloadable CSVs for the Data page."""
    import shutil

    import pandas as pd

    from atlas.data.catalog import BLOCKS, DEFAULT_PATH, DESTINATIONS, EVENTS

    folder.mkdir(parents=True, exist_ok=True)
    out = []
    daily = engine.history.copy()
    daily["date"] = daily["date"].dt.strftime("%Y-%m-%d")
    out.append(folder / "daily_history.csv"); daily.to_csv(out[-1], index=False)
    wk = engine.weekly.copy(); wk["week"] = wk["week"].dt.strftime("%Y-%m-%d"); wk["adr"] = wk["adr"].round()
    out.append(folder / "weekly_history.csv"); wk.to_csv(out[-1], index=False)
    fc = engine.forecast.copy(); fc["week"] = fc["week"].dt.strftime("%Y-%m-%d")
    fc[["p10", "p50", "p90"]] = fc[["p10", "p50", "p90"]].round(1)
    out.append(folder / "forecast.csv"); fc[["dest", "week", "p10", "p50", "p90", "drivers"]].to_csv(out[-1], index=False)
    out.append(folder / "destinations.csv")
    pd.DataFrame([{"code": d.code, "name": d.name, "lat": d.lat, "lng": d.lng, "hub": d.hub, "region": d.region,
                   "base_daily": d.base_daily, "adr": d.adr, "cancel_rate": d.cancel_rate,
                   **{f"m{i + 1:02d}": v for i, v in enumerate(d.profile)}} for d in DESTINATIONS]).to_csv(out[-1], index=False)
    out.append(folder / "events.csv")
    pd.DataFrame([{"name": e.name, "start": e.start, "end": e.end, "intensity": e.intensity,
                   "destinations": " ".join(e.destinations) or "ALL"} for e in EVENTS]).to_csv(out[-1], index=False)
    out.append(folder / "blocks.csv")
    pd.DataFrame([{"id": b.id, "dest": b.dest, "label": b.label, "kind": b.kind, "start": b.start, "end": b.end,
                   "share": b.share, "cost": b.cost, "price": b.price, "salvage": b.salvage} for b in BLOCKS]).to_csv(out[-1], index=False)
    out.append(folder / "catalog.json"); shutil.copy(DEFAULT_PATH, out[-1])
    return out


def main() -> None:
    t = time.time()
    engine = Engine()
    payload = engine.export(OUT)
    import json

    files = write_datasets(engine, OUT.parent)
    manifest = []
    for f in files:
        rows = sum(1 for _ in f.open(encoding="utf-8")) - 1 if f.suffix == ".csv" else None
        manifest.append({"file": f.name, "bytes": f.stat().st_size, "rows": rows})
        print(f"  dataset {f.name}: {f.stat().st_size / 1024:.0f} KB")
    payload["datasets"] = manifest
    OUT.write_text(json.dumps(payload, separators=(",", ":"), default=str))
    bt = payload["backtest"]
    s = payload["default_plan"]["summary"]
    print(f"Wrote {OUT.relative_to(ROOT.parent)} ({OUT.stat().st_size / 1024:.0f} KB) in {time.time() - t:.1f}s")
    print(f"  forecast WAPE {bt['model_wape']:.1%} vs seasonal naive {bt['naive_wape']:.1%}, "
          f"P10-P90 coverage {bt['coverage_p10_p90']:.0%}")
    print(f"  default plan: {s['blocks']} blocks, spend ₹{s['spent'] / 1e7:.2f} Cr, "
          f"expected profit ₹{s['expected_profit'] / 1e7:.2f} Cr")


if __name__ == "__main__":
    main()
