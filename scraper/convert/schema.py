#!/usr/bin/env python3
"""The serving schema of one festival edition, and the validator every write passes.

A serving block (`site/data/festivals/<festival>/<edition>.json`) is festival-
oblivious: whatever the source sites called things, it says the same fields in
the same vocabulary for every festival, and carries the festival's id so every
record still points at its host. The shape, field by field, is documented in
scraper/festivals/README.md; this module is what enforces it.

`validate(block)` returns a list of problems (empty = valid). The converter
refuses to write anything while that list is non-empty, so a bad adapter or a
malformed raw folder can never replace a good committed file.

    python3 scraper/convert/schema.py --selftest
"""

import copy
import os
import re
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "festivals"))
from registry import GENRES, KINDS, SECTIONS

VERSION = 1
LAYOUTS = ("raked", "flat", "cabaret", "cinema", "outdoor", "standing")
# Unknown is its own state: a performance no availability source speaks for is
# "unknown", never assumed on sale.
STATUSES = ("on-sale", "free", "sold-out", "unknown")

TOP_KEYS = ("v", "festival", "categories", "venues", "events", "performances", "sources", "provenance")
FESTIVAL_KEYS = (
    "id", "edition", "ordinal", "name", "nameLocal", "city", "country", "lat", "lng",
    "timezone", "lang", "dir", "kind", "defaultGenre", "site", "firstDate", "lastDate", "ticketing",
)
CATEGORY_KEYS = ("id", "name")
VENUE_KEYS = ("id", "name", "address", "lat", "lng", "capacity", "layout", "rooms", "accessibility", "notes", "refs")
ROOM_KEYS = ("id", "name", "capacity", "layout")
EVENT_KEYS = ("id", "title", "titleLocal", "url", "genre", "categories", "blurb", "durationMin", "imageUrl")
PERFORMANCE_KEYS = (
    "id", "eventId", "venueId", "roomId", "date", "start", "ticketUrl", "free", "status", "priceMin", "priceMax",
)

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Festivals that run past midnight write 24:30 for the same night; allow to 29:59.
_HHMM = re.compile(r"^([01]\d|2\d):[0-5]\d$")


