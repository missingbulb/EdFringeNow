"""acco-tc raw (`programme.json`) -> the theatre programme's events and performances.

The page's own labels become our fields here:

  * every show is filed under the programme itself (`theatre-programme`), first,
    so the programme is what a page shows as the show's kind;
  * הפקת מקור / הצגה אורחת / בכורה / הצגות חממה / לנשים בלבד are the festival's
    own categories, named as the page writes them;
  * כניסה חופשית is not a category but the performance's `free`, with a price
    of 0. On this page the free-entry lines are the foyer concerts, so a show
    with one is `music`; every other show takes the festival's default genre;
  * a sold-out mark is `status: sold-out`. A line with an eventer link and no
    mark is `on-sale`, which is what the page says of it. A line with neither
    is `unknown`.

The page prints no price, running time, blurb or picture for a ticketed show,
and names a hall only on the free concerts, so those fields are left out rather
than set to null: the eventer source supplies them, and a null here would win
the merge over it.
"""

PROGRAMME = ("theatre-programme", "פסטיבל תיאטרון עכו")
LABEL_CATEGORIES = {
    "הפקת מקור": "original-production",
    "הצגה אורחת": "guest-production",
    "בכורה": "premiere",
    "הצגות חממה": "incubator",
    "לנשים בלבד": "women-only",
}
FREE_LABEL = "כניסה חופשית"
VENUE = "acco-theatre-centre"
# The page's hall names -> curated/venues.json's room ids for the theatre centre.
HALL_ROOMS = {"אולם הפואייה": "foyer"}


def event_id(title):
    return "theatre/" + title


def status(line, free):
    if line["soldOut"]:
        return "sold-out"
    if free:
        return "free"
    return "on-sale" if line["ticketUrl"] else "unknown"


def adapt(source):
    raw = source.read("programme.json")
    categories = {PROGRAMME[0]: {"name": PROGRAMME[1]}}
    events, performances = {}, {}
    for line in raw["lines"]:
        eid = event_id(line["title"])
        free = FREE_LABEL in line["labels"]
        event = events.setdefault(eid, {
            "title": line["title"],
            "url": raw["site"],
            "categories": [PROGRAMME[0]],
        })
        for label in line["labels"]:
            # A label outside this list (a performer's name, a note) stays in
            # raw and is not a category.
            cid = LABEL_CATEGORIES.get(label)
            if cid:
                categories[cid] = {"name": label}
                if cid not in event["categories"]:
                    event["categories"].append(cid)
        if free:
            event["genre"] = "music"
        performances["%s/%s/%s" % (eid, line["date"], line["start"])] = {
            "eventId": eid,
            "venueId": VENUE,
            "roomId": HALL_ROOMS.get(line["hall"]),
            "date": line["date"],
            "start": line["start"],
            "ticketUrl": line["ticketUrl"],
            "free": free,
            "status": status(line, free),
            "priceMin": 0 if free else None,
            "priceMax": 0 if free else None,
        }
    return {"categories": categories, "events": events, "performances": performances}
