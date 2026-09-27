"""festival-site raw (`programme.json`) -> the Tel Aviv Festival's events and performances.

The site's own vocabulary becomes our fields here:

  * **Events.** A show record is one slot; the site lists a show twice when it
    plays twice on different nights or in two separate slots (the same `name`,
    two `id`s). Records are grouped by their name, whitespace-normalised, into
    one event, whose id and page (`/show/<id>`) are the first record's. Its
    picture is the first record's `photo` that exists (a path on the site); a
    show with no photo anywhere has no picture, since its `/show/<id>` page only
    repeats the programme's record.
  * **Performances.** Each record plays at `time` and at every entry of
    `times`. The museum nights run past midnight, so a time before 06:00 is the
    same night's, written 24:xx on that night's date (schema.py's convention).
  * **Categories** are the programme's blocks, named as the site names them:
    each special night by its own day title, and the two museum nights together
    as the Night Pass (`settings.passLabel`) they are sold as.
  * **Genre** is music unless the show is plainly something else (the midnight
    screenings, the dance piece, the talks and live podcasts), listed by the
    site's show id below.
  * **Status.** `soldout` is `sold-out`; `ticket: free` is `free`; `live` with
    a ticket link is `on-sale`; anything else is `unknown`.
  * **Ticket link.** The show's own Ticketmaster link (`tmUrl`), else the
    pass-plus-show link (`comboUrl`), else, for a show the Night Pass admits,
    that night's pass (`passUrl`).
  * **Prices** are what the ticket that admits you to that performance costs,
    read from the programme's own figures:
      - `ticket: separate` with a `price`: that price. (The Friday noon shows
        are also sold as a cheaper add-on to a Wednesday or Thursday pass; that
        is a two-day bundle, not this performance's ticket.) Without a `price`
        (the opening, the closing), the price is unknown.
      - `ticket: pass`: the Night Pass, `settings.passPrice`. The pass admits
        to every gallery and garden show that night, so this is the cost of the
        whole evening, not a price per show.
      - `ticket: addon`: `addonPrice` is printed as the price on top of the
        pass, and the add-on is only sold with it, as one Ticketmaster ticket
        (`comboUrl`) — e.g. "פס רביעי + שימי תבורי" at 209 = 159 + 50. So the
        performance's price is the pass plus the add-on.
      - `ticket: free`: 0.
    Pricing details that fit no performance (the pass itself, Digitel
    benefits) are the festival's `[ticketing]` notes.
"""

import re
import urllib.parse

MUSEUM_NIGHT_KIND = "museum"
NIGHT_PASS_CATEGORY = "night-pass"
# A time before this hour is past midnight of the night it is listed under.
NIGHT_ENDS_HOUR = 6

# The programme's `venue` labels -> (curated/venues.json venue id, room id).
VENUES = {
    "המשכן לאמנויות הבמה": ("tel-aviv-performing-arts-center", None),
    "אולם רקנאטי": ("tel-aviv-museum-of-art", "recanati-hall"),
    "אולם אסיא": ("tel-aviv-museum-of-art", "asia-hall"),
    "אולם קאופמן": ("tel-aviv-museum-of-art", "kaufmann-hall"),
    "אולם סיימון ומרי יגלום": ("tel-aviv-museum-of-art", "yaglom-hall"),
    "מבואת ריקליס": ("tel-aviv-museum-of-art", "rickles-foyer"),
    "מבואת רפפורט": ("tel-aviv-museum-of-art", "rapaport-foyer"),
    "גלריית הצילום": ("tel-aviv-museum-of-art", "photography-gallery"),
    "חדרי המיניאטורות של הלנה רובינשטיין": ("tel-aviv-museum-of-art", "rubinstein-miniatures"),
    "נומה בר: מצד שני": ("tel-aviv-museum-of-art", "noma-bar-exhibition"),
    "חזון העצמות החדשות": ("tel-aviv-museum-of-art", "new-bones-exhibition"),
    "שנת אפס": ("tel-aviv-museum-of-art", "year-zero-exhibition"),
    "גן הפסלים": ("tel-aviv-museum-of-art", "sculpture-garden"),
    "אודיטוריום בית אריאלה": ("beit-ariela", "auditorium"),
    "הסלון העירוני, בית אריאלה": ("beit-ariela", "urban-salon"),
    "בית רדיקל": ("beit-radical", None),
    "היכל התרבות, אולם לאוי": ("heichal-hatarbut", "lowy-hall"),
}

