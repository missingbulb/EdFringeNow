"""comedy-festival-site raw (`programme.json`) -> events, performances, venue names.

Where the site's vocabulary meets ours: its taxonomy slugs stay the festival's
own categories, and only the overarching genre is ours to assign.
"""

# The festival's own sections that are not what the festival is (comedy). Any
# section not listed takes the festival's declared default genre.
GENRE_BY_CATEGORY = {
    "movies": "film",
    "competition-plays": "theatre",
}


def performance_id(slug, performance):
    return "%s/%s/%s" % (slug, performance["date"], performance["start"])


def adapt(source):
    raw = source.read("programme.json")
    partial = {
        "categories": {slug: {"name": name} for slug, name in raw["categories"]},
        "venues": {v["code"]: {"name": v["name"], "address": v["address"]} for v in raw["venues"]},
        "events": {},
        "performances": {},
        "skipped": raw["skipped"],
    }
    for show in raw["shows"]:
        event = {
            "title": show["title"],
            "url": show["url"],
            "categories": show["categories"],
            # An empty blurb is no blurb: unknown, not an empty string.
            "blurb": show["description"] or None,
            "durationMin": show["duration"],
            "imageUrl": show["image"],
        }
        genre = next((GENRE_BY_CATEGORY[c] for c in show["categories"] if c in GENRE_BY_CATEGORY), None)
        if genre:
            event["genre"] = genre
        partial["events"][show["slug"]] = event
        for p in show["performances"]:
            partial["performances"][performance_id(show["slug"], p)] = {
                "eventId": show["slug"],
                "venueId": p["venue"],
                "date": p["date"],
                "start": p["start"],
                "ticketUrl": p["ticketUrl"],
                "free": p["free"],
            }
    return partial
