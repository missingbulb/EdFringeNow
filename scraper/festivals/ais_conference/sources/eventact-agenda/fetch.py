#!/usr/bin/env python3
"""Fetch the AIS conference programme for one edition into its raw folder.

Run it by hand, on a machine that can reach the site. It never runs on a schedule:

    python3 scraper/festivals/ais_conference/sources/eventact-agenda/fetch.py --edition 2026

Everything about the platform is scraper/festivals/platforms/eventact.py; this
file names the programme page the conference site links ("Click here for the
Program") and refuses one whose title is not the edition's ("AIS 2026 ...").
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import eventact

PAGES = {"2026": "https://program.eventact.com/Program/iOZQAAA/iozk/en"}


def programme_page(edition_id):
    if edition_id not in PAGES:
        sys.exit("no programme page known for edition %s: add the conference site's programme link to PAGES" % edition_id)
    return PAGES[edition_id]


def is_edition(page, edition_id):
    title = re.search(r"<title>([^<]*)</title>", page)
    return bool(title) and re.search(r"\bAIS %s\b" % edition_id, title.group(1)) is not None


if __name__ == "__main__":
    eventact.run(os.path.dirname(os.path.dirname(HERE)), programme_page, "eventact-agenda",
                 "scraper/festivals/ais_conference/sources/eventact-agenda/fetch.py", edition_marker=is_edition)
