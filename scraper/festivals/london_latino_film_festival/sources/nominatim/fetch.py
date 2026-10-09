#!/usr/bin/env python3
"""Geocode the venue addresses the London Latino Film Festival's Eventive box office published, for one edition.

Run by hand, after the eventive fetch for the same edition:

    python3 scraper/festivals/london_latino_film_festival/sources/nominatim/fetch.py --edition <year>
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import nominatim

if __name__ == "__main__":
    nominatim.run(os.path.dirname(os.path.dirname(HERE)), "nominatim", "eventive",
                  "scraper/festivals/london_latino_film_festival/sources/nominatim/fetch.py", "gb", field="addressLine")
