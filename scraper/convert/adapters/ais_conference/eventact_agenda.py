"""eventact-agenda raw (`programme.json`) -> the AIS conference's sessions, at its host college.

The agenda's shape is the shared EventAct adapter's (adapters/platforms/eventact.py);
this is AIS's vocabulary. Panels and roundtables are type 12 and a few panels
type 3; the agenda lists no breaks or meals.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import eventact

VENUE = "ramat-gan-academic-college"
REGISTRATION = "https://ws.eventact.com/AIS2026/Registration"


def adapt(source):
    return eventact.adapt(source, venue=VENUE, sessions=(12, 3), logistics=(2, 39), ticket_url=REGISTRATION)
