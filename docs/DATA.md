# Synthetic data

No dataset was provided, so the generator builds two years of history (4 Nov 2024 to 1 Nov 2026) for 16 destinations. Each assumption is written down here so judges can check that the model recovers what was planted.

| Pattern | How it is planted | How we show it was recovered |
|---|---|---|
| Seasonality | 12 monthly multipliers per destination (Goa peaks in December, Bali in July, London in June) | Demand map in the Walkthrough; monthly bars on the planner globe |
| Festivals | Calendar intensity on stay dates with a ramp-up: Christmas–New Year +55%, Diwali +40%, Ramadan +65% for Makkah, school holidays +30%, weddings +35% | Forecast `drivers` field; spikes in the planner's forecast chart |
| Moving festivals | Diwali and Ramadan dates shift between years | Event-adjusted anchor beats plain last-year naive (8.5% vs 10.0% WAPE) |
| Growth | 16% a year | Year-on-year normaliser estimates 1.10–1.25 per destination |
| Sell-outs | Free-sale capacity is 1.55× base demand and grows only 8% a year | `lost` column; 4–11% of demand hits sold-out |
| Cancellations | 4% (Makkah) to 13% (Manali) of bookings | Net demand used for sizing is reduced by half the cancel rate |
| Weekday rhythm | Friday and Saturday stays are about 20% higher | Absorbed by weekly aggregation |
| Search intent | 6.5–9.5 searches per unit of demand | Look-to-book funnel in the Walkthrough |

## Tables

`python -m scripts.generate_data --out data/` writes:

- `daily_history.csv`: `date, dest, searches, demand, bookings, lost, cancellations, adr, event_intensity, events`
- `weekly_history.csv`: `dest, week, searches, demand, bookings, lost, cancellations, adr, event_intensity, observed_demand`

## Candidate blocks

22 blocks from November 2026 to October 2027: 18 hotel blocks (room-nights) and 4 flight blocks (seats). Each block has:
- a stay window and a share of destination demand,
- a contracted cost, with selling price about 27% above cost for hotels and 22% for flights,
- a salvage value, which is what an unsold unit recovers through release or distressed resale.

## Swapping in real data

Write a loader that returns the same weekly frame (`dest, week, observed_demand, lost, event_intensity, …`) from TBO logs and pass it to `DemandForecaster.fit()`. The catalog's destinations and blocks can be loaded from a supplier contract table in the same way.
