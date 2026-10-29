"""Run the full pipeline on your own catalog and/or history, and write a frontend snapshot.

    ATLAS_CATALOG=my_catalog.json python -m scripts.run_custom --history my_history.csv --out ../frontend/data/atlas.json

Both inputs are optional: leave out --history to use synthetic history for your catalog.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from atlas.data.loaders import load_history_csv  # noqa: E402
from atlas.pipeline import Engine  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--history", help="daily history CSV (see atlas/data/loaders.py)")
    ap.add_argument("--out", default=str(ROOT.parent / "frontend" / "data" / "atlas.json"))
    args = ap.parse_args()
    history = load_history_csv(args.history) if args.history else None
    payload = Engine(history=history).export(Path(args.out))
    s = payload["default_plan"]["summary"]
    print(f"Wrote {args.out}: {len(payload['destinations'])} destinations, {len(payload['candidates'])} blocks, "
          f"plan spends {s['spent'] / 1e7:.2f} Cr for {s['expected_profit'] / 1e7:.2f} Cr expected profit")


if __name__ == "__main__":
    main()
