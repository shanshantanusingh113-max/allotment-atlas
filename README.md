# Allotment Atlas

**A decision engine for TBO.com that decides which hotel rooms and flight seats to pre-buy, how many, when, and at what selling price, so a fixed budget earns the highest risk-adjusted profit.**

Built for the TBO Hackathon, Problem 1: *Inventory Optimization*.

---

## What's in this repo

| Path | What it is |
|---|---|
| `site/index.html` | **Allotment Atlas 3D**: a simulation lab with a 3D route globe and five interactive simulations |
| `site/walkthrough.html` | **Allotment Atlas walkthrough**: the full plan explained step by step, with a glossary, live demos, a 21-idea roadmap and a team idea board |

Both pages are single, self-contained HTML files. No build step.

## Run it

Open either file in a browser, or serve the folder:

```bash
cd site
python3 -m http.server 8000
# then open http://localhost:8000
```

To publish with GitHub Pages: **Settings → Pages → Deploy from branch → `main` / `/site`**.

> The team idea board in `walkthrough.html` saves posts only when the page is opened as a Claude artifact. Everywhere else it shows a notice and the rest of the page works normally.

## The five simulations (`site/index.html`)

| # | Simulation | What it shows |
|---|---|---|
| 01 | **Season in a hotel** (3D) | A 240-room Goa hotel plays out 90 days. You choose the pre-bought block, demand level and cancellation rate, and watch bookings, sell-outs, lost searches and profit unfold. |
| 02 | **Agency swarm** | Searches fly from Delhi, Mumbai, Bengaluru and Dubai to five destinations. They book when stock exists and bounce when it doesn't. Unsold stock is wasted each day. |
| 03 | **Forecast surface** (3D) | Bookings on hand by stay date × days before arrival. It separates what's already booked from what must be forecast, and includes a concert-shock toggle. |
| 04 | **Profit landscape** (3D) + **Monte Carlo** | Expected profit for every block size and level of forecast uncertainty, with the optimal ridge. A 5,000-season simulation compares any block with the best one. |
| 05 | **Portfolio city** (3D) | Sixteen candidate blocks compete for one budget under five market shocks, and the optimizer re-plans live. |

## How the engine works

1. **Data layer:** synthetic searches, bookings, cancellations, sell-outs, supplier rate cards, a festival calendar and external signals (FX, visa, fuel).
2. **Intelligence layer**
   - Demand forecast: a pickup model on booking curves plus a LightGBM quantile model, giving P10/P50/P90 per destination-week.
   - Look-to-book gap: searches that didn't convert, read as unmet demand.
   - Price elasticity and cancellation models.
3. **Decision layer**
   - Per-block **newsvendor**: `critical ratio = (p − c) / (p − s)`, `Q* = μ + σ · Φ⁻¹(critical ratio)`.
   - **Buy timing**: balancing supplier rates rising toward the stay date against forecast uncertainty shrinking.
   - **Portfolio optimizer**: maximizes expected profit − λ·risk under the budget (CP-SAT / PuLP in production; greedy in the demos).
   - **Monte Carlo risk**: profit distribution, P10 downside, CVaR.
4. **Experience layer:** a dashboard, an LLM "explain my pick" panel and a FastAPI service.

## Planned stack

Python · pandas · DuckDB · LightGBM · Prophet · OR-Tools / PuLP · NumPy · FastAPI · React · Three.js

Front-end libraries used by the current pages (loaded from CDNs):
- [Three.js r128](https://threejs.org/), MIT license
- Google Fonts: Big Shoulders Display, IBM Plex Sans, IBM Plex Mono (SIL Open Font License)

## Roadmap

The walkthrough's "What we could add next" section ranks 21 extensions by impact and effort. Quick wins include:
- a smart release engine for soft allotments,
- airfare as a hotel-demand signal,
- an ask-the-optimizer chat,
- a season "time machine" backtest.

## Data disclaimer

All figures are **synthetic and illustrative**. No real TBO, customer or supplier data is used.
