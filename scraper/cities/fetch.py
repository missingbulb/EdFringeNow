#!/usr/bin/env python3
"""Fetch one city's visitor layer into its raw folder. Run by hand:

    python3 scraper/cities/fetch.py osm --city edinburgh
    python3 scraper/cities/fetch.py wikidata --city edinburgh    # after osm
    python3 scraper/cities/fetch.py amenities --city edinburgh
    python3 scraper/cities/fetch.py wikivoyage --city edinburgh

`osm` asks OpenStreetMap's Overpass API for the named places a visitor would
walk to between shows — museums, galleries, gardens, notable parks, markets,
viewpoints, landmarks — within the city's `radius_m`, with their
`opening_hours` as mapped. `wikidata` then asks Wikidata about every place the
OSM record links, for how notable it is (its count of Wikipedia editions), an
English description and an image — the ranking that picks a city's highlights.
`amenities` asks Overpass for the hotels and restaurants within the city's
`near_m` of its festivals' venues, and records the venues it asked around.
`wikivoyage` reads the "Go next" section of the city's Wikivoyage guide, and
each destination it links for where that destination is.

Each writes only `data/cities/<city>/<source>/`, all at once or not at all, with
a `manifest.json` — the same contract as a festival source
(scraper/festivals/README.md), without editions: a city is not annual.
"""

import argparse
import json
import math
import os
import re
import shutil
import sys
import time
import tomllib
import urllib.parse
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "festivals"))
import common

REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
RAW_ROOT = os.path.join(REPO_ROOT, "data", "cities")
CITIES = os.path.join(HERE, "cities.toml")
# The main Overpass instance first, then a public mirror of the same database
# (listed on the OSM wiki's Overpass API page); the manifest names the one that answered.
OVERPASS = ("https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter")
WIKIDATA = "https://www.wikidata.org/w/api.php"
WIKIVOYAGE = "https://en.wikivoyage.org/wiki/"
FESTIVAL_REGISTRY = os.path.join(REPO_ROOT, "site", "data", "festivals", "index.json")
FETCHER_VERSION = 2

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
KEPT_TAGS = ("name", "name:en", "tourism", "leisure", "amenity", "historic", "building", "opening_hours", "website",
             "wikidata", "wikipedia", "addr:housenumber", "addr:street", "addr:postcode", "fee", "wheelchair")


def load_cities():
    with open(CITIES, "rb") as handle:
        cities = {c["id"]: c for c in tomllib.load(handle)["city"]}
    return cities


def overpass(query):
    """(answer, the instance that gave it) from the first instance that answers."""
    body = urllib.parse.urlencode({"data": query}).encode()
    failures = []
    for url in OVERPASS:
        try:
            return common.post(url, body, headers={"Content-Type": "application/x-www-form-urlencoded"}), url
        except Exception as error:  # one instance down or refusing; the next serves the same database
            failures.append("%s: %s" % (url, error))
    raise RuntimeError("no Overpass instance answered:\n  " + "\n  ".join(failures))


def elements_to_places(data, kept_tags):
    places = []
    for el in data["elements"]:
        point = el if "lat" in el else el.get("center") or {}
        if "lat" not in point:
            continue
        places.append({
            "id": "%s/%d" % (el["type"], el["id"]),
            "lat": round(point["lat"], 6),
            "lng": round(point["lon"], 6),
            "tags": {k: el["tags"][k] for k in kept_tags if k in el["tags"]},
        })
    places.sort(key=lambda p: p["id"])
    return places


def overpass_query(city):
    around = "(around:%d,%s,%s)" % (city["radius_m"], city["lat"], city["lng"])
    parts = "".join("nwr%s%s;" % (around, s) for s in SELECTORS)
    return "[out:json][timeout:180];(%s);out center tags;" % parts


def fetch_osm(city):
    data, url = overpass(overpass_query(city))
    return {"places.json": {"places": elements_to_places(data, KEPT_TAGS)}}, [url], \
        "One Overpass query: %s" % overpass_query(city)


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
            instance_of = sorted({c.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
                                  for c in claims.get("P31", [])} - {None})
            entities[qid] = {
                "sitelinks": len([k for k in entity.get("sitelinks", {}) if k.endswith("wiki") and k != "commonswiki"]),
                "description": entity.get("descriptions", {}).get("en", {}).get("value"),
                "image": image,
                "instanceOf": instance_of,
            }
    return ({"entities.json": {"entities": dict(sorted(entities.items()))}}, [WIKIDATA],
            "wbgetentities for every Wikidata id the osm source links; sitelinks counts Wikipedia editions.")


# --- where to stay and eat, near the festivals' venues ----------------------

AMENITY_SELECTORS = (
    '["tourism"~"^(hotel|guest_house|hostel|motel)$"]["name"]',
    '["amenity"="restaurant"]["name"]',
)
AMENITY_TAGS = ("name", "name:en", "tourism", "amenity", "stars", "cuisine", "website", "contact:website",
                "opening_hours", "wikidata", "addr:housenumber", "addr:street", "addr:postcode", "wheelchair")
# Venues are asked around in cells this many degrees across (about 550 m of
# latitude), so a city of three hundred venues is a few dozen clauses rather
# than three hundred; the radius gains the cell's half-diagonal so no venue's
# own circle is cut short, and the answer is trimmed to the venues themselves.
CELL_DEG = 0.005
CELL_SLACK_M = 400


def distance_m(a_lat, a_lng, b_lat, b_lng):
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = p2 - p1, math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(h))


