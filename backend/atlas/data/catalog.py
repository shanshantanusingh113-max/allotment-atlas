"""Reference data: destinations, the event calendar, candidate blocks and market shocks.

Every number here is synthetic and chosen to be plausible for an Indian B2B
travel distributor. Monthly profiles are demand multipliers for January..December
relative to the destination's yearly average.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

# --------------------------------------------------------------------------- #
# Destinations
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Destination:
    code: str
    name: str
    lat: float
    lng: float
    hub: str  # Indian departure hub that feeds most of the demand
    region: str  # used for correlated risk in the Monte Carlo
    base_daily: float  # average unconstrained room-night demand per day on TBO
    adr: int  # average daily rate in INR
    profile: tuple[float, ...]  # Jan..Dec multipliers
    cancel_rate: float = 0.10
    capacity_factor: float = 1.55  # free-sale capacity as a multiple of base demand


# Profiles are Jan..Dec.
DESTINATIONS: tuple[Destination, ...] = (
    Destination("GOI", "Goa", 15.40, 73.90, "BOM", "india", 62, 7800,
                (1.35, 1.0, 0.8, 0.55, 0.45, 0.25, 0.22, 0.3, 0.4, 0.75, 1.0, 1.75), 0.11),
    Destination("DXB", "Dubai", 25.20, 55.30, "DEL", "gulf", 70, 9800,
                (1.3, 1.15, 1.0, 0.75, 0.5, 0.35, 0.35, 0.42, 0.65, 1.05, 1.25, 1.6), 0.12),
    Destination("BKK", "Bangkok", 13.75, 100.50, "DEL", "sea", 58, 6400,
                (1.3, 1.0, 0.85, 0.95, 0.6, 0.52, 0.52, 0.52, 0.6, 0.9, 1.15, 1.5), 0.10),
    Destination("DPS", "Bali", -8.40, 115.20, "BLR", "sea", 44, 8900,
                (0.75, 0.55, 0.55, 0.7, 1.0, 1.35, 1.5, 1.45, 0.95, 0.75, 0.7, 1.15), 0.10),
    Destination("SIN", "Singapore", 1.35, 103.80, "BLR", "sea", 48, 13200,
                (0.8, 0.65, 0.7, 0.85, 1.25, 1.35, 0.95, 0.7, 0.7, 0.75, 0.8, 1.15), 0.08),
    Destination("MLE", "Maldives", 3.20, 73.20, "BLR", "india_ocean", 26, 24500,
                (1.3, 1.35, 1.15, 0.9, 0.5, 0.42, 0.5, 0.6, 0.65, 0.9, 1.0, 1.4), 0.07),
    Destination("MKK", "Makkah", 21.40, 39.80, "BOM", "gulf", 52, 8200,
                (0.85, 1.6, 1.5, 0.8, 0.9, 1.1, 0.7, 0.7, 0.75, 0.8, 0.85, 0.85), 0.04),
    Destination("HKT", "Phuket", 7.90, 98.40, "BOM", "sea", 30, 7200,
                (1.35, 1.2, 1.0, 0.85, 0.5, 0.45, 0.5, 0.5, 0.45, 0.75, 1.1, 1.5), 0.11),
    Destination("DAD", "Da Nang", 16.05, 108.20, "DEL", "sea", 24, 5600,
                (1.0, 1.05, 1.1, 1.15, 1.2, 1.15, 1.05, 0.95, 0.65, 0.6, 0.8, 1.2), 0.10),
    Destination("KUU", "Manali", 32.20, 77.20, "DEL", "india", 38, 5200,
                (0.75, 0.6, 0.65, 0.95, 1.6, 1.55, 0.7, 0.55, 0.75, 1.05, 0.9, 1.3), 0.13),
    Destination("JAI", "Jaipur", 26.90, 75.80, "DEL", "india", 46, 6800,
                (1.2, 1.05, 0.85, 0.5, 0.35, 0.35, 0.45, 0.5, 0.75, 1.15, 1.6, 1.45), 0.12),
    Destination("COK", "Kerala", 9.90, 76.30, "BLR", "india", 34, 6100,
                (1.4, 1.25, 0.9, 0.7, 0.5, 0.4, 0.6, 0.85, 0.8, 0.95, 1.05, 1.5), 0.10),
    Destination("SXR", "Srinagar", 34.10, 74.80, "DEL", "india", 22, 5900,
                (0.6, 0.55, 0.7, 1.25, 1.65, 1.6, 1.0, 0.85, 1.05, 1.1, 0.75, 0.85), 0.12),
    Destination("LON", "London", 51.50, -0.10, "DEL", "europe", 28, 18400,
                (0.55, 0.6, 0.75, 0.95, 1.35, 1.45, 1.45, 1.35, 1.0, 0.85, 0.7, 1.05), 0.09),
    Destination("KUL", "Kuala Lumpur", 3.14, 101.70, "BLR", "sea", 30, 5900,
                (0.95, 0.8, 0.85, 0.95, 1.15, 1.2, 1.05, 0.9, 0.85, 0.95, 1.05, 1.3), 0.09),
    Destination("TBS", "Tbilisi", 41.70, 44.80, "DEL", "europe", 14, 6900,
                (0.5, 0.5, 0.65, 0.95, 1.45, 1.5, 1.35, 1.3, 1.15, 0.9, 0.6, 0.6), 0.10),
)

DEST_BY_CODE = {d.code: d for d in DESTINATIONS}

HUBS = {
    "DEL": ("Delhi", 28.60, 77.20),
    "BOM": ("Mumbai", 19.10, 72.90),
    "BLR": ("Bengaluru", 13.00, 77.60),
}

# --------------------------------------------------------------------------- #
# Event calendar
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Event:
    name: str
    start: date
    end: date
    intensity: float  # extra demand multiplier at peak (0.4 = +40%)
    destinations: tuple[str, ...] = ()  # empty means every destination


def _yearly(name: str, m1: int, d1: int, m2: int, d2: int, intensity: float,
            dests: tuple[str, ...] = (), years=(2024, 2025, 2026, 2027)) -> list[Event]:
    out = []
    for y in years:
        start = date(y, m1, d1)
        end = date(y + (1 if m2 < m1 else 0), m2, d2)
        out.append(Event(name, start, end, intensity, dests))
    return out


INDIA_LEISURE = ("GOI", "JAI", "COK", "KUU", "SXR")
SHORT_HAUL = ("DXB", "BKK", "HKT", "DPS", "SIN", "MLE", "DAD", "KUL")

EVENTS: tuple[Event, ...] = tuple(
    _yearly("Christmas and New Year", 12, 20, 1, 3, 0.55, ())
    + _yearly("Indian school summer holidays", 5, 15, 6, 15, 0.30, INDIA_LEISURE + SHORT_HAUL + ("LON", "TBS"))
    + _yearly("Wedding season", 11, 15, 12, 12, 0.35, ("JAI", "GOI", "COK"))
    + [
        Event("Diwali", date(2024, 10, 29), date(2024, 11, 4), 0.40, INDIA_LEISURE + SHORT_HAUL),
        Event("Diwali", date(2025, 10, 18), date(2025, 10, 24), 0.40, INDIA_LEISURE + SHORT_HAUL),
        Event("Diwali", date(2026, 11, 6), date(2026, 11, 12), 0.40, INDIA_LEISURE + SHORT_HAUL),
        Event("Diwali", date(2027, 10, 27), date(2027, 11, 2), 0.40, INDIA_LEISURE + SHORT_HAUL),
        Event("Ramadan and Umrah", date(2025, 3, 1), date(2025, 3, 30), 0.65, ("MKK",)),
        Event("Ramadan and Umrah", date(2026, 2, 18), date(2026, 3, 19), 0.65, ("MKK",)),
        Event("Ramadan and Umrah", date(2027, 2, 8), date(2027, 3, 9), 0.65, ("MKK",)),
        Event("Dubai Shopping Festival", date(2024, 12, 13), date(2025, 1, 26), 0.20, ("DXB",)),
        Event("Dubai Shopping Festival", date(2025, 12, 5), date(2026, 1, 11), 0.20, ("DXB",)),
        Event("Dubai Shopping Festival", date(2026, 12, 11), date(2027, 1, 24), 0.20, ("DXB",)),
        Event("Songkran", date(2025, 4, 12), date(2025, 4, 16), 0.35, ("BKK", "HKT")),
        Event("Songkran", date(2026, 4, 12), date(2026, 4, 16), 0.35, ("BKK", "HKT")),
        Event("Songkran", date(2027, 4, 12), date(2027, 4, 16), 0.35, ("BKK", "HKT")),
    ]
)

# --------------------------------------------------------------------------- #
# Candidate inventory blocks (the decisions)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Block:
    id: str
    dest: str
    label: str
    kind: str  # "hotel" (room-nights) or "flight" (seats)
    start: date
    end: date
    share: float  # share of destination demand this block can serve
    cost: int  # pre-buy cost per unit, INR
    price: int  # selling price per unit, INR
    salvage: int  # recovered per unsold unit (release refund or distressed resale), INR
    contract: str = "hard"  # "hard" or "soft"
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def nights(self) -> int:
        return (self.end - self.start).days + 1


def _b(id, dest, label, kind, s, e, share, cost, price, salvage, contract="hard", tags=()):
    return Block(id, dest, label, kind, date.fromisoformat(s), date.fromisoformat(e),
                 share, cost, price, salvage, contract, tags)


# Planning horizon: November 2026 to October 2027.
BLOCKS: tuple[Block, ...] = (
    _b("GOI-NYE", "GOI", "Goa beach resorts", "hotel", "2026-12-20", "2027-01-02", 0.42, 6000, 7600, 1500, tags=("festival",)),
    _b("GOI-DIW", "GOI", "Goa Diwali weekend", "hotel", "2026-11-05", "2026-11-12", 0.30, 4800, 6100, 1200),
    _b("DXB-DEC", "DXB", "Dubai city hotels", "hotel", "2026-12-12", "2026-12-31", 0.36, 7200, 9100, 2200, tags=("festival",)),
    _b("DXB-FLT", "DXB", "DEL→DXB seats", "flight", "2026-12-15", "2026-12-28", 0.30, 14500, 17700, 6000),
    _b("BKK-NYE", "BKK", "Bangkok hotels", "hotel", "2026-12-22", "2027-01-05", 0.34, 4700, 6000, 1300),
    _b("BKK-SGK", "BKK", "Bangkok Songkran", "hotel", "2027-04-10", "2027-04-18", 0.30, 4300, 5500, 1200),
    _b("HKT-DEC", "HKT", "Phuket beach hotels", "hotel", "2026-12-18", "2027-01-04", 0.34, 5400, 6900, 1500),
    _b("DPS-SUM", "DPS", "Bali villas", "hotel", "2027-07-01", "2027-08-15", 0.30, 6400, 8100, 1900),
    _b("SIN-SUM", "SIN", "Singapore hotels", "hotel", "2027-05-15", "2027-06-15", 0.28, 9900, 12600, 3500),
    _b("SIN-FLT", "SIN", "BLR→SIN seats", "flight", "2027-05-15", "2027-06-10", 0.24, 11800, 14400, 5200),
    _b("MLE-FEB", "MLE", "Maldives resorts", "hotel", "2027-02-01", "2027-02-28", 0.30, 18800, 23900, 4500),
    _b("MKK-RAM", "MKK", "Makkah hotels, Ramadan", "hotel", "2027-02-08", "2027-03-09", 0.44, 6100, 7700, 2600, tags=("religious",)),
    _b("DAD-SPR", "DAD", "Da Nang hotels", "hotel", "2027-03-01", "2027-05-31", 0.28, 4000, 5100, 1100),
    _b("KUU-SUM", "KUU", "Manali hotels", "hotel", "2027-05-15", "2027-06-15", 0.36, 3900, 5000, 1000),
    _b("JAI-WED", "JAI", "Jaipur heritage, weddings", "hotel", "2026-11-15", "2026-12-12", 0.32, 5100, 6500, 1400),
    _b("COK-WIN", "COK", "Kerala houseboats", "hotel", "2026-12-20", "2027-01-31", 0.30, 4500, 5700, 1200),
    _b("SXR-SPR", "SXR", "Srinagar hotels", "hotel", "2027-04-15", "2027-06-10", 0.30, 4400, 5600, 1100),
    _b("LON-SUM", "LON", "London hotels", "hotel", "2027-06-01", "2027-07-31", 0.22, 14200, 18000, 5200),
    _b("KUL-DEC", "KUL", "Kuala Lumpur hotels", "hotel", "2026-12-15", "2027-01-05", 0.28, 4300, 5500, 1300),
    _b("TBS-SUM", "TBS", "Tbilisi hotels", "hotel", "2027-05-01", "2027-06-30", 0.30, 5000, 6400, 1300),
    _b("GOI-FLT", "GOI", "BOM→GOI seats", "flight", "2026-12-24", "2026-12-31", 0.26, 5200, 6300, 1800),
    _b("BKK-FLT", "BKK", "DEL→BKK seats", "flight", "2026-12-20", "2027-01-03", 0.22, 11200, 13700, 4300),
)

BLOCK_BY_ID = {b.id: b for b in BLOCKS}

# --------------------------------------------------------------------------- #
# Market shocks (scenarios)
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Shock:
    id: str
    label: str
    description: str
    demand: dict[str, float] = field(default_factory=dict)  # dest -> multiplier
    sigma: dict[str, float] = field(default_factory=dict)  # dest -> multiplier
    flight_cost: float = 1.0  # multiplier on flight block costs


SHOCKS: tuple[Shock, ...] = (
    Shock("gulf_advisory", "Gulf travel advisory",
          "A travel advisory cuts Dubai demand by 35% and makes it far less predictable.",
          demand={"DXB": 0.65}, sigma={"DXB": 1.5}),
    Shock("vietnam_visa", "Vietnam visa-free for Indians",
          "Visa-free entry lifts Da Nang demand by 60%.",
          demand={"DAD": 1.6}, sigma={"DAD": 1.2}),
    Shock("cyclone", "Cyclone season warning",
          "A cyclone warning cuts Phuket and Bali demand by 30% and raises uncertainty.",
          demand={"HKT": 0.7, "DPS": 0.7}, sigma={"HKT": 1.6, "DPS": 1.6}),
    Shock("bangkok_concert", "Stadium concert in Bangkok",
          "A sold-out stadium tour lifts Bangkok demand by 35%.",
          demand={"BKK": 1.35}),
    Shock("fuel_spike", "Jet fuel price spike",
          "Fuel surcharges raise flight block costs by 12%.",
          flight_cost=1.12),
)

SHOCK_BY_ID = {s.id: s for s in SHOCKS}

# Correlation structure for the Monte Carlo.
REGION_CORRELATION = 0.35
GLOBAL_CORRELATION = 0.15
