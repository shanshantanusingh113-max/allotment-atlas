import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client(engine):
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_destinations_and_forecast(client):
    dests = client.get("/api/destinations").json()
    assert len(dests) == 16
    f = client.get("/api/forecast/goi").json()
    assert f["dest"] == "GOI" and len(f["forecast"]) >= 52
    assert client.get("/api/forecast/XXX").status_code == 404


def test_optimize_round_trip(client):
    r = client.post("/api/optimize", json={"budget_lakh": 400, "shocks": ["fuel_spike"], "simulations": 1000})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["spent"] <= 400 * 1e5
    assert body["risk"]["histogram"]


def test_unknown_shock_is_rejected(client):
    r = client.post("/api/optimize", json={"shocks": ["meteor"]})
    assert r.status_code == 422 and "meteor" in r.json()["detail"]


def test_newsvendor_endpoint(client):
    r = client.post("/api/newsvendor", json={"mu": 120, "sigma": 35, "price": 8500, "cost": 6000, "salvage": 1500})
    body = r.json()
    assert r.status_code == 200 and 0 < body["optimal_quantity"] < 120
    bad = client.post("/api/newsvendor", json={"mu": 1, "sigma": 1, "price": 5, "cost": 9})
    assert bad.status_code == 422


def test_timing_and_frontier(client):
    assert client.get("/api/timing/GOI-NYE").status_code == 200
    assert client.get("/api/timing/NOPE").status_code == 404
    pts = client.get("/api/frontier", params={"budget_lakh": 600}).json()
    assert len(pts) >= 5


def test_sensitivity_and_replay_endpoints(client):
    s = client.post("/api/sensitivity", json={"budget_lakh": 500})
    assert s.status_code == 200 and len(s.json()["factors"]) == 6
    r = client.post("/api/replay?seed=7", json={"budget_lakh": 500})
    assert r.status_code == 200 and r.json()["seed"] == 7
