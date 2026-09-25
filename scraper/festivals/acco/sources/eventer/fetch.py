#!/usr/bin/env python3
"""Fetch the Acco Theatre Centre's festival listing from its Eventer producer page, for one edition.

Run by hand:

    python3 scraper/festivals/acco/sources/eventer/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/eventer.py; this
file only names the Eventer producer and the festival folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import eventer

USER = "accofestival"

if __name__ == "__main__":
    eventer.run(os.path.dirname(os.path.dirname(HERE)), USER, "eventer", "scraper/festivals/acco/sources/eventer/fetch.py")