def festival_venues(festival):
    for edition in festival["editions"]:
        url = edition.get("dataUrl")
        if not url:
            continue
        if edition.get("format") == "edfringe-wire":
            with open(os.path.join(REPO_ROOT, "site", edition["wire"]["lookups"].lstrip("/")), encoding="utf-8") as h:
                yield from (dict(v, id=k) for k, v in json.load(h)["venues"].items())
        else:
            with open(os.path.join(REPO_ROOT, "site", url.lstrip("/")), encoding="utf-8") as h:
                yield from json.load(h)["venues"]


def venue_anchors(city):
    """The venues of every festival the registry places in this city, within its
    `radius_m`: the points a visitor keeps coming back to. A city with no
    programme served yet is anchored at its centre."""
    with open(FESTIVAL_REGISTRY, encoding="utf-8") as handle:
        registry = json.load(handle)
    anchors = {}
    for festival in registry["festivals"]:
        if festival["city"] != city["name"]:
            continue
        for v in festival_venues(festival):
            if v.get("online") or v.get("lat") is None or v.get("lng") is None:
                continue
            if distance_m(city["lat"], city["lng"], v["lat"], v["lng"]) > city["radius_m"]:
                continue
            key = (round(v["lat"], 5), round(v["lng"], 5))
            anchors.setdefault(key, {"festival": festival["id"], "venue": str(v["id"]), "lat": key[0], "lng": key[1]})
    if not anchors:
        return [{"festival": None, "venue": None, "lat": city["lat"], "lng": city["lng"]}]
    return sorted(anchors.values(), key=lambda a: (a["festival"], a["venue"], a["lat"], a["lng"]))


def amenity_cells(anchors):
    return sorted({(round(round(a["lat"] / CELL_DEG) * CELL_DEG, 4), round(round(a["lng"] / CELL_DEG) * CELL_DEG, 4))
                   for a in anchors})


def amenities_query(city, anchors):
    radius = city["near_m"] + CELL_SLACK_M
    parts = "".join("nwr(around:%d,%s,%s)%s;" % (radius, lat, lng, sel)
                    for lat, lng in amenity_cells(anchors) for sel in AMENITY_SELECTORS)
    return "[out:json][timeout:180];(%s);out center tags;" % parts


def fetch_amenities(city):
    anchors = venue_anchors(city)
    data, url = overpass(amenities_query(city, anchors))
    places = [p for p in elements_to_places(data, AMENITY_TAGS)
              if any(distance_m(p["lat"], p["lng"], a["lat"], a["lng"]) <= city["near_m"] for a in anchors)]
    return ({"places.json": {"nearM": city["near_m"], "anchors": anchors, "places": places}}, [url],
            "Hotels, guest houses, hostels, motels and restaurants within nearM of an anchor: a festival "
            "venue, or the centre where no programme is served. One Overpass query around %d cells."
            % len(amenity_cells(anchors)))


# --- day trips, from the city's Wikivoyage guide ----------------------------

GEO = re.compile(r"\{\{\s*geo\s*\|\s*(-?[\d.]+)\s*\|\s*(-?[\d.]+)", re.I)
REDIRECT = re.compile(r"^#REDIRECT\s*\[\[([^\]|#]+)", re.I)
LINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]")


def wikivoyage_raw(title, follow=True):
    """(title, wikitext) of a guide, through one redirect; None for a page that does not exist."""
    url = WIKIVOYAGE + urllib.parse.quote(title.strip().replace(" ", "_")) + "?action=raw"
    text = common.get_or_none(url, as_json=False)
    # One page a second: Wikimedia rate-limits bursts from a shared address.
    time.sleep(1)
    if text is None:
        return None
    m = REDIRECT.match(text.strip())
    if m and follow:
        return wikivoyage_raw(m.group(1), follow=False)
    return title.strip(), text


def go_next_items(wikitext):
    """Each bullet of the Go next section that links a destination: its first link, and the line as written."""
    section = re.split(r"^==\s*Go next\s*==\s*$", wikitext, flags=re.M | re.I)
    if len(section) < 2:
        return []
    body = re.split(r"^==[^=].*==\s*$", section[1], flags=re.M)[0]
    items = []
    for line in body.splitlines():
        if not line.startswith("*"):
            continue
        m = LINK.search(line)
        if not m or m.group(1).strip().lower().startswith(("image:", "file:", "category:")):
            continue
        items.append({"page": m.group(1).strip(), "line": line.lstrip("*: ").strip()})
    return items


def fetch_wikivoyage(city):
    page = wikivoyage_raw(city["wikivoyage"])
    if page is None:
        sys.exit("no Wikivoyage guide called %r" % city["wikivoyage"])
    title, text = page
    url = WIKIVOYAGE + urllib.parse.quote(title.replace(" ", "_"))
    items = go_next_items(text)
    for item in items:
        dest = wikivoyage_raw(item["page"])
        geo = GEO.search(dest[1]) if dest else None
        item["resolved"] = dest[0] if dest else None
        item["lat"] = round(float(geo.group(1)), 6) if geo else None
        item["lng"] = round(float(geo.group(2)), 6) if geo else None
    return ({"gonext.json": {"page": title, "url": url, "items": items}}, [url],
            "The guide's Go next section (action=raw), and each destination it links for its {{geo}}. "
            "Wikivoyage text is CC BY-SA 4.0.")


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


FETCHERS = {"osm": fetch_osm, "wikidata": fetch_wikidata, "amenities": fetch_amenities, "wikivoyage": fetch_wikivoyage}


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", choices=tuple(FETCHERS))
    parser.add_argument("--city", required=True)
    args = parser.parse_args()
    cities = load_cities()
    if args.city not in cities:
        sys.exit("unknown city %r (have %s)" % (args.city, sorted(cities)))
    files, urls, notes = FETCHERS[args.source](cities[args.city])
    write_raw(args.city, args.source, files, urls, notes)


if __name__ == "__main__":
    main()
