"""Pure transforms turning comedy-festival.co.il's markup into planner records.

No network and no filesystem: `fetch.py` does the talking to the world and hands
the bytes here, which is what lets `--selftest` prove the whole Hebrew-parsing
surface offline. Every string that reaches these functions is Hebrew, so the
module is UTF-8 end to end and never touches `.encode('ascii')`.

What the site actually carries, and where, is the scrape's map:

  * the WP REST API (`wp/v2/events`, `wp/v2/dates`, the three taxonomies) gives
    identity — titles, slugs, categories, which performance belongs to which
    venue, and which events are this year's;
  * date, start time, ticket URL, street address and running time are NOT in
    REST — JetEngine renders them into each event's own page, so they are read
    out of that HTML here;
  * there is no price anywhere on the festival site (ticketing hands off to
    smarticket.co.il / eventer.co.il), so no record carries one.
"""

import html as _html
import re
import unicodedata
import urllib.parse
from datetime import date

# --- Hebrew vocabulary ----------------------------------------------------

# Python's weekday(): Monday is 0, Sunday is 6. The festival runs Sun-Thu, but
# the whole week is listed so a future edition that adds a Friday still parses.
HEBREW_WEEKDAYS = {
    "ראשון": 6,
    "שני": 0,
    "שלישי": 1,
    "רביעי": 2,
    "חמישי": 3,
    "שישי": 4,
    "שבת": 5,
}

# Running time is written either as a plain minute count ("105 דקות") or in
# words ("שעה ורבע"). The word forms are a closed set on this site; anything
# outside it is left unknown rather than guessed, because a duration is what the
# scheduler uses to decide two shows don't clash.
HEBREW_DURATIONS = {
    "שעה": 60,
    "שעה ורבע": 75,
    "שעה וחצי": 90,
    "שעה ושלושת רבעי": 105,
    "שעתיים": 120,
    "שעתיים וחצי": 150,
}

# The two button labels the site puts on a performance. The free one is what
# tells a free event from a ticketed one — there is no free flag in the data.
FREE_TICKET_LABELS = {"להרשמה בחינם"}

DURATION_PREFIX = "אורך המופע:"


