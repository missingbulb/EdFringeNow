"""abugosh-site raw (`programme.json`) -> categories, concerts, performances, venue names.

This is where the site's vocabulary meets ours:

  * a card's place ("Kiryat Yearim Church", "The Crypt", "Tel Aviv Museum of
    Art") is a venue; the outdoor cards' places ("The Café Terrace", "The
    Patio") are spots at Kiryat Ye'arim Church, the festival's home ground, so
    they are rooms of that venue (curated/venues.json cites where they are);
  * the festival's own sections, as its menu names them, are the categories:
    the Tel Aviv, Abu Gosh church and Crypt concerts, and the outdoor sets;
  * the outdoor café set repeats on each day under its own page, so cards of
    one listing with the same title and picture are one event;
  * a price printed on a concert's page is that performance's price; an
    outdoor page that says "Free admission" makes its performances free.
"""

import re
import urllib.parse

# Card place (its last part, English) -> (venue id, room id, category id).
PLACES = {
    "Tel Aviv Museum of Art": ("tel-aviv-museum-of-art", None, "tel-aviv"),
    "Kiryat Yearim Church": ("kiryat-yearim-church", None, "abu-gosh"),
    "The Crypt": ("benedictine-crypt", None, "crypt"),
    "The Café Terrace": ("kiryat-yearim-church", "cafe-terrace", "outdoor"),
    "The Patio": ("kiryat-yearim-church", "patio", "outdoor"),
}
# The site menu's names for its sections.
CATEGORIES = {
    "tel-aviv": "Concerts in Tel Aviv",
    "abu-gosh": "Concerts in Abu Gosh",
    "crypt": "The Crypt at the Benedictine Monastery",
    "outdoor": "Outdoor Performances",
}


def _clean(title):
    return re.sub(r"\s+", " ", title).strip()


def adapt(source):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    event_of = {}
    for card in raw["cards"]:
        where = card["place"][-1] if card["place"] else None
        if where not in PLACES:
            partial["skipped"].append("%s %s: unknown place %r" % (card["date"], card["title"], where))
            continue
        venue_id, room_id, category = PLACES[where]
        partial["categories"].setdefault(category, {"name": CATEGORIES[category]})
        if room_id is None:
            partial["venues"].setdefault(venue_id, {"name": where})

        key = (card["listing"], _clean(card["title"]), card["image"])
        event_id = event_of.setdefault(key, "post-%d" % card["postId"])
        detail = card["detail"] or {}
        if event_id not in partial["events"]:
            title_he = _clean(card["titleHe"]) if card["titleHe"] else None
            partial["events"][event_id] = {
                "title": _clean(card["title"]),
                "titleLocal": title_he if title_he and title_he != _clean(card["title"]) else None,
                # The site prints its paths with raw Hebrew; serve them percent-encoded.
                "url": urllib.parse.quote(card["url"], safe=":/%"),
                "categories": [category],
                "blurb": detail.get("description") or card["blurb"],
                "durationMin": detail.get("durationMin"),
                "imageUrl": card["image"],
            }

        free = True if detail.get("free") else (False if detail.get("price") is not None else None)
        for slot in card["times"]:
            pid = "%s/%s/%s" % (event_id, card["date"], slot["start"])
            if pid in partial["performances"]:
                raise ValueError("two performances of %s at %s %s" % (event_id, card["date"], slot["start"]))
            performance = {
                "eventId": event_id,
                "venueId": venue_id,
                "roomId": room_id,
                "date": card["date"],
                "start": slot["start"],
                "ticketUrl": detail.get("ticketUrl"),
                "free": free,
                # Free entry is the one availability the site states; it
                # publishes nothing about seats left on a ticketed concert.
                "status": "free" if free else "unknown",
            }
            if free:
                performance["priceMin"] = performance["priceMax"] = 0
            elif detail.get("price") is not None:
                performance["priceMin"] = performance["priceMax"] = detail["price"]
            partial["performances"][pid] = performance
    return partial
