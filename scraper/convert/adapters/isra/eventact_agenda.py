"""eventact-agenda raw (`programme.json`) -> sessions as events, one performance each, the hotel and its halls.

This is where EventAct's vocabulary meets ours. A session (type 12) is the
performance a visitor picks, so each is an event with its one slot; its lectures
and speakers become the blurb, and the first real speaker portrait its picture.
The evening social activities (type 29) are events too. Registration, coffee
breaks and meals (types 2 and 39) are logistics, so they are skipped by name.

Every activity is at the conference hotel; one listed in a single hall plays in
that room, and one listed across all halls has no room.
"""

import re

VENUE = "davids-harp-galilee"
SESSION, SOCIAL = 12, 29
LOGISTICS = (2, 39)


def room_code(hall):
    """"Hall A" -> "hall-a", the room id curated/venues.json uses."""
    return re.sub(r"[^a-z0-9]+", "-", hall.lower()).strip("-")


def _minutes(hhmm):
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def _speaker(speaker):
    return "%s (%s)" % (speaker["name"], speaker["institute"]) if speaker["institute"] else speaker["name"]


def blurb(activity):
    session = activity["session"]
    parts = []
    for text in (activity["description"], session["note"]):
        if text:
            parts.append(text)
    if session["chairs"]:
        parts.append("Chairs: " + ", ".join(c["name"] for c in session["chairs"]) + ".")
    for lecture in session["lectures"]:
        # An activity with no lectures of its own lists itself as its one lecture.
        if lecture["title"] == activity["title"] and not lecture["speakers"]:
            continue
        line = "%s %s" % (lecture["start"], lecture["title"])
        if lecture["speakers"]:
            line += " — " + "; ".join(_speaker(s) for s in lecture["speakers"])
        if lecture["notes"]:
            line += " (%s)" % lecture["notes"]
        parts.append(line)
    return "\n".join(parts) or None


def genre(activity):
    if activity["type"] == SOCIAL:
        return "comedy" if "stand-up" in activity["title"].lower() else "other"
    return None


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {VENUE: {}}, "events": {}, "performances": {}, "skipped": []}
    for activity in raw["activities"]:
        if activity["type"] in LOGISTICS:
            partial["skipped"].append("%s %s %s (logistics)" % (activity["date"], activity["start"], activity["title"]))
            continue
        if activity["type"] not in (SESSION, SOCIAL):
            raise ValueError("activity %s has EventAct type %r, which this adapter does not know" % (activity["id"], activity["type"]))
        event_id = "session-%d" % activity["id"]
        event = {
            "title": activity["title"],
            "titleLocal": None,
            "url": raw["site"],
            "categories": [],
            "blurb": blurb(activity),
            "durationMin": _minutes(activity["end"]) - _minutes(activity["start"]),
            "imageUrl": activity["session"]["image"],
        }
        if genre(activity):
            event["genre"] = genre(activity)
        partial["events"][event_id] = event
        halls = activity["halls"]
        partial["performances"]["%s/%s/%s" % (event_id, activity["date"], activity["start"])] = {
            "eventId": event_id,
            "venueId": VENUE,
            "roomId": room_code(halls[0]) if len(halls) == 1 else None,
            "date": activity["date"],
            "start": activity["start"],
            # Admission is a paid conference registration, never a ticket per session.
            "ticketUrl": raw["site"].rsplit("/", 1)[0] + "/Registration",
            "free": False,
        }
    return partial
