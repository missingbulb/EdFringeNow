#!/usr/bin/env python3
"""Convert a city's raw visitor sources into its serving file, or prove the committed ones current.

    python3 scraper/cities/to_serving.py <city>      # write site/data/cities/<city>.json + index.json
    python3 scraper/cities/to_serving.py --check     # re-derive everything, diff, exit 1 on drift
    python3 scraper/cities/to_serving.py --selftest

The serving file (`v` 1) is festival-oblivious, one per city:

  * `city`: `id, name, country, lat, lng, timezone`
  * `places[]` (to see): `{id, name, nameEn, kind, lat, lng, address, website, wikidata,
    wikipedia, description, image, notability, highlight, openingHours,
    hoursSource, hours}` — `kind` ∈ KINDS; `openingHours` an OSM-syntax string,
    as mapped in OSM or, where OSM has none, as hand-researched in
    `scraper/cities/curated/<city>.json` (null: neither has it); `hoursSource`
    "osm" or the curated entry's URL; `hours` that string parsed into dated rules
    (scraper/cities/opening_hours.py; null: absent or outside the parsed
    subset, never a guess); `notability` the place's count of Wikipedia
    editions (null: no Wikidata link, or one to the person a grave or
    memorial remembers rather than to the place); `highlight` true for the city's top
    HIGHLIGHTS by notability — the short list to suggest first; `nameEn` the
    English name OSM maps beside a local one (null: none mapped).
  * `stay[]` (at most STAY) and `eat[]` (at most EAT), from the `amenities`
    raw: `{id, name, nameEn, kind, stars, cuisine, lat, lng, address, website,
    wikidata, openingHours, hours, toVenueM, venuesNear}` — `kind` ∈
    STAY_KINDS for a place to stay, "restaurant" to eat; `stars` a number or
    null; `cuisine` OSM's list or null; `toVenueM` the metres to the nearest
    anchor and `venuesNear` the anchors within WALK_M, where an anchor is a
    festival venue in the city, or its centre while none is served (`near`
    says which). Ranked by `rank_amenities`.
  * `near`: "venues" or "centre", what `toVenueM` measures from.
  * `trips[]` (at most TRIPS), from the `wikivoyage` raw: `{name, page, url,
    description, lat, lng, km}` — the guide's Go next destinations within
    TRIP_MAX_KM of the centre, nearest first; `description` the guide's own
    line as plain text, less the name it opens with (null: the line is only
    the name).
  * `guide`: the Wikivoyage guide the trips came from, `{page, url}`, or null.
  * `licences`: per source, `{name, url, attribution}` and, for OSM, `credit`
    (the page its attribution links to) — what a page showing that source's
    data must credit, `url` being the licence's own text.
  * `provenance`: `{source: {fetchedAt, fetcher, fetcherVersion}}`

The registry `site/data/cities/index.json` is `{v, cities[{id, name, country,
lat, lng, timezone, dataUrl, places}]}`; `dataUrl` is null for a city whose osm
raw has not been fetched yet.
"""

import html
import json
import os
import re
import sys
import tempfile
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import fetch
import opening_hours

