"""An EventAct agenda's raw (`programme.json`) -> sessions as events, one performance each.

Shared by every conference whose programme is an EventAct agenda
(scraper/festivals/platforms/eventact.py writes the raw). A session is the
performance a visitor picks, so each is an event with its one slot; its
lectures and speakers become the blurb, and the first real speaker portrait its
picture. A festival's adapter supplies the vocabulary: which EventAct type
numbers are sessions and which are logistics, the venue, and the ticket link.

An activity listed in a single hall plays in that room; one listed across
several halls has no room.
"""

import re


def room_code(hall):
    """"Hall A" -> "hall-a", the room id a festival's curated venues use."""
    return re.sub(r"[^a-z0-9]+", "-", hall.lower()).strip("-")


def minutes(hhmm):
    hours, mins = hhmm.split(":")
    return int(hours) * 60 + int(mins)


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
        # A lecture the agenda gives no length of has no time of its own.
        bits = [lecture["start"]] if lecture["end"] != lecture["start"] else []
        if lecture["title"]:
            # One lecture is one blurb line, whatever line breaks its title carries.
            bits.append(lecture["title"].replace("\n", " "))
        line = " ".join(bits)
        if lecture["speakers"]:
            line = (line + " — " if line else "") + "; ".join(_speaker(s) for s in lecture["speakers"])
        if lecture["notes"]:
            line += " (%s)" % lecture["notes"]
        if line:
            parts.append(line)
    return "\n".join(parts) or None


def adapt(source, *, venue, sessions, logistics, ticket_url, genre=None):
    """The partial for one agenda. `sessions` and `logistics` are EventAct type
    numbers; an activity of any other type is refused, so a new type is a
    decision rather than a silent default. `genre(activity)` may name an
    event's genre, else the festival's default applies."""
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {venue: {}}, "events": {}, "performances": {}, "skipped": []}
    for activity in raw["activities"]:
        if activity["type"] in logistics:
            partial["skipped"].append("%s %s %s (logistics)" % (activity["date"], activity["start"], activity["title"]))
            continue
        if activity["type"] not in sessions:
            raise ValueError("activity %s has EventAct type %r, which this adapter does not know" % (activity["id"], activity["type"]))
        event_id = "session-%d" % activity["id"]
        event = {
            "title": activity["title"],
            "titleLocal": None,
            "url": raw["site"],
            "categories": [],
            "blurb": blurb(activity),
            "durationMin": minutes(activity["end"]) - minutes(activity["start"]),
            "imageUrl": activity["session"]["image"],
        }
        named = genre(activity) if genre else None
        if named:
            event["genre"] = named
        partial["events"][event_id] = event
        halls = activity["halls"]
        partial["performances"]["%s/%s/%s" % (event_id, activity["date"], activity["start"])] = {
            "eventId": event_id,
            "venueId": venue,
            "roomId": room_code(halls[0]) if len(halls) == 1 else None,
            "date": activity["date"],
            "start": activity["start"],
            "ticketUrl": ticket_url,
            "free": False,
        }
    return partial
