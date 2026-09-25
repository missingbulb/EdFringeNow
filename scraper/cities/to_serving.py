#!/usr/bin/env python3
"""Convert a city's raw sightseeing sources into its serving file, or prove the committed ones current.

    python3 scraper/cities/to_serving.py <city>      # write site/data/cities/<city>.json + index.json
    python3 scraper/cities/to_serving.py --check     # re-derive everything, diff, exit 1 on drift
    python3 scraper/cities/to_serving.py --selftest

The serving file (`v` 1) is festival-oblivious, one per city:

  * `city`: `id, name, country, lat, lng, timezone`
  * `places[]`: `{id, name, kind, lat, lng, address, website, wikidata,
    wikipedia, description, image, notability, highlight, openingHours,
    hoursSource, hours}` — `kind` ∈ KINDS; `openingHours` an OSM-syntax string,
    as mapped in OSM or, where OSM has none, as hand-researched in
    `scraper/cities/curated/<city>.json` (null: neither has it); `hoursSource`
    "osm" or the curated entry's URL; `hours` that string parsed into dated rules
    (scraper/cities/opening_hours.py; null: absent or outside the parsed
    subset, never a guess); `notability` the place's count of Wikipedia
    editions (null: no Wikidata link); `highlight` true for the city's top
    HIGHLIGHTS by notability — the short list to suggest first.
  * `provenance`: `{source: {fetchedAt, fetcher, fetcherVersion}}`

The registry `site/data/cities/index.json` is `{v, cities[{id, name, country,
lat, lng, timezone, dataUrl, places}]}`; `dataUrl` is null for a city whose osm
raw has not been fetched yet.
"""

import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fetch
import opening_hours

VERSION = 1
SERVING_ROOT = os.path.join(fetch.REPO_ROOT, "site", "data", "cities")
INDEX = os.path.join(SERVING_ROOT, "index.json")
HIGHLIGHTS = 25
KINDS = ("museum", "gallery", "garden", "park", "market", "viewpoint", "landmark", "zoo", "attraction")


def kind_of(tags):
    tourism, leisure = tags.get("tourism"), tags.get("leisure")
    if tourism in ("museum", "gallery", "viewpoint"):
        return tourism
    if tourism in ("zoo", "aquarium"):
        return "zoo"
    if leisure == "garden":
        return "garden"
    if leisure in ("park", "nature_reserve"):
        return "park"
    if tags.get("amenity") == "marketplace":
        return "market"
    if tags.get("historic") or tags.get("building") in ("cathedral", "church"):
        return "landmark"
    return "attraction"


def address_of(tags):
    street = " ".join(v for v in (tags.get("addr:housenumber"), tags.get("addr:street")) if v)
    parts = [p for p in (street, tags.get("addr:postcode")) if p]
    return ", ".join(parts) or None


def read(city_id, source, name):
    path = os.path.join(fetch.RAW_ROOT, city_id, source, name)
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def curated_hours(city_id):
    """{wikidata id: {openingHours, source}} — the hand-kept fallback for sights OSM has no hours for."""
    path = os.path.join(HERE, "curated", "%s.json" % city_id)
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as handle:
        hours = json.load(handle)["hours"]
    for qid, entry in hours.items():
        if not str(entry.get("source", "")).startswith("http") or opening_hours.parse(entry.get("openingHours")) is None:
            raise ValueError("curated/%s.json %s: needs a parseable openingHours and a source URL" % (city_id, qid))
    return hours


def build_city(city):
    osm = read(city["id"], "osm", "places.json")
    if osm is None:
        return None
    curated = curated_hours(city["id"])
    wikidata = (read(city["id"], "wikidata", "entities.json") or {"entities": {}})["entities"]
    places, seen = [], set()
    for p in osm["places"]:
        tags = p["tags"]
        # One sight mapped twice (a castle as a node and as its outline) is
        # one suggestion: the first record per Wikidata id stands.
        qid = tags.get("wikidata")
        if qid and qid in seen:
            continue
        if qid:
            seen.add(qid)
        entity = wikidata.get(qid) if qid else None
        hours_text, hours_source = tags.get("opening_hours"), "osm" if tags.get("opening_hours") else None
        if hours_text is None and qid in curated:
            hours_text, hours_source = curated[qid]["openingHours"], curated[qid]["source"]
        places.append({
            "id": "osm:" + p["id"],
            "name": tags["name"],
            "kind": kind_of(tags),
            "lat": p["lat"],
            "lng": p["lng"],
            "address": address_of(tags),
            "website": tags.get("website"),
            "wikidata": qid,
            "wikipedia": tags.get("wikipedia"),
            "description": entity["description"] if entity else None,
            "image": entity["image"] if entity else None,
            "notability": entity["sitelinks"] if entity else None,
            "highlight": False,
            "openingHours": hours_text,
            "hoursSource": hours_source,
            "hours": opening_hours.parse(hours_text),
        })
    ranked = sorted((p for p in places if p["notability"]), key=lambda p: (-p["notability"], p["id"]))
    for p in ranked[:HIGHLIGHTS]:
        p["highlight"] = True
    places.sort(key=lambda p: (not p["highlight"], -(p["notability"] or 0), p["name"], p["id"]))
    provenance = {}
    for source in ("osm", "wikidata"):
        manifest = read(city["id"], source, "manifest.json")
        if manifest:
            provenance[source] = {k: manifest.get(k) for k in ("fetchedAt", "fetcher", "fetcherVersion")}
    return {
        "v": VERSION,
        "city": {k: city[k] for k in ("id", "name", "country", "lat", "lng", "timezone")},
        "places": places,
        "provenance": provenance,
    }


