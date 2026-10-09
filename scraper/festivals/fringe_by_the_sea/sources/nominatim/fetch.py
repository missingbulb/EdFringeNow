#!/usr/bin/env python3
"""Geocode the festival's venues, for one edition.

Run by hand, after the festival-site fetch for the same edition:

    python3 scraper/festivals/fringe_by_the_sea/sources/nominatim/fetch.py --edition 2026

Reads that source's raw `programme.json` — the Lodge Grounds' street address
and each box's `place.query` — and writes
`data/festivals/fringe-by-the-sea/<edition>/nominatim/geocode.json`: one record
per distinct query, as Nominatim answered it. Queries are bounded to a box
around North Berwick (the festival's venues are all in or near the town), so a
name that also exists elsewhere cannot land there. A query with no hit is
retried with its leading parts dropped ("Over the Pond, Archerfield Walled
Garden, …" → "Archerfield Walled Garden, …") and then on its postcode; a hit on
the town itself, or on a place whose name the query does not contain, is
refused, and a query with no usable hit is kept with null
coordinates rather than pinned to the town centre.
"""

import os
import re
import sys
import time
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "nominatim"
FETCHER_VERSION = 1
ADDRESSES_FROM = "festival-site"

GEOCODER = "https://nominatim.openstreetmap.org/search"
PAUSE_SECONDS = 1.1
# left, top, right, bottom: North Berwick with Dirleton/Archerfield to the west.
VIEWBOX = "-2.86,56.09,-2.62,56.02"


POSTCODE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b")
# A hit on the town itself says nothing about where in it the venue is.
AREA_TYPES = {"city", "town", "village", "hamlet", "suburb", "neighbourhood", "administrative"}


def _words(text):
    return set(re.findall(r"[a-z0-9]+", (text or "").lower()))


def names_match(hit_name, query):
    """A named hit must be named in the query: "North Berwick East Beach" is not West Beach."""
    return not hit_name or POSTCODE.fullmatch(query.strip()) is not None or _words(hit_name) <= _words(query)


def geocode_one(query):
    params = urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1, "viewbox": VIEWBOX, "bounded": 1})
    time.sleep(PAUSE_SECONDS)
    results = [r for r in common.get(GEOCODER + "?" + params)
               if r.get("type") not in AREA_TYPES and names_match(r.get("name"), query)]
    if not results:
        return None, None
    return round(float(results[0]["lat"]), 6), round(float(results[0]["lon"]), 6)


def attempts(query):
    """The query, then it with its leading parts dropped one by one, then its postcode."""
    parts = [p.strip() for p in query.split(",")]
    out = [", ".join(parts[i:]) for i in range(len(parts) - 1)]
    postcode = POSTCODE.search(query)
    if postcode:
        out.append(postcode.group(1))
    return out or [query]


def geocode(query):
    for attempt in attempts(query):
        lat, lng = geocode_one(attempt)
        if lat is not None:
            return lat, lng, attempt
    return None, None, None


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = common.read_raw(festival, edition["id"], ADDRESSES_FROM, "programme.json")
    queries = {programme["mainVenue"]["address"]}
    queries |= {s["place"]["query"] for s in programme["shows"] if s["place"] and s["place"]["query"]}
    results = []
    for query in sorted(queries):
        lat, lng, matched = geocode(query)
        results.append({"query": query, "matched": matched, "lat": lat, "lng": lng})
        print("  %s -> %s, %s (%s)" % (query, lat, lng, matched))
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"geocode.json": {"results": results}},
        fetcher="scraper/festivals/fringe_by_the_sea/sources/nominatim/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[GEOCODER],
        notes="One free-text query per distinct place in %s, bounded to viewbox %s, retried with "
              "its leading parts dropped and then on its postcode; hits on a whole town or area are "
              "refused. First hit, rounded to 6 dp; no hit is null." % (ADDRESSES_FROM, VIEWBOX),
    )


if __name__ == "__main__":
    main()
