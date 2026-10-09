#!/usr/bin/env python3
"""Fetch the Israel Neurological Association conference's programme for one edition into its raw folder.

Run by the festival update, or by hand:

    python3 scraper/festivals/israel_neurology/sources/congress-site/fetch.py --edition 2026

Writes `data/festivals/israel-neurological-association/<edition>/congress-site/`
(`programme.json` + `manifest.json`) and nothing else. The programme page's
address carries its year ("תכנית הכנס 2026"); if its day headings are in
another year, or any cell falls outside the edition, nothing is written. The
parsing half lives in parse.py.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as nparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "congress-site"
FETCHER_VERSION = 1
SITE = "https://israelneurocongress.com/"
# "תכנית-הכנס-<year>", the programme page.
PAGE = SITE + "%d7%aa%d7%9b%d7%a0%d7%99%d7%aa-%d7%94%d7%9b%d7%a0%d7%a1-{edition}/"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    url = PAGE.format(edition=edition["id"])
    page = common.get_or_none(url, as_json=False)
    if page is None:
        common.not_ready("%s answers 404: the %s programme is not out" % (url, edition["id"]))
    cells = nparse.cells(page)
    if not cells:
        raise common.FetchRefused("%s held no dated programme table (%d characters); nothing written" % (url, len(page)))
    years = {c["date"][:4] for c in cells}
    if years != {edition["id"]}:
        raise common.FetchRefused("the programme is dated %s, not edition %s; nothing written" % (sorted(years), edition["id"]))
    common.guard_dates(edition, [c["date"] for c in cells])
    common.write_raw(
        festival, edition["id"], SOURCE_ID, {"programme.json": {"site": SITE, "page": url, "cells": cells}},
        fetcher="scraper/festivals/israel_neurology/sources/congress-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[url],
        notes="One record per non-empty cell of the programme's daily tables: its day, the halls its "
              "columns are headed with, the time rows it runs through as printed (a blank time cell "
              "counts as the timed row above) and their start and end, and its text.",
    )
    print("%d cells" % len(cells))


if __name__ == "__main__":
    main()
