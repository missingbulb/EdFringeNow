#!/usr/bin/env python3
"""Fetch edinburghartfestival.com's programme for one edition into its raw folder.

Run by hand, on a machine that can reach the site — never on a schedule:

    python3 scraper/festivals/edinburgh_art_festival/sources/festival-site/fetch.py --edition 2026

Writes `data/festivals/edinburgh-art-festival/<edition>/festival-site/`
(`programme.json` + `manifest.json`) and nothing else. Everything comes from the
site's WP REST API (`wp/v2/event` with its ACF fields); no page is scraped.

The site marks an edition with its `festival<year>` event tag; the edition asked
for must have one or nothing is written. Every record under that tag is kept —
exhibitions with their date range and opening hours, and events dated before
the festival proper — because the raw is the site's programme, not ours; which
of them become performances is the adapter's call. `common.guard_dates` runs
over the single-sitting events inside the declared edition, so a fetch that
finds none of them writes nothing.

Parsing lives in parse.py, proven offline by its own self-test.
"""

import os
import sys
import urllib.parse
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as eparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
FETCHER_VERSION = 1

SITE = "https://edinburghartfestival.com"
REST = SITE + "/wp-json/wp/v2"


def rest_all(path, **params):
    params.setdefault("per_page", 100)
    out, page = [], 1
    while True:
        params["page"] = page
        batch = common.get(REST + "/" + path + "?" + urllib.parse.urlencode(params))
        out.extend(batch)
        if len(batch) < params["per_page"]:
            return out
        page += 1


def build(year):
    tags = {t["id"]: t["slug"] for t in rest_all("event-tag")}
    marker = eparse.edition_tag(year)
    tag_id = next((i for i, s in tags.items() if s == marker), None)
    if tag_id is None:
        raise common.FetchRefused("no %r event tag on the site — nothing written" % marker)
    types = {t["id"]: (t["slug"], eparse.clean_text(t["name"])) for t in rest_all("event-type")}

    raw_events = rest_all("event", **{"event-tag": tag_id})
    events, venues = [], {}
    for event in raw_events:
        events.append(eparse.event_record(event, tags, types))
        embedded = (event.get("acf") or {}).get("event2venue")
        if isinstance(embedded, dict):
            venues.setdefault(embedded["id"], eparse.venue_record(embedded))
    events.sort(key=lambda e: (e["dateStart"] or "", e["start"] or "", e["slug"]))
    used_types = sorted({t for e in events for t in e["types"]})
    type_names = dict(types.values())
    return {
        "site": SITE,
        "year": year,
        "editionTag": marker,
        "categories": [[slug, type_names[slug]] for slug in used_types],
        "venues": sorted(venues.values(), key=lambda v: v["name"]),
        "events": events,
    }


def sittings_in_edition(edition, events):
    lo = (date.fromisoformat(edition["first"]) - timedelta(days=1)).isoformat()
    hi = (date.fromisoformat(edition["last"]) + timedelta(days=1)).isoformat()
    return [
        e["dateStart"]
        for e in events
        if e["format"] == "event" and e["dateStart"] and e["dateStart"] == e["dateEnd"] and lo <= e["dateStart"] <= hi
    ]


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = build(int(edition["id"]))
    common.guard_dates(edition, sittings_in_edition(edition, programme["events"]))
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/edinburgh_art_festival/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[REST + "/event?event-tag=<festival-year tag>", REST + "/event-tag", REST + "/event-type"],
        notes="WP REST with ACF: every event and exhibition tagged %s, each with its embedded venue "
              "(coordinates, address, opening hours). Start times are read from the free-text "
              "time_info (parse.py); no prices (the ACF price fields are form defaults)." % programme["editionTag"],
    )
    formats = {}
    for e in programme["events"]:
        formats[e["format"]] = formats.get(e["format"], 0) + 1
    print("%d records %s, %d venues" % (len(programme["events"]), formats, len(programme["venues"])))


if __name__ == "__main__":
    main()
