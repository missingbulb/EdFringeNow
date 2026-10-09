#!/usr/bin/env python3
"""Fetch the Red Sea Jazz Festival's lineup for one edition into its raw folder.

Run by hand, on a machine that can reach the site. Never run it on a schedule:

    python3 scraper/festivals/red_sea_jazz/sources/festival-site/fetch.py --edition 2026

Writes `data/festivals/red-sea-jazz/<edition>/festival-site/` (`programme.json`
+ `manifest.json`) and nothing else. The page names its year in its title; if
that is not the edition asked for, or any show is dated outside the edition,
nothing is written. The parsing half lives in parse.py.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as rparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
FETCHER_VERSION = 1
PAGE = "https://redseajazz.co.il/lineup/"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    page = common.get(PAGE, as_json=False)
    year = rparse.page_year(page)
    if year != int(edition["id"]):
        raise common.FetchRefused("the lineup page is for %s, not edition %s; nothing written" % (year, edition["id"]))
    shows = rparse.shows(page)
    common.guard_dates(edition, [s["date"] for s in shows])
    common.write_raw(
        festival, edition["id"], SOURCE_ID, {"programme.json": {"site": PAGE, "year": year, "shows": shows}},
        fetcher="scraper/festivals/red_sea_jazz/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PAGE],
        notes="One record per show card of the lineup's day blocks, in the page's own words; stages untranslated.",
    )
    print("%d shows" % len(shows))


if __name__ == "__main__":
    main()
