import json

import pandas as pd
import pytest

from atlas.data import catalog as C
from atlas.data.loaders import HistoryError, load_history_csv


def test_catalog_is_large_and_consistent():
    assert len(C.DESTINATIONS) >= 28 and len(C.HUBS) >= 6
    assert len(C.BLOCKS) >= 40 and len(C.SHOCKS) >= 9 and len(C.EVENTS) >= 50
    C.validate(C.CATALOG)  # does not raise


def test_bad_catalog_is_rejected(tmp_path):
    raw = json.loads(C.DEFAULT_PATH.read_text())
    raw["blocks"][0]["dest"] = "NOWHERE"
    raw["blocks"][1]["salvage"] = raw["blocks"][1]["price"] + 1
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(raw))
    with pytest.raises(C.CatalogError) as err:
        C.load_catalog(p)
    assert "unknown destination NOWHERE" in str(err.value) and "salvage < cost < price" in str(err.value)


def test_history_loader_round_trip(engine, tmp_path):
    h = engine.history[["date", "dest", "bookings", "lost"]].copy()
    p = tmp_path / "history.csv"
    h.to_csv(p, index=False)
    loaded = load_history_csv(p)
    assert len(loaded) == len(h)
    assert {"demand", "searches", "event_intensity"} <= set(loaded.columns)
    assert (loaded["demand"] == loaded["bookings"] + loaded["lost"]).all()


def test_history_loader_explains_problems(tmp_path):
    p = tmp_path / "short.csv"
    pd.DataFrame({"date": ["2026-01-01"], "dest": ["GOI"], "bookings": [3]}).to_csv(p, index=False)
    with pytest.raises(HistoryError, match="lost"):
        load_history_csv(p)
    pd.DataFrame({"date": ["2026-01-01"], "dest": ["XXX"], "bookings": [3], "lost": [0]}).to_csv(p, index=False)
    with pytest.raises(HistoryError, match="XXX"):
        load_history_csv(p)
