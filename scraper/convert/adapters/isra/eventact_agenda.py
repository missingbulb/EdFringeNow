"""eventact-agenda raw (`programme.json`) -> ISRA's sessions, at the conference hotel.

The agenda's shape is the shared EventAct adapter's (adapters/platforms/eventact.py);
this is ISRA's vocabulary. Sessions (type 12) and the evening social activities
(type 29) are events; registration, coffee breaks and meals (types 2 and 39)
are logistics, so they are skipped.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import eventact

VENUE = "davids-harp-galilee"
SESSION, SOCIAL = 12, 29
LOGISTICS = (2, 39)


def genre(activity):
    if activity["type"] == SOCIAL:
        return "comedy" if "stand-up" in activity["title"].lower() else "other"
    return None


def adapt(source):
    site = source.read("programme.json")["site"]
    return eventact.adapt(
        source, venue=VENUE, sessions=(SESSION, SOCIAL), logistics=LOGISTICS,
        # Admission is a paid conference registration, never a ticket per session.
        ticket_url=site.rsplit("/", 1)[0] + "/Registration",
        genre=genre,
    )
