"""festival-site raw (`programme.json`) -> the Red Sea Jazz Festival's shows, on its stages.

Each show card is one event with its one performance; its picture is the
card's. The stages are rooms of the festival's port compound, except the
Jasper 08 club at the Isrotel Agamim hotel, where the free late sets and the
nightly jam play. A card tagged "כניסה חופשית" is free and has no ticket link;
the others link their own Ticketmaster page. The jam session's start is the one
its subtitle states ("from 23:30").
"""

STAGES = {
    "Port Arena": ("eilat-port", "port-arena"),
    "Red note club": ("eilat-port", "red-note-club"),
    "de Present": ("eilat-port", "the-present"),
    "de Future": ("eilat-port", "the-future"),
    "הרחבה הציבורית": ("eilat-port", "plaza"),
    "Jasper08 מלון אגמים": ("jasper-08-agamim", None),
}
FREE_TAG = "כניסה חופשית"


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    for show in raw["shows"]:
        start = show["time"] or show["startStated"]
        if not start:
            partial["skipped"].append("%s %s (no start time)" % (show["date"], show["name"]))
            continue
        if show["stage"] not in STAGES:
            raise ValueError("stage %r is not one this adapter knows" % show["stage"])
        venue, room = STAGES[show["stage"]]
        partial["venues"].setdefault(venue, {})
        event_id = "%s-%s-%s" % (show["date"], start.replace(":", ""), room or venue)
        blurb = [line for line in (show["tag"], show["sub"]) if line]
        partial["events"][event_id] = {
            "title": show["name"],
            "titleLocal": None,
            "url": show["artistUrl"] or raw["site"],
            "categories": [],
            "blurb": "\n".join(blurb) or None,
            "durationMin": None,
            "imageUrl": show["imageUrl"],
            "genre": "music",
        }
        free = show["tag"] == FREE_TAG
        hours, minutes = start.split(":")
        partial["performances"]["%s/%s/%s" % (event_id, show["date"], start)] = {
            "eventId": event_id,
            "venueId": venue,
            "roomId": room,
            "date": show["date"],
            "start": "%02d:%s" % (int(hours), minutes),
            "ticketUrl": show["ticketUrl"] or (None if free else raw["site"]),
            "free": free,
        }
    return partial
