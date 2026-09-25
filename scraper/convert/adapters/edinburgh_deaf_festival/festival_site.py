"""festival-site raw (`programme.json`) -> events, performances, venues with rooms.

The site names each room of Deaf Action's building as its own location
("Deaf Action – Blackwood Bar", "Deaf Action - The Garden"); here they become
rooms of one venue, Deaf Action, at the address the site gives the building, so
the planner knows a move between them is a walk down a corridor.

Only single-day, timed sittings inside the edition become performances; the
rest (multi-day exhibitions and drop-ins, events outside the window, cancelled
ones) are named in `skipped` with the reason and stay in the raw.
"""

import re
from datetime import date, timedelta

HOUSE = "deaf-action"
HOUSE_ROOM = re.compile(r"^deaf-action-(.+)$")

# The festival's own categories that say what the overarching genre is, in
# priority order for an event filed under several; the rest take the default.
GENRE_BY_CATEGORY = (
    ("film-screening", "film"),
    ("theatre", "theatre"),
    ("comedy", "comedy"),
    ("dance", "dance"),
    ("music", "music"),
    ("family", "family"),
    ("youth", "family"),
    ("presentation", "talk"),
    ("qa", "talk"),
    ("debate", "talk"),
    ("book-club", "talk"),
)


def skip_reason(event, lo, hi):
    if "cancelled" in event["title"].lower():
        return "cancelled"
    if event["dateStart"] != event["dateEnd"]:
        return "runs %s..%s" % (event["dateStart"], event["dateEnd"])
    if not lo <= event["dateStart"] <= hi:
        return "dated %s, outside the edition" % event["dateStart"]
    if event["start"] is None:
        return "no clock start (%r)" % event["timeText"]
    if event["venue"] is None:
        return "no venue"
    return None


def place(code):
    """A raw venue code -> (venue id, room id or None)."""
    m = HOUSE_ROOM.match(code)
    return (HOUSE, m.group(1)) if m else (code, None)


def adapt(source):
    raw = source.read("programme.json")
    edition = source.edition
    lo = (date.fromisoformat(edition["first"]) - timedelta(days=1)).isoformat()
    hi = (date.fromisoformat(edition["last"]) + timedelta(days=1)).isoformat()
    raw_venues = {v["code"]: v for v in raw["venues"]}
    partial = {
        "categories": {slug: {"name": name} for slug, name in raw["categories"]},
        "venues": {},
        "events": {},
        "performances": {},
        "skipped": [],
    }
    rooms = {}
    for event in raw["events"]:
        reason = skip_reason(event, lo, hi)
        if reason:
            partial["skipped"].append("%s (%s)" % (event["slug"], reason))
            continue
        record = {
            "title": event["title"],
            "url": event["url"],
            "categories": event["categories"],
            "blurb": event["description"],
            "durationMin": event["durationMin"],
            "imageUrl": event["image"],
        }
        genre = next((g for c, g in GENRE_BY_CATEGORY if c in event["categories"]), None)
        if genre:
            record["genre"] = genre
        partial["events"][event["slug"]] = record
        venue_id, room_id = place(event["venue"])
        if room_id:
            name = re.sub(r"^Deaf Action\s*[–-]\s*", "", raw_venues[event["venue"]]["name"])
            rooms[room_id] = {"id": room_id, "name": name, "capacity": None, "layout": None}
        if venue_id not in partial["venues"]:
            v = raw_venues.get(venue_id) or raw_venues[event["venue"]]
            partial["venues"][venue_id] = {"name": v["name"] if venue_id != HOUSE else "Deaf Action",
                                           "address": v["address"]}
        partial["performances"]["%s/%s/%s" % (event["slug"], event["dateStart"], event["start"])] = {
            "eventId": event["slug"],
            "venueId": venue_id,
            "roomId": room_id,
            "date": event["dateStart"],
            "start": event["start"],
            "ticketUrl": event["bookingUrl"],
            "free": event["free"],
        }
    if HOUSE in partial["venues"]:
        partial["venues"][HOUSE]["rooms"] = sorted(rooms.values(), key=lambda r: r["id"])
    return partial
