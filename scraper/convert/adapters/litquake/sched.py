"""Litquake's Sched raw -> the block, through the platform adapter.

Litquake's own vocabulary: which session types are a genre other than a talk,
and the first line of each session's notes, where the organisers write its
price ("FREE, $10-$15 suggested donation", "$12 adv / $15 door") or that it
has sold out. A line in any other shape says nothing we serve.
"""

import importlib.util
import os
import re

_spec = importlib.util.spec_from_file_location(
    "sched_platform_adapter",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms", "sched.py"))
platform = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(platform)

GENRE_BY_CATEGORY = {
    "FILM SCREENING": "film",
    "MUSIC": "music",
    "PARTY": "other",
    "KIDQUAKE": "family",
}
SOLD_OUT_RE = re.compile(r"sold out|at capacity", re.I)
# "$12 adv / $15 door", "$20 adv / $25 door": advance and door prices of one seat.
ADV_DOOR_RE = re.compile(r"\$(\d+(?:\.\d\d)?) adv / \$(\d+(?:\.\d\d)?) door")
SINGLE_RE = re.compile(r"\$(\d+(?:\.\d\d)?)")


def genre(session):
    return next((GENRE_BY_CATEGORY[c.strip()] for c in (session["categories"] or "").split(",")
                 if c.strip() in GENRE_BY_CATEGORY), None)


def tickets(session):
    line = (session["description"] or "").split("\n", 1)[0].strip()
    if SOLD_OUT_RE.search(line):
        return {"status": "sold-out"}
    # "FREE", "FREE, $10–15 suggested donation": free entry with an ask, as the
    # festival's own word for it; the donation is not a price.
    if re.match(r"FREE\b", line):
        return {"free": True, "status": "free", "priceMin": 0, "priceMax": 0}
    adv_door = ADV_DOOR_RE.fullmatch(line)
    if adv_door:
        low, high = float(adv_door.group(1)), float(adv_door.group(2))
        return {"free": False, "status": "on-sale", "priceMin": low, "priceMax": high}
    single = SINGLE_RE.fullmatch(line)
    if single:
        return {"free": False, "status": "on-sale", "priceMin": float(single.group(1)), "priceMax": float(single.group(1))}
    return {}


def adapt(source):
    return platform.adapt(source, genre=genre, tickets=tickets)
