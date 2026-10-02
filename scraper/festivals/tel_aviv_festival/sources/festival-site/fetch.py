#!/usr/bin/env python3
"""Fetch the Tel Aviv Festival's programme for one edition into its raw folder.

Run by the festival update (`scraper/festivals/update.py`), or by hand:

    python3 scraper/festivals/tel_aviv_festival/sources/festival-site/fetch.py --edition 2026

Writes `data/festivals/tel-aviv-festival/<edition>/festival-site/`
(`programme.json` + `manifest.json`) and nothing else. The page names its year
in its title; if that is not the edition asked for, if a day's printed weekday
does not fall on its date in that year, or if any day is outside the edition,
nothing is written.

The page is the whole programme, pictures included: each show's own page
(`/show/<id>`) repeats the same record, so it is not fetched. The parsing half
lives in parse.py and is proven offline by its self-test.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as siteparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 1
SITE = "https://telavivfestival.co.il"
PAGE = SITE + "/program"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    html = common.get(PAGE, as_json=False)
    year = siteparse.page_year(html)
    if year != int(edition["id"]):
        raise common.FetchRefused(
            "the page programmes %s, not edition %s — nothing written" % (year, edition["id"])
        )
    try:
        raw = siteparse.programme(html, year)
    except siteparse.ParseError as error:
        raise common.FetchRefused("%s — nothing written" % error)
    common.guard_dates(edition, [day["isoDate"] for day in raw["days"]])
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": {"site": SITE, "page": PAGE, "year": year, **raw}},
        fetcher="scraper/festivals/tel_aviv_festival/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PAGE],
        notes="The page's settings, days and shows as its RSC payload carries them; each day gains isoDate.",
    )
    performances = sum(1 + len(show.get("times") or []) for show in raw["shows"])
    print("%d days, %d shows, %d performances" % (len(raw["days"]), len(raw["shows"]), performances))


if __name__ == "__main__":
    main()
