"""A Smarticket listing's raw (`programme.json`) -> shows as events, performances with price and availability.

Shared by every festival that sells through a Smarticket tenant
(scraper/festivals/platforms/smarticket.py writes the raw). Performances of one
show (the same slug) share one event; each event's picture is its show's own,
from the performance page. A festival's adapter supplies the vocabulary: which
venue each of the tenant's place names is, and an event's genre.

A price of 0 is the box office's "ללא עלות", free admission; schema.org's
SoldOut is sold out, anything else on sale.
"""

SOLD_OUT = ("https://schema.org/SoldOut", "http://schema.org/SoldOut")


def blurb_of(performance):
    return performance["description"] or performance["brief"]


def adapt(source, venue_of, genre_of=None):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {}, "events": {}, "performances": {}, "skipped": []}
    for perf in raw["performances"]:
        event_id = "show-%s" % min(p["id"] for p in raw["performances"] if p["show"] == perf["show"])
        if event_id not in partial["events"]:
            event = {
                "title": perf["name"],
                "titleLocal": None,
                "url": perf["url"],
                "categories": [],
                "blurb": blurb_of(perf),
                "durationMin": perf["durationMin"],
                "imageUrl": perf["image"],
            }
            genre = genre_of(perf) if genre_of else None
            if genre:
                event["genre"] = genre
            partial["events"][event_id] = event
        venue, room = venue_of(perf["location"])
        partial["venues"].setdefault(venue, {})
        price = float(perf["price"]) if perf["price"] not in (None, "") else None
        if price is not None and price.is_integer():
            price = int(price)
        free = price == 0
        status = "free" if free else ("sold-out" if perf["availability"] in SOLD_OUT else "on-sale")
        partial["performances"]["perf-%d" % perf["id"]] = {
            "eventId": event_id,
            "venueId": venue,
            "roomId": room,
            "date": perf["startDate"][:10],
            "start": perf["startDate"][11:16],
            "ticketUrl": perf["url"],
            "free": free,
            "status": status,
            "priceMin": price,
            "priceMax": price,
        }
    return partial
