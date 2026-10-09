"""Pure transforms turning edinburghdeaffestival.com's Modern Events Calendar data
into raw records.

No network and no filesystem: `fetch.py` does the talking and hands the bytes
here, which is what lets `--selftest` prove the parsing offline.

Where the site carries what:

  * WP REST (`wp/v2/mec-events`, `wp/v2/mec_category`) gives identity — title,
    slug, link, categories, the description, and the "Book now" button's link
    (Humanitix, Eventbrite, edfringe.com) inside the content; the content's
    "Duration:" and "Price:" lines are free text and are kept as written;
  * the plugin's own REST route (`mec/v1/events`) answers `[]`, and its iCal
    feed carries only upcoming events, so the occurrence — date range, venue
    name and address — is read from the schema.org Event JSON-LD MEC prints on
    each event page, and the clock time from the page's "Time" box
    ("13:00 - 14:00", "22:00", "All Day").
"""

import html as _html
import json
import re

_LD = re.compile(r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>', re.S)
_TIME_BOX = re.compile(r'mec-single-event-time">.*?<abbr class="mec-events-abbr">([^<]*)</abbr>', re.S)
_HHMM = re.compile(r"^(\d{1,2}):(\d{2})(?:\s*-\s*(\d{1,2}):(\d{2}))?$")


def clean_text(raw):
    if raw is None:
        return ""
    text = re.sub(r"<br\s*/?>|</p>", "\n", raw)
    text = re.sub(r"<[^>]+>", " ", text)
    text = _html.unescape(text)
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def one_line(raw):
    return re.sub(r"\s+", " ", clean_text(raw)).strip()


def content_field(content_html, label):
    """The text after a bold "<label>:" in the content, to the end of its line."""
    for line in clean_text(content_html).split("\n"):
        if line.lower().startswith(label.lower() + ":"):
            return line[len(label) + 1:].strip() or None
    return None


def booking_link(content_html):
    m = re.search(r'<a [^>]*class="button"[^>]*href="(https?://[^"]+)"', content_html or "")
    if not m:
        m = re.search(r'<a [^>]*href="(https?://[^"]+)"[^>]*class="button"', content_html or "")
    return _html.unescape(m.group(1)) if m else None


def blurb(content_html):
    """The description without the Duration/Age/Price/Accessibility header lines."""
    keep = []
    for line in clean_text(content_html).split("\n"):
        head = line.split(":", 1)[0].lower()
        if ":" in line and head in ("duration", "age suitability", "price", "accessibility"):
            continue
        if line.lower() in ("accessibility:", "book now"):
            continue
        keep.append(line)
    return "\n".join(keep) or None


def free_flag(price_text):
    """The Price line -> True (plainly free), False (a charge, incl. pay-what-you-can) or None."""
    text = (price_text or "").strip().lower()
    if text == "free":
        return True
    if text.startswith(("£", "from £", "pay what", "pay as")):
        return False
    return None


def parse_time_box(text):
    """"13:00 - 14:00" -> ("13:00", 60); "22:00" -> ("22:00", None); "All Day" -> (None, None)."""
    m = _HHMM.match(one_line(text))
    if not m:
        return None, None
    sh, sm, eh, em = m.groups()
    start = int(sh) * 60 + int(sm)
    if start >= 24 * 60:
        return None, None
    duration = None
    if eh is not None:
        duration = (int(eh) * 60 + int(em) - start) % (24 * 60) or None
    return "%02d:%02d" % divmod(start, 60), duration


def page_occurrence(page_html):
    """An event page -> {dateStart, dateEnd, timeText, start, durationMin, venue, address}, or None."""
    m = _LD.search(page_html)
    if not m:
        return None
    ld = json.loads(m.group(1), strict=False)
    location = ld.get("location") or {}
    box = _TIME_BOX.search(page_html)
    time_text = one_line(box.group(1)) if box else None
    start, duration = parse_time_box(time_text or "")
    return {
        "dateStart": ld.get("startDate") or None,
        "dateEnd": ld.get("endDate") or None,
        "timeText": time_text,
        "start": start,
        "durationMin": duration,
        "venue": one_line(location.get("name")) or None,
        "address": one_line(location.get("address")) or None,
        "image": ld.get("image") or None,
    }


def event_record(post, category_slugs, occurrence):
    content = post["content"]["rendered"]
    return {
        "id": post["id"],
        "slug": post["slug"],
        "title": one_line(post["title"]["rendered"]),
        "url": post["link"],
        "categories": [category_slugs[c] for c in post.get("mec_category", []) if c in category_slugs],
        "description": blurb(content),
        "durationText": content_field(content, "Duration"),
        "ageText": content_field(content, "Age Suitability"),
        "priceText": content_field(content, "Price"),
        "free": free_flag(content_field(content, "Price")),
        "bookingUrl": booking_link(content),
        **occurrence,
    }


# --- selftest -------------------------------------------------------------

# Trimmed from https://edinburghdeaffestival.com/mec-events/a-wolf-shall-devour-the-sun/ (2026-09-25).
SAMPLE_PAGE = """
<div class="mec-single-event-date"><dl><dd><abbr class="mec-events-abbr"><span class="mec-start-date-label">09-Aug-2026</span></abbr></dd></dl></div>
<div class="mec-single-event-time">
  <i class="mec-sl-clock"></i>  <h3 class="mec-time">Time</h3>
  <i class="mec-time-comment"></i>
  <dl>
    <dd><abbr class="mec-events-abbr">13:00 - 14:00</abbr></dd>
  </dl>
</div>
<script type="application/ld+json">
{
    "@context": "http://schema.org",
    "@type": "Event",
    "startDate": "2026-08-09",
    "endDate": "2026-08-09",
    "location":
    {
        "@type": "Place",
                            "name": "Scottish Storytelling Centre",
        "image": "",
        "address": "43-45 High St, Edinburgh EH1 1SR"
    },
    "description": "Duration: 1 hour  Age Suitability: 8+	Price: £13.50",
    "image": "https://edinburghdeaffestival.com/wp-content/uploads/2026/06/wolf.jpg",
    "name": "A Wolf Shall Devour the Sun"
}
</script>
"""

# Trimmed from https://edinburghdeaffestival.com/wp-json/wp/v2/mec-events (2026-09-25).
SAMPLE_POST = {
    "id": 3403,
    "slug": "a-wolf-shall-devour-the-sun",
    "link": "https://edinburghdeaffestival.com/mec-events/a-wolf-shall-devour-the-sun/",
    "title": {"rendered": "A Wolf Shall Devour the Sun"},
    "mec_category": [79, 62],
    "content": {
        "rendered": "<p><strong>Duration: </strong>1 hour<br />\n<strong>Age Suitability: </strong>8+<br />\n"
        "<strong>Price: </strong>£13.50</p>\n<p><strong>Accessibility:</strong><br />\n"
        "<img src=\"/wp-content/uploads/2022/06/BSL-Blue-Yellow.svg\" alt=\"\" /></p>\n"
        "<p>Respected by ancient cultures&#8230;</p>\n"
        "<p><a class=\"button\" href=\"https://events.humanitix.com/a-wolf-shall-devour-the-sun\" "
        "target=\"_blank\" rel=\"noopener\">Book now</a></p>\n"
    },
}


def selftest():
    assert parse_time_box("13:00 - 14:00") == ("13:00", 60)
    assert parse_time_box("22:00") == ("22:00", None)
    assert parse_time_box("All Day") == (None, None)
    assert parse_time_box("23:30 - 01:00") == ("23:30", 90)
    assert free_flag("Free") is True
    assert free_flag("Free or Pay what you can") is None
    assert free_flag("Pay what you can") is False and free_flag("£13.50") is False
    assert free_flag("See website for details") is None and free_flag(None) is None

    occ = page_occurrence(SAMPLE_PAGE)
    assert occ == {
        "dateStart": "2026-08-09", "dateEnd": "2026-08-09", "timeText": "13:00 - 14:00",
        "start": "13:00", "durationMin": 60, "venue": "Scottish Storytelling Centre",
        "address": "43-45 High St, Edinburgh EH1 1SR",
        "image": "https://edinburghdeaffestival.com/wp-content/uploads/2026/06/wolf.jpg",
    }, occ
    assert page_occurrence("<html></html>") is None

    rec = event_record(SAMPLE_POST, {79: "storytelling", 62: "theatre"}, occ)
    assert rec["categories"] == ["storytelling", "theatre"]
    assert (rec["durationText"], rec["ageText"], rec["priceText"], rec["free"]) == ("1 hour", "8+", "£13.50", False)
    assert rec["bookingUrl"] == "https://events.humanitix.com/a-wolf-shall-devour-the-sun"
    assert rec["description"] == "Respected by ancient cultures…", rec["description"]
    print("edinburgh-deaf-festival parse selftest: ok")


if __name__ == "__main__":
    import sys

    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
