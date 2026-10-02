"""An Eventive box office's raw (`programme.json`) -> events, performances, venues, status, prices.

Shared by every festival that sells through Eventive (scraper/festivals/platforms/eventive.py
writes the raw). Eventive lists screenings; screenings of the same films are one
event here, so a film shown three times is one show with three performances.
A festival's own adapter passes in only its vocabulary: which tags name a genre or
mark availability, and what it lists that is not its programme.
"""

import html
import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

_BLOCK_END = re.compile(r"</(p|div|li|h[1-6])\s*>|<br\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")
# Byte-order marks and zero-width spaces pasted in from word processors.
_INVISIBLE = {0xFEFF: None, 0x200B: None}


def text_of(markup):
    """HTML as plain paragraphs, or None when it holds no text."""
    if not markup:
        return None
    text = html.unescape(_TAG.sub("", _BLOCK_END.sub("\n", markup))).translate(_INVISIBLE)
    paragraphs = [re.sub(r"\s+", " ", line).strip() for line in text.split("\n")]
    return "\n\n".join(p for p in paragraphs if p) or None


def wall_clock(start_time, zone):
    """A UTC instant as the festival's ("YYYY-MM-DD", "HH:MM")."""
    instant = datetime.strptime(start_time[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    local = instant.astimezone(ZoneInfo(zone))
    return local.date().isoformat(), local.strftime("%H:%M")


def event_key(screening):
    """Screenings of the same films are one event; one with no films is its own."""
    films = sorted(f["id"] for f in screening["films"])
    return "films-" + "-".join(films) if films else screening["id"]


def runtime(screening):
    minutes = [f["runtime"] for f in screening["films"]]
    if not minutes or not all(m and str(m).isdigit() and int(m) > 0 for m in minutes):
        return None
    return sum(int(m) for m in minutes)


def image(screening):
    if screening.get("cover"):
        return screening["cover"]
    for film in screening["films"]:
        for key in ("still_image", "cover_image", "poster_image"):
            if film.get(key):
                return film[key]
    return None


def blurb(screening):
    own = text_of(screening.get("description")) or text_of(screening.get("short_description"))
    if own:
        return own
    films = [f for f in screening["films"] if f.get("short_description") or f.get("description")]
    if len(screening["films"]) == 1 and films:
        return text_of(films[0].get("short_description")) or text_of(films[0].get("description"))
    lines = ["%s: %s" % (f["name"].strip(), text_of(f["short_description"])) for f in films if text_of(f.get("short_description"))]
    return "\n\n".join(lines) or None


def prices(screening):
    """(min, max) in the currency's units over the public, active ticket types, or (None, None)."""
    amounts = [b["price"] / 100 for b in screening["ticket_buckets"]
               if b.get("public") and b.get("is_active") is not False and isinstance(b.get("price"), (int, float))]
    return (min(amounts), max(amounts)) if amounts else (None, None)


def status_of(screening, free, tag_status):
    if tag_status:
        return tag_status
    # With no ticket types the box office sells nothing for it (a pass-holders'
    # event, a partner cinema's own sale), which says nothing about the door.
    if screening.get("hide_tickets_button") or not screening["ticket_buckets"]:
        return "unknown"
    if screening.get("tickets_available"):
        return "free" if free else "on-sale"
    return "sold-out"


def adapt(source, genre_by_tag=None, status_by_tag=None, skip=lambda screening: False):
    """The festival's own vocabulary, each optional: `genre_by_tag` maps its tag
    names to our genres (an event with no films is not a screening and takes
    "other" unless a tag says otherwise); `status_by_tag` maps the tags it marks
    availability with to a status, and those tags are not categories; `skip(screening)`
    says a listed screening is not part of the festival's programme."""
    genre_by_tag = genre_by_tag or {}
    status_by_tag = status_by_tag or {}
    raw = source.read("programme.json")
    zone = source.festival["timezone"]
    site = raw["site"]
    partial = {
        "categories": {},
        "venues": {
            v["id"]: {"name": v["name"].strip(), "address": v["addressLine"], "capacity": v["default_capacity"],
                      "online": False}
            for v in raw["venues"]
        },
        "events": {},
        "performances": {},
        "skipped": list(raw["outOfEdition"]),
    }
    for screening in raw["events"]:
        if skip(screening):
            partial["skipped"].append("%s (%s)" % (screening["name"].strip(), screening["start_time"]))
            continue
        tags = [t for t in screening["tags"] if t["name"] not in status_by_tag]
        eid = event_key(screening)
        if eid not in partial["events"]:
            films = screening["films"]
            genre = next((genre_by_tag[t["name"]] for t in screening["tags"] if t["name"] in genre_by_tag), None)
            record = {
                "title": screening["name"].strip(),
                "url": "%s/films/%s" % (site, films[0]["id"]) if len(films) == 1 else "%s/schedule/%s" % (site, screening["id"]),
                "categories": [t["id"] for t in tags],
                "blurb": blurb(screening),
                "durationMin": runtime(screening),
                "imageUrl": image(screening),
                "genre": genre or ("film" if films else "other"),
            }
            partial["events"][eid] = record
        for tag in tags:
            partial["categories"][tag["id"]] = {"name": tag["name"].strip()}
        low, high = prices(screening)
        free = (high == 0) if high is not None else None
        day, start = wall_clock(screening["start_time"], zone)
        partial["performances"][screening["id"]] = {
            "eventId": eid,
            "venueId": screening["venue"],
            "date": day,
            "start": start,
            "ticketUrl": "%s/schedule/%s" % (site, screening["id"]),
            "free": free,
            "status": status_of(screening, free,
                                next((status_by_tag[t["name"]] for t in screening["tags"] if t["name"] in status_by_tag), None)),
            "priceMin": low,
            "priceMax": high,
        }
    return partial