VERSION = 1
SERVING_ROOT = os.path.join(fetch.REPO_ROOT, "site", "data", "cities")
INDEX = os.path.join(SERVING_ROOT, "index.json")
HIGHLIGHTS = 25
KINDS = ("museum", "gallery", "garden", "park", "market", "viewpoint", "landmark", "zoo", "attraction")
HUMAN = "Q5"
STAY_KINDS = ("hotel", "guest_house", "hostel", "motel")
STAY = 8
EAT = 8
TRIPS = 6
WALK_M = 1000
TRIP_MAX_KM = 200
LICENCES = {
    "osm": {"name": "ODbL", "url": "https://opendatacommons.org/licenses/odbl/",
            "attribution": "© OpenStreetMap contributors", "credit": "https://www.openstreetmap.org/copyright"},
    "wikidata": {"name": "CC0", "url": "https://creativecommons.org/publicdomain/zero/1.0/",
                 "attribution": "Wikidata"},
    "wikivoyage": {"name": "CC BY-SA 4.0", "url": "https://creativecommons.org/licenses/by-sa/4.0/",
                   "attribution": "Wikivoyage contributors"},
}


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
        # A grave or memorial tagged with the person it remembers links that
        # person, not the place: their fame is not the sight's.
        if entity and HUMAN in entity.get("instanceOf", ()):
            entity = None
        hours_text, hours_source = tags.get("opening_hours"), "osm" if tags.get("opening_hours") else None
        if hours_text is None and qid in curated:
            hours_text, hours_source = curated[qid]["openingHours"], curated[qid]["source"]
        places.append({
            "id": "osm:" + p["id"],
            "name": tags["name"],
            "nameEn": name_en(tags),
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
    amenities = read(city["id"], "amenities", "places.json")
    stay, eat, near = build_amenities(amenities) if amenities else ([], [], None)
    gonext = read(city["id"], "wikivoyage", "gonext.json")
    trips = build_trips(city, gonext) if gonext else []
    provenance = {}
    for source in ("osm", "wikidata", "amenities", "wikivoyage"):
        manifest = read(city["id"], source, "manifest.json")
        if manifest:
            provenance[source] = {k: manifest.get(k) for k in ("fetchedAt", "fetcher", "fetcherVersion")}
    licences = {"osm": LICENCES["osm"]}
    if wikidata:
        licences["wikidata"] = LICENCES["wikidata"]
    if trips:
        licences["wikivoyage"] = LICENCES["wikivoyage"]
    return {
        "v": VERSION,
        "city": {k: city[k] for k in ("id", "name", "country", "lat", "lng", "timezone")},
        "places": places,
        "near": near,
        "stay": stay,
        "eat": eat,
        "trips": trips,
        "guide": {"page": gonext["page"], "url": gonext["url"]} if gonext else None,
        "licences": licences,
        "provenance": provenance,
    }


def name_en(tags):
    english = tags.get("name:en")
    return english if english and english != tags["name"] else None


def stars_of(tags):
    m = re.match(r"\s*(\d+(?:\.\d+)?)", tags.get("stars") or "")
    return float(m.group(1)) if m else None


def amenity_entry(p, anchors):
    tags = p["tags"]
    distances = [fetch.distance_m(p["lat"], p["lng"], a["lat"], a["lng"]) for a in anchors]
    kind = tags.get("tourism") if tags.get("tourism") in STAY_KINDS else "restaurant"
    cuisine = [c.strip() for c in tags["cuisine"].split(";") if c.strip()] if tags.get("cuisine") else None
    hours_text = tags.get("opening_hours")
    return {
        "id": "osm:" + p["id"],
        "name": tags["name"],
        "nameEn": name_en(tags),
        "kind": kind,
        "stars": stars_of(tags) if kind != "restaurant" else None,
        "cuisine": cuisine if kind == "restaurant" else None,
        "lat": p["lat"],
        "lng": p["lng"],
        "address": address_of(tags),
        "website": tags.get("website") or tags.get("contact:website"),
        "wikidata": tags.get("wikidata"),
        "openingHours": hours_text,
        "hours": opening_hours.parse(hours_text),
        "toVenueM": int(round(min(distances))),
        "venuesNear": sum(1 for d in distances if d <= WALK_M),
    }


def rank_amenities(entries):
    """The short list: where most of the city's venues are a walk away, then the
    place a visitor can most check before going (a website, mapped hours, a
    Wikidata entry, stars or a cuisine), then the nearest to a venue.

    How many venues are a walk away is counted in quarters of the best any
    candidate reaches, so in a city of hundreds of venues one venue more or less
    does not outrank a place that says what it is and when it is open."""
    best = max((e["venuesNear"] for e in entries), default=0)

    def band(e):
        return int(4 * e["venuesNear"] / best) if best else 0

    def known(e):
        return sum(1 for v in (e["website"], e["openingHours"], e["wikidata"], e["stars"] or e["cuisine"]) if v)

    return sorted(entries, key=lambda e: (-band(e), -known(e), e["toVenueM"], e["id"]))


def build_amenities(raw):
    anchors = raw["anchors"]
    near = "centre" if all(a["venue"] is None for a in anchors) else "venues"
    entries = [amenity_entry(p, anchors) for p in raw["places"]]
    stay = rank_amenities([e for e in entries if e["kind"] in STAY_KINDS])[:STAY]
    eat = rank_amenities([e for e in entries if e["kind"] == "restaurant"])[:EAT]
    return stay, eat, near


WIKILINK = re.compile(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]")
EXTLINK = re.compile(r"\[(?:https?:)?//[^\s\]]+\s*([^\]]*)\]")


def plain_text(wikitext):
    """A Go next line as a reader sees it: links as their words, no templates, markup or references."""
    text = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", wikitext, flags=re.S)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = WIKILINK.sub(lambda m: (m.group(2) or m.group(1)).strip(), text)
    text = EXTLINK.sub(lambda m: m.group(1), text)
    text = re.sub(r"'{2,}", "", text)
    text = html.unescape(re.sub(r"<[^>]+>", "", text))
    return re.sub(r"\s+", " ", text).strip(" :–-")


def trip_description(item, name):
    """The guide's line about a destination, less the name it opens with; None when that is all it says."""
    text = plain_text(item["line"])
    for opening in (name, item["page"]):
        if text.startswith(opening):
            rest = text[len(opening):]
            if not rest.strip() or rest.lstrip()[:1] in "–—-:,(":
                text = rest.lstrip().lstrip("–—-:,").strip()
                break
    return text[:1].upper() + text[1:] if text else None


def trip_name(item):
    m = WIKILINK.search(item["line"])
    shown = (m.group(2) if m and m.group(2) else item["page"]).strip()
    return re.sub(r"\s*\([^)]*\)$", "", shown)


def build_trips(city, gonext):
    trips, seen = [], set()
    for item in gonext["items"]:
        page = item.get("resolved")
        if page is None or item["lat"] is None or page in seen:
            continue
        seen.add(page)
        km = fetch.distance_m(city["lat"], city["lng"], item["lat"], item["lng"]) / 1000
        if km > TRIP_MAX_KM or km < 1:
            continue
        name = trip_name(item)
        trips.append({
            "name": name,
            "page": page,
            "url": fetch.WIKIVOYAGE + urllib.parse.quote(page.replace(" ", "_")),
            "description": trip_description(item, name),
            "lat": item["lat"],
            "lng": item["lng"],
            "km": int(round(km)),
        })
    trips.sort(key=lambda t: (t["km"], t["name"]))
    return trips[:TRIPS]


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
    for name, cap, kinds in (("stay", STAY, STAY_KINDS), ("eat", EAT, ("restaurant",))):
        entries = block.get(name, [])
        if len(entries) > cap:
            errors.append("%s: %d entries, at most %d" % (name, len(entries), cap))
        for i, e in enumerate(entries):
            if e["kind"] not in kinds:
                errors.append("%s[%d].kind %r not in %s" % (name, i, e["kind"], kinds))
    if len(block.get("trips", [])) > TRIPS:
        errors.append("trips: %d entries, at most %d" % (len(block["trips"]), TRIPS))
    for i, t in enumerate(block.get("trips", [])):
        if t["km"] > TRIP_MAX_KM:
            errors.append("trips[%d]: further than %d km" % (i, TRIP_MAX_KM))
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

    assert plain_text("[[Linlithgow]] has a ruined ''Palace''.") == "Linlithgow has a ruined Palace."
    assert plain_text("[[Melrose (Scotland) | Melrose]] {{marker|x}} has an [http://a.b abbey]<ref>r</ref>") == \
        "Melrose has an abbey"
    assert trip_description({"page": "Bethlehem", "line": "[[Bethlehem]] &ndash; the birthplace"}, "Bethlehem") == \
        "The birthplace"
    assert trip_description({"page": "Abu Gosh", "line": "[[Abu Gosh]]"}, "Abu Gosh") is None
    assert trip_description({"page": "Linlithgow", "line": "[[Linlithgow]] has a palace."}, "Linlithgow") == \
        "Linlithgow has a palace."
    assert trip_name({"page": "Kelso (Scotland)", "line": "[[Kelso (Scotland)]] is old"}) == "Kelso"
    assert trip_name({"page": "Melrose (Scotland)", "line": "[[Melrose (Scotland) | Melrose]] x"}) == "Melrose"
    assert stars_of({"stars": "4S"}) == 4.0 and stars_of({}) is None

    # Ranking: more venues a walk away wins by whole quarters only, then what
    # can be checked before going, then nearness.
    anchors = [{"venue": "a", "lat": 0.0, "lng": 0.0}, {"venue": "b", "lat": 0.0, "lng": 0.01}]
    raw = {"anchors": anchors, "places": [
        {"id": "node/1", "lat": 0.0, "lng": 0.02, "tags": {"name": "Far", "amenity": "restaurant"}},
        {"id": "node/2", "lat": 0.0, "lng": 0.005, "tags": {"name": "Bare", "amenity": "restaurant"}},
        {"id": "node/3", "lat": 0.0, "lng": 0.006, "tags": {"name": "Known", "amenity": "restaurant",
                                                          "website": "https://x", "cuisine": "thai;noodle"}},
        {"id": "node/4", "lat": 0.0, "lng": 0.0, "tags": {"name": "Inn", "tourism": "hotel", "stars": "3"}},
    ]}
    stay, eat, near = build_amenities(raw)
    assert near == "venues" and [e["name"] for e in stay] == ["Inn"] and stay[0]["stars"] == 3.0
    assert [e["name"] for e in eat] == ["Known", "Bare", "Far"], [e["name"] for e in eat]
    assert eat[0]["cuisine"] == ["thai", "noodle"] and eat[0]["venuesNear"] == 2 and eat[2]["venuesNear"] == 0
    assert build_amenities({"anchors": [{"venue": None, "lat": 0, "lng": 0}], "places": []})[2] == "centre"

    city = {"lat": 0.0, "lng": 0.0}
    gonext = {"items": [
        {"page": "B", "resolved": "B", "line": "[[B]] is near.", "lat": 0.0, "lng": 0.2},
        {"page": "A", "resolved": "A", "line": "[[A]] is nearer.", "lat": 0.0, "lng": 0.1},
        {"page": "A2", "resolved": "A", "line": "[[A2]] again.", "lat": 0.0, "lng": 0.1},
        {"page": "Far", "resolved": "Far", "line": "[[Far]] is far.", "lat": 0.0, "lng": 5.0},
        {"page": "Region", "resolved": "Region", "line": "[[Region]] has no point.", "lat": None, "lng": None},
    ]}
    assert [(t["name"], t["km"]) for t in build_trips(city, gonext)] == [("A", 11), ("B", 22)]
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
