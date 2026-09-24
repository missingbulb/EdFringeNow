#!/usr/bin/env python3
"""Fetch comedy-festival.co.il's programme for one edition into its raw folder.

Run by hand, on a machine that can reach the site — never on a schedule:

    python3 scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py --edition 2026

Writes `data/festivals/jerusalem-comedy/<edition>/comedy-festival-site/`
(`programme.json` + `manifest.json`) and nothing else. The records keep the
site's own vocabulary — its taxonomy slugs, its Hebrew venue keys — because
turning them into ours is the converter's job (scraper/convert/), not this one's.

The site marks an edition with its `event-year` taxonomy term; the edition asked
for must have one, and every performance date must fall inside the edition
declared in festival.toml, or nothing is written.

The parsing half lives in parse.py and is proven offline by its own self-test;
this module is only the network and the hand-off to the shared raw writer.
"""

import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as jparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "comedy-festival-site"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 1

SITE = "https://comedy-festival.co.il"
REST = SITE + "/wp-json/wp/v2"


def rest(path, **params):
    params.setdefault("per_page", 100)
    return common.get(REST + "/" + path + "?" + urllib.parse.urlencode(params))


def event_page(cache_dir, slug, url):
    """The event's rendered page, cached on disk so re-runs need no network."""
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, slug + ".html")
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    body = common.get(url, as_json=False)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
    return body


def build(year, cache_dir):
    year_terms = {t["name"]: t["id"] for t in rest("event-year")}
    if str(year) not in year_terms:
        raise SystemExit("no event-year term for %s (have %s)" % (year, sorted(year_terms)))
    year_term = year_terms[str(year)]

    locations = {t["id"]: t for t in rest("eventlocation")}
    categories = {t["id"]: t for t in rest("event-type")}
    date_posts = {p["id"]: p for p in rest("dates")}
    all_dates = set(date_posts)

    events = [e for e in rest("events") if year_term in e.get("event-year", [])]
    print("%d events tagged %s" % (len(events), year))

    venue_addresses = {}
    skipped = []
    shows = []
    for event in events:
        page = event_page(cache_dir, event["slug"], event["link"])
        performances = jparse.page_performances(page, all_dates, year)
        if not performances:
            # The four "family events on <weekday>" pages are placeholders: no
            # date, no venue, no blurb. They are recorded rather than dropped
            # silently, so a future run that finds them filled in is a visible
            # change rather than a surprise.
            skipped.append(event["slug"])
            continue

        venue_ids = []
        for performance in performances:
            terms = date_posts[performance["id"]].get("eventlocation") or []
            venue_id = terms[0] if terms else None
            performance["venue"] = venue_id
            if venue_id is not None and venue_id not in venue_ids:
                venue_ids.append(venue_id)

        address = jparse.page_address(page, [locations[v]["name"] for v in venue_ids if v in locations])
        if address and len(venue_ids) == 1:
            venue_addresses.setdefault(venue_ids[0], address)

        shows.append(
            {
                "slug": event["slug"],
                "title": jparse.clean_text(event["title"]["rendered"]),
                "url": event["link"],
                "categories": [
                    categories[c]["slug"] for c in event.get("event-type", []) if c in categories
                ],
                "categoryNames": [
                    jparse.clean_text(categories[c]["name"])
                    for c in event.get("event-type", [])
                    if c in categories
                ],
                "description": jparse.page_description(page),
                "image": jparse.page_image(page),
                "duration": jparse.page_duration_minutes(page),
                "performances": [
                    {
                        "date": p["date"],
                        "start": p["start"],
                        "venue": venue_key(locations, p["venue"]),
                        "ticketUrl": p["ticketUrl"],
                        "free": p["free"],
                    }
                    for p in performances
                ],
            }
        )

    used = sorted({p["venue"] for s in shows for p in s["performances"] if p["venue"]})
    by_key = {venue_key(locations, i): i for i in locations}
    venues = []
    for key in used:
        term = locations[by_key[key]]
        venues.append(
            {
                "code": key,
                "name": jparse.clean_text(term["name"]),
                "address": venue_addresses.get(term["id"]),
            }
        )

    shows.sort(key=lambda s: (s["performances"][0]["date"], s["performances"][0]["start"], s["slug"]))
    return {
        "site": SITE,
        "year": year,
        "venues": venues,
        "skipped": skipped,
        "categories": sorted(
            {
                (c, n)
                for s in shows
                for c, n in zip(s["categories"], s["categoryNames"])
            }
        ),
        "shows": shows,
    }


def venue_key(locations, term_id):
    if term_id is None or term_id not in locations:
        return None
    return jparse.venue_code(locations[term_id]["slug"], term_id)


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    # The site files an edition under its calendar year; our edition id is that year.
    programme = build(int(edition["id"]), registry.cache_dir(festival, edition["id"], SOURCE_ID))
    common.guard_dates(edition, [p["date"] for s in programme["shows"] for p in s["performances"]])
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/jerusalem/sources/comedy-festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[REST + "/events", REST + "/dates", REST + "/eventlocation", REST + "/event-type",
              REST + "/event-year", SITE + "/events/<slug>/"],
        notes="WP REST gives identity and venue membership; date, start, ticket link, address "
              "and running time are read from each event's rendered page (parse.py).",
    )
    print("%d shows, %d performances, %d venues" % (
        len(programme["shows"]),
        sum(len(s["performances"]) for s in programme["shows"]),
        len(programme["venues"]),
    ))


if __name__ == "__main__":
    main()