# Shows that are not a concert, by any of the site's ids for them.
GENRES = {
    "wed-rocky": "film",           # a midnight screening
    "thu-hunger": "film",          # a midnight screening
    "wed-pinto": "dance",          # Inbal Pinto's "The Room", danced
    "wed-ulman": "talk",           # a master class
    "thu-castelbloom": "talk",     # a live special of the "One Book" podcast
    "thu-liberman": "talk",        # a live recording of the "1+1" podcast
    "thu-drummer": "talk",         # the exhibition's curator in conversation, with records
}

# The site's running-time phrases -> minutes. "כ" (about) is kept as the figure.
DURATIONS = {"שעה": 60, "כשעה": 60, "כשעה ורבע": 75, "כשעה וחצי": 90}
MINUTES_RE = re.compile(r"^(\d+)\s*דקות$")


def duration_min(text):
    if not text:
        return None
    text = text.strip()
    match = MINUTES_RE.match(text)
    return int(match.group(1)) if match else DURATIONS.get(text)


def title_key(name):
    return " ".join(name.split())


def start(time):
    hour, minute = (int(part) for part in time.split(":"))
    if hour < NIGHT_ENDS_HOUR:
        hour += 24
    return "%02d:%02d" % (hour, minute)


def category(day, settings):
    if day["kind"] == MUSEUM_NIGHT_KIND:
        return NIGHT_PASS_CATEGORY, settings["passLabel"]
    return day["id"], day["title"] or day["blurb"]


def price(show, settings):
    if show["ticket"] == "free":
        return 0
    if show["ticket"] == "pass":
        return settings["passPrice"]
    if show["ticket"] == "addon":
        return settings["passPrice"] + show["addonPrice"] if "addonPrice" in show else None
    return show.get("price")


def status(show, ticket_url):
    if show["status"] == "soldout":
        return "sold-out"
    if show["ticket"] == "free":
        return "free"
    if show["status"] == "live" and ticket_url:
        return "on-sale"
    return "unknown"


def adapt(source):
    raw = source.read("programme.json")
    settings = raw["settings"]
    days = {day["id"]: day for day in raw["days"]}
    categories, events, performances = {}, {}, {}
    event_of_title = {}
    for show in raw["shows"]:
        day = days[show["dayId"]]
        if show["venue"] not in VENUES:
            raise ValueError("show %s: venue %r is not mapped to a curated venue" % (show["id"], show["venue"]))
        venue_id, room_id = VENUES[show["venue"]]
        cid, cname = category(day, settings)
        categories[cid] = {"name": cname}

        title = title_key(show["name"])
        eid = event_of_title.setdefault(title, show["id"])
        event = events.setdefault(eid, {
            "title": title,
            "titleLocal": None,
            "url": "%s/show/%s" % (raw["site"], eid),
            "genre": "music",
            "categories": [],
            "blurb": None,
            "durationMin": None,
            "imageUrl": None,
        })
        if cid not in event["categories"]:
            event["categories"].append(cid)
        if show["id"] in GENRES:
            event["genre"] = GENRES[show["id"]]
        blurb = (show.get("about") or show.get("sub") or "").strip()
        if blurb and event["blurb"] is None:
            event["blurb"] = blurb
        if event["durationMin"] is None:
            event["durationMin"] = duration_min(show.get("duration"))
        if show.get("photo") and event["imageUrl"] is None:
            event["imageUrl"] = urllib.parse.urljoin(raw["site"] + "/", show["photo"])

        ticket_url = show.get("tmUrl") or show.get("comboUrl")
        if ticket_url is None and show["ticket"] == "pass":
            ticket_url = day.get("passUrl")
        amount = price(show, settings)
        for time in [show["time"]] + list(show.get("times") or []):
            at = start(time)
            performances["%s/%s" % (show["id"], at)] = {
                "eventId": eid,
                "venueId": venue_id,
                "roomId": room_id,
                "date": day["isoDate"],
                "start": at,
                "ticketUrl": ticket_url,
                "free": show["ticket"] == "free",
                "status": status(show, ticket_url),
                "priceMin": amount,
                "priceMax": amount,
            }
    return {"categories": categories, "events": events, "performances": performances}
