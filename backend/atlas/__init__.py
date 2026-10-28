"""Allotment Atlas: a decision engine for pre-buying travel inventory.

The package is organised as a pipeline:

    data      synthetic searches, bookings, sell-outs and an event calendar
    forecast  quantile demand forecasts (P10 / P50 / P90) per destination-week
    optimize  newsvendor sizing, buy timing and a budget-constrained portfolio
    risk      correlated Monte Carlo simulation of portfolio profit
    explain   plain-language reasons for each recommendation

`atlas.pipeline.build_engine()` wires these together.
"""

__version__ = "0.2.0"
