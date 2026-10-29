# Synthetic data

No dataset was provided, so the generator builds two years of history (4 Nov 2024 to 1 Nov 2026) for 28 destinations across eight regions, fed from six Indian hubs (Delhi, Mumbai, Bengaluru, Hyderabad, Chennai, Kolkata). Everything is defined in `backend/atlas/data/catalog.json`, and every table can be downloaded from the Data page. Each assumption is written down here so judges can check that the model recovers what was planted.

| Pattern | How it is planted | How we show it was recovered |
|---|---|---|
| Seasonality | 12 monthly multipliers per destination (Goa peaks in December, Bali in July, London in June) | Demand map in the Walkthrough; monthly bars on the planner globe |
| Festivals | Calendar intensity on stay dates with a ramp-up: Christmas–New Year +55%, Diwali +40%, Ramadan +65% and Hajj +80% for Makkah, Dev Deepawali +55% for Varanasi, cherry blossom +45% for Tokyo, Holi, Durga Puja, Songkran, Esala Perahera, Christmas markets, school holidays, weddings and the Independence Day long weekend | Forecast `drivers` field; spikes in the planner's forecast chart |
| Moving festivals | Diwali, Holi, Ramadan, Hajj and Durga Puja shift between years | Event-adjusted anchor beats plain last-year naive (9.0% vs 11.2% WAPE) |
| Growth | 16% a year | Year-on-year normaliser estimates 1.10–1.25 per destination |
| Sell-outs | Free-sale capacity is 1.45–1.55× base demand and grows only 8% a year | `lost` column; 4–12% of demand hits sold-out, 31% for peaky Leh |
| Cancellations | 4% (Makkah) to 13% (Manali) of bookings | Net demand used for sizing is reduced by half the cancel rate |
| Weekday rhythm | Friday and Saturday stays are about 20% higher | Absorbed by weekly aggregation |
| Search intent | 6.5–9.5 searches per unit of demand | Look-to-book funnel in the Walkthrough |

## Tables

`python -m scripts.generate_data --out data/` writes:

- `daily_history.csv`: `date, dest, searches, demand, bookings, lost, cancellations, adr, event_intensity, events`
- `weekly_history.csv`: `dest, week, searches, demand, bookings, lost, cancellations, adr, event_intensity, observed_demand`

## Candidate blocks

40 blocks from November 2026 to October 2027: 34 hotel blocks (room-nights) and 6 flight blocks (seats). Each block has:
- a stay window and a share of destination demand,
- a contracted cost, with selling price about 27% above cost for hotels and 22% for flights,
- a salvage value, which is what an unsold unit recovers through release or distressed resale.

## Downloads

The Data page offers `daily_history.csv`, `weekly_history.csv`, `forecast.csv`, `destinations.csv`, `events.csv`, `blocks.csv` and `catalog.json`. `make export` regenerates them.

## Swapping in real data

1. Copy `catalog.json`, edit hubs, destinations, events, blocks and shocks, and set `ATLAS_CATALOG` to the new file. It is validated on load.
2. Export daily history with at least `date, dest, bookings, lost` (400+ days) and run `python -m scripts.run_custom --history my.csv`. See `atlas/data/loaders.py` for optional columns.
