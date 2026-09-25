#!/usr/bin/env python3
"""Fetch one city's sightseeing layer into its raw folder. Run by hand:

    python3 scraper/cities/fetch.py osm --city edinburgh
    python3 scraper/cities/fetch.py wikidata --city edinburgh    # after osm

`osm` asks OpenStreetMap's Overpass API for the named places a visitor would
walk to between shows — museums, galleries, gardens, notable parks, markets,
viewpoints, landmarks — within the city's `radius_m`, with their
`opening_hours` as mapped. `wikidata` then asks Wikidata about every place the
OSM record links, for how notable it is (its count of Wikipedia editions), an
English description and an image — the ranking that picks a city's highlights.

Each writes only `data/cities/<city>/<source>/`, all at once or not at all, with
a `manifest.json` — the same contract as a festival source
(scraper/festivals/README.md), without editions: a city's sights are not
annual.
"""

import argparse
import json
import os
import shutil
import sys
import tomllib
import urllib.parse
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "festivals"))
import common

REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
RAW_ROOT = os.path.join(REPO_ROOT, "data", "cities")
CITIES = os.path.join(HERE, "cities.toml")
OVERPASS = "https://overpass-api.de/api/interpreter"
WIKIDATA = "https://www.wikidata.org/w/api.php"
FETCHER_VERSION = 1

# What a place must be to be worth suggesting. Parks, gardens, historic sites
# and plain "attractions" are legion in OSM (most named gardens are communal
# squares behind railings), so the long-tail classes need a Wikidata link
# (someone found them notable) or, for a garden, mapped opening hours;
# museums, galleries, markets and viewpoints are kept on a name alone.
SELECTORS = (
    '["tourism"~"^(museum|gallery|zoo|aquarium|theme_park|viewpoint)$"]["name"]',
    '["tourism"="attraction"]["name"]["wikidata"]',
    '["leisure"="garden"]["name"]["wikidata"]',
    '["leisure"="garden"]["name"]["opening_hours"]',
    '["leisure"~"^(park|nature_reserve)$"]["name"]["wikidata"]',
    '["amenity"="marketplace"]["name"]',
    '["historic"~"^(castle|palace|monument|memorial|ruins|church|cathedral|fort|city_gate|archaeological_site)$"]["name"]["wikidata"]',
    '["building"~"^(cathedral|church)$"]["name"]["wikidata"]["tourism"]',
)
KEPT_TAGS = ("name", "tourism", "leisure", "amenity", "historic", "building", "opening_hours", "website",
             "wikidata", "wikipedia", "addr:housenumber", "addr:street", "addr:postcode", "fee", "wheelchair")


def load_cities():
    with open(CITIES, "rb") as handle:
        cities = {c["id"]: c for c in tomllib.load(handle)["city"]}
    return cities


def overpass_query(city):
    around = "(around:%d,%s,%s)" % (city["radius_m"], city["lat"], city["lng"])
    parts = "".join("nwr%s%s;" % (around, s) for s in SELECTORS)
    return "[out:json][timeout:180];(%s);out center tags;" % parts


def fetch_osm(city):
    body = urllib.parse.urlencode({"data": overpass_query(city)}).encode()
    data = common.post(OVERPASS, body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    places = []
    for el in data["elements"]:
        point = el if "lat" in el else el.get("center") or {}
        if "lat" not in point:
            continue
        places.append({
            "id": "%s/%d" % (el["type"], el["id"]),
            "lat": round(point["lat"], 6),
            "lng": round(point["lon"], 6),
            "tags": {k: el["tags"][k] for k in KEPT_TAGS if k in el["tags"]},
        })
    places.sort(key=lambda p: p["id"])
    return {"places.json": {"places": places}}, [OVERPASS], "One Overpass query: %s" % overpass_query(city)


def fetch_wikidata(city):
    with open(os.path.join(RAW_ROOT, city["id"], "osm", "places.json"), encoding="utf-8") as handle:
        places = json.load(handle)["places"]
    qids = sorted({p["tags"]["wikidata"] for p in places if p["tags"].get("wikidata", "").startswith("Q")})
    entities = {}
    for i in range(0, len(qids), 50):
        query = urllib.parse.urlencode({
            "action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "format": "json",
            "props": "sitelinks|descriptions|claims", "languages": "en",
        })
        answer = common.get(WIKIDATA + "?" + query)
        for qid, entity in answer.get("entities", {}).items():
            if "missing" in entity:
                continue
            claims = entity.get("claims", {})
            image = claims.get("P18", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
            entities[qid] = {
                "sitelinks": len([k for k in entity.get("sitelinks", {}) if k.endswith("wiki") and k != "commonswiki"]),
                "description": entity.get("descriptions", {}).get("en", {}).get("value"),
                "image": image,
            }
    return ({"entities.json": {"entities": dict(sorted(entities.items()))}}, [WIKIDATA],
            "wbgetentities for every Wikidata id the osm source links; sitelinks counts Wikipedia editions.")


def write_raw(city_id, source, files, urls, notes):
    target = os.path.join(RAW_ROOT, city_id, source)
    staging = target + ".tmp-%d" % os.getpid()
    shutil.rmtree(staging, ignore_errors=True)
    os.makedirs(staging)
    files = dict(files)
    files["manifest.json"] = {
        "city": city_id, "source": source,
        "fetchedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "fetcher": "scraper/cities/fetch.py", "fetcherVersion": FETCHER_VERSION,
        "urls": urls, "files": sorted(n for n in files if n != "manifest.json"), "notes": notes,
    }
    try:
        for name, payload in files.items():
            common._dump(os.path.join(staging, name), payload)
        shutil.rmtree(target, ignore_errors=True)
        os.rename(staging, target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    print("wrote %s" % os.path.relpath(target, REPO_ROOT))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", choices=("osm", "wikidata"))
    parser.add_argument("--city", required=True)
    args = parser.parse_args()
    cities = load_cities()
    if args.city not in cities:
        sys.exit("unknown city %r (have %s)" % (args.city, sorted(cities)))
    files, urls, notes = (fetch_osm if args.source == "osm" else fetch_wikidata)(cities[args.city])
    write_raw(args.city, args.source, files, urls, notes)


if __name__ == "__main__":
    main()
