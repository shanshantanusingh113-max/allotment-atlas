# Project plan

Allotment Atlas is TBO Hackathon Problem 1, *Inventory Optimization*. TBO can pre-buy hotel rooms and flight seats at contracted rates. Buying well locks in margin and availability. Buying badly leaves unsold, perishable stock. Allotment Atlas decides **what to buy, how much, when, and at what price** under one budget.

## 1. Objectives and how we meet them

| Brief objective | What the system does | Where |
|---|---|---|
| Predict demand | Weekly P10/P50/P90 forecast per destination, from searches, bookings, sell-outs and a festival calendar | `backend/atlas/forecast` |
| Identify opportunities | Forecasts *unconstrained* demand (bookings + searches lost to sold-out), which shows where inventory is short | `backend/atlas/data`, Walkthrough §04 |
| Optimise investments | Newsvendor sizing per block, then an exact budget-constrained portfolio with a per-destination cap | `backend/atlas/optimize` |
| Maximise profit | Buy-timing curve per block and a selling price per pick; risk-adjusted objective `E[profit] − λ·SD` | `optimize/timing.py`, `pipeline.py` |
| Manage risk | Correlated Monte Carlo (global, region and destination shocks) giving P10, CVaR 5% and chance of loss; five market-shock scenarios | `backend/atlas/risk` |

## 2. Scope

**In scope:** synthetic data generator, forecaster with backtest, sizing, timing, portfolio optimiser, Monte Carlo, sensitivity and season replay, plain-language explanations, a REST API, four web pages (landing, Buy Planner, 3D Lab, Walkthrough), tests and CI.

**Out of scope for the hackathon:** real TBO data connections, live supplier rate feeds, sign-in and roles, writing back to booking systems. Section 6 shows where each would plug in.

## 3. Repository layout

```
allotment-atlas/
├── backend/            Python engine and FastAPI service
│   ├── atlas/          data · forecast · optimize · risk · explain · pipeline
│   ├── app/            HTTP API (FastAPI)
│   ├── scripts/        export_frontend.py, generate_data.py
│   └── tests/          55 pytest tests
├── frontend/           Static site (GitHub Pages)
│   ├── index.html      Landing page
│   ├── lab.html        3D Lab: five teaching simulations
│   ├── planner.html    Buy Planner: the full engine on a 3D globe
│   ├── walkthrough.html Plan walkthrough, glossary, idea matrix, team board
│   ├── assets/css, assets/js
│   ├── data/atlas.json Model snapshot exported by the backend
│   └── tests/          Browser-engine parity test (Node)
├── docs/               Plan, architecture, API, data and demo script
└── .github/workflows/  CI: backend tests and frontend parity
```

## 4. Milestones

| # | Milestone | Done when | Status |
|---|---|---|---|
| M0 | Problem chosen, plan and explainer pages | Walkthrough and 3D Lab live | ✅ |
| M1 | Synthetic data with planted patterns | Generator reproduces seasonality, festivals, growth, sell-outs | ✅ |
| M2 | Forecaster beats seasonal naive | Backtest WAPE 8.5% vs 10.0%; P10–P90 coverage 83% | ✅ |
| M3 | Sizing, timing and exact portfolio | DP matches brute force; beats greedy by ₹39.6 L at ₹8 Cr | ✅ |
| M4 | Risk engine and shocks | Monte Carlo with correlated shocks; five scenarios | ✅ |
| M5 | API and Buy Planner | FastAPI service; planner switches between API and browser engine | ✅ |
| M6 | Tests, CI, deploy | 51 backend tests, parity test, GitHub Pages | ✅ |
| M7 | Decision tools | Command bar, buy calendar, tornado, season replay, scenarios, CSV, landing page | ✅ |
| M8 | Hackathon polish | Rehearse demo, record backup video, swap in TBO data if provided | Next |

## 5. Team split (four people)

| Role | Owns | Hand-off contract |
|---|---|---|
| Data and ML | `atlas/data`, `atlas/forecast` | Weekly forecast frame: `dest, week, p10, p50, p90, drivers` |
| Optimisation | `atlas/optimize`, `atlas/risk` | `Engine.optimize()` JSON, documented in `docs/API.md` |
| Frontend | `frontend/` | Consumes only the API shapes; works offline on `atlas.json` |
| Backend and story | `app/`, docs, demo | Deployed API, pitch deck, demo script |

## 6. From hackathon to production

1. **Real data.** Replace `generate_history()` with a loader that produces the same weekly frame from TBO search and booking logs. Nothing downstream changes.
2. **Supplier rates.** Replace the `timing.rate_multiplier` curve with each hotel's quoted rates by lead time.
3. **Solver.** The grouped knapsack is exact and fast for about 25 blocks. For thousands of blocks, swap `portfolio.solve()` for OR-Tools CP-SAT with the same inputs.
4. **Re-planning.** Run the optimiser nightly as new bookings land. Released soft allotments and markdowns become extra decisions.
5. **Explanations.** Keep the numbers template-driven. An LLM may rephrase them but must never be their source.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Synthetic data looks fake | Every assumption is in `docs/DATA.md`, and the backtest shows the model recovering the planted patterns |
| Judges get lost in maths | Lead with the 3D globe and the buy list; formulas live in the Walkthrough |
| API down during the demo | The planner falls back to the in-browser engine, which is tested to match Python exactly |
| Over-confidence | Lead-time market uncertainty widens bands for far-out blocks; Monte Carlo shows the tails |

## 8. Ideas backlog

21 extensions are ranked by impact and effort in Walkthrough §14. Top quick wins: smart release engine for soft allotments, airfare as a hotel-demand signal, ask-the-optimiser chat, and a season time-machine backtest.
