"""Pure transforms turning edinburghartfestival.com's WP REST records into raw records.

No network and no filesystem: `fetch.py` does the talking and hands the decoded
JSON here, which is what lets `--selftest` prove the parsing offline.

What the site carries, all of it in WP REST (`wp/v2/event`, ACF fields exposed):

  * an edition is the `festival2026` event tag (and the `festival-year` post
    type); an event's `acf.event_format` says whether it is an `exhibition`
    (a date range with opening hours) or an `event` (one sitting, usually);
  * dates are ISO (`exhibition_start` / `exhibition_end`, used for both
    formats); times are free text (`time_info`: "2.30–4pm", "12noon—evening",
    "(Doors open at 7pm) 8pm—1am"), read here into a 24h start where it is
    unambiguous and left unknown otherwise;
  * each event embeds its venue (`acf.event2venue`) with coordinates, address
    and the venue's own opening hours;
  * tickets sell through Eventbrite and partners' own sites (`ticket_link`);
    `acf.price_*_ticket` are the form's defaults (the same 4/6/20/0 on free
    events), so no price is read from them.
"""

import html as _html
import re

EDITION_TAG_PREFIX = "festival"

_DASH = "[–—‒-]"
_CLOCK = r"(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm|noon)?"


def clean_text(raw):
    if raw is None:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = _html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _clock(hour, minute, suffix):
    hour = int(hour)
    minute = int(minute or 0)
    if hour > 12 or minute > 59:
        return None
    if suffix == "noon":
        return 12 * 60 + minute if hour == 12 else None
    if suffix == "pm" and hour != 12:
        hour += 12
    if suffix == "am" and hour == 12:
        hour = 0
    return hour * 60 + minute


def parse_times(text):
    """time_info -> (start "HH:MM" or None, duration minutes or None).

    The start's am/pm, when not written, is taken from the end's ("2.30–4pm"),
    unless that would put the start after the end ("11—1pm" is 11am). A start
    with no suffix anywhere ("8:10") is ambiguous and stays unknown, as does
    anything that is not a clock ("May 2026—Aug 2027", "Various times").
    """
    text = clean_text(text).lower()
    text = re.sub(r"\([^)]*\)", " ", text).strip()
    m = re.match(r"^" + _CLOCK + r"(?:\s*" + _DASH + r"\s*(?:" + _CLOCK + r"|(evening|late))?)?\s*$", text)
    if not m:
        return None, None
    sh, sm, ss, eh, em, es, _word = m.groups()
    end = _clock(eh, em, es) if eh else None
    if ss is None:
        if es is None:
            return None, None
        pm_start = _clock(sh, sm, "pm" if es in ("pm", "noon") else "am")
        am_start = _clock(sh, sm, "am")
        start = pm_start if es == "pm" and pm_start is not None and end is not None and pm_start <= end else am_start
    else:
        start = _clock(sh, sm, ss)
    if start is None:
        return None, None
    duration = None
    if end is not None:
        duration = (end - start) % (24 * 60) or None
    return "%02d:%02d" % divmod(start, 60), duration


def free_flag(price_type):
    """acf.event_price_type -> True (free), False (ticketed) or None (not said)."""
    words = (price_type or "").lower()
    if "free" in words:
        return True
    if "ticket" in words or "£" in words:
        return False
    return None


def edition_tag(year):
    return "%s%s" % (EDITION_TAG_PREFIX, year)


def venue_record(embedded):
    """acf.event2venue (a Timber post) -> the site's venue record, untranslated."""
    def num(key):
        try:
            return round(float(embedded.get(key)), 6)
        except (TypeError, ValueError):
            return None

    lat, lng = num("latitude"), num("longitude")
    if lat is None or lng is None:
        lat = lng = None
    return {
        "id": embedded["id"],
        "slug": embedded.get("slug"),
        "name": clean_text(embedded.get("post_title") or embedded.get("title")),
        "type": embedded.get("type"),
        "address": clean_text(embedded.get("contact_address")) or None,
        "lat": lat,
        "lng": lng,
        "openingTimes": clean_text(embedded.get("opening_times")) or None,
        "website": embedded.get("website_url") or None,
    }


def event_record(event, tag_slugs, type_names):
    """One wp/v2/event record -> the raw event, in the site's vocabulary."""
    acf = event.get("acf") or {}
    venue = acf.get("event2venue")
    image = (event.get("yoast_head_json") or {}).get("og_image") or []
    start, duration = parse_times(acf.get("time_info"))
    return {
        "id": event["id"],
        "slug": event["slug"],
        "title": clean_text(event["title"]["rendered"]),
        "url": event["link"],
        "format": acf.get("event_format"),
        "types": [type_names[t][0] for t in event.get("event-type", []) if t in type_names],
        "tags": [tag_slugs[t] for t in event.get("event-tag", []) if t in tag_slugs],
        "description": clean_text(event["content"]["rendered"]) or None,
        "image": image[0]["url"] if image else None,
        "venue": venue["id"] if isinstance(venue, dict) else None,
        "dateStart": acf.get("exhibition_start") or None,
        "dateEnd": acf.get("exhibition_end") or None,
        "openDays": acf.get("exhibition_open_dow") or [],
        "excludeDates": [d for d in (acf.get("exhibition_exclude_dates") or []) if d],
        "dateInfo": clean_text(acf.get("date_info")) or None,
        "fullDateInfo": clean_text(acf.get("full_date_info")) or None,
        "timeInfo": clean_text(acf.get("time_info")) or None,
        "start": start,
        "durationMin": duration,
        "priceType": clean_text(acf.get("event_price_type")) or None,
        "free": free_flag(acf.get("event_price_type")),
        "ticketLink": acf.get("ticket_link") or None,
        "ticketInfo": clean_text(acf.get("ticket_info_text")) or None,
    }


