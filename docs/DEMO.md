# Four-minute demo script

Open the **Buy Planner**. Keep the 3D Lab and Walkthrough in other tabs as backup.

| Time | Screen | Say | Do |
|---|---|---|---|
| 0:00 | Planner, top | "TBO can pre-buy rooms and seats at contract rates. Buy too few and agencies hit sold-out; buy too many and the rooms rot. This engine decides what, how much and when." | Point at the five KPI tiles |
| 0:30 | Globe | "Each bar is next year's forecast demand. Gold means we buy hotels there, blue means seats." | Press ▶ to play through the months; stop on Dec |
| 1:00 | Buy list → Makkah | "Top pick: 1,630 room-nights in Makkah for Ramadan. Here's why, in one sentence, and every number comes from the model." | Select the row; read the explanation; point at the forecast spike and the best-buy-day curve |
| 1:45 | Budget slider | "Same engine, any budget." | Drag from ₹8 Cr to ₹4 Cr, then ₹12 Cr; watch the bars recolour and the list re-plan |
| 2:20 | Shocks | "A Gulf travel advisory just landed." | Toggle it; Dubai money moves out; P10 stays positive |
| 2:50 | Risk section | "Ten thousand simulated seasons. Even the worst 5% stays profitable. Careful trades a little profit for a narrower spread." | Switch Balanced → Careful; show the frontier dot moving |
| 3:20 | Model section | "The forecast beats last-year-plus-growth by 15% on weeks it never saw, and the exact optimiser beats a simple rule by ₹40 lakh at ₹8 Cr." | Point at the backtest chart and the green KPI |
| 3:45 | Close | "Plug in TBO's real logs and supplier rates, and the same pipeline runs nightly." | Show the Live API badge if the backend is running |

## Before going on stage

- Start the API (`make api`), open `planner.html?api=http://localhost:8000`, and check that the badge reads **Live API**.
- If the network fails, the page falls back to the browser engine with identical numbers.
- Record a backup video of this script.
