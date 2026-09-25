"""festival-site raw (`programme.json`) -> events, performances, availability, prices.

Where edfilmfest.org's vocabulary meets ours: its programme types stay the
festival's own categories, its venue labels map onto the curated venue codes,
and its per-showing price bands and seats-left become status and a price range.
"""

# The site labels one venue several ways across its listings. A label not here
# fails the conversion, so a new venue is a visible change, never a silent null.
VENUE_BY_LABEL = {
    "EIFF @ Cineworld": "cineworld",
    "Cineworld": "cineworld",
    "EIFF @ Filmhouse": "filmhouse",
    "EIFF @ The Cameo": "cameo",
    "Central Hall": "central-hall",
    "Tollcross Central Hall": "central-hall",
    "EIFF @ Tollcross Central Hall": "central-hall",
    "Monkey Barrel Comedy MB3": "monkey-barrel-3",
    "EIFF @ Monkey Barrel Comedy": "monkey-barrel-3",
}

GENRE_BY_PROGRAMME_TYPE = {"talk": "talk"}


def _amounts(showing):
    """Every published price of a showing (full and concession), as numbers."""
    amounts = []
    for band in showing["tickets"]:
        if not band.get("hide_full_price"):
            amounts.append(float(band["full_price"]))
        amounts.extend(float(c["price"]) for c in band.get("concessions", []))
    return amounts


def _status(showing):
    if showing["soldOut"]:
        return "sold-out"
    left = [int(b["availability"]) for b in showing["tickets"] if b.get("availability") not in (None, "")]
    if left and max(left) <= 0:
        return "sold-out"
    return "on-sale" if left else "unknown"


def adapt(source):
    raw = source.read("programme.json")
    names = {t["slug"]: t["name"] for t in raw["programmeTypes"]}
    used = sorted({t for show in raw["shows"] for t in show["programmeTypes"]})
    partial = {
        "categories": {slug: {"name": names[slug]} for slug in used},
        "events": {},
        "performances": {},
        "skipped": raw["unlisted"],
    }
    for show in raw["shows"]:
        card = show["listing"]
        event = {
            "title": show["title"],
            "url": show["url"],
            "categories": show["programmeTypes"],
            "blurb": show["excerpt"],
            "durationMin": card["duration"],
            "imageUrl": card["image"],
        }
        genre = next((GENRE_BY_PROGRAMME_TYPE[t] for t in show["programmeTypes"] if t in GENRE_BY_PROGRAMME_TYPE), None)
        if genre:
            event["genre"] = genre
        partial["events"][show["slug"]] = event
        for showing in card["showings"]:
            label = showing["venue"]
            if label is not None and label not in VENUE_BY_LABEL:
                raise ValueError("unmapped EIFF venue label %r (%s)" % (label, show["slug"]))
            amounts = _amounts(showing)
            pid = "%s/%s/%s" % (show["slug"], showing["date"], showing["start"])
            if pid in partial["performances"]:
                raise ValueError("two showings share %s" % pid)
            partial["performances"][pid] = {
                "eventId": show["slug"],
                # A sold-out showing prints no venue: unknown, not guessed from
                # the film's other showings.
                "venueId": VENUE_BY_LABEL.get(label),
                "date": showing["date"],
                "start": showing["start"],
                "ticketUrl": show["url"],
                "free": (all(a == 0 for a in amounts)) if amounts else None,
                "status": _status(showing),
                "priceMin": min(amounts) if amounts else None,
                "priceMax": max(amounts) if amounts else None,
            }
    return partial
