#!/usr/bin/env python3
"""Fetch ISRA's scientific programme for one edition into its raw folder.

Run it by hand, on a machine that can reach the site. It never runs on a schedule:

    python3 scraper/festivals/isra/sources/eventact-agenda/fetch.py --edition 2026

Everything about the platform is scraper/festivals/platforms/eventact.py; this
file only names the programme page, the conference site's Scientific Program
page (events.ortra.com, one site per year: `/isra<edition>/`), so the edition
is the year in the site's own path.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import eventact


def programme_page(edition_id):
    return "https://events.ortra.com/isra%s/ScientificVProgram" % edition_id


if __name__ == "__main__":
    eventact.run(os.path.dirname(os.path.dirname(HERE)), programme_page, "eventact-agenda",
                 "scraper/festivals/isra/sources/eventact-agenda/fetch.py")
