"""Reference data loaded from a JSON catalog.

The catalog describes the world the engine plans for: departure hubs,
destinations (with monthly demand profiles), an event calendar, candidate
inventory blocks and market shocks. Nothing here is hard-coded: point the
`ATLAS_CATALOG` environment variable at another JSON file with the same shape
to plan for a different business, region or product.

The default file, `catalog.json`, is synthetic and chosen to be plausible for
an Indian B2B travel distributor. Monthly profiles are January..December
demand multipliers relative to the destination's yearly average.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

DEFAULT_PATH = Path(__file__).with_name("catalog.json")


# --------------------------------------------------------------------------- #
# Types
# --------------------------------------------------------------------------- #


@dataclass(frozen=True)
class Destination:
    code: str
    name: str
    lat: float
    lng: float
    hub: str  # departure hub that feeds most of the demand
    region: str  # used for correlated risk in the Monte Carlo
    base_daily: float  # average unconstrained unit demand per day
    adr: int  # average daily rate
    profile: tuple[float, ...]  # Jan..Dec multipliers
    cancel_rate: float = 0.10
    capacity_factor: float = 1.55  # free-sale capacity as a multiple of base demand


@dataclass(frozen=True)
class Event:
    name: str
    start: date
    end: date
    intensity: float  # extra demand multiplier at peak (0.4 = +40%)
    destinations: tuple[str, ...] = ()  # empty means every destination


@dataclass(frozen=True)
class Block:
    id: str
    dest: str
    label: str
    kind: str  # "hotel" (room-nights) or "flight" (seats); any unit works
    start: date
    end: date
    share: float  # share of destination demand this block can serve
    cost: int  # pre-buy cost per unit
    price: int  # selling price per unit
    salvage: int  # recovered per unsold unit (release refund or distressed resale)
    contract: str = "hard"
    tags: tuple[str, ...] = field(default_factory=tuple)

    @property
    def nights(self) -> int:
        return (self.end - self.start).days + 1


@dataclass(frozen=True)
class Shock:
    id: str
    label: str
    description: str
    demand: dict[str, float] = field(default_factory=dict)  # dest -> multiplier
    sigma: dict[str, float] = field(default_factory=dict)  # dest -> multiplier
    flight_cost: float = 1.0  # multiplier on flight block costs


@dataclass(frozen=True)
class Catalog:
    meta: dict
    hubs: dict[str, tuple[str, float, float]]
    destinations: tuple[Destination, ...]
    events: tuple[Event, ...]
    blocks: tuple[Block, ...]
    shocks: tuple[Shock, ...]
    global_correlation: float
    region_correlation: float


# --------------------------------------------------------------------------- #
# Loading and validation
# --------------------------------------------------------------------------- #


class CatalogError(ValueError):
    pass


def load_catalog(path: str | Path | None = None) -> Catalog:
    path = Path(path or os.getenv("ATLAS_CATALOG") or DEFAULT_PATH)
    raw = json.loads(path.read_text(encoding="utf-8"))
    hubs = {k: (v["name"], float(v["lat"]), float(v["lng"])) for k, v in raw["hubs"].items()}
    dests = tuple(Destination(**{**d, "profile": tuple(d["profile"])}) for d in raw["destinations"])
    events = tuple(Event(e["name"], date.fromisoformat(e["start"]), date.fromisoformat(e["end"]),
                         float(e["intensity"]), tuple(e.get("destinations", ()))) for e in raw["events"])
    blocks = tuple(Block(**{**b, "start": date.fromisoformat(b["start"]), "end": date.fromisoformat(b["end"]),
                            "tags": tuple(b.get("tags", ()))}) for b in raw["blocks"])
    shocks = tuple(Shock(**s) for s in raw.get("shocks", ()))
    risk = raw.get("risk", {})
    cat = Catalog(raw.get("meta", {}), hubs, dests, events, blocks, shocks,
                  float(risk.get("global_correlation", 0.15)), float(risk.get("region_correlation", 0.35)))
    validate(cat)
    return cat


def validate(cat: Catalog) -> None:
    codes = {d.code for d in cat.destinations}
    problems = []
    if len(codes) != len(cat.destinations):
        problems.append("destination codes must be unique")
    for d in cat.destinations:
        if d.hub not in cat.hubs:
            problems.append(f"{d.code}: hub {d.hub} is not in hubs")
        if len(d.profile) != 12:
            problems.append(f"{d.code}: profile needs 12 monthly values")
    ids = [b.id for b in cat.blocks]
    if len(set(ids)) != len(ids):
        problems.append("block ids must be unique")
    for b in cat.blocks:
        if b.dest not in codes:
            problems.append(f"{b.id}: unknown destination {b.dest}")
        if not (b.salvage < b.cost < b.price):
            problems.append(f"{b.id}: needs salvage < cost < price")
        if b.end < b.start:
            problems.append(f"{b.id}: end is before start")
        if not 0 < b.share <= 1:
            problems.append(f"{b.id}: share must be in (0, 1]")
    for e in cat.events:
        unknown = set(e.destinations) - codes
        if unknown:
            problems.append(f"event {e.name}: unknown destinations {sorted(unknown)}")
    for s in cat.shocks:
        unknown = (set(s.demand) | set(s.sigma)) - codes
        if unknown:
            problems.append(f"shock {s.id}: unknown destinations {sorted(unknown)}")
    if problems:
        raise CatalogError("Invalid catalog:\n  " + "\n  ".join(problems))


CATALOG = load_catalog()

# Module-level names used across the engine.
HUBS = CATALOG.hubs
DESTINATIONS = CATALOG.destinations
DEST_BY_CODE = {d.code: d for d in DESTINATIONS}
EVENTS = CATALOG.events
BLOCKS = CATALOG.blocks
BLOCK_BY_ID = {b.id: b for b in BLOCKS}
SHOCKS = CATALOG.shocks
SHOCK_BY_ID = {s.id: s for s in SHOCKS}
GLOBAL_CORRELATION = CATALOG.global_correlation
REGION_CORRELATION = CATALOG.region_correlation
META = CATALOG.meta
