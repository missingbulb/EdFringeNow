"""A Spektrix client's raw (`programme.json`) -> events, performances, venue names, status, prices.

Shared by every festival that sells through Spektrix (scraper/festivals/platforms/spektrix.py
writes the raw). The client's `attribute_*` fields are its own vocabulary, so
each festival's adapter passes in how to read them: which events are public
programme, their genre, their page URL, whether they are free.
"""

import re

# Price-list entries that are add-ons or special allocations, never the price
# of a seat: they would drag priceMin to £2 on every performance.
NOT_A_SEAT = re.compile(r"protection|donat|voucher|gift|carer|companion|essential|access|comp\b|booking fee", re.I)


def seat_amounts(price_list):
    return [p["amount"] for p in price_list or [] if p["amount"] > 0 and not NOT_A_SEAT.search(p["ticketType"])]


def status_of(instance, free):
    if instance["capacity"] and instance["available"] == 0:
        return "sold-out"
    if free:
        return "free"
    if instance["isOnSale"] and instance["available"]:
        return "on-sale"
    # Sales closed (a past edition) with seats left says nothing either way.
    return "unknown"


def adapt(source, *, public, genre, url, free=lambda event: None, listed_price=lambda event: (None, None)):
    """`listed_price(event)` -> (min, max) from the client's own price text, used
    only where the price list has no seat price (a past edition's lists keep
    only their add-ons once sales close)."""
    raw = source.read("programme.json")
    events = {e["id"]: e for e in raw["events"]}
    kept = {eid for eid, e in events.items() if public(e)}
    partial = {
        "venues": {v["id"]: {"name": v["name"].strip(), "address": v.get("address") or None} for v in raw["venues"]},
        "events": {},
        "performances": {},
        "skipped": sorted(events[eid]["name"] for eid in events if eid not in kept),
    }
    for instance in raw["instances"]:
        eid = instance["event"]
        if eid not in kept or instance["cancelled"]:
            continue
        event = events[eid]
        if eid not in partial["events"]:
            record = {
                "title": event["name"].strip(),
                "url": url(event),
                "categories": [],
                "blurb": (event.get("description") or "").strip() or None,
                "durationMin": event.get("duration") or None,
                "imageUrl": event.get("imageUrl") or None,
            }
            g = genre(event)
            if g:
                record["genre"] = g
            partial["events"][eid] = record
        is_free = free(event)
        amounts = seat_amounts(raw["priceLists"].get(instance["priceList"]))
        low, high = (min(amounts), max(amounts)) if amounts else listed_price(event)
        partial["performances"][instance["id"]] = {
            "eventId": eid,
            "venueId": instance["venue"],
            "date": instance["start"][:10],
            "start": instance["start"][11:16],
            "ticketUrl": url(event),
            "free": is_free,
            "status": status_of(instance, is_free),
            "priceMin": low,
            "priceMax": high,
        }
    return partial
