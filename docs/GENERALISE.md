# Making Allotment Atlas generic

Today the engine plans hotel rooms and flight seats for one synthetic Indian distributor. The maths is not travel-specific: it applies to any business that commits money up front for perishable capacity, for example event tickets, cruise cabins, transfers, rail seats, ad slots, cloud capacity, or seasonal retail stock. This page lists what is already generic and what to add next, in priority order.

## Already generic

| Area | How |
|---|---|
| **World definition** | Hubs, destinations, events, blocks and shocks live in `backend/atlas/data/catalog.json`. Point `ATLAS_CATALOG` at another file to plan for a different business. The file is validated on load with readable errors. |
| **History** | `atlas/data/loaders.py` accepts any daily CSV with `date, dest, bookings, lost`. Missing optional columns are filled in. `scripts/run_custom.py` runs the whole pipeline on it. |
| **Units** | Blocks carry a `kind` and the engine only sees units, cost, price and recovery, so a "room-night" could be a seat, a ticket or a cabin. |
| **Frontend** | Every page reads counts, names, shocks and dates from the exported snapshot; nothing is hard-coded to 28 destinations or 40 blocks. |
| **Engines** | The same optimiser runs in Python (API) and in the browser, with a parity test keeping them identical. |

## What to add next

### Now: small changes, big reach

1. **Product types as config.** Add `unit_types` to the catalog (label, plural, icon, default contract terms) and replace the hotel/flight checks in the UI and explanations with lookups. Activities, transfers, cruise cabins and rail seats then work with no code change.
2. **Currency and locale.** Add `currency`, `locale` and an FX table to `meta`. Format money from config instead of assuming INR, and allow costs in one currency and prices in another.
3. **Contract terms per block.** Model soft allotments with a release date and penalty, minimum nights, deposits and payment dates. Each becomes extra options for the optimiser and changes the recovery value.
4. **Upload in the browser.** A Data-page form that accepts a catalog JSON and a history CSV, validates them with the same rules, and runs the browser engine on them. Nothing leaves the user's machine.
5. **Configurable constraints.** Move the per-destination cap into a list of rules such as caps per region, per supplier or per month of cash outflow, minimum number of destinations, and blocks that must or must not be bought.

### Next: deeper modelling

6. **Pluggable forecasters.** Define a `Forecaster` interface (`fit(weekly)`, `predict(dest, weeks)`) and register LightGBM, Prophet or a neural model alongside the current one. Pick per destination using the backtest.
7. **Hierarchy and cold start.** Forecast region → destination → hotel and reconcile the levels. New destinations borrow the shape of similar ones until they have a year of history.
8. **External signals.** Airfare and seat sell-outs, events APIs, weather and disaster alerts, visa policy, FX and competitor rates as forecast features and as automatic shocks.
9. **Substitution.** When one hotel sells out, part of its demand moves to similar hotels. Add a substitution matrix so the optimiser does not over-count overlapping demand.
10. **Rolling decisions.** Re-plan weekly as bookings arrive, with release-or-hold decisions for soft allotments and markdown pricing for slow blocks: a multi-stage problem instead of a single buy.

### Later: product and operations

11. **Persistence and learning loop.** Store plans, decisions and actual outcomes in a database, compare forecast with reality after each season, and track forecast and profit accuracy over time.
12. **Multi-tenant and roles.** Organisations, users, approval workflow for buys above a limit, an audit log, and alerts by email or chat when a buy window opens.
13. **Scale.** For thousands of blocks, switch `portfolio.solve()` to OR-Tools CP-SAT with the same inputs, and run Monte Carlo in a vectorised worker.
14. **Admin UI.** Edit destinations, events, blocks and shocks in the browser instead of JSON, with validation as you type.
15. **Hosting.** Deploy the API, schedule nightly re-plans, monitor model drift, and version every model and catalog that produced a plan.

## Suggested order for the hackathon

If time allows only a few, do **1, 2, 4 and 5**. They let judges see the same engine plan a cruise line or an events business by swapping a file, which is the clearest proof that the solution is generic.
