#!/usr/bin/env python3
"""Fetch Scala Days's schedule from pretalx, for one edition.

Run by hand:

    python3 scraper/festivals/scala_days/sources/pretalx/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/pretalx.py;
this file only names the event and the festival folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import pretalx

# The event is named per edition.
EVENT = "https://cfp.scaladays.org/scala26"

if __name__ == "__main__":
    pretalx.run(os.path.dirname(os.path.dirname(HERE)), EVENT, "pretalx", "scraper/festivals/scala_days/sources/pretalx/fetch.py")
