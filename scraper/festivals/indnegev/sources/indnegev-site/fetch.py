#!/usr/bin/env python3
"""Fetch InDNegev's timetable for one edition into its raw folder.

Run by the festival update (`scraper/festivals/update.py`), or by hand:

    python3 scraper/festivals/indnegev/sources/indnegev-site/fetch.py --edition 2026

It writes `data/festivals/indnegev/<edition>/indnegev-site/` (`programme.json`
and `manifest.json`) and nothing else. The records keep the site's own
vocabulary: its set ids, its stage codes and names, its day numbers and its
minutes-after-midnight times. Translating them is the converter's job.

Pages read: `/schedule`, for the script chunks it loads, and those chunks until
one holds the timetable (parse.py says what it looks like).

Two things refuse the write. The days the timetable dates must lie in the
edition's year and match the day tabs the server HTML renders, and every set
must fall inside the edition's dates (`common.guard_dates`).
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
SOURCE_ID = "indnegev-site"
# Bumped when the shape of programme.json changes, so a manifest says which
# shape its folder holds.
FETCHER_VERSION = 1

SITE = "https://indnegev.co.il"
SCHEDULE = SITE + "/schedule"


def main():
    args = common.parse_args(__doc__)
    festival = registry.load(FESTIVAL_DIR)
    edition = registry.edition(festival, args.edition)
    cache = registry.cache_dir(festival, edition["id"], SOURCE_ID)

    page = common.cached_page(cache, SCHEDULE)
    chunk_url, programme = None, None
    for path in iparse.script_paths(page):
        js = common.cached_page(cache, SITE + path)
        if js and iparse.has_programme(js):
            chunk_url, programme = SITE + path, iparse.parse_programme(js)
            break
    if programme is None:
        raise common.FetchRefused("no script chunk of %s holds the timetable — nothing written" % SCHEDULE)

    years = {day["iso"][:4] for day in programme["days"].values()}
    if years != {edition["id"]}:
        raise common.FetchRefused("the timetable dates years %s, not edition %s — nothing written" % (sorted(years), edition["id"]))
    tabs = [d for _, d in iparse.schedule_tabs(page)]
    dated = [programme["days"][n]["date"] for n in sorted(programme["days"])]
    if tabs != dated:
        raise common.FetchRefused("the page's day tabs %s disagree with the timetable's days %s — nothing written" % (tabs, dated))

    for s in programme["sets"]:
        s["date"], s["startTime"] = iparse.wall_clock(programme["days"][s["day"]]["iso"], s["start"])
    common.guard_dates(edition, [s["date"] for s in programme["sets"] if s["shown"]])

    programme = {
        "site": SITE,
        "schedule": SCHEDULE,
        "chunk": chunk_url,
        "days": {str(n): day for n, day in sorted(programme["days"].items())},
        "stages": programme["stages"],
        "stageOrder": programme["stageOrder"],
        "sets": programme["sets"],
    }
    common.write_raw(
        festival,
        edition["id"],
        SOURCE_ID,
        {"programme.json": programme},
        fetcher="scraper/festivals/indnegev/sources/indnegev-site/fetch.py",
        fetcher_version=FETCHER_VERSION,
        urls=[SCHEDULE, chunk_url],
        notes="The schedule page renders one day; the whole timetable is a literal in one of its "
              "script chunks (parse.py). `start`/`end` are minutes after the festival day's "
              "midnight; `date`/`startTime` are the wall clock of `start`. `shown` is false for "
              "the sets the chunk filters out of the published schedule.",
    )
    shown = [s for s in programme["sets"] if s["shown"]]
    print("%d sets (%d shown) over %d days on %d stages" % (
        len(programme["sets"]), len(shown), len(programme["days"]), len({s["stage"] for s in shown})))


if __name__ == "__main__":
    main()
