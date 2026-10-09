"""festival-site raw (`programme.json`) -> events, performances, venues.

The serving block has no shape yet for a drop-in exhibition (a date range with
opening hours), so only single, timed sittings inside the edition become
performances. Everything else stays in the raw, with its dates and hours, and
is named in `skipped` with the reason, so a later schema can pick it up.
"""

from datetime import date, timedelta

# The festival's own event types that say what the overarching genre is; any
# type not listed takes the festival's default genre (other).
GENRE_BY_TYPE = {
    "talk": "talk",
    "screening": "film",
}


def _window(edition):
    lo = (date.fromisoformat(edition["first"]) - timedelta(days=1)).isoformat()
    hi = (date.fromisoformat(edition["last"]) + timedelta(days=1)).isoformat()
    return lo, hi


def skip_reason(event, lo, hi):
    if event["format"] != "event":
        return "exhibition"
    if event["title"].lower().startswith("cancelled"):
        return "cancelled"
    if not event["dateStart"] or event["dateStart"] != event["dateEnd"]:
        return "runs %s..%s" % (event["dateStart"], event["dateEnd"])
    if not lo <= event["dateStart"] <= hi:
        return "dated %s, outside the edition" % event["dateStart"]
    if event["start"] is None:
        return "no clock start in %r" % event["timeInfo"]
    if event["venue"] is None:
        return "no venue"
    return None


def adapt(source):
    raw = source.read("programme.json")
    lo, hi = _window(source.edition)
    partial = {
        "categories": {slug: {"name": name} for slug, name in raw["categories"]},
        "venues": {},
        "events": {},
        "performances": {},
        "skipped": [],
    }
    venues = {v["id"]: v for v in raw["venues"]}
    for event in raw["events"]:
        reason = skip_reason(event, lo, hi)
        if reason:
            partial["skipped"].append("%s (%s)" % (event["slug"], reason))
            continue
        record = {
            "title": event["title"],
            "url": event["url"],
            "categories": event["types"],
            "blurb": event["description"],
            "durationMin": event["durationMin"],
            "imageUrl": event["image"],
        }
        genre = next((GENRE_BY_TYPE[t] for t in event["types"] if t in GENRE_BY_TYPE), None)
        if genre:
            record["genre"] = genre
        partial["events"][event["slug"]] = record
        venue_id = str(event["venue"])
        partial["performances"]["%s/%s/%s" % (event["slug"], event["dateStart"], event["start"])] = {
            "eventId": event["slug"],
            "venueId": venue_id,
            "date": event["dateStart"],
            "start": event["start"],
            "ticketUrl": event["ticketLink"],
            "free": event["free"],
        }
        v = venues[event["venue"]]
        partial["venues"][venue_id] = {
            "name": v["name"],
            "address": v["address"],
            "lat": v["lat"],
            "lng": v["lng"],
            "notes": ("Opening hours: %s" % v["openingTimes"]) if v["openingTimes"] else None,
        }
    return partial
