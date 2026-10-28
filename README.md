# Allotment Atlas

**A decision engine for TBO.com that decides which hotel rooms and flight seats to pre-buy, how many, when, and at what selling price, so a fixed budget earns the highest risk-adjusted profit.**

TBO Hackathon, Problem 1: *Inventory Optimization*.

**Live site:** https://shanshantanusingh113-max.github.io/allotment-atlas/
· [Buy Planner](https://shanshantanusingh113-max.github.io/allotment-atlas/planner.html)
· [3D Lab](https://shanshantanusingh113-max.github.io/allotment-atlas/index.html)
· [Walkthrough](https://shanshantanusingh113-max.github.io/allotment-atlas/walkthrough.html)

---

## Results on synthetic data

| | |
|---|---|
| Forecast error (WAPE, 26 unseen weeks) | **8.5%** vs 10.0% for last-year-plus-growth |
| Weeks inside the P10–P90 band | **83%** (target 80%) |
| Plan at ₹8 Cr budget | 22 blocks, **₹2.03 Cr** expected profit (25.7% return) |
| Exact optimiser vs a simple ratio rule | **+₹39.6 L** risk-adjusted |
| Bad season (P10) / worst 5% average | ₹1.95 Cr / ₹1.76 Cr, 0% chance of a loss |
| Browser engine vs Python | Same blocks, quantities and spend; re-plans in under 100 ms |

## Repository

```
allotment-atlas/
├── backend/                 Python engine + FastAPI service
│   ├── atlas/
│   │   ├── data/            catalog (destinations, events, blocks, shocks) · synthetic generator
│   │   ├── forecast/        quantile gradient boosting + event-aware anchor + conformal bands
│   │   ├── optimize/        newsvendor · buy timing · exact budget portfolio
│   │   ├── risk/            correlated Monte Carlo
│   │   ├── explain.py       plain-language reasons
│   │   └── pipeline.py      Engine: data → forecast → decide → simulate
│   ├── app/                 FastAPI routes and schemas
│   ├── scripts/             export_frontend.py · generate_data.py
│   ├── tests/               51 pytest tests
│   └── Dockerfile
├── frontend/                Static site (GitHub Pages)
│   ├── planner.html         Buy Planner: the full engine on a 3D globe
│   ├── index.html           3D Lab: five teaching simulations
│   ├── walkthrough.html     Plan walkthrough, glossary, idea matrix, team board
│   ├── assets/{css,js}/     styles · engine.js · api.js · charts.js · page scripts
│   ├── data/atlas.json      model snapshot exported by the backend
│   └── tests/               browser-engine parity test
├── docs/                    PLAN · ARCHITECTURE · API · DATA · DEMO
├── docker-compose.yml       API + static site
├── Makefile
└── .github/workflows/ci.yml backend tests + parity test
```

## Quick start

```bash
# 1. Backend
cd backend
pip install -r requirements-dev.txt
python -m pytest                      # 51 tests
uvicorn app.main:app --port 8000      # API docs at http://localhost:8000/docs

# 2. Frontend (in another terminal)
cd frontend
python3 -m http.server 5173           # open http://localhost:5173/planner.html
```

On localhost the planner connects to the API automatically. Anywhere else, add `?api=https://your-api-host` to the URL, or let it run the browser engine on `data/atlas.json`.

With Docker: `docker compose up --build`. The site is then on http://localhost:8080 and the API on http://localhost:8000.

`make help` lists the shortcuts: `install`, `test`, `api`, `web`, `export`, `data`.

## How it works

1. **Data:** two years of daily searches, bookings, sell-outs and cancellations for 16 destinations, with a festival calendar. See [docs/DATA.md](docs/DATA.md).
2. **Forecast:** weekly P10/P50/P90 of *unconstrained* demand (bookings plus searches lost to sold-out).
3. **Size:** newsvendor quantity per block, `Q* = μ + σ·Φ⁻¹((p − c)/(p − s))`.
4. **Time:** expected profit by buy day, trading rising rates against shrinking uncertainty.
5. **Choose:** an exact grouped-knapsack DP maximises `E[profit] − λ·SD` under the budget and a per-destination cap.
6. **Stress-test:** 10,000 correlated seasons give P10, CVaR 5% and the chance of a loss; five market shocks re-plan instantly.
7. **Explain:** one sentence per pick, built only from engine numbers.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · API: [docs/API.md](docs/API.md) · Plan and roadmap: [docs/PLAN.md](docs/PLAN.md) · Demo script: [docs/DEMO.md](docs/DEMO.md)

## Deployment

- **Site:** GitHub Pages serves the `gh-pages` branch, a copy of `frontend/`. Run `make export` after changing the model, then publish `frontend/` to `gh-pages`.
- **API:** any container host (Render, Railway, Fly.io, Cloud Run) can run `backend/Dockerfile`. Set `ATLAS_CORS_ORIGINS` to the site's origin.

## Notes

- All data is **synthetic**. No real TBO, customer or supplier data is used.
- The team idea board in `walkthrough.html` saves posts only when the page is opened as a Claude artifact. Elsewhere it shows a notice.
- Front-end libraries come from CDNs: three.js r128 (MIT) and Google Fonts (SIL OFL).
