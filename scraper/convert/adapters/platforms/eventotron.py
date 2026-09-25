"""An Eventotron box office's raw (`programme.json`) -> events, performances, venues, prices.

Shared by every festival on the platform (scraper/festivals/platforms/eventotron.py
writes the raw); each festival's own adapter supplies only its genre mapping,
because the genre names are the festival's vocabulary, not the platform's.
"""

# The box office's per-performance ticketing label. "pwyw" and "donations" are
# free entry with an ask at the door; "paid" is a ticket. A performance with no
# label (Leicester prints none) is free only if the page says so in a band.
FREE_LABELS = {"free", "pwyw", "donations", "unticketed"}
PAID_LABELS = {"paid"}


def is_free(performance):
    label = (performance.get("ticketing") or "").strip().lower()
    if label in FREE_LABELS:
        return True
    if label in PAID_LABELS:
        return False
    amounts = [b["amount"] for b in performance["prices"] if b["amount"] is not None]
    if any(a > 0 for a in amounts):
        return False
    if performance["prices"] and all("free" in b["text"].lower() for b in performance["prices"]):
        return True
    return None


def performance_id(slug, p):
    return "%s/%s/%s/%s" % (slug, p["date"], p["start"], p["venue"])


def adapt(source, genre_by_slug):
    raw = source.read("programme.json")
    names = {g["slug"]: g["name"] for g in raw["genres"]}
    used = sorted({g for show in raw["shows"] for g in show["genres"]})
    partial = {
        "categories": {slug: {"name": names[slug]} for slug in used},
        "venues": {
            v["slug"]: {"name": v["name"], "address": v["address"], "lat": v["lat"], "lng": v["lng"],
                        "refs": [v["url"]]}
            for v in raw["venues"]
        },
        "events": {},
        "performances": {},
        "skipped": raw["outOfEdition"],
    }
    for show in raw["shows"]:
        event = {
            "title": show["title"],
            "url": show["url"],
            "categories": show["genres"],
            "blurb": show["description"],
            "durationMin": None,
            "imageUrl": None,
        }
        genre = next((genre_by_slug[g] for g in show["genres"] if g in genre_by_slug), None)
        if genre:
            event["genre"] = genre
        partial["events"][show["slug"]] = event
        for p in show["performances"]:
            free = is_free(p)
            amounts = [b["amount"] for b in p["prices"] if b["amount"] is not None]
            if p["status"] == "sold-out":
                status = "sold-out"
            elif free:
                status = "free"
            else:
                # Listed and not marked is all the page says; whether a seat is
                # left is not published.
                status = "unknown"
            partial["performances"][performance_id(show["slug"], p)] = {
                "eventId": show["slug"],
                "venueId": p["venue"],
                "date": p["date"],
                "start": p["start"],
                "ticketUrl": show["url"],
                "free": free,
                "status": status,
                # Unknown stays null: a PWYW band prints no figure, and that is
                # not a £0 price.
                "priceMin": min(amounts) if amounts else None,
                "priceMax": max(amounts) if amounts else None,
            }
    return partial
