"""Write the synthetic history to CSV for inspection or use in notebooks.

    python -m scripts.generate_data --out data/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from atlas.data.generator import generate_history, weekly  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default=str(ROOT / "data"), help="output folder")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    daily = generate_history(args.seed)
    week = weekly(daily)
    daily.to_csv(out / "daily_history.csv", index=False)
    week.to_csv(out / "weekly_history.csv", index=False)
    print(f"daily rows: {len(daily):,}  weekly rows: {len(week):,}  -> {out}")


if __name__ == "__main__":
    main()
