"""A pretalx schedule's raw (`programme.json`) -> events, performances, and the rooms they play in.

Shared by every conference that publishes with pretalx (scraper/festivals/platforms/pretalx.py
writes the raw). pretalx knows rooms but not the building they are in, so the
festival's own adapter says which curated venue each room belongs to, and
which of its listed items are not programme (registration, breaks, walking time).
"""

import re


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "x"


def minutes(duration):
    """pretalx's "HH:MM" duration in minutes, or None for none."""
    found = re.fullmatch(r"(\d+):(\d\d)", duration or "")
    total = int(found.group(1)) * 60 + int(found.group(2)) if found else 0
    return total or None


def blurb(talk):
    text = (talk.get("abstract") or "").strip() or (talk.get("description") or "").strip()
    speakers = [p for p in talk["persons"] if p]
    if speakers:
        text = (text + "\n\n" if text else "") + "Speakers: " + ", ".join(speakers)
    return text or None


def adapt(source, venue_of, public=lambda talk: True, genre=lambda talk: None):
    """`venue_of(room)` names the curated venue a pretalx room is in; `public(talk)`
    says whether a listed item is programme; `genre(talk)` maps the festival's
    session types to a genre, or None for the festival's default."""
    raw = source.read("programme.json")
    capacity = {r["name"]: r["capacity"] for r in raw["conference"]["rooms"]}
    track_ids = {t["name"]: t["slug"] or slug(t["name"]) for t in raw["conference"]["tracks"]}
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    for talk in raw["talks"]:
        if not public(talk):
            partial["skipped"].append("%s (%s %s)" % (talk["title"], talk["date"][:10], talk["start"]))
            continue
        label = talk["track"] or talk["type"]
        category = (track_ids.get(talk["track"]) or slug(talk["track"])) if talk["track"] else ("type-" + slug(talk["type"]) if talk["type"] else None)
        if category:
            partial["categories"][category] = {"name": label}
        event = {
            "title": talk["title"].strip(),
            "url": talk["url"],
            "categories": [category] if category else [],
            "blurb": blurb(talk),
            "durationMin": minutes(talk["duration"]),
            "imageUrl": talk["logo"] or None,
        }
        g = genre(talk)
        if g:
            event["genre"] = g
        partial["events"][talk["code"]] = event
        venue_id = venue_of(talk["room"])
        rooms = partial["venues"].setdefault(venue_id, {"rooms": []})["rooms"]
        room_id = slug(talk["room"])
        if room_id not in {r["id"] for r in rooms}:
            rooms.append({"id": room_id, "name": talk["room"], "capacity": capacity.get(talk["room"]), "layout": None})
        # A submission scheduled in several slots (a CTF, a repeated workshop) is one
        # event with a performance per slot.
        partial["performances"]["%s/%sT%s" % (talk["code"], talk["date"][:10], talk["start"])] = {
            "eventId": talk["code"],
            "venueId": venue_id,
            "roomId": room_id,
            "date": talk["date"][:10],
            "start": talk["start"],
            "ticketUrl": None,
        }
    for venue in partial["venues"].values():
        venue["rooms"].sort(key=lambda r: r["name"])
    return partial
