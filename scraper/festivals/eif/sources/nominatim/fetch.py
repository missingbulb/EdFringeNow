#!/usr/bin/env python3
"""Geocode the venue addresses the Edinburgh International Festival's Spektrix source published, for one edition.

Run by hand, after the spektrix fetch for the same edition:

    python3 scraper/festivals/eif/sources/nominatim/fetch.py --edition <year>
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import nominatim

if __name__ == "__main__":
    nominatim.run(os.path.dirname(os.path.dirname(HERE)), "nominatim", "spektrix",
                  "scraper/festivals/eif/sources/nominatim/fetch.py", "gb")
