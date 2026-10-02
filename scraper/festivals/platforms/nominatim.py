#!/usr/bin/env python3
"""Geocode the venue addresses another source of the same edition published.

A festival declares a `nominatim` source (roles = ["venues"]) whose fetch.py
calls `run`, naming the source whose raw `programme.json` lists
`venues[{address}]` (or another field `run` is told). One query per distinct
address, retried in the plainer forms `candidates` lists; a miss is kept with null
coordinates — the planner falls back to its flat inter-show gap where it cannot
measure a distance, which is honest, whereas a guessed point would quietly
mis-time a walk.
"""

import os
import re
import sys
import time
import urllib.parse

FETCHER_VERSION = 3
GEOCODER = "https://nominatim.openstreetmap.org/search"
# Nominatim asks every caller to stay under one request a second.
PAUSE_SECONDS = 1.1


# A unit inside a building ("#02-30", "Ste 121", "Suite B101", "Level 5"), which
# the geocoder's street index does not know and fails the whole query on.
UNIT_RE = re.compile(r"(?:#\s*[\w-]+|\b(?:Ste|Suite|Unit|Level|Floor)\.?\s+[\w-]+(?:\s*(?:&|,)\s*(?:Level\s+)?\d+)*)", re.I)


def candidates(address):
    """The address as printed, then without its leading name when it has one, then
    from each later part that starts with a street number ("SFPL Main Branch,
    Koret Auditorium, 100 Larkin St, …", "447 Minna, 447 Minna St, …"), then
    without the unit inside the building.

    A leading part that starts with a digit is the street number, not a name:
    dropping it alone would answer with the town's centre, a guessed point."""
    parts = [p.strip() for p in address.split(",")]
    named = len(parts) > 2 and not parts[0][:1].isdigit()
    tries = [address] + ([", ".join(parts[1:])] if named else [])
    for i in range(1, len(parts) - 1):
        if parts[i][:1].isdigit():
            tries.append(", ".join(parts[i:]))
    plain = ", ".join(p for p in (re.sub(r"\s{2,}", " ", UNIT_RE.sub("", part)).strip(" &") for part in parts) if p)
    tries.append(plain)
    return list(dict.fromkeys(tries))


def selftest():
    assert candidates("Festival Theatre, Nicolson Street, Edinburgh") == [
        "Festival Theatre, Nicolson Street, Edinburgh", "Nicolson Street, Edinburgh"]
    assert candidates("SFPL Main Branch, Koret Auditorium, 100 Larkin St, San Francisco") == [
        "SFPL Main Branch, Koret Auditorium, 100 Larkin St, San Francisco",
        "Koret Auditorium, 100 Larkin St, San Francisco", "100 Larkin St, San Francisco"]
    assert candidates("447 Minna, 447 Minna St, San Francisco")[1] == "447 Minna St, San Francisco"
    assert candidates("3803 E Harry St Ste 121, Wichita, KS 67218") == [
        "3803 E Harry St Ste 121, Wichita, KS 67218", "3803 E Harry St, Wichita, KS 67218"]
    # A street number never leaves the query: the town alone is a guessed point.
    assert candidates("900 Camp Street, New Orleans, LA 70130") == ["900 Camp Street, New Orleans, LA 70130"]
    print("nominatim platform selftest: ok")


def run(festival_dir, source_id, addresses_from, fetcher, country_codes, field="address"):
    """`field` names the venue key holding the one-line address the source serves."""
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Geocode %s's venue addresses." % addresses_from)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    programme = common.read_raw(festival, edition["id"], addresses_from, "programme.json")
    addresses = sorted({v[field] for v in programme["venues"] if v.get(field)})
    results = []
    for address in addresses:
        # A box office often prefixes the street address with the building's
        # name, which Nominatim may not know; the plainer forms are the next tries.
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


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: nominatim.py --selftest")
    selftest()
