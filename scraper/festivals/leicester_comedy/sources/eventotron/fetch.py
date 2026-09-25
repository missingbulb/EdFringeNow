#!/usr/bin/env python3
"""Fetch the Leicester Comedy Festival's programme from its Eventotron box office, for one edition.

Run by hand:

    python3 scraper/festivals/leicester_comedy/sources/eventotron/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/eventotron.py;
this file only says which site, and which festival folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import eventotron

SITE = "https://events.comedy-festival.co.uk"

if __name__ == "__main__":
    eventotron.run(
        os.path.dirname(os.path.dirname(HERE)), SITE, "eventotron",
        "scraper/festivals/leicester_comedy/sources/eventotron/fetch.py",
    )
