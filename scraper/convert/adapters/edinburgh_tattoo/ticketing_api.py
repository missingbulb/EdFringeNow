"""ticketing-api raw (`programme.json`) -> the show, its performances, availability, prices.

Where the ticketing API's vocabulary meets ours: one product is one event, every
performance is on the Castle Esplanade, amounts are thousandths of a pound, and
an availability level becomes our status.
"""

VENUE_ID = "castle-esplanade"
# The availability levels SecuTix publishes; any other, or none, is unknown.
STATUS_BY_LEVEL = {"GOOD": "on-sale", "LIMITED": "on-sale", "LOW": "on-sale", "SOLD_OUT": "sold-out", "NONE": "sold-out"}


def _pounds(amount):
    return None if amount is None else amount / 1000


def adapt(source):
    raw = source.read("programme.json")
    product = raw["product"]
    event_id = product["code"].lower()
    partial = {
        "categories": {},
        "events": {
            event_id: {
                "title": product["name"],
                "url": product["url"],
                "categories": [],
                "blurb": product["description"] or None,
                "durationMin": None,
                "imageUrl": product["image"],
            }
        },
        "performances": {},
        "skipped": [],
    }
    for perf in raw["performances"]:
        status = STATUS_BY_LEVEL.get(perf["availabilityLevel"], "unknown")
        if perf["availability"] == 0:
            status = "sold-out"
        partial["performances"]["%s/%s/%s" % (event_id, perf["date"], perf["start"])] = {
            "eventId": event_id,
            "venueId": VENUE_ID,
            "date": perf["date"],
            "start": perf["start"],
            "ticketUrl": product["url"],
            "free": False,
            "status": status,
            "priceMin": _pounds(perf["minPrice"]),
            "priceMax": _pounds(perf["maxPrice"]),
        }
    return partial
