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


def main() -> None:
    t = time.time()
    engine = Engine()
    payload = engine.export(OUT)
    bt = payload["backtest"]
    s = payload["default_plan"]["summary"]
    print(f"Wrote {OUT.relative_to(ROOT.parent)} ({OUT.stat().st_size / 1024:.0f} KB) in {time.time() - t:.1f}s")
    print(f"  forecast WAPE {bt['model_wape']:.1%} vs seasonal naive {bt['naive_wape']:.1%}, "
          f"P10-P90 coverage {bt['coverage_p10_p90']:.0%}")
    print(f"  default plan: {s['blocks']} blocks, spend ₹{s['spent'] / 1e7:.2f} Cr, "
          f"expected profit ₹{s['expected_profit'] / 1e7:.2f} Cr")


if __name__ == "__main__":
    main()
