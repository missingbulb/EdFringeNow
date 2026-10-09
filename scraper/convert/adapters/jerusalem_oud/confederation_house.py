"""confederation-house raw (`programme.json`) -> the festival's concerts and their one performance each.

Where the site's words meet ours:

  * the location label ("אולם שרובר, תיאטרון ירושלים", "תיאטרון החאן", …) maps to
    a curated venue and, at the Jerusalem Theatre, one of its halls; a label
    outside the map is refused, so a new hall is researched, not guessed;
  * the title is the heading's lines after the festival's own name, joined
    with " – "; the concert page's heading wins over the listing card's;
  * the picture is the concert page's, else the listing card's;
  * a concert whose heading calls it a dance piece (מחול) is `dance`, the rest
    take the festival's default, music;
  * the price is the one the concert page prints for it; the site marks nothing
    sold out or free, so status stays unknown and free is false only where a
    price above zero is printed.
"""

LOCATIONS = {
    "בית הקונפדרציה": ("confederation-house", None),
    "תיאטרון החאן": ("khan-theatre", None),
    "אולם שרובר, תיאטרון ירושלים": ("jerusalem-theatre", "sherover"),
    "אולם רבקה קראון, תיאטרון ירושלים": ("jerusalem-theatre", "rebecca-crown"),
}
DANCE_WORD = "מחול"


def adapt(source):
    raw = source.read("programme.json")
    events, performances = {}, {}
    for concert in raw["concerts"]:
        card, page = concert["listing"], concert["page"] or {}
        eid = "page-%d" % card["pageId"]
        lines = page.get("titleLines") or card["titleLines"]
        title = " – ".join(lines)
        event = {
            "title": title,
            "titleLocal": None,
            "url": concert["url"],
            "categories": [],
            "blurb": page.get("blurb"),
            "durationMin": None,
            "imageUrl": page.get("image") or card["image"],
        }
        if DANCE_WORD in title:
            event["genre"] = "dance"
        events[eid] = event

        location = page.get("location") or card["location"]
        if location not in LOCATIONS:
            raise ValueError("%s: location %r is not in LOCATIONS" % (eid, location))
        venue, room = LOCATIONS[location]
        date = page.get("date") or card["date"]
        start = page.get("start") or card["start"]
        lo, hi = page.get("priceMin"), page.get("priceMax")
        performance = {
            "eventId": eid,
            "venueId": venue,
            "roomId": room,
            "date": date,
            "start": start,
            "ticketUrl": page.get("ticketUrl"),
            "free": (lo == 0 and hi == 0) if lo is not None else None,
        }
        if lo is not None:
            performance["priceMin"], performance["priceMax"] = lo, hi
        performances["%s/%s/%s" % (eid, date, start)] = performance
    return {"categories": {}, "venues": {}, "events": events, "performances": performances, "skipped": []}
