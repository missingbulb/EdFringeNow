"""A Tel Aviv Cinematheque festival programme's raw (`programme.json`) -> films as events, screenings as performances.

Shared by every festival whose programme is a Cinematheque programme page
(scraper/festivals/platforms/cinematheque.py writes the raw). Each film's own
page groups its screenings into one event; each card's still is its picture,
since the card is all the programme shows of a screening. Every screening is
at the Cinematheque, in the hall the card names ("אולם 2" -> room `hall-2`).

Titles drop the festival's own label, which every card repeats after its last
" | "; the "country / year / length" line, director and language lead the blurb.
"""

import re

VENUE = "tel-aviv-cinematheque"
_LENGTH = re.compile(r"אורך:\s*(\d{1,3})")
_HALL = re.compile(r"^אולם\s+(\d+)$")


def room_of(hall):
    found = _HALL.match(hall or "")
    if not found:
        raise ValueError("hall %r is not a numbered Cinematheque hall" % hall)
    return "hall-%s" % found.group(1)


def title_of(title, label):
    suffix = " | " + label
    return title[: -len(suffix)].strip() if title.endswith(suffix) else title


def blurb_of(screening):
    lines = [screening["meta"]]
    if screening["director"]:
        lines.append("בימוי: " + screening["director"])
    if screening["language"]:
        lines.append("שפה: " + screening["language"])
    lines.append(screening["blurb"])
    return "\n".join(line for line in lines if line) or None


def adapt(source):
    raw = source.read("programme.json")
    label = raw["category"]["label"]
    partial = {"categories": {}, "venues": {VENUE: {}}, "events": {}, "performances": {}, "skipped": []}
    films = {}
    for screening in raw["screenings"]:
        films.setdefault(screening["url"], []).append(screening)
    for url, screenings in films.items():
        first = min(screenings, key=lambda s: s["post"])
        event_id = "film-%d" % first["post"]
        length = _LENGTH.search(first["meta"] or "")
        partial["events"][event_id] = {
            "title": title_of(first["title"], label),
            "titleLocal": None,
            "url": url,
            "categories": [],
            "blurb": blurb_of(first),
            "durationMin": int(length.group(1)) if length and int(length.group(1)) > 0 else None,
            "imageUrl": first["imageUrl"],
            "genre": "film",
        }
        for screening in screenings:
            partial["performances"]["screening-%d" % screening["post"]] = {
                "eventId": event_id,
                "venueId": VENUE,
                "roomId": room_of(screening["hall"]),
                "date": screening["date"],
                "start": screening["start"],
                "ticketUrl": screening["ticketUrl"] or url,
                "free": False,
            }
    return partial
