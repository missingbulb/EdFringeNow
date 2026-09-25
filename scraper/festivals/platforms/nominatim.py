#!/usr/bin/env python3
"""Geocode the venue addresses another source of the same edition published.

A festival declares a `nominatim` source (roles = ["venues"]) whose fetch.py
calls `run`, naming the source whose raw `programme.json` lists
`venues[{address}]`. One query per distinct address; a miss is kept with null
coordinates — the planner falls back to its flat inter-show gap where it cannot
measure a distance, which is honest, whereas a guessed point would quietly
mis-time a walk.
"""

import os
import sys
import time
import urllib.parse

FETCHER_VERSION = 2
GEOCODER = "https://nominatim.openstreetmap.org/search"
# Nominatim asks every caller to stay under one request a second.
PAUSE_SECONDS = 1.1


def candidates(address):
    """The address as printed, then without its leading name when it has one."""
    parts = [p.strip() for p in address.split(",")]
    return [address] + ([", ".join(parts[1:])] if len(parts) > 2 else [])


def run(festival_dir, source_id, addresses_from, fetcher, country_codes):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Geocode %s's venue addresses." % addresses_from)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    programme = common.read_raw(festival, edition["id"], addresses_from, "programme.json")
    addresses = sorted({v["address"] for v in programme["venues"] if v.get("address")})
    results = []
    for address in addresses:
        # A box office often prefixes the street address with the building's
        # name, which Nominatim may not know; the street address alone is the
        # second try.
        tried = None
        for attempt in candidates(address):
            query = urllib.parse.urlencode({"q": attempt, "format": "json", "limit": 1, "countrycodes": country_codes})
            hits = common.get(GEOCODER + "?" + query)
            time.sleep(PAUSE_SECONDS)
            tried = attempt
            if hits:
                break
        lat, lng = (round(float(hits[0]["lat"]), 6), round(float(hits[0]["lon"]), 6)) if hits else (None, None)
        results.append({"query": address, "matched": tried if hits else None, "lat": lat, "lng": lng})
        print("  %s -> %s, %s" % (address, lat, lng))
    common.write_raw(
        festival, edition["id"], source_id, {"geocode.json": {"results": results}},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION, urls=[GEOCODER],
        notes="One free-text query per distinct venue address from %s; first hit, rounded to 6 dp." % addresses_from,
    )
