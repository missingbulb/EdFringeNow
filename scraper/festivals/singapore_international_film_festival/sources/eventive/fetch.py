#!/usr/bin/env python3
"""Fetch the Singapore International Film Festival's programme from its Eventive box office, for one edition.

Run by hand:

    python3 scraper/festivals/singapore_international_film_festival/sources/eventive/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/eventive.py;
this file only names the box office and the festival folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import eventive

TENANT = "sgiff"

if __name__ == "__main__":
    eventive.run(os.path.dirname(os.path.dirname(HERE)), TENANT, "eventive", "scraper/festivals/singapore_international_film_festival/sources/eventive/fetch.py")