def validate(block):
    errors = []
    ids = set()
    for i, p in enumerate(block["places"]):
        where = "places[%d]" % i
        if p["id"] in ids:
            errors.append("%s.id %s repeated" % (where, p["id"]))
        ids.add(p["id"])
        if p["kind"] not in KINDS:
            errors.append("%s.kind %r not in %s" % (where, p["kind"], KINDS))
        if not (-90 <= p["lat"] <= 90 and -180 <= p["lng"] <= 180):
            errors.append("%s: coordinates out of range" % where)
        if p["hours"] is not None and p["openingHours"] is None:
            errors.append("%s: hours without the openingHours they were parsed from" % where)
    return errors


def render(obj):
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"


def serving_path(city_id):
    return os.path.join(SERVING_ROOT, "%s.json" % city_id)


def expected_outputs():
    cities = fetch.load_cities()
    outputs, entries = {}, []
    for cid in sorted(cities):
        block = build_city(cities[cid])
        if block is not None:
            problems = validate(block)
            if problems:
                raise ValueError("%s does not validate; nothing written:\n  %s" % (cid, "\n  ".join(problems[:20])))
            outputs[serving_path(cid)] = render(block)
        entries.append({
            **{k: cities[cid][k] for k in ("id", "name", "country", "lat", "lng", "timezone")},
            "dataUrl": "/data/cities/%s.json" % cid if block else None,
            "places": len(block["places"]) if block else 0,
        })
    outputs[INDEX] = render({"v": VERSION, "cities": entries})
    return outputs


def atomic_write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(text)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


def write(city_id):
    outputs = expected_outputs()
    for path in (serving_path(city_id), INDEX):
        if path not in outputs:
            sys.exit("%s has no osm raw yet — run scraper/cities/fetch.py osm --city %s" % (city_id, city_id))
        atomic_write(path, outputs[path])
        print("wrote %s" % os.path.relpath(path, fetch.REPO_ROOT))


def check():
    expected = expected_outputs()
    committed = set()
    for root, _, files in os.walk(SERVING_ROOT):
        committed.update(os.path.join(root, f) for f in files)
    problems = []
    for path, text in sorted(expected.items()):
        rel = os.path.relpath(path, fetch.REPO_ROOT)
        if not os.path.exists(path):
            problems.append("%s is missing — run to_serving.py for its city" % rel)
        else:
            with open(path, encoding="utf-8") as handle:
                if handle.read() != text:
                    problems.append("%s differs from what its committed raw converts to" % rel)
    for path in sorted(committed - set(expected)):
        problems.append("%s is not produced by any declared city" % os.path.relpath(path, fetch.REPO_ROOT))
    if problems:
        print("city data drift:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1
    print("city data: %d serving file(s) match their raw" % len(expected))
    return 0


def selftest():
    assert kind_of({"tourism": "attraction", "historic": "castle"}) == "landmark"
    assert kind_of({"leisure": "garden"}) == "garden" and kind_of({"amenity": "marketplace"}) == "market"
    assert kind_of({"tourism": "attraction"}) == "attraction"
    assert address_of({"addr:housenumber": "1", "addr:street": "Castlehill", "addr:postcode": "EH1 2NG"}) == "1 Castlehill, EH1 2NG"
    assert address_of({}) is None
    block = {"places": [
        {"id": "osm:node/1", "kind": "museum", "lat": 55.9, "lng": -3.2, "hours": None, "openingHours": None},
        {"id": "osm:node/1", "kind": "spa", "lat": 95, "lng": 0, "hours": [], "openingHours": None},
    ]}
    problems = validate(block)
    assert len(problems) == 4, problems
    print("cities to_serving selftest: ok")


def main(argv):
    if argv == ["--check"]:
        return check()
    if argv == ["--selftest"]:
        selftest()
        return 0
    if len(argv) == 1 and not argv[0].startswith("-"):
        write(argv[0])
        return 0
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
