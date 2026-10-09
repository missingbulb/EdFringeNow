"""The pre-registry catalogue `site/data/jerusalem/shows.json`, derived from the serving block.

A tolerance, not a feature: /planJerusalem/ still reads this shape. It is a view
of the converted edition (never a second reading of raw), so it cannot disagree
with the serving file, and `to_serving.py --check` proves it byte-identical to
what is committed. It goes when the page reads the registry.
"""

SOURCE = "comedy-festival-site"


def build(block):
    festival = block["festival"]
    names = {c["id"]: c["name"] for c in block["categories"]}
    by_event = {}
    for p in block["performances"]:
        by_event.setdefault(p["eventId"], []).append(
            {
                "date": p["date"],
                "start": p["start"],
                "venue": p["venueId"],
                "ticketUrl": p["ticketUrl"],
                "free": p["free"],
            }
        )
    dates = sorted(p["date"] for p in block["performances"])
    return {
        "festival": {
            "id": festival["id"],
            "name": festival["name"],
            "nameLocal": festival["nameLocal"],
            "city": festival["city"],
            "lang": festival["lang"],
            "timezone": festival["timezone"],
            "site": festival["site"],
            "year": int(festival["edition"]),
            "firstDate": dates[0],
            "lastDate": dates[-1],
        },
        "venues": [
            {"code": v["id"], "name": v["name"], "address": v["address"], "lat": v["lat"], "lng": v["lng"]}
            for v in block["venues"]
        ],
        "skipped": block["provenance"]["skipped"].get(SOURCE, []),
        "categories": [[c["id"], c["name"]] for c in block["categories"]],
        "shows": [
            {
                "slug": e["id"],
                "title": e["title"],
                "url": e["url"],
                "categories": e["categories"],
                "categoryNames": [names[c] for c in e["categories"]],
                "description": e["blurb"] or "",
                "image": e["imageUrl"],
                "duration": e["durationMin"],
                "performances": by_event[e["id"]],
            }
            for e in block["events"]
        ],
    }
