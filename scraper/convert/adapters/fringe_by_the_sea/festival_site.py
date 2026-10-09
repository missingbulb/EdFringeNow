"""festival-site raw (`programme.json`) -> events, performances, venues with rooms.

The fetcher already read each show's free-text details box into `sessions`
(date + start) and `place` (which venue, which room); a show the box leaves
unresolved (a run across the festival, a daily drop-in, times that cannot be
tied to dates) is named in `skipped` with the parser's reason and stays in the
raw with its box as written.

The covered venues inside the Lodge Grounds are rooms of one venue, the Lodge
Grounds, at the address the site's venues page gives.
"""

# The festival's own sections that say what the overarching genre is, in
# priority order for a show filed under several; the rest take the default.
GENRE_BY_SECTION = (
    ("family", "family"),
    ("comedy", "comedy"),
    ("music", "music"),
    ("film", "film"),
    ("dance", "dance"),
    ("literature", "talk"),
    ("conversation", "talk"),
)


def adapt(source):
    raw = source.read("programme.json")
    main = raw["mainVenue"]
    partial = {
        "categories": {slug: {"name": name} for slug, name in raw["categories"]},
        "venues": {},
        "events": {},
        "performances": {},
        "skipped": [],
    }
    rooms = {}
    for show in raw["shows"]:
        place = show["place"]
        if not show["sessions"] or place is None:
            partial["skipped"].append("%s (%s)" % (show["slug"], show["unresolved"] or "no venue"))
            continue
        event = {
            "title": show["title"],
            "url": show["url"],
            "categories": show["sections"],
            "blurb": show["description"],
            "imageUrl": show["image"],
        }
        genre = next((g for s, g in GENRE_BY_SECTION if s in show["sections"]), None)
        if genre:
            event["genre"] = genre
        partial["events"][show["slug"]] = event
        venue_id = place["venue"]
        if venue_id not in partial["venues"]:
            partial["venues"][venue_id] = {
                "name": place["name"],
                "address": main["address"] if venue_id == main["venue"] else place["query"],
            }
        if place["room"]:
            rooms.setdefault(venue_id, {})[place["room"]] = {
                "id": place["room"], "name": place["roomName"], "capacity": None, "layout": None}
        for session in show["sessions"]:
            partial["performances"]["%s/%s/%s" % (show["slug"], session["date"], session["start"])] = {
                "eventId": show["slug"],
                "venueId": venue_id,
                "roomId": place["room"],
                "date": session["date"],
                "start": session["start"],
                "ticketUrl": show["ticketUrl"],
                "free": show["free"],
            }
    for venue_id, by_id in rooms.items():
        partial["venues"][venue_id]["rooms"] = sorted(by_id.values(), key=lambda r: r["id"])
    return partial
