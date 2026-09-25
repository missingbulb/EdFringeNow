#!/usr/bin/env python3
"""Fetch the Edinburgh International Book Festival's programme from its Spektrix public API, for one edition.

Run by hand:

    python3 scraper/festivals/edinburgh_book_festival/sources/spektrix/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/spektrix.py; this
file only names the Spektrix client and the festival folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import spektrix

CLIENT = "edinburghinternationalbookfestival"

if __name__ == "__main__":
    spektrix.run(os.path.dirname(os.path.dirname(HERE)), CLIENT, "spektrix", "scraper/festivals/edinburgh_book_festival/sources/spektrix/fetch.py")
