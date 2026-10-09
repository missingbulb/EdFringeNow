#!/usr/bin/env python3
"""Geocode the venue addresses the festival site published, for one edition.

Run by hand, after the comedy-festival-site fetch for the same edition:

    python3 scraper/festivals/jerusalem/sources/nominatim/fetch.py --edition 2026

Reads that source's raw `programme.json` for its street addresses and writes
`data/festivals/jerusalem-comedy/<edition>/nominatim/geocode.json`: one record
per distinct address, as Nominatim answered it. An address with no match is
kept with null coordinates — the planner falls back to its flat inter-show gap
where it cannot measure a distance, which is honest, whereas a guessed point
would quietly mis-time a walk.
"""

import os
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
ADDRESSES_FROM = "comedy-festival-site"

GEOCODER = "https://nominatim.openstreetmap.org/search"
# Nominatim asks every caller to stay under one request a second.
PAUSE_SECONDS = 1.1


def geocode(address):
    query = urllib.parse.urlencode({"q": address, "format": "json", "limit": 1})
    results = common.get(GEOCODER + "?" + query)
    if not results:
        return None, None
    return round(float(results[0]["lat"]), 6), round(float(results[0]["lon"]), 6)


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = common.read_raw(festival, edition["id"], ADDRESSES_FROM, "programme.json")
    addresses = sorted({v["address"] for v in programme["venues"] if v.get("address")})
    results = []
    for address in addresses:
        lat, lng = geocode(address)
        results.append({"query": address, "lat": lat, "lng": lng})
        print("  %s -> %s, %s" % (address, lat, lng))
        time.sleep(PAUSE_SECONDS)
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"geocode.json": {"results": results}},
        fetcher="scraper/festivals/jerusalem/sources/nominatim/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[GEOCODER],
        notes="One free-text query per distinct venue address from %s; first hit, rounded to 6 dp."
        % ADDRESSES_FROM,
    )


if __name__ == "__main__":
    main()
