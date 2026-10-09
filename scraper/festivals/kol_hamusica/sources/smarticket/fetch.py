#!/usr/bin/env python3
"""Fetch Kol HaMusica's programme from the Upper Galilee culture department's Smarticket box office, for one edition.

Run by hand:

    python3 scraper/festivals/kol_hamusica/sources/smarticket/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/smarticket.py;
this file only names the tenant and the festival's category page on it.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import smarticket

TENANT = "https://galil-elion.smarticket.co.il/"
# "פסטיבל_קול_המוסיקה", the category the festival's performances are filed under.
CATEGORY = "%D7%A4%D7%A1%D7%98%D7%99%D7%91%D7%9C_%D7%A7%D7%95%D7%9C_%D7%94%D7%9E%D7%95%D7%A1%D7%99%D7%A7%D7%94"

if __name__ == "__main__":
    smarticket.run(os.path.dirname(os.path.dirname(HERE)), TENANT, CATEGORY, "smarticket",
                   "scraper/festivals/kol_hamusica/sources/smarticket/fetch.py")