def clean_text(raw):
    """Un-escape entities, strip tags, and collapse whitespace to single spaces.

    Also folds the Unicode bidi control characters some WordPress editors leave
    in RTL copy: they are invisible, they survive a naive `strip()`, and they
    make two otherwise-equal venue names compare unequal.
    """
    if raw is None:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    text = _html.unescape(text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Cf")
    return re.sub(r"\s+", " ", text).strip()


def parse_day_month(text):
    """("יום ראשון | 18.10") -> (weekday 0-6 or None, day, month), or None."""
    text = clean_text(text)
    m = re.search(r"(\d{1,2})\.(\d{1,2})", text)
    if not m:
        return None
    weekday = None
    # The day name is written either before the date ("יום ראשון | 18.10") or
    # after it ("22.10 חמישי"), so it is matched as a free-standing word rather
    # than by position. Python's \b is Unicode-aware, so it fences Hebrew too.
    for word, index in HEBREW_WEEKDAYS.items():
        if re.search(r"\b" + word + r"\b", text):
            weekday = index
            break
    return weekday, int(m.group(1)), int(m.group(2))


def parse_time(text):
    """("| 20:30") -> "20:30". Returns None when no HH:MM is present."""
    m = re.search(r"(\d{1,2}):(\d{2})", clean_text(text))
    if not m:
        return None
    hour, minute = int(m.group(1)), int(m.group(2))
    if hour > 23 or minute > 59:
        return None
    return "%02d:%02d" % (hour, minute)


def parse_duration_minutes(text):
    """("אורך המופע: שעה ורבע") -> 75. None when absent or not understood.

    Unknown stays None rather than collapsing to a zero or a default: the
    scheduler reads a duration to decide whether two shows overlap, and a
    fabricated one would silently invent a clash or hide one.
    """
    text = clean_text(text)
    if DURATION_PREFIX in text:
        text = text.split(DURATION_PREFIX, 1)[1].strip()
    m = re.match(r"^(\d{1,3})\s*דקות?$", text)
    if m:
        return int(m.group(1))
    return HEBREW_DURATIONS.get(text)


def resolve_year(day, month, weekday, around):
    """Pin a DD.MM with no year, using the weekday the site prints beside it.

    The listing writes "יום ראשון | 18.10" — the day name is the only thing on
    the page that distinguishes one year's 18 October from another's, and it
    disambiguates uniquely within any five-year span. `around` is the year the
    scrape is filing under (the festival's `event-year` term), so the search
    starts there and only widens if the weekday disagrees.
    """
    candidates = [around, around + 1, around - 1, around + 2, around - 2]
    for year in candidates:
        try:
            candidate = date(year, month, day)
        except ValueError:
            continue
        if weekday is None or candidate.weekday() == weekday:
            return candidate
    return None


def venue_code(wp_slug, term_id):
    """A stable lookup key for a venue, read off WordPress's own term slug.

    WordPress percent-encodes a Hebrew slug, and the encoded form is unreadable
    in a diff while carrying no more information than the decoded one — so it
    is decoded back to Hebrew and used as-is. Hebrew has no transliteration we
    could produce honestly, and the key is only ever a lookup, never a URL.
    A slug that decodes to nothing falls back to the numeric term id.
    """
    decoded = clean_text(urllib.parse.unquote(wp_slug or ""))
    return decoded or str(term_id)


# --- the event page -------------------------------------------------------

_ITEM_RE = re.compile(
    r'<div class="jet-listing-grid__item[^"]*"[^>]*data-post-id="(\d+)"'
)
_FIELD_RE = re.compile(
    r'jet-listing-dynamic-field__content"[^>]*>(.*?)</div>', re.S
)
_BUTTON_RE = re.compile(
    r'<a class="elementor-button[^"]*"\s+href="([^"]+)"[^>]*>.*?'
    r'elementor-button-text">([^<]*)<',
    re.S,
)
_TEXT_WIDGET_RE = re.compile(
    r'data-widget_type="text-editor\.default"[^>]*>(.*?)(?=data-widget_type=|\Z)', re.S
)
_OG_IMAGE_RE = re.compile(r'<meta property="og:image" content="([^"]+)"')
# "<street> <number>, <city>" — the one shape every venue address on the site
# takes, and specific enough that no other dynamic field matches it.
_ADDRESS_RE = re.compile(r"^\S.*\s\d+[^,]*,\s*\S+")


def _grid_items(page_html):
    """Every JetEngine listing item on the page, as (post id, its own markup).

    An item's markup runs to the start of the next one — the listings nest, so
    a balanced-tag parse would need a real DOM and buys nothing here: every
    field this module reads is inside the item that opens it.
    """
    matches = list(_ITEM_RE.finditer(page_html))
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(page_html)
        yield int(match.group(1)), page_html[match.start() : end]


def page_description(page_html):
    """The event's blurb: the first text-editor widget on the page.

    The page's later text widgets are the footer's credits and the cookie
    banner, which is why this takes the first and stops.
    """
    for match in _TEXT_WIDGET_RE.finditer(page_html):
        body = match.group(1)
        stop = body.find('<div class="elementor-element')
        text = clean_text(body[:stop] if stop > 0 else body)
        if text:
            return text
    return ""


def page_image(page_html):
    match = _OG_IMAGE_RE.search(page_html)
    return match.group(1) if match else None


def page_duration_minutes(page_html):
    """Running time, which the page states once for the whole event."""
    for match in _FIELD_RE.finditer(page_html):
        text = clean_text(match.group(1))
        if text.startswith(DURATION_PREFIX):
            minutes = parse_duration_minutes(text)
            if minutes is not None:
                return minutes
    return None


def page_address(page_html, venue_names):
    """The street address the page prints beside its venue name.

    Keyed off the venue name rather than a selector: the address sits in an
    anonymous sibling field, and the name that precedes it is the only thing in
    the markup that says which of the two this is.
    """
    fields = [clean_text(m.group(1)) for m in _FIELD_RE.finditer(page_html)]
    normalized = {clean_text(name) for name in venue_names}
    for i, text in enumerate(fields[:-1]):
        if text in normalized and _ADDRESS_RE.match(fields[i + 1]):
            return fields[i + 1]
    # The site spells one venue two ways ("היכל התרבות בית העם" against the
    # taxonomy's "היכל תרבות בית העם"), so a page whose name does not match the
    # canonical one still has to yield its address: fall back to the first field
    # shaped like a street address.
    for text in fields:
        if _ADDRESS_RE.match(text):
            return text
    return None


def page_performances(page_html, date_post_ids, year):
    """The event's own performances, in page order.

    `date_post_ids` is the set of `dates` post ids from REST; the same page also
    renders a "you may also like" strip of other events, and membership of that
    set is what tells this event's performances from the neighbours'.
    """
    performances = []
    for post_id, markup in _grid_items(page_html):
        if post_id not in date_post_ids:
            continue
        fields = [clean_text(m.group(1)) for m in _FIELD_RE.finditer(markup)]
        when = next((parse_day_month(f) for f in fields if parse_day_month(f)), None)
        start = next((parse_time(f) for f in fields if parse_time(f)), None)
        if not when or not start:
            continue
        weekday, day, month = when
        on = resolve_year(day, month, weekday, year)
        if on is None:
            continue
        button = _BUTTON_RE.search(markup)
        ticket_url = button.group(1).replace("//iframe", "/iframe") if button else None
        label = clean_text(button.group(2)) if button else None
        performances.append(
            {
                "id": post_id,
                "date": on.isoformat(),
                "start": start,
                "ticketUrl": ticket_url,
                "ticketLabel": label,
                "free": label in FREE_TICKET_LABELS if label else None,
            }
        )
    performances.sort(key=lambda p: (p["date"], p["start"]))
    return performances


# --- selftest -------------------------------------------------------------

_FIXTURE_PAGE = """
<meta property="og:image" content="https://example.test/cover.webp">
<div data-widget_type="text-editor.default"><p>&#1502;&#1493;&#1508;&#1506; &#1502;&#1510;&#1495;&#1497;&#1511;.</p>
<div class="elementor-element elementor-element-x">
<div class="jet-listing-grid__item a" data-post-id="111">
  <div class="jet-listing-dynamic-field__content" > &#1497;&#1493;&#1501; &#1512;&#1488;&#1513;&#1493;&#1503; | 18.10 </div>
  <div class="jet-listing-dynamic-field__content" > | 20:00</div>
  <a class="elementor-button elementor-button-link" href="https://t.test//iframe/event/1" target="_blank">
  <span class="elementor-button-text">&#1500;&#1492;&#1512;&#1513;&#1502;&#1492; &#1489;&#1495;&#1497;&#1504;&#1501;</span></a>
</div>
<div class="jet-listing-grid__item b" data-post-id="112">
  <div class="jet-listing-dynamic-field__content" >&#1497;&#1493;&#1501; &#1513;&#1504;&#1497; | 19.10</div>
  <div class="jet-listing-dynamic-field__content" >| 22:00</div>
  <div class="jet-listing-dynamic-field__content" >&#1489;&#1505;&#1512;&#1489;&#1497;&#1492; &#1489;&#1512;</div>
  <div class="jet-listing-dynamic-field__content" >&#1489;&#1503; &#1497;&#1492;&#1493;&#1491;&#1492; 34, &#1497;&#1512;&#1493;&#1513;&#1500;&#1497;&#1501;</div>
  <div class="jet-listing-dynamic-field__content" >&#1488;&#1493;&#1512;&#1498; &#1492;&#1502;&#1493;&#1508;&#1506;: &#1513;&#1506;&#1492; &#1493;&#1512;&#1489;&#1506;</div>
  <a class="elementor-button elementor-button-link" href="https://t.test/iframe/event/2" target="_blank">
  <span class="elementor-button-text">&#1500;&#1492;&#1494;&#1502;&#1504;&#1514; &#1499;&#1512;&#1496;&#1497;&#1505;&#1497;&#1501;</span></a>
</div>
<div class="jet-listing-grid__item c" data-post-id="999">
  <div class="jet-listing-dynamic-field__content" >&#1497;&#1493;&#1501; &#1495;&#1502;&#1497;&#1513;&#1497; | 22.10</div>
  <div class="jet-listing-dynamic-field__content" >| 21:00</div>
</div>
"""


def selftest():
    """Prove the Hebrew parsing surface offline, on markup shaped like the site's."""
    bar_venue = "בסרביה בר"

    assert parse_time("| 20:30") == "20:30"
    assert parse_time("no time here") is None
    assert parse_duration_minutes("אורך המופע: 105 דקות") == 105
    assert parse_duration_minutes("אורך המופע:  70 דקות") == 70
    assert parse_duration_minutes("אורך המופע: שעה ורבע") == 75
    assert parse_duration_minutes("אורך המופע: שעה") == 60
    # Unknown must stay unknown — never a zero, never a default.
    assert parse_duration_minutes("אורך המופע: בערך") is None

    assert parse_day_month("יום ראשון | 18.10") == (6, 18, 10)
    assert parse_day_month("22.10 חמישי") == (3, 22, 10)

    # 18 October is a Sunday in 2026 and in no other year within the search.
    assert resolve_year(18, 10, 6, 2026) == date(2026, 10, 18)
    # A weekday that does not match the filing year walks to the one that does.
    assert resolve_year(18, 10, 0, 2026) == date(2027, 10, 18)
    # 29 February only exists in a leap year, and the walk must not crash on it.
    assert resolve_year(29, 2, None, 2027) == date(2028, 2, 29)

    assert page_image(_FIXTURE_PAGE) == "https://example.test/cover.webp"
    assert page_description(_FIXTURE_PAGE) == "מופע מצחיק."
    assert page_duration_minutes(_FIXTURE_PAGE) == 75
    assert page_address(_FIXTURE_PAGE, [bar_venue]) == "בן יהודה 34, ירושלים"

    performances = page_performances(_FIXTURE_PAGE, {111, 112}, 2026)
    assert [p["id"] for p in performances] == [111, 112], performances
    assert performances[0]["date"] == "2026-10-18"
    assert performances[0]["start"] == "20:00"
    # The doubled slash the site's own markup carries would 404 if shipped.
    assert performances[0]["ticketUrl"] == "https://t.test/iframe/event/1"
    assert performances[0]["free"] is True
    assert performances[1]["free"] is False

    # An unmatched venue name still yields the address on the page.
    assert page_address(_FIXTURE_PAGE, ["a name the page never prints"]) == "בן יהודה 34, ירושלים"

    assert venue_code("%d7%91%d7%a1%d7%a8%d7%91%d7%99%d7%94-%d7%91%d7%a8", 119) == "בסרביה-בר"
    assert venue_code("", 119) == "119"

    print("jerusalem parse selftest: ok")


if __name__ == "__main__":
    import sys

    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
