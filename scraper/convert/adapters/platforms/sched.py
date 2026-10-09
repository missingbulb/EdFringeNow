"""A Sched calendar's raw (`programme.json`) -> events, performances, and the places they happen.

Shared by every event that publishes on Sched (scraper/festivals/platforms/sched.py
writes the raw). The export is the same for a city-wide festival and a
one-building conference, so the festival's own adapter says what a `LOCATION`
is (by default its own venue, named by the text before the first comma), which
session types are which genre, and what the organiser's notes say about
tickets.
"""

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "x"


def wall_clock(dtstart, zone):
    """A UTC DTSTART as the festival's ("YYYY-MM-DD", "HH:MM")."""
    local = datetime.strptime(dtstart, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).astimezone(ZoneInfo(zone))
    return local.date().isoformat(), local.strftime("%H:%M")


def minutes(session):
    if not session.get("dtend"):
        return None
    span = (datetime.strptime(session["dtend"], "%Y%m%dT%H%M%SZ") - datetime.strptime(session["dtstart"], "%Y%m%dT%H%M%SZ"))
    total = int(span.total_seconds() // 60)
    # A session that "lasts" a day or more is a placeholder span, not a running time.
    return total if 0 < total < 12 * 60 else None


def own_venue(location):
    """The default reading: each location is a place, named before its first comma;
    only one with a street number is an address a geocoder can place."""
    name = location.split(",", 1)[0].strip()
    return {"venue": slug(location), "name": name,
            "address": location if re.search(r"\d", location.split(",", 1)[-1]) else None}


def adapt(source, place=own_venue, genre=lambda session: None, tickets=lambda session: {}):
    """`place(location)` -> {"venue", "name", "address"} (a new venue) or {"venue", "room"} (a room
    of a venue the festival's research names); `genre(session)` -> a genre or None for the
    festival's default; `tickets(session)` -> the performance fields the organiser's notes
    support ("free", "status", "priceMin", "priceMax"), only for a source with those roles."""
    raw = source.read("programme.json")
    zone = source.festival["timezone"]
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": list(raw["outOfEdition"])}
    for session in raw["sessions"]:
        where = place(session["location"]) if session["location"] else None
        if where is None:
            partial["skipped"].append("%s (no location)" % session["summary"])
            continue
        venue = partial["venues"].setdefault(where["venue"], {})
        if "room" in where:
            rooms = venue.setdefault("rooms", [])
            if where["room"] not in {r["name"] for r in rooms}:
                rooms.append({"id": slug(where["room"]), "name": where["room"], "capacity": None, "layout": None})
        else:
            venue.update(name=where["name"], address=where["address"], online=False)
        categories = [c.strip() for c in (session["categories"] or "").split(",") if c.strip()]
        for c in categories:
            partial["categories"][slug(c)] = {"name": c}
        event = {
            "title": session["summary"].strip(),
            "url": session["url"].replace("http://", "https://", 1) if session["url"] else None,
            "categories": [slug(c) for c in categories],
            "blurb": (session["description"] or "").strip() or None,
            "durationMin": minutes(session),
            "imageUrl": None,
        }
        g = genre(session)
        if g:
            event["genre"] = g
        partial["events"][session["uid"]] = event
        day, start = wall_clock(session["dtstart"], zone)
        performance = {
            "eventId": session["uid"],
            "venueId": where["venue"],
            "roomId": slug(where["room"]) if "room" in where else None,
            "date": day,
            "start": start,
            "ticketUrl": event["url"],
        }
        performance.update(tickets(session))
        partial["performances"][session["uid"]] = performance
    for venue in partial["venues"].values():
        if "rooms" in venue:
            venue["rooms"].sort(key=lambda r: r["name"])
    return partial
