#!/usr/bin/env python3
"""Fetch TLVFest's programme from the Tel Aviv Cinematheque, for one edition.

Run by hand:

    python3 scraper/festivals/tlvfest/sources/cinematheque/fetch.py --edition <year>

Everything about the Cinematheque's programme pages is
scraper/festivals/platforms/cinematheque.py; this file only names the
festival's programme page and the folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import cinematheque

PAGE = "https://www.cinema.co.il/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%A4%D7%A1%D7%98%D7%99%D7%91%D7%9C/"

if __name__ == "__main__":
    cinematheque.run(os.path.dirname(os.path.dirname(HERE)), PAGE, "cinematheque",
                     "scraper/festivals/tlvfest/sources/cinematheque/fetch.py")
