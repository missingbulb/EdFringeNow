"""forms-wizard raw (`programme.json`) -> the IAEM assembly's sessions, at Avenue, Airport City.

The agenda's shape is the shared Forms Wizard adapter's (adapters/platforms/forms_wizard.py);
this is the assembly's vocabulary. The agenda lists sessions, not talks: a
plenary's talks and the three parallel forums at 16:00 stay in their item's
blurb. Registration, coffee breaks and lunch (the handshake, coffee and
cutlery icons) are logistics. A place is a hall, or the poster area.
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import forms_wizard

VENUE = "avenue-airport-city"
REGISTRATION = "https://emergencymedicine-2026.forms-wizard.biz/users/new"
LOGISTICS = {"handshake-o", "coffee", "cutlery"}
_HALL = re.compile(r"^Hall ([A-Z])$")
_POSTERS = re.compile(r"^At Poster Exhibition Area ([A-Z])$")


def room_of(place):
    hall, posters = _HALL.match(place), _POSTERS.match(place)
    if hall:
        return "hall-" + hall.group(1).lower()
    if posters:
        return "poster-area-" + posters.group(1).lower()
    raise ValueError("agenda place %r is not one of the venue's rooms" % place)


def adapt(source):
    return forms_wizard.adapt(source, VENUE, lambda item: item["icon"] in LOGISTICS, room_of, REGISTRATION)
