#!/usr/bin/env python3
"""Fetch edinburghdeaffestival.com's programme for one edition into its raw folder.

Run by hand, on a machine that can reach the site — never on a schedule:

    python3 scraper/festivals/edinburgh_deaf_festival/sources/festival-site/fetch.py --edition 2026

Writes `data/festivals/edinburgh-deaf-festival/<edition>/festival-site/`
(`programme.json` + `manifest.json`) and nothing else.

The site runs the Modern Events Calendar plugin. WP REST lists its events
(`wp/v2/mec-events`) but not their dates; the plugin's `mec/v1/events` answered
`[]` and its iCal feed lists only upcoming events (both probed 2026-09-25), so
each event's page is read for its occurrence (parse.py). Tickets sell through
Humanitix (no open API) and, for Fringe-registered shows, edfringe.com.

The edition marker is the occurrence year on each page: an event is this
edition's when its page dates it in the edition's year. Only posts modified in
that year are opened at all (an older post cannot be this year's). Every such
event is kept in the raw, including multi-day and out-of-window ones; the
adapter decides what becomes a performance. `common.guard_dates` runs over the
single-day sittings inside the declared edition, so a fetch that finds none
writes nothing.
"""

import os
import re
import sys
import urllib.parse
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as dparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
FETCHER_VERSION = 1

SITE = "https://edinburghdeaffestival.com"
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


def venue_code(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("’", "")).strip("-")


def build(year, cache_dir):
    categories = {c["id"]: (c["slug"], dparse.one_line(c["name"])) for c in rest_all("mec_category")}
    slugs = {i: s for i, (s, _n) in categories.items()}
    posts = [p for p in rest_all("mec-events") if p["modified"] >= "%d-01-01" % year]
    events, venues = [], {}
    for post in posts:
        occurrence = dparse.page_occurrence(common.cached_page(cache_dir, post["link"]))
        if occurrence is None or not (occurrence["dateStart"] or "").startswith(str(year)):
            continue
        record = dparse.event_record(post, slugs, occurrence)
        if record["venue"]:
            code = venue_code(record["venue"])
            record["venue"] = code
            venues.setdefault(code, {"code": code, "name": occurrence["venue"], "address": occurrence["address"]})
        events.append(record)
    events.sort(key=lambda e: (e["dateStart"], e["start"] or "", e["slug"]))
    names = dict(categories.values())
    return {
        "site": SITE,
        "year": year,
        "categories": [[s, names[s]] for s in sorted({c for e in events for c in e["categories"]})],
        "venues": sorted(venues.values(), key=lambda v: v["code"]),
        "events": events,
    }


def sittings_in_edition(edition, events):
    lo = (date.fromisoformat(edition["first"]) - timedelta(days=1)).isoformat()
    hi = (date.fromisoformat(edition["last"]) + timedelta(days=1)).isoformat()
    return [e["dateStart"] for e in events if e["dateStart"] == e["dateEnd"] and lo <= e["dateStart"] <= hi]


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = build(int(edition["id"]), registry.cache_dir(festival, edition["id"], SOURCE_ID))
    if not programme["events"]:
        raise common.FetchRefused("no event page dated %s — nothing written" % edition["id"])
    common.guard_dates(edition, sittings_in_edition(edition, programme["events"]))
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/edinburgh_deaf_festival/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[REST + "/mec-events", REST + "/mec_category", SITE + "/mec-events/<slug>/"],
        notes="WP REST gives identity, categories, description, the Duration/Price lines and the "
              "booking link; date range, venue and address come from each page's schema.org JSON-LD "
              "and the clock time from its Time box (parse.py). No availability; prices are free text.",
    )
    print("%d events, %d venues" % (len(programme["events"]), len(programme["venues"])))


if __name__ == "__main__":
    main()
