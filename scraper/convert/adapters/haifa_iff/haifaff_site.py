"""haifaff-site raw (`programme.json`) -> sections, films and events, screenings, venue labels.

This is where the site's vocabulary meets ours. Its section group ids stay the
festival's own categories, and a film is filed under every section it sits in.
Venues are keyed by a code made from the site's venue label. Genre is ours to
assign: an event in the industry group (713) is a talk, and everything else
takes the festival's default, film.
"""

import re

GENRE_BY_EVENT_GROUP = {"713": "talk"}


def venue_code(label):
    """"Kriger (Carmel Zarfati)" -> "kriger-carmel-zarfati", the key curated/venues.json uses."""
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    for label in raw["venues"]:
        partial["venues"][venue_code(label)] = {"name": label}

    for film in raw["films"]:
        sections = [s for s in film["sections"] if s["id"] is not None]
        for s in sections:
            partial["categories"].setdefault(s["id"], {"name": s["name"]})
        partial["events"]["film-%d" % film["id"]] = {
            "title": film["title"],
            "titleLocal": film["titleHe"],
            "url": film["url"],
            "categories": [s["id"] for s in sections],
            "blurb": film["synopsis"],
            "durationMin": film["runtimeMin"],
            "imageUrl": film["image"],
        }
    for event in raw["events"]:
        record = {
            "title": event["title"],
            "url": event["url"],
            "categories": [],
            "blurb": None,
            "durationMin": None,
            "imageUrl": event.get("image"),
        }
        genre = next((GENRE_BY_EVENT_GROUP[g] for g in event["groups"] or [] if g in GENRE_BY_EVENT_GROUP), None)
        if genre:
            record["genre"] = genre
        partial["events"]["event-%d" % event["id"]] = record

    for s in raw["screenings"]:
        event_id = "%s-%d" % (s["kind"], s["refId"])
        pid = "%s/%s/%s" % (event_id, s["date"], s["start"])
        if pid in partial["performances"]:
            raise ValueError("two screenings of %s at %s %s" % (event_id, s["date"], s["start"]))
        performance = {
            "eventId": event_id,
            "venueId": venue_code(s["venue"]) if s["venue"] else None,
            "date": s["date"],
            "start": s["start"],
            "ticketUrl": s["ticketUrl"],
            # Nothing on the site marks a screening free, and there is a basket
            # for almost everything, so free is unknown rather than false.
            "free": None,
        }
        if s["price"] is not None:
            performance["priceMin"] = performance["priceMax"] = s["price"]
        partial["performances"][pid] = performance

    partial["skipped"] = ["%s %s %s: %s" % (u["date"], u["start"], u["venue"], u["heading"]) for u in raw["unlinked"]]
    return partial
