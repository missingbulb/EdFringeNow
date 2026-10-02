#!/usr/bin/env python3
"""Geocode the venue addresses the Viet Film Fest's Eventive box office published, for one edition.

Run by hand, after the eventive fetch for the same edition:

    python3 scraper/festivals/viet_film_fest/sources/nominatim/fetch.py --edition <year>
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import nominatim

if __name__ == "__main__":
    nominatim.run(os.path.dirname(os.path.dirname(HERE)), "nominatim", "eventive",
                  "scraper/festivals/viet_film_fest/sources/nominatim/fetch.py", "us", field="addressLine")
