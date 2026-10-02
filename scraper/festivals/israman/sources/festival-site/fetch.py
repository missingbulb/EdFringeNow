#!/usr/bin/env python3
"""Fetch Challenge ISRAMAN's weekend schedule for one edition into its raw folder.

Run by the festival update, or by hand:

    python3 scraper/festivals/israman/sources/festival-site/fetch.py --edition 2027

Writes `data/festivals/israman/<edition>/festival-site/` (`programme.json` +
`manifest.json`) and nothing else. The schedule page is always the coming
weekend's; if its days are not all in the edition, nothing is written. The
parsing half lives in parse.py.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))
import common
import parse as iparse
import registry

FESTIVAL_DIR = os.path.dirname(os.path.dirname(HERE))
SOURCE_ID = "festival-site"
FETCHER_VERSION = 1
PAGE = "https://israman.co.il/?page_id=313"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    try:
        schedule = iparse.schedule(common.get(PAGE, as_json=False))
    except (AttributeError, ValueError) as error:
        raise common.FetchRefused("%s is not the schedule this parser reads (%s); nothing written" % (PAGE, error))
    dates = [day["date"] for day in schedule["days"]]
    if not dates:
        raise common.FetchRefused("%s has no dated day; nothing written" % PAGE)
    if not all(edition["first"] <= date <= edition["last"] for date in dates):
        common.not_ready("%s is the schedule of %s, not edition %s" % (PAGE, sorted(dates), edition["id"]))
    common.guard_dates(edition, dates)
    common.write_raw(
        festival, edition["id"], SOURCE_ID, {"programme.json": {"page": PAGE, **schedule}},
        fetcher="scraper/festivals/israman/sources/festival-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[PAGE],
        notes="One record per day of the weekend schedule: its lines, each with the times printed before "
              "it (a range in either order, a single time, an estimate) and its text, and on race day the "
              "start-wave table; the undated sections (the shuttle timetables) by title only.",
    )
    print("%d days, %d lines, %d start waves" % (len(dates), sum(len(d["lines"]) for d in schedule["days"]),
                                                 sum(len(d["waves"]) for d in schedule["days"])))


if __name__ == "__main__":
    main()
