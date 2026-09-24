#!/usr/bin/env python3
"""Fetch the Acco Theatre Centre's festival programme for one edition into its raw folder.

Run by hand, on a machine that can reach the site. Never run it on a schedule:

    python3 scraper/festivals/acco/sources/acco-tc/fetch.py --edition 2026

Writes `data/festivals/acco/<edition>/acco-tc/` (`programme.json` +
`manifest.json`) and nothing else. Each record is one line of the page, in the
page's own words. The page names its year in its heading. If that year is not
the edition asked for, or any line is dated outside the edition, nothing is
written.

The parsing half lives in parse.py and is proven offline by its self-test.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import page_blocks
import parse as tcparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "acco-tc"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 1
PAGE = "https://www.acco-tc.com/shows/accofestival/"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    tokens = page_blocks.blocks(common.get(PAGE, as_json=False))
    year = tcparse.page_year(tokens)
    if year != int(edition["id"]):
        raise common.FetchRefused(
            "the page programmes %s, not edition %s — nothing written" % (year, edition["id"])
        )
    lines = tcparse.programme(tokens, year)
    common.guard_dates(edition, [line["date"] for line in lines])
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": {"site": PAGE, "year": year, "lines": lines}},
        fetcher="scraper/festivals/acco/sources/acco-tc/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PAGE],
        notes="One line per performance as the page prints it; labels untranslated.",
    )
    print("%d performance lines, %d titles" % (len(lines), len({line["title"] for line in lines})))


if __name__ == "__main__":
    main()