def _is_num(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _keys(obj, expected, where, errors):
    if not isinstance(obj, dict):
        errors.append("%s: not an object" % where)
        return False
    missing = [k for k in expected if k not in obj]
    extra = [k for k in obj if k not in expected]
    if missing:
        errors.append("%s: missing %s" % (where, ", ".join(missing)))
    if extra:
        errors.append("%s: unexpected %s" % (where, ", ".join(extra)))
    return not missing


def _opt_str(value, where, errors, allow_empty=False):
    if value is None:
        return
    if not isinstance(value, str) or (not allow_empty and not value.strip()):
        errors.append("%s: must be a non-empty string or null" % where)


def _req_str(value, where, errors):
    if not isinstance(value, str) or not value.strip():
        errors.append("%s: must be a non-empty string" % where)


def _opt_count(value, where, errors):
    if value is not None and not (isinstance(value, int) and not isinstance(value, bool) and value > 0):
        errors.append("%s: must be a positive integer or null" % where)


def _iso(value, where, errors):
    if not isinstance(value, str) or not _ISO.match(value):
        errors.append("%s: %r is not YYYY-MM-DD" % (where, value))
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        errors.append("%s: %r is not a real date" % (where, value))
        return None


def _unique(items, where, errors):
    ids = [i.get("id") for i in items if isinstance(i, dict)]
    dupes = sorted({i for i in ids if ids.count(i) > 1}, key=str)
    if dupes:
        errors.append("%s: duplicate ids %s" % (where, dupes[:5]))
    return set(ids)


def validate(block):
    """Every problem with a serving block, as readable strings; [] when it is valid."""
    errors = []
    if not _keys(block, TOP_KEYS, "block", errors):
        return errors
    if block["v"] != VERSION:
        errors.append("v: expected %d, got %r" % (VERSION, block["v"]))

    fest = block["festival"]
    first = last = None
    if _keys(fest, FESTIVAL_KEYS, "festival", errors):
        for k in ("id", "edition", "name", "city", "country", "timezone", "lang", "site"):
            _req_str(fest[k], "festival.%s" % k, errors)
        _opt_str(fest["nameLocal"], "festival.nameLocal", errors)
        if not re.match(r"^\d{4}$", str(fest["edition"])):
            errors.append("festival.edition: must be a year")
        if fest["ordinal"] is not None and not (isinstance(fest["ordinal"], int) and fest["ordinal"] > 0):
            errors.append("festival.ordinal: must be a positive integer or null")
        if not (_is_num(fest["lat"]) and -90 <= fest["lat"] <= 90 and _is_num(fest["lng"]) and -180 <= fest["lng"] <= 180):
            errors.append("festival.lat/lng: must be real coordinates")
        if fest["dir"] not in ("ltr", "rtl"):
            errors.append("festival.dir: must be ltr or rtl")
        if fest["kind"] not in KINDS:
            errors.append("festival.kind: %r not in %s" % (fest["kind"], KINDS))
        if fest["defaultGenre"] not in GENRES:
            errors.append("festival.defaultGenre: %r not in %s" % (fest["defaultGenre"], GENRES))
        first = _iso(fest["firstDate"], "festival.firstDate", errors)
        last = _iso(fest["lastDate"], "festival.lastDate", errors)
        if first and last and first > last:
            errors.append("festival: lastDate before firstDate")
        if not isinstance(fest["ticketing"], dict):
            errors.append("festival.ticketing: must be an object")

    categories = block["categories"] if isinstance(block["categories"], list) else []
    if not isinstance(block["categories"], list):
        errors.append("categories: must be a list")
    for i, cat in enumerate(categories):
        if _keys(cat, CATEGORY_KEYS, "categories[%d]" % i, errors):
            _req_str(cat["id"], "categories[%d].id" % i, errors)
            _req_str(cat["name"], "categories[%d].name" % i, errors)
    category_ids = _unique(categories, "categories", errors)

    venues = block["venues"] if isinstance(block["venues"], list) else []
    rooms_by_venue = {}
    for i, venue in enumerate(venues):
        where = "venues[%d]" % i
        if not _keys(venue, VENUE_KEYS, where, errors):
            continue
        _req_str(venue["id"], where + ".id", errors)
        _req_str(venue["name"], where + ".name", errors)
        _opt_str(venue["address"], where + ".address", errors)
        lat, lng = venue["lat"], venue["lng"]
        if (lat is None) != (lng is None):
            errors.append("%s: lat and lng must be both known or both null" % where)
        elif lat is not None and not (_is_num(lat) and -90 <= lat <= 90 and _is_num(lng) and -180 <= lng <= 180):
            errors.append("%s: lat/lng out of range" % where)
        _opt_count(venue["capacity"], where + ".capacity", errors)
        if venue["layout"] is not None and venue["layout"] not in LAYOUTS:
            errors.append("%s.layout: %r not in %s" % (where, venue["layout"], LAYOUTS))
        _opt_str(venue["accessibility"], where + ".accessibility", errors)
        _opt_str(venue["notes"], where + ".notes", errors)
        if not isinstance(venue["refs"], list) or not all(isinstance(r, str) and r.startswith("http") for r in venue["refs"]):
            errors.append("%s.refs: must be a list of URLs" % where)
        rooms = venue["rooms"] if isinstance(venue["rooms"], list) else []
        if not isinstance(venue["rooms"], list):
            errors.append("%s.rooms: must be a list" % where)
        for j, room in enumerate(rooms):
            rw = "%s.rooms[%d]" % (where, j)
            if _keys(room, ROOM_KEYS, rw, errors):
                _req_str(room["id"], rw + ".id", errors)
                _req_str(room["name"], rw + ".name", errors)
                _opt_count(room["capacity"], rw + ".capacity", errors)
                if room["layout"] is not None and room["layout"] not in LAYOUTS:
                    errors.append("%s.layout: %r not in %s" % (rw, room["layout"], LAYOUTS))
        rooms_by_venue[venue["id"]] = _unique(rooms, where + ".rooms", errors)
    venue_ids = _unique(venues, "venues", errors)

    events = block["events"] if isinstance(block["events"], list) else []
    for i, event in enumerate(events):
        where = "events[%d]" % i
        if not _keys(event, EVENT_KEYS, where, errors):
            continue
        _req_str(event["id"], where + ".id", errors)
        _req_str(event["title"], where + ".title", errors)
        # The title in the festival's own language, when `title` is not already in it.
        _opt_str(event["titleLocal"], where + ".titleLocal", errors)
        _opt_str(event["url"], where + ".url", errors)
        _opt_str(event["blurb"], where + ".blurb", errors)
        _opt_str(event["imageUrl"], where + ".imageUrl", errors)
        if event["genre"] not in GENRES:
            errors.append("%s.genre: %r not in %s" % (where, event["genre"], GENRES))
        if not isinstance(event["categories"], list):
            errors.append("%s.categories: must be a list" % where)
        else:
            unknown = [c for c in event["categories"] if c not in category_ids]
            if unknown:
                errors.append("%s.categories: %s not in categories" % (where, unknown))
        _opt_count(event["durationMin"], where + ".durationMin", errors)
    event_ids = _unique(events, "events", errors)

    lo = first - timedelta(days=1) if first else None
    hi = last + timedelta(days=1) if last else None
    performed = set()
    performances = block["performances"] if isinstance(block["performances"], list) else []
    for i, perf in enumerate(performances):
        where = "performances[%d]" % i
        if not _keys(perf, PERFORMANCE_KEYS, where, errors):
            continue
        _req_str(perf["id"], where + ".id", errors)
        if perf["eventId"] not in event_ids:
            errors.append("%s.eventId: %r is not an event" % (where, perf["eventId"]))
        performed.add(perf["eventId"])
        if perf["venueId"] is not None and perf["venueId"] not in venue_ids:
            errors.append("%s.venueId: %r is not a venue" % (where, perf["venueId"]))
        if perf["roomId"] is not None and perf["roomId"] not in rooms_by_venue.get(perf["venueId"], set()):
            errors.append("%s.roomId: %r is not a room of %r" % (where, perf["roomId"], perf["venueId"]))
        on = _iso(perf["date"], where + ".date", errors)
        if on and lo and not lo <= on <= hi:
            errors.append("%s.date: %s outside the edition (%s..%s ±1 day)" % (where, perf["date"], first, last))
        if not isinstance(perf["start"], str) or not _HHMM.match(perf["start"]):
            errors.append("%s.start: %r is not HH:MM" % (where, perf["start"]))
        _opt_str(perf["ticketUrl"], where + ".ticketUrl", errors)
        if perf["free"] not in (True, False, None):
            errors.append("%s.free: must be true, false or null" % where)
        if perf["status"] not in STATUSES:
            errors.append("%s.status: %r not in %s" % (where, perf["status"], STATUSES))
        for k in ("priceMin", "priceMax"):
            if perf[k] is not None and not (_is_num(perf[k]) and perf[k] >= 0):
                errors.append("%s.%s: must be a non-negative number or null" % (where, k))
        if _is_num(perf["priceMin"]) and _is_num(perf["priceMax"]) and perf["priceMin"] > perf["priceMax"]:
            errors.append("%s: priceMin above priceMax" % where)
    _unique(performances, "performances", errors)
    for name in ("venues", "events", "performances"):
        if not isinstance(block[name], list):
            errors.append("%s: must be a list" % name)

    unperformed = sorted(event_ids - performed, key=str)
    if unperformed:
        errors.append("events without a performance: %s" % unperformed[:5])

    if not isinstance(block["sources"], dict) or any(
        k not in SECTIONS or not isinstance(v, list) for k, v in block["sources"].items()
    ):
        errors.append("sources: must map sections %s to lists of source ids" % (SECTIONS,))
    if not isinstance(block["provenance"], dict):
        errors.append("provenance: must be an object")
    return errors


def sample_block():
    """The smallest valid block, for the self-tests here and in merge/to_serving."""
    return {
        "v": VERSION,
        "festival": {
            "id": "sample-fest", "edition": "2026", "ordinal": None, "name": "Sample", "nameLocal": None,
            "city": "Town", "country": "GB", "lat": 55.95, "lng": -3.19, "timezone": "Europe/London",
            "lang": "en", "dir": "ltr", "kind": "comedy", "defaultGenre": "comedy",
            "site": "https://example.test", "firstDate": "2026-10-01", "lastDate": "2026-10-03", "ticketing": {},
        },
        "categories": [{"id": "stand-up", "name": "Stand-up"}],
        "venues": [{
            "id": "hall", "name": "Hall", "address": None, "lat": None, "lng": None, "capacity": None,
            "layout": None, "rooms": [{"id": "main", "name": "Main", "capacity": 200, "layout": "raked"}],
            "accessibility": None, "notes": None, "refs": [],
        }],
        "events": [{
            "id": "show", "title": "Show", "titleLocal": None, "url": None, "genre": "comedy", "categories": ["stand-up"],
            "blurb": None, "durationMin": None, "imageUrl": None,
        }],
        "performances": [{
            "id": "show/2026-10-01/20:00", "eventId": "show", "venueId": "hall", "roomId": "main",
            "date": "2026-10-01", "start": "20:00", "ticketUrl": None, "free": None, "status": "unknown",
            "priceMin": None, "priceMax": None,
        }],
        "sources": {"venues": ["a"]},
        "provenance": {},
    }


def selftest():
    good = sample_block()
    assert validate(good) == [], validate(good)

    def broken(mutate, expect):
        block = copy.deepcopy(good)
        mutate(block)
        problems = validate(block)
        assert any(expect in p for p in problems), (expect, problems)

    broken(lambda b: b.update(v=2), "v: expected")
    broken(lambda b: b["performances"][0].update(eventId="nope"), "is not an event")
    broken(lambda b: b["performances"][0].update(venueId="nope"), "is not a venue")
    broken(lambda b: b["performances"][0].update(roomId="nope"), "is not a room")
    broken(lambda b: b["performances"][0].update(date="2026-10-05"), "outside the edition")
    # The ±1 day slack: the evening before the first night is inside.
    edge = copy.deepcopy(good)
    edge["performances"][0]["date"] = "2026-09-30"
    assert validate(edge) == [], validate(edge)
    broken(lambda b: b["performances"][0].update(start="8pm"), "is not HH:MM")
    broken(lambda b: b["performances"][0].update(status="available"), ".status")
    broken(lambda b: b["performances"][0].update(priceMin=10, priceMax=5), "priceMin above priceMax")
    broken(lambda b: b["performances"].append(dict(b["performances"][0])), "duplicate ids")
    broken(lambda b: b["events"][0].update(genre="standup"), ".genre")
    broken(lambda b: b["events"][0].update(titleLocal=""), ".titleLocal")
    broken(lambda b: b["events"][0].update(categories=["x"]), "not in categories")
    broken(lambda b: b["events"][0].update(durationMin=0), "durationMin")
    broken(lambda b: b["venues"][0].update(lat=55.9), "both known or both null")
    broken(lambda b: b["venues"][0].update(capacity=0), ".capacity")
    broken(lambda b: b["venues"][0].update(extra=1), "unexpected extra")
    broken(lambda b: b["festival"].pop("timezone"), "missing timezone")
    broken(lambda b: b.update(performances=[]), "events without a performance")
    broken(lambda b: b.update(sources={"seats": []}), "sources:")
    print("convert schema selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        sys.exit("usage: schema.py --selftest")
