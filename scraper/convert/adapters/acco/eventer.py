"""eventer raw (`programme.json`) -> the theatre programme's halls, running times, prices, blurbs, pictures.

The theatre centre sells every ticketed show on its Eventer producer page, one
Eventer event per performance. The programme page (acco-tc) is the festival's own
schedule, so Eventer adds to acco-tc's performances and never creates one: each
Eventer event is matched to the acco-tc line at the same date and start, and
where two lines share a slot, to the one linking to that event's ticket page. An
event matching no line is skipped and reported. A line whose link is the ticket
page of a performance on another date or time (the page copied a neighbour's
link) gets no ticket link and an unknown status, rather than selling that other
night.

From the title line, "... - האולם האדום (50 דק')", come the hall (a room of the
theatre centre) and the running time. Prices are the full price and the
concessions; the Akko residents' and subscribers' rate (תושב עכו/מנוי) needs ID
at the door and is in the festival's ticketing note instead, and the couple
ticket (זוגי) is two seats' price.
"""

import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "platforms"))
import eventer

# Title-line hall words -> curated/venues.json's room ids for the theatre centre.
HALL_ROOMS = (
    ("אדום", "red-hall"),
    ("לבן", "white-hall"),
    ("דיוואן", "diwan-hall"),
    ("סטודיו", "studio"),
    ("פואייה", "foyer"),
)
NOT_A_SEAT = re.compile(r"תושב|מנוי|זוגי")


def room_of(name):
    for word, room in HALL_ROOMS:
        if word in (name or ""):
            return room
    return None


def _slug(url):
    return urllib.parse.urlsplit(url).path.strip("/") if url else None


def match(event, by_slot):
    """The acco-tc performance id this Eventer event sells, or None."""
    date, start = event["start"][:10], event["start"][11:16]
    candidates = by_slot.get((date, start), [])
    if len(candidates) == 1:
        return candidates[0][0]
    linked = [pid for pid, perf in candidates if _slug(perf.get("ticketUrl")) == event["linkName"]]
    return linked[0] if len(linked) == 1 else None


def adapt(source):
    raw = source.read("programme.json")
    programme = source.partials["acco-tc"]["performances"]
    by_slot = {}
    for pid, perf in programme.items():
        by_slot.setdefault((perf["date"], perf["start"]), []).append((pid, perf))
    events, performances, skipped = {}, {}, []
    for event in raw["events"]:
        pid = match(event, by_slot)
        if pid is None:
            skipped.append("%s %s" % (event["start"], event["linkName"]))
            continue
        low, high = eventer.seat_prices(event, NOT_A_SEAT.search)
        performances[pid] = {
            "roomId": room_of(event["name"]),
            "ticketUrl": event["ticketUrl"],
            "status": eventer.status_of(event),
            "priceMin": low,
            "priceMax": high,
        }
        eid = programme[pid]["eventId"]
        record = events.setdefault(eid, {})
        # Several performances of one show: the first to state a field speaks for it.
        for field, value in (("durationMin", eventer.minutes_in(event["name"])),
                             ("blurb", eventer.text_of(event["eventDesc"])),
                             ("imageUrl", event["imageUrl"])):
            if value is not None and record.get(field) is None:
                record[field] = value
    sold_by = {event["linkName"]: pid for event in raw["events"] for pid in [match(event, by_slot)] if pid}
    for pid, perf in programme.items():
        owner = sold_by.get(_slug(perf.get("ticketUrl")))
        if owner is not None and owner != pid:
            performances[pid] = {"ticketUrl": None, "status": "unknown"}
    return {"events": events, "performances": performances, "skipped": skipped}
