#!/usr/bin/env python3
"""Geocode the locations Litquake's Sched calendar published, for one edition.

Run by hand, after the sched fetch for the same edition:

    python3 scraper/festivals/litquake/sources/nominatim/fetch.py --edition <year>
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import nominatim

if __name__ == "__main__":
    nominatim.run(os.path.dirname(os.path.dirname(HERE)), "nominatim", "sched",
                  "scraper/festivals/litquake/sources/nominatim/fetch.py", "us")
