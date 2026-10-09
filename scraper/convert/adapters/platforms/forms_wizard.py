"""A Forms Wizard agenda's raw (`programme.json`) -> sessions as events, each with its one performance.

Shared by every conference whose site is a Forms Wizard page
(scraper/festivals/platforms/forms_wizard.py writes the raw). An item's title
is " - "-separated parts: the local-language name, the English one, and, when
the item has no time of its own, its time ("11:15-13:00"). Its people and its
description's rows make the blurb. A festival's adapter supplies the
vocabulary: the venue, which items are logistics, and the room a place names.
"""

import re

_SLOT = re.compile(r"^(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})$")
_HEBREW = re.compile("[֐-׿]")


def _hhmm(hours, minutes):
    return "%02d:%s" % (int(hours), minutes)


def title_parts(title):
    """"מושבים מקבילים - 11:15-13:00 - Parallel Session: X" -> ("Parallel Session: X", "מושבים מקבילים", "11:15-13:00")."""
    local, english, slot = [], [], None
    for part in (p.strip() for p in title.split(" - ")):
        if _SLOT.match(part) and slot is None:
            slot = part
        elif _HEBREW.search(part):
            local.append(part)
        else:
            english.append(part)
    return " - ".join(english) or None, " - ".join(local) or None, slot


def slot_of(item):
    """The item's (start, end), from its time or, failing that, its title; None when it has neither."""
    found = _SLOT.match(item["time"] or "") or _SLOT.match(title_parts(item["title"] or "")[2] or "")
    if not found:
        return None
    return _hhmm(found.group(1), found.group(2)), _hhmm(found.group(3), found.group(4))


def _minutes(hhmm):
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def _row(cells):
    """One description row -> a line: a time cell leads, the first line of the rest is its heading."""
    lines = [line for cell in cells for line in cell]
    if len(cells) > 1 and len(cells[0]) == 1 and _SLOT.match(cells[0][0]):
        lead, lines = cells[0][0] + " ", [line for cell in cells[1:] for line in cell]
    else:
        lead = ""
    if not lines:
        return lead.strip() or None
    return lead + lines[0] + (": " + "; ".join(lines[1:]) if lines[1:] else "")


def blurb_of(item):
    lines = [item["people"].rstrip(", ")] if item["people"] else []
    lines += [line for line in (_row(row) for row in item["description"]) if line]
    return "\n".join(lines) or None


def adapt(source, venue, is_logistics, room_of, ticket_url):
    raw = source.read("programme.json")
    partial = {"categories": {}, "venues": {venue: {}}, "events": {}, "performances": {}, "skipped": []}
    for item in raw["items"]:
        title, title_local, _ = title_parts(item["title"] or "")
        slot = slot_of(item)
        if slot is None:
            raise ValueError("agenda item %d (%r) has no time" % (item["id"], item["title"]))
        if is_logistics(item):
            partial["skipped"].append("%s %s %s (logistics)" % (item["date"], slot[0], title or title_local))
            continue
        event_id = "item-%d" % item["id"]
        partial["events"][event_id] = {
            "title": title or title_local,
            "titleLocal": title_local if title else None,
            "url": raw["site"],
            "categories": [],
            "blurb": blurb_of(item),
            "durationMin": _minutes(slot[1]) - _minutes(slot[0]),
            "imageUrl": None,
        }
        partial["performances"]["%s/%s/%s" % (event_id, item["date"], slot[0])] = {
            "eventId": event_id,
            "venueId": venue,
            "roomId": room_of(item["place"]) if item["place"] else None,
            "date": item["date"],
            "start": slot[0],
            "ticketUrl": ticket_url,
            "free": False,
        }
    return partial
