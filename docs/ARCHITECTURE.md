# Architecture

```mermaid
flowchart LR
  subgraph Data
    G[generator.py<br/>2 years · 16 destinations] --> W[weekly frame<br/>observed demand = bookings + lost]
    C[catalog.py<br/>destinations · events · blocks · shocks]
  end
  subgraph Forecast
    W --> F[DemandForecaster<br/>quantile GBM + event-aware anchor<br/>conformal P10–P90]
    F --> BT[walk-forward backtest]
  end
  subgraph Decide
    F --> CA[candidates<br/>block μ, σ + lead-time market risk]
    C --> CA
    CA --> NV[newsvendor<br/>Q*, E, SD per option]
    NV --> PF[portfolio.solve<br/>grouped knapsack DP]
    CA --> TM[timing.curve<br/>best buy day]
  end
  subgraph Risk
    PF --> MC[Monte Carlo<br/>global · region · destination shocks]
  end
  PF --> EX[explain.py] --> API[(FastAPI)]
  MC --> API
  TM --> API
  BT --> API
  API --> UI[Buy Planner]
  PF -. export_frontend.py .-> SNAP[data/atlas.json] --> JS[engine.js<br/>browser port] --> UI
```

## Components

### Data (`backend/atlas/data`)
- **catalog.py** holds the reference data: 16 destinations with monthly demand profiles, cancellation rates and capacity; a festival calendar from 2024 to 2027; 22 candidate blocks (hotel room-nights and flight seats) for November 2026 to October 2027; and five market shocks.
- **generator.py** simulates daily stay-date demand: base × month profile × weekday × (1 + event intensity) × 16% annual growth × lognormal noise. Free-sale capacity grows only 8% a year, so peaks sell out more each year. It records bookings, searches lost to sold-out, cancellations, searches and ADR.

### Forecast (`backend/atlas/forecast/model.py`)
1. The target is unconstrained demand, not bookings.
2. Each destination is normalised by its first-year level and year-on-year growth, so one pooled model learns shared shapes.
3. `HistGradientBoostingRegressor` with quantile loss is trained for P10, P50 and P90. Features: destination, week-of-year (sin/cos), month, event intensity, last year's demand (raw and 3-week smoothed).
4. The median is blended 40/60 with an event-adjusted seasonal anchor, which re-weights last year when a festival moved, for example Diwali or Ramadan.
5. Split-conformal calibration widens the band until about 80% of held-out weeks fall inside.

The walk-forward backtest (26 held-out weeks) gives model WAPE 8.5%, seasonal-naive WAPE 10.0%, and 83% P10–P90 coverage.

### Decide (`backend/atlas/optimize`)
- **newsvendor.py:** `Q* = μ + σ·Φ⁻¹((p−c)/(p−s))`. Expected profit and SD are computed on an 800-point normal quantile grid, so they are deterministic and accurate to about 0.1%.
- **Candidates (`pipeline.py`):** block demand is the forecast summed over the stay window × the block's share × (1 − ½·cancel rate). σ combines the model band (adjacent weeks correlated at 0.5) with market uncertainty, whose coefficient of variation grows from 10% to 24% over 240 days of lead time.
- **portfolio.py:** each block offers 0–125% of Q*. Blocks are grouped by destination, every within-destination combination is enumerated, combinations over the destination cap are dropped, and a vectorised DP runs on a ₹1 lakh grid. This is exact; tests compare it with brute force. A greedy ratio rule is kept as the baseline.
- **timing.py:** expected value of buying L days out = P(still offered) × E[profit at Q*(rate(L), σ(L))].

### Risk (`backend/atlas/risk/montecarlo.py`)
`z = √0.15·Z_global + √0.20·Z_region + √0.25·Z_dest + √0.40·ε`. 10,000 seasons per plan produce the mean, SD, P5/P10/P50/P90, CVaR 5%, P(loss), a histogram and per-block sell-through.

### Analyse (`backend/atlas/analysis.py`)
- **sensitivity():** six factors (demand ±15%, price ±5%, supplier rate ±5%, σ ±30%, recovery ±50%, flight cost ±10%). For each, expected profit with the plan held fixed and after re-planning.
- **replay():** one correlated draw of realised demand. Each policy pays its spend on the plan date and earns revenue as stays happen. Policies: Atlas, the greedy ratio rule, and last year's volume (scaled to the budget). A 2,000-season scorecard reports average, P10 and how often each policy finishes first.

### Explain (`backend/atlas/explain.py`)
Templates only: every figure in a sentence comes from the engine.

### Serve (`backend/app`)
FastAPI with CORS. The engine trains once at startup in about 10 seconds. See `docs/API.md`.

### Frontend (`frontend/`)
- **planner.html:** a three.js globe whose bars are monthly P50 demand, coloured by what the plan buys, with arcs from hubs. It also shows the buy list, detail drawer (explanation, forecast chart, timing chart), Monte Carlo histogram, frontier and backtest.
- **engine.js:** a line-for-line port of the optimiser, timing, Monte Carlo and explanations. `frontend/tests/engine.test.mjs` asserts that it reproduces the Python plan exactly (same blocks, quantities, spend and buy-by dates).
- **api.js:** uses the API when `?api=` is set, or on localhost, and otherwise the browser engine.
- **index.html:** the landing page, with live numbers, an auto-playing globe and an in-page planner.
- **planner.html** also has a rule-based command bar, buy calendar and alerts, tornado, season race, scenario compare (localStorage), CSV export and URL parameters.
- **lab.html** (3D Lab) and **walkthrough.html** are teaching pages.
