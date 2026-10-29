# Allotment Atlas

**A decision engine for TBO.com that decides which hotel rooms and flight seats to pre-buy, how many, when, and at what selling price, so a fixed budget earns the highest risk-adjusted profit.**

TBO Hackathon, Problem 1: *Inventory Optimization*.

**Live site:** https://shanshantanusingh113-max.github.io/allotment-atlas/
· [Buy Planner](https://shanshantanusingh113-max.github.io/allotment-atlas/planner.html)
· [Data](https://shanshantanusingh113-max.github.io/allotment-atlas/data.html)
· [3D Lab](https://shanshantanusingh113-max.github.io/allotment-atlas/lab.html)
· [Walkthrough](https://shanshantanusingh113-max.github.io/allotment-atlas/walkthrough.html)

---

## Results on synthetic data

| | |
|---|---|
| Dataset | 28 destinations, 6 hubs, 50 event dates, 40 inventory blocks, 9 market shocks, 20,384 daily rows |
| Forecast error (WAPE, 26 unseen weeks) | **9.0%** vs 11.2% for last-year-plus-growth |
| Weeks inside the P10–P90 band | **84%** (target 80%) |
| Plan at ₹8 Cr budget | 36 blocks, **₹2.08 Cr** expected profit (26.5% return) |
| Exact optimiser vs a simple ratio rule | **+₹51.0 L** risk-adjusted |
| Bad season (P10) / worst 5% average | ₹2.05 Cr / ₹1.92 Cr, 0% chance of a loss |
| 2,000 simulated seasons at ₹8 Cr | Atlas finishes first in 83%; averages ₹24.9 L more than the simple rule with a ₹59 L better bad season |
| Browser engine vs Python | Same blocks, quantities and spend; re-plans in under 100 ms |

## Features

| | |
|---|---|
| **Landing page** | Opening sequence, live headline numbers, an auto-playing demand globe that spins in, and an in-page planner |
| **Page transitions** | Animated transitions between pages (View Transitions, with a fallback), a sliding nav indicator and scroll reveals |
| **Data explorer** | Browse destinations with monthly sparklines, the event calendar and every block; download seven dataset files |
| **Bring your own data** | Swap the JSON catalog and/or a daily history CSV; both are validated with clear errors |
| **3D demand globe** | Bars rise and fall with each month's forecast; colour shows what the plan buys; arcs show spend from each hub |
| **Ask the planner** | Plain-English commands: "budget 12 crore, careful, gulf advisory", "cut 3 crore", "show July", "why Makkah" |
| **Buy list with reasons** | Units, cost, expected profit, buy-by date and a one-sentence explanation per block; CSV export |
| **Buy calendar and alerts** | Each contract's best signing day against its stay window; this week's deadlines flagged |
| **Risk** | 10,000 correlated seasons, P10, worst-5% average, chance of loss, risk–return frontier, five market shocks |
| **What moves profit** | Tornado chart of price, supplier rate, flight costs, uncertainty, demand and recovery |
| **Season replay** | One simulated year races Atlas against the simple rule and last year's volume, plus a 2,000-season scorecard |
| **Scenario compare** | Save up to four plans and compare spend, profit, bad season and what changed |
| **Shareable links** | `planner.html?budget=1200&risk=1&shocks=cyclone` opens with those settings |
| **Live API or offline** | Uses the FastAPI service when reachable; otherwise the browser engine, tested to match Python |

## Repository

```
allotment-atlas/
├── backend/                 Python engine + FastAPI service
│   ├── atlas/
│   │   ├── data/            catalog.json + loader · synthetic generator · CSV loader for your own data
│   │   ├── forecast/        quantile gradient boosting + event-aware anchor + conformal bands
│   │   ├── optimize/        newsvendor · buy timing · exact budget portfolio
│   │   ├── risk/            correlated Monte Carlo
│   │   ├── analysis.py      sensitivity (tornado) and season replay
│   │   ├── explain.py       plain-language reasons
│   │   └── pipeline.py      Engine: data → forecast → decide → simulate
│   ├── app/                 FastAPI routes and schemas
│   ├── scripts/             export_frontend.py · generate_data.py · run_custom.py
│   ├── tests/               59 pytest tests
│   └── Dockerfile
├── frontend/                Static site (GitHub Pages)
│   ├── index.html           Landing page
│   ├── planner.html         Buy Planner: the full engine on a 3D globe
│   ├── data.html            Data explorer and downloads
│   ├── lab.html             3D Lab: five teaching simulations
│   ├── walkthrough.html     Plan walkthrough, glossary, idea matrix, team board
│   ├── assets/{css,js}/     styles · engine.js · api.js · charts.js · page scripts
│   ├── data/                model snapshot (atlas.json) and downloadable CSVs
│   └── tests/               browser-engine parity test
├── docs/                    PLAN · ARCHITECTURE · API · DATA · DEMO · GENERALISE
├── docker-compose.yml       API + static site
├── Makefile
└── .github/workflows/ci.yml backend tests + parity test
```

## Quick start

```bash
# 1. Backend
cd backend
pip install -r requirements-dev.txt
python -m pytest                      # 59 tests
uvicorn app.main:app --port 8000      # API docs at http://localhost:8000/docs

# 2. Frontend (in another terminal)
cd frontend
python3 -m http.server 5173           # open http://localhost:5173/planner.html
```

On localhost the planner connects to the API automatically. Anywhere else, add `?api=https://your-api-host` to the URL, or let it run the browser engine on `data/atlas.json`.

With Docker: `docker compose up --build`. The site is then on http://localhost:8080 and the API on http://localhost:8000.

`make help` lists the shortcuts: `install`, `test`, `api`, `web`, `export`, `data`.

## How it works

1. **Data:** two years of daily searches, bookings, sell-outs and cancellations for 28 destinations, with a 50-date festival calendar. See [docs/DATA.md](docs/DATA.md).
2. **Forecast:** weekly P10/P50/P90 of *unconstrained* demand (bookings plus searches lost to sold-out).
3. **Size:** newsvendor quantity per block, `Q* = μ + σ·Φ⁻¹((p − c)/(p − s))`.
4. **Time:** expected profit by buy day, trading rising rates against shrinking uncertainty.
5. **Choose:** an exact grouped-knapsack DP maximises `E[profit] − λ·SD` under the budget and a per-destination cap.
6. **Stress-test:** 10,000 correlated seasons give P10, CVaR 5% and the chance of a loss; five market shocks re-plan instantly.
7. **Explain:** one sentence per pick, built only from engine numbers.
8. **Analyse:** a tornado of the inputs that move profit, and a season replay against two common buying rules.

Making it generic: [docs/GENERALISE.md](docs/GENERALISE.md) · Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · API: [docs/API.md](docs/API.md) · Plan and roadmap: [docs/PLAN.md](docs/PLAN.md) · Demo script: [docs/DEMO.md](docs/DEMO.md)

## Deployment

- **Site:** GitHub Pages serves the `gh-pages` branch, a copy of `frontend/`. Run `make export` after changing the model, then publish `frontend/` to `gh-pages`.
- **API:** any container host (Render, Railway, Fly.io, Cloud Run) can run `backend/Dockerfile`. Set `ATLAS_CORS_ORIGINS` to the site's origin.

## Notes

- All data is **synthetic**. No real TBO, customer or supplier data is used.
- The team idea board in `walkthrough.html` saves posts only when the page is opened as a Claude artifact. Elsewhere it shows a notice.
- Front-end libraries come from CDNs: three.js r128 (MIT) and Google Fonts (SIL OFL).
