#!/usr/bin/env python3
"""Fetch the IAEM annual assembly's agenda from its Forms Wizard site, for one edition.

Run by the festival update, or by hand:

    python3 scraper/festivals/iaem/sources/forms-wizard/fetch.py --edition 2026

Everything about the platform is scraper/festivals/platforms/forms_wizard.py;
this file only names the edition's site, whose address carries its year.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import forms_wizard


if __name__ == "__main__":
    forms_wizard.run(os.path.dirname(os.path.dirname(HERE)), "https://emergencymedicine-{edition}.forms-wizard.biz/",
                     "forms-wizard", "scraper/festivals/iaem/sources/forms-wizard/fetch.py")
