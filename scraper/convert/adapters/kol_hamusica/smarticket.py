"""smarticket raw (`programme.json`) -> Kol HaMusica's performances, in its own places.

The listing's shape is the shared Smarticket adapter's (adapters/platforms/smarticket.py);
this is the festival's vocabulary: the box office's place names, its "[n] "
programme numbers before each title, and which strands are talks or for families.
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import smarticket

PLACES = {
    "בית העם כפר בלום": ("beit-haam-kfar-blum", None),
    "אולם מרכז קלור (כפר בלום)": ("klor-centre", "hall"),
    "אולם תיאטרון מרכז קלור - לא מסומן": ("klor-centre", "theatre"),
    "מלון פסטורל, כפר בלום": ("pastoral-hotel", None),
    # The family picnic "on the bank of the Jordan".
    "חוץ": ("jordan-bank", None),
    "דומוס גלילאה": ("domus-galilaeae", None),
}
_NUMBER = re.compile(r"^\[\d+\]\s*")


def venue_of(place):
    if place not in PLACES:
        raise ValueError("Smarticket place %r is not in this festival's venues" % place)
    return PLACES[place]


def genre_of(perf):
    name = perf["name"] or ""
    if "קונצרט ילדים" in name or "לכל המשפחה" in name:
        return "family"
    if name and "יצירה בפוקוס" in name:
        return "talk"
    return None


def adapt(source):
    partial = smarticket.adapt(source, venue_of, genre_of)
    for event in partial["events"].values():
        event["title"] = _NUMBER.sub("", event["title"])
    return partial
