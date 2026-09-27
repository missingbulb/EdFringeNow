"""indnegev-site raw (`programme.json`) -> the festival grounds and its stages, one event per set, its performances.

This is where the site's vocabulary meets ours. The whole festival is one venue,
the grounds, and each stage is a room of it, in the site's column order. Every
set is its own event: no act plays twice. A set's `tag` (a stage takeover) is
the festival's own category. The sets the site filters out of its published
schedule are not served, and are listed as skipped. Genre is the festival's
default, music.

The site publishes no picture or page per act, so events carry neither.
"""

VENUE = "mitzpe-gvulot"


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    order = raw["stageOrder"] or sorted(raw["stages"])
    shown_stages = {s["stage"] for s in raw["sets"] if s["shown"]}
    partial["venues"][VENUE] = {
        "rooms": [
            {"id": code, "name": raw["stages"][code]["name"], "capacity": None, "layout": "outdoor"}
            for code in order + sorted(shown_stages - set(order)) if code in shown_stages
        ],
    }
    for s in raw["sets"]:
        if not s["shown"]:
            partial["skipped"].append("%s %s %s: %s (not in the published schedule)" % (
                s["date"], s["startTime"], raw["stages"][s["stage"]]["short"], s["name"]))
            continue
        event_id = "set-%s" % s["id"]
        tag = s.get("tag")
        if tag:
            partial["categories"].setdefault(tag, {"name": tag})
        partial["events"][event_id] = {
            "title": s["name"],
            "titleLocal": None,
            "url": raw["schedule"],
            "categories": [tag] if tag else [],
            "blurb": None,
            "durationMin": s["end"] - s["start"],
            "imageUrl": None,
        }
        partial["performances"]["%s/%s/%s" % (event_id, s["date"], s["startTime"])] = {
            "eventId": event_id,
            "venueId": VENUE,
            "roomId": s["stage"],
            "date": s["date"],
            "start": s["startTime"],
            "ticketUrl": "https://www.eventer.co.il/ind2026",
            # Entry is by festival ticket only.
            "free": False,
        }
    return partial
