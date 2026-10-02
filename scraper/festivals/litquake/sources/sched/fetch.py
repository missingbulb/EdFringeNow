#!/usr/bin/env python3
"""Fetch Litquake's programme from its Sched calendar, for one edition.

Run by hand:

    python3 scraper/festivals/litquake/sources/sched/fetch.py --edition <year>

Everything about the platform is scraper/festivals/platforms/sched.py; this
file only names the calendar and the festival folder it writes for.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(HERE))), "platforms"))
import sched

# The calendar is named per edition.
EVENT = "litquake2026"

if __name__ == "__main__":
    sched.run(os.path.dirname(os.path.dirname(HERE)), EVENT, "sched", "scraper/festivals/litquake/sources/sched/fetch.py")
