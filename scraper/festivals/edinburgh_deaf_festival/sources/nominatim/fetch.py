#!/usr/bin/env python3
"""Geocode the venue addresses the festival site published, for one edition.

Run by hand, after the festival-site fetch for the same edition:

    python3 scraper/festivals/edinburgh_deaf_festival/sources/nominatim/fetch.py --edition 2026

Reads that source's raw `programme.json` and writes
`data/festivals/edinburgh-deaf-festival/<edition>/nominatim/geocode.json`: one
record per distinct address, as Nominatim answered it. An address with no street
match is retried on its postcode alone (the postcode's centre is a few doors
off, close enough for walking maths); an address with neither — the site gives
several Deaf Action rooms as just "Edinburgh" — is kept with null coordinates
rather than pinned to the city centre, a guess that would mis-time a walk.
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
# Nominatim asks every caller to stay under one request a second.
PAUSE_SECONDS = 1.1
POSTCODE = re.compile(r"\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b")


def geocode(query):
    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1, "countrycodes": "gb"})
    time.sleep(PAUSE_SECONDS)
    results = common.get(GEOCODER + "?" + params)
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
        postcode = POSTCODE.search(address)
        if not postcode:
            results.append({"query": address, "matched": None, "lat": None, "lng": None})
            print("  %s -> no postcode, left unknown" % address)
            continue
        lat, lng = geocode(address)
        matched = "address"
        if lat is None:
            lat, lng = geocode(postcode.group(1))
            matched = "postcode" if lat is not None else None
        results.append({"query": address, "matched": matched, "lat": lat, "lng": lng})
        print("  %s -> %s, %s (%s)" % (address, lat, lng, matched))
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"geocode.json": {"results": results}},
        fetcher="scraper/festivals/edinburgh_deaf_festival/sources/nominatim/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[GEOCODER],
        notes="One free-text query per distinct venue address from %s, retried on the postcode alone; "
              "addresses without a postcode are not queried. First hit, rounded to 6 dp." % ADDRESSES_FROM,
    )


if __name__ == "__main__":
    main()
