"""street-programme raw (`programme.json`) -> the street programme's events, performances, zones.

The street programme (מופעי חוצות) is the festival's own category for every item on
the page. Its section headings are zones of the Old City, and each zone becomes a
venue named by its heading. Roaming items have no fixed place, so they get no venue.

Entry is free (the page says "הכניסה חופשית!"). An item with no price is therefore
`free` with `status: free` and a price of 0. The one priced item, the Knights' Halls
night show, carries its own price, and its availability is unknown.

The genre is read off each card's genre line by keyword. The first rule that
matches wins, and an item that matches none is `other`. Living statues, circus,
fire, stilts and characters all fall to `other`. The rules take both English and
Hebrew words: the research transcription carries English summaries of the genre
lines, and a real fetch carries the page's own Hebrew.
"""

PROGRAMME = ("street-programme", "מופעי חוצות")

# heading -> (venue id, whether the heading is the venue's name). The Knights'
# Halls take their name from the curated venue research instead.
ZONES = {
    "רחוב ויצמן": ("weizmann-st", True),
    "מתחם הבאר": ("well-compound", True),
    "חניית אולמות האבירים": ("knights-halls-car-park", True),
    "חפיר תחתון": ("lower-moat", True),
    "במת לילה": ("night-stage", True),
    "מופעי שטח מסתובבים": (None, False),
    "אולמות האבירים, בלילה וביום": ("knights-halls", False),
}

GENRE_RULES = (
    ("family", ("family", "משפח", "ילדים")),
    ("dance", ("dance", "מחול")),
    ("theatre", ("theatre", "mime", "puppet", "תיאטרון", "פנטומימ", "בובות")),
    ("other", ("living statue", "פסל חי", "פסלים חיים")),
    ("music", ("music", "jazz", "band", "dj", "piano", "musician", "tribute",
               "מוזיק", "ג'אז", "ג׳אז", "להקה", "להקת", "די ג'יי", "פסנתר", "נגנים")),
)


def genre(line):
    text = (line or "").lower()
    for name, words in GENRE_RULES:
        if any(word in text for word in words):
            return name
    return "other"


def duration(item):
    """The card's stated running time. When the card states none and every
    performance is a window of the same length (a set on the night stage, say),
    that length is used. Anything else stays unknown."""
    if item["durationMin"] is not None:
        return item["durationMin"]
    lengths = set()
    for p in item["performances"]:
        if not p["end"]:
            return None
        start_h, start_m = (int(x) for x in p["start"].split(":"))
        end_h, end_m = (int(x) for x in p["end"].split(":"))
        lengths.add((end_h * 60 + end_m) - (start_h * 60 + start_m))
    if len(lengths) == 1 and min(lengths) > 0:
        return lengths.pop()
    return None


def adapt(source):
    raw = source.read("programme.json")
    partial = {
        "categories": {PROGRAMME[0]: {"name": PROGRAMME[1]}},
        "venues": {},
        "events": {},
        "performances": {},
        "skipped": [],
    }
    for section in raw["sections"]:
        venue_id, named = ZONES[section["heading"]]
        if venue_id and named:
            partial["venues"][venue_id] = {"name": section["heading"]}
        for item in section["items"]:
            eid = "street/" + item["title"]
            if not item["performances"]:
                # Roaming, or "details to come": nothing on the page says when.
                partial["skipped"].append(eid)
                continue
            partial["events"][eid] = {
                "title": item["title"],
                "url": raw["site"],
                "genre": genre(item["genreLine"]),
                "categories": [PROGRAMME[0]],
                "blurb": None,
                "durationMin": duration(item),
                "imageUrl": None,
            }
            free = item["price"] is None
            for p in item["performances"]:
                partial["performances"]["%s/%s/%s" % (eid, p["date"], p["start"])] = {
                    "eventId": eid,
                    "venueId": venue_id,
                    "roomId": None,
                    "date": p["date"],
                    "start": p["start"],
                    "ticketUrl": item["ticketUrl"],
                    "free": free,
                    "status": "free" if free else "unknown",
                    "priceMin": 0 if free else item["price"],
                    "priceMax": 0 if free else item["price"],
                }
    return partial
