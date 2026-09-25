#!/usr/bin/env python3
"""Fetch the Edinburgh International Film Festival's programme into its raw folder.

Run by hand, on a machine that can reach the site — never on a schedule:

    python3 scraper/festivals/eiff/sources/festival-site/fetch.py --edition 2026

Writes `data/festivals/eiff/<edition>/festival-site/` (`programme.json` +
`manifest.json`) and nothing else.

The festival's own WordPress site (www.edfilmfest.org; the old edfilmfest.org.uk
only redirects there) sells its own tickets through a basket plugin
(`/wp-json/event-api/v1/basket`); the ticketing system behind it exposes no
listing of its own, so the What's On page is the most official surface with
showings on it. WP REST `wp/v2/film` adds each film's taxonomy.

The edition marker is the site's `festival` taxonomy term: one whose name ends
in the edition's year must exist, only films carrying it are read, and every
showing must fall inside the edition declared in festival.toml, or nothing is
written. The parsing half is parse.py, proven offline by its self-test.
"""

import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as eparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
FETCHER_VERSION = 1

SITE = "https://www.edfilmfest.org"
REST = SITE + "/wp-json/wp/v2"
WHATS_ON = SITE + "/whats-on/"
# The site's host drops a share of connections from here mid-handshake; a
# dropped connection is retried, an HTTP error is not (common.get).
ATTEMPTS = 8


def rest(path, **params):
    params.setdefault("per_page", 100)
    return common.get(REST + "/" + path + "?" + urllib.parse.urlencode(params), attempts=ATTEMPTS)


def rest_all(path, **params):
    records, page = [], 1
    while True:
        batch = rest(path, page=page, **params)
        records.extend(batch)
        if len(batch) < params.get("per_page", 100):
            return records
        page += 1


def build(year):
    terms = [t for t in rest("festival") if t["name"].strip().endswith(str(year))]
    if len(terms) != 1:
        raise SystemExit("no single festival term for %s (have %s)"
                         % (year, [t["name"] for t in rest("festival")]))
    term = terms[0]
    programme_types = {t["id"]: t for t in rest("programme_type")}
    films = [eparse.rest_film(f, programme_types) for f in rest_all("film", festival=term["id"])]
    print("%d films tagged %r" % (len(films), term["name"]))

    listing = eparse.whats_on(common.get(WHATS_ON, as_json=False, attempts=ATTEMPTS))
    by_slug = {f["slug"]: f for f in films}
    shows = []
    for slug, card in sorted(listing.items()):
        film = by_slug.get(slug)
        if film is None:
            raise SystemExit("What's On lists %s, which carries no %r term" % (slug, term["name"]))
        shows.append(dict(film, listing=card))
    unlisted = sorted(set(by_slug) - set(listing))
    return {
        "site": SITE,
        "festivalTerm": {"id": term["id"], "name": term["name"], "slug": term["slug"]},
        "programmeTypes": sorted(
            ({"slug": t["slug"], "name": t["name"]} for t in programme_types.values()), key=lambda t: t["slug"]),
        # Films tagged for the edition that What's On never shows: industry
        # sessions and pass-only items. Recorded, not dropped silently.
        "unlisted": unlisted,
        "shows": shows,
    }


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    programme = build(int(edition["id"]))
    common.guard_dates(edition, [s["date"] for show in programme["shows"] for s in show["listing"]["showings"]])
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/eiff/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[WHATS_ON, REST + "/film", REST + "/festival", REST + "/programme_type"],
        notes="Showings (time, venue label, price bands, seats left, sold out) are read from the "
              "What's On page's date grid; a sold-out showing prints only its time, so its venue and "
              "price are unknown. Film taxonomy is WP REST.",
    )
    print("%d films, %d showings" % (
        len(programme["shows"]), sum(len(s["listing"]["showings"]) for s in programme["shows"])))


if __name__ == "__main__":
    main()
