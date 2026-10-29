# API reference

Base URL when running locally: `http://localhost:8000`. Interactive docs are at `/docs`.

Money is in INR. `budget_lakh` is in lakh (100 = ₹1 Cr).

| Method | Path | What it returns |
|---|---|---|
| GET | `/health` | `{status, version, plan_date, destinations, candidates}` |
| GET | `/api/destinations` | 28 destinations with coordinates, hub, 12-month P50 forecast, growth and sell-out share |
| GET | `/api/forecast/{dest}?history_weeks=52` | Weekly history (`demand`, `lost`) and 56-week forecast (`p10`, `p50`, `p90`, `drivers`) |
| GET | `/api/backtest` | Walk-forward WAPE vs seasonal naive, coverage, per-destination error |
| GET | `/api/shocks` | Scenario ids, labels and descriptions |
| GET | `/api/candidates?shocks=…` | 40 blocks with μ, σ, P10/P90, price, cost, salvage, critical ratio, Q*, expected profit |
| POST | `/api/optimize` | The plan (see below) |
| GET | `/api/frontier?budget_lakh=800&shocks=…` | Expected profit, SD and P10 for risk aversion 0 to 2 |
| GET | `/api/timing/{block_id}?shocks=…` | Expected profit by buy day and the best day |
| POST | `/api/newsvendor` | Single-block sizing with a profit curve |
| POST | `/api/sensitivity` | For each input pushed low and high: expected profit with the plan fixed (`*_fixed`) and after re-planning for the same risk setting (`*_replanned`) |
| POST | `/api/replay?seed=1` | One simulated season, week by week, for Atlas, the simple rule and last year's volume, plus a 2,000-season scorecard (`avg_final`, `p10_final`, `win_rate`) |

## POST /api/optimize

```json
{
  "budget_lakh": 800,
  "risk_aversion": 0.5,
  "max_share": 0.35,
  "shocks": ["gulf_advisory"],
  "simulations": 10000
}
```

Response (abridged):

```json
{
  "plan_date": "2026-11-02",
  "summary": {
    "spent": 78541000, "budget": 80000000, "expected_profit": 20821983,
    "objective": 20012444, "blocks": 36, "roi": 0.2651,
    "greedy_objective": 14912403, "uplift_vs_greedy": 5100040
  },
  "picks": [{
    "id": "MKK-RAM", "label": "Makkah hotels, Ramadan", "units": 1050,
    "cost": 6405000, "expected_profit": "…", "buy_by": "2026-11-03",
    "explanation": "Buy 1,050 room-nights for Makkah hotels, Ramadan (8 Feb – 9 Mar 2027). …"
  }],
  "skipped": [{"id": "…", "explanation": "Skip …: other blocks earn more per rupee of budget."}],
  "risk": {"mean": "…", "p10": 20500264, "cvar5": 19228085, "prob_loss": 0.0, "histogram": [ … ], "by_block": { … }}
}
```

Errors return HTTP 422 with a `detail` message, for example an unknown shock id or cost above price, and 404 for an unknown destination or block.

## Shock ids

| id | Effect |
|---|---|
| `gulf_advisory` | Dubai demand ×0.65, σ ×1.5 |
| `vietnam_visa` | Da Nang demand ×1.6 |
| `cyclone` | Phuket and Bali demand ×0.7, σ ×1.6 |
| `bangkok_concert` | Bangkok demand ×1.35 |
| `fuel_spike` | Flight block costs ×1.12 |
| `nepal_quake` | Kathmandu demand ×0.55, σ ×1.7 |
| `weak_yen` | Tokyo demand ×1.4 |
| `schengen_delay` | Paris demand ×0.75, σ ×1.3 |
| `hajj_quota` | Makkah demand ×1.25 |

## POST /api/sensitivity and /api/replay

Both take the same body as `/api/optimize`. `*_replanned` maximises risk-adjusted profit, so with a risk appetite above Bold its *expected* profit can sit slightly below the fixed plan's. Replay draws use NumPy's generator in the API and a seeded JavaScript generator in the browser, so the same seed gives different (but statistically equivalent) seasons in each engine.
