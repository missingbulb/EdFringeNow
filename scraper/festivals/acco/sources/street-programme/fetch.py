#!/usr/bin/env python3
"""Fetch the free street programme (מופעי חוצות) for one edition into its raw folder.

Run by hand, on a machine that can reach the site. Never run it on a schedule:

    python3 scraper/festivals/acco/sources/street-programme/fetch.py --edition 2026

Writes `data/festivals/acco/<edition>/street-programme/` (`programme.json` and
`manifest.json`) and nothing else. The page states its own dates ("28–30.9.26").
If that year is not the edition asked for, or any performance falls outside the
edition, nothing is written.

The parsing half lives in parse.py, and its self-test proves it offline.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import page_blocks
import parse as streetparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "street-programme"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 1
PAGE = "https://akko-festival-shows.vercel.app"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    tokens = page_blocks.blocks(common.get(PAGE, as_json=False))
    year, days = streetparse.page_dates(tokens)
    if year != int(edition["id"]):
        raise common.FetchRefused(
            "the page programmes %s, not edition %s — nothing written" % (year, edition["id"])
        )
    raw = streetparse.programme(tokens, year, days)
    common.guard_dates(
        edition,
        days + [p["date"] for s in raw["sections"] for item in s["items"] for p in item["performances"]],
    )
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": {"site": PAGE, "year": year, "days": days, **raw}},
        fetcher="scraper/festivals/acco/sources/street-programme/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PAGE],
        notes="Cards grouped under the page's own zone headings; genre lines untranslated.",
    )
    items = [item for s in raw["sections"] for item in s["items"]]
    print("%d items, %d performances, %d theatre posters" % (
        len(items), sum(len(i["performances"]) for i in items), raw["theatrePosters"]))


if __name__ == "__main__":
    main()