# --- selftest -------------------------------------------------------------

# Trimmed from https://edinburghartfestival.com/wp-json/wp/v2/event (2026-09-25).
SAMPLE_EVENT = {
    "id": 14174,
    "slug": "megan-rudden-pamphlet-launch-and-in-conversation-with-helen-charman",
    "link": "https://edinburghartfestival.com/event/megan-rudden-pamphlet-launch-and-in-conversation-with-helen-charman/",
    "title": {"rendered": "Megan Rudden Pamphlet launch &#038; talk"},
    "content": {"rendered": "\n<p>This event marks the launch&nbsp;of a new pamphlet.</p>\n"},
    "event-tag": [634, 158],
    "event-type": [569],
    "yoast_head_json": {"og_image": [{"url": "https://edinburghartfestival.com/wp-content/uploads/2026/07/x.jpg"}]},
    "acf": {
        "event_format": "event",
        "event_price_type": "FREE",
        "exhibition_start": "2026-08-28",
        "exhibition_end": "2026-08-28",
        "exhibition_open_dow": ["friday"],
        "exhibition_exclude_dates": [""],
        "date_info": "Fri 28 Aug",
        "full_date_info": "",
        "time_info": "2.30–4pm",
        "ticket_link": "https://www.eventbrite.co.uk/e/1996081078238",
        "ticket_info_text": "",
        "event2venue": {
            "id": 334, "slug": "edinburgh-sculpture-workshop", "post_title": "Edinburgh Sculpture Workshop",
            "type": "partner_venue", "opening_times": "Daily, 11am – 5pm",
            "latitude": "55.97868", "longitude": "-3.19077",
            "contact_address": "Bill Scott Sculpture Centre, \r\n21 Hawthornvale, \r\nEdinburgh, EH6 4JT",
            "website_url": "http://www.edinburghsculpture.org",
        },
    },
}


def selftest():
    cases = {
        "2.30–4pm": ("14:30", 90),
        "2:30pm": ("14:30", None),
        "6pm": ("18:00", None),
        "12pm": ("12:00", None),
        "8:10": (None, None),
        "9pm–1am": ("21:00", 240),
        "11am—1pm": ("11:00", 120),
        "11—1pm": ("11:00", 120),
        "5.30—6.30pm": ("17:30", 60),
        "12noon—evening": ("12:00", None),
        "10am—12noon": ("10:00", 120),
        "3—5pm ": ("15:00", 120),
        "(Doors open at 7pm) 8pm—1am ": ("20:00", 300),
        "May 2026—Aug 2027": (None, None),
        "Various times": (None, None),
        "Tues—Fri, 10.30am—6pm; Sat, 11am—2pm": (None, None),
    }
    for text, want in cases.items():
        got = parse_times(text)
        assert got == want, (text, got, want)
    assert free_flag("Drop-In, FREE") is True
    assert free_flag("TICKETED") is False
    assert free_flag("£11.55") is False
    assert free_flag("Drop-in") is None and free_flag("") is None
    assert edition_tag(2026) == "festival2026"

    rec = event_record(SAMPLE_EVENT, {634: "festival2026", 158: "free"}, {569: ("talk", "Talk")})
    assert rec["title"] == "Megan Rudden Pamphlet launch & talk", rec["title"]
    assert rec["types"] == ["talk"] and rec["tags"] == ["festival2026", "free"]
    assert (rec["start"], rec["durationMin"], rec["free"]) == ("14:30", 90, True)
    assert rec["excludeDates"] == [] and rec["venue"] == 334
    assert rec["description"] == "This event marks the launch of a new pamphlet."
    venue = venue_record(SAMPLE_EVENT["acf"]["event2venue"])
    assert venue["address"] == "Bill Scott Sculpture Centre, 21 Hawthornvale, Edinburgh, EH6 4JT"
    assert (venue["lat"], venue["lng"]) == (55.97868, -3.19077)
    assert venue["openingTimes"] == "Daily, 11am – 5pm"
    assert venue_record({"id": 1, "post_title": "X", "latitude": ""})["lat"] is None
    print("edinburgh-art-festival parse selftest: ok")


if __name__ == "__main__":
    import sys

    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
