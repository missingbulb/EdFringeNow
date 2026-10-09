"""Pure transforms turning fringebythesea.com's show posts into raw records.

No network and no filesystem: `fetch.py` does the talking and hands the bytes
here, which is what lets `--selftest` prove the parsing offline.

Where the site carries what:

  * each show is an ordinary WP post (`wp/v2/posts`), filed under its sections
    (music, comedy, family, …) and under day categories; its content holds the
    description and the CitizenTicket "buy tickets" link;
  * date, venue, time and price are an ACF field the REST API does not expose
    (`acf` is empty); the theme renders it into the post page as one free-text
    box (`<div class="vc_acf … field_5c499a9729646">`), one fact per line, in no
    fixed order ("Tuesday 4th August 2026 | Big Top | 8.45pm – 10.45pm | £32").

The box is read line by line. The festival runs ten days whose day-of-month
numbers are all distinct (31 July, 1–9 August), so a day number alone places a
date; the box's month and year are typo-prone ("5th July" for a Wednesday that
is 5 August) and are not trusted over it. A weekday, when given, must agree.
Anything the box does not say unambiguously — a date range ("daily", "31st
July – 9th August"), several times that cannot be paired with their dates, a
start with no am/pm — leaves `sessions` empty and says why in `unresolved`.
"""

import html as _html
import re
from datetime import date, timedelta

FIELD = "field_5c499a9729646"
_BOX = re.compile(r'<div class="vc_acf[^"]*' + FIELD + r'">(.*?)</div>', re.S)
_IMAGE = re.compile(r'<img[^>]*src="([^"]+)"[^>]*class="vc_single_image-img')

WEEKDAYS = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
_DAY = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)\b", re.I)
_WEEKDAY_DAY = re.compile(r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(\d{1,2})(?:st|nd|rd|th)\b", re.I)
_RANGE = re.compile(r"\d(?:st|nd|rd|th)?\b[^0-9|]*?(?:\bto\b|[–—-])\s*(?:[a-z]+day\s+)?\d{1,2}(?:st|nd|rd|th)\b", re.I)
_MONEY = re.compile(r"£\s*\d+(?:[.,]\d+)?")
_DASH = r"(?:-|–|—|to)"
_CLOCK = re.compile(
    r"(?<![\d£.])(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)?"
    r"(?:\s*" + _DASH + r"\s*(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm))?",
    re.I,
)
_PRICE_WORDS = re.compile(r"£|\bfree\b|drop[ -]?in|donation|pay on the day|ticketed|first come|\bunder \d|\bu1\d", re.I)
# What is left of a date split across lines ("Sunday 9th | August 2026").
_DATE_TAIL = re.compile(r"^(?:(?:july|august)\s*)?(?:20\d\d)?$", re.I)
_WEEKDAY = re.compile(r"\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b", re.I)


def clean(raw):
    text = _html.unescape(re.sub(r"<[^>]+>", "", raw or ""))
    return re.sub(r"\s+", " ", text).strip()


def box_lines(page_html):
    """The details box's lines, or None when the page has no box."""
    m = _BOX.search(page_html)
    if not m:
        return None
    parts = re.split(r"<br\s*/?>|</p>|</b>\s*<b>|\|", m.group(1))
    return [line for line in (clean(p).strip(" ,") for p in parts) if line]


def page_image(page_html):
    m = _IMAGE.search(page_html)
    return m.group(1) if m else None


def edition_days(first, last):
    """{day-of-month: iso date} for the edition, or None when a number repeats."""
    lo, hi = date.fromisoformat(first), date.fromisoformat(last)
    days, d = {}, lo
    while d <= hi:
        if d.day in days:
            return None
        days[d.day] = d
        d += timedelta(days=1)
    return days


def _minutes(hour, minute, suffix):
    hour, minute = int(hour), int(minute or 0)
    if hour > 12 or minute > 59:
        return None
    if suffix == "pm" and hour != 12:
        hour += 12
    if suffix == "am" and hour == 12:
        hour = 0
    return hour * 60 + minute


def line_starts(line):
    """Session starts ("HH:MM") written on one line; None if any start is ambiguous."""
    text = _WEEKDAY_DAY.sub(" ", line)
    text = _DAY.sub(" ", text)
    text = re.sub(r"\b20\d\d\b", " ", _MONEY.sub(" ", text))
    text = re.sub(r"\(\s*\d+\s*min[^)]*\)|\d+\s*min(?:ute)?s?\b|\blast entry[^)]*", " ", text, flags=re.I)
    starts = []
    for m in _CLOCK.finditer(text):
        sh, sm, ss, eh, em, es = m.groups()
        if ss is None and es is None and sm is None:
            continue  # a bare number is not a clock
        ss, es = (ss or "").lower() or None, (es or "").lower() or None
        end = _minutes(eh, em, es) if eh else None
        if ss is None:
            if es is None:
                return None
            pm = _minutes(sh, sm, "pm")
            start = pm if es == "pm" and pm is not None and end is not None and pm <= end else _minutes(sh, sm, "am")
        else:
            start = _minutes(sh, sm, ss)
            if ss == "pm" and es == "pm" and end is not None and start > end:
                start = _minutes(sh, sm, "am")  # "10.15pm-12.00pm": the start's pm is a slip
        if start is None:
            return None
        starts.append("%02d:%02d" % divmod(start, 60))
    return starts


def line_dates(line, days):
    """Dates a line names, by day number; (dates, problem)."""
    weekday_of = {int(n): w.lower() for w, n in _WEEKDAY_DAY.findall(line)}
    out = []
    for n in (int(x) for x in _DAY.findall(line)):
        if n not in days:
            return None, "day %d is outside the edition" % n
        d = days[n]
        if n in weekday_of and WEEKDAYS[weekday_of[n]] != d.weekday():
            return None, "%s %d is not %s" % (weekday_of[n], n, d.isoformat())
        out.append(d.isoformat())
    return out, None


def read_box(lines, first, last):
    """The details box -> {dates, sessions, venue, price, unresolved}."""
    days = edition_days(first, last)
    if days is None:
        raise ValueError("edition %s..%s repeats a day number" % (first, last))
    result = {"dates": [], "sessions": [], "venue": None, "price": None, "unresolved": None}
    venue_lines, price_lines = [], []
    pending, loose, paired, problem = [], [], [], None
    for line in lines:
        lower = line.lower()
        has_day = bool(_DAY.search(line))
        if has_day and ("daily" in lower or _RANGE.search(line)):
            problem = problem or "runs across several days (%s)" % line
        if "daily" in lower:
            problem = problem or "daily (%s)" % line
        dates, why = line_dates(line, days) if has_day else ([], None)
        if why:
            problem = problem or why
            dates = []
        starts = line_starts(line)
        timed = starts is None or bool(starts)
        if starts is None:
            problem = problem or "ambiguous time (%s)" % line
            starts = []
        if starts and not has_day and _WEEKDAY.search(line):
            problem = problem or "times given per weekday (%s)" % line
        result["dates"].extend(d for d in dates if d not in result["dates"])
        if dates and starts:
            paired.extend((d, s) for d in dates for s in starts)
        elif dates:
            if pending:
                loose.append(("dates", pending))
            pending = dates
        elif starts:
            if pending:
                paired.extend((d, s) for d in pending for s in starts)
                pending = []
            else:
                loose.append(("starts", starts))
        elif _PRICE_WORDS.search(line):
            price_lines.append(line)
        elif not (has_day or timed or line.startswith("(") or _DATE_TAIL.match(line)):
            venue_lines.append(line)
    if pending:
        loose.append(("dates", pending))
    loose_dates = [d for kind, v in loose if kind == "dates" for d in v]
    loose_starts = [s for kind, v in loose if kind == "starts" for s in v]
    if loose_starts and not paired:
        # One list of dates and one list of times: a product only when one side is single.
        dates = loose_dates or [d for d, _s in paired]
        if len(dates) == 1 or len(set(loose_starts)) == 1:
            paired = [(d, s) for d in dates for s in dict.fromkeys(loose_starts)]
        else:
            problem = problem or "%d dates and %d times that cannot be paired" % (len(dates), len(loose_starts))
    elif loose_starts:
        problem = problem or "times not tied to a date"
    if not result["dates"]:
        problem = problem or "no date"
    elif not paired:
        problem = problem or "no start time"
    result["venue"] = ", ".join(venue_lines) or None
    result["price"] = " / ".join(price_lines) or None
    if problem:
        result["unresolved"] = problem
    else:
        result["sessions"] = [{"date": d, "start": s} for d, s in sorted(set(paired))]
    return result


# The festival's own names for its covered venues inside the Lodge Grounds, as
# the boxes write them (after dropping "The " and ", Lodge Grounds"): the site
# says most events are in "covered venues within The Lodge Grounds", and
# several boxes spell each of these as "<name>, Lodge Grounds".
LODGE_STAGES = {
    "big top": ("big-top", "Big Top"),
    "dome": ("dome", "The Dome"),
    "times lounge": ("times-lounge", "The Times Lounge"),
    "famous grouse lodge stage": ("lodge-stage", "The Famous Grouse Lodge Stage"),
    "famous grouse lodge": ("lodge-stage", "The Famous Grouse Lodge Stage"),
    "lodge stage": ("lodge-stage", "The Famous Grouse Lodge Stage"),
    "lodge": ("lodge-stage", "The Famous Grouse Lodge Stage"),
    "kids zone": ("kids-zone", "Kids Zone"),
    "thespace": ("thespace", "theSpace"),
    "vip lounge": ("vip-lounge", "The VIP Lounge"),
    "vip bar": ("vip-bar", "The VIP Bar"),
    "vip tent": ("vip-tent", "The VIP Tent"),
    "fbts box office": ("box-office", "FBTS Box Office"),
}
LODGE_GROUNDS = "lodge-grounds"
SEABIRD = "scottish-seabird-centre"
_POSTCODE = re.compile(r"\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b")
_MEET = re.compile(r"^(?:meet(?:ing point)?\s*(?:at|outside)?\s*:?\s*)", re.I)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower().replace("’", "").replace("'", "")).strip("-")


def place(venue_text):
    """A box's venue text -> {venue, name, room, roomName, query}: which place it is.

    `query` is what to geocode (None for the Lodge Grounds, whose address comes
    from the site's venue page, and for the Seabird Centre's own rooms, which
    share its point).
    """
    if not venue_text:
        return None
    text = _MEET.sub("", venue_text.strip())
    key = re.sub(r",?\s*lodge grounds$", "", text.lower()).strip(" ,")
    key = re.sub(r"^the\s+", "", key)
    if key in LODGE_STAGES:
        room, name = LODGE_STAGES[key]
        return {"venue": LODGE_GROUNDS, "name": "Lodge Grounds", "room": room, "roomName": name, "query": None}
    if "lodge grounds" in text.lower():
        return {"venue": LODGE_GROUNDS, "name": "Lodge Grounds", "room": None, "roomName": None, "query": None}
    if "seabird centre" in text.lower():
        head = text.split(",")[0].strip()
        room = None if "seabird centre" in head.lower() else head
        return {"venue": SEABIRD, "name": "Scottish Seabird Centre", "room": slug(room) if room else None,
                "roomName": room, "query": "Scottish Seabird Centre, The Harbour, North Berwick EH39 4SS"}
    head = re.sub(r"\s+", " ", text.split(",")[0]).strip(" “”\"")
    query = re.sub(r",(?=\S)", ", ", text)
    if not _POSTCODE.search(query) and "north berwick" not in query.lower():
        query += ", North Berwick"
    return {"venue": slug(head), "name": head, "room": None, "roomName": None, "query": query}


def free_flag(price):
    text = (price or "").lower()
    if not text:
        return None
    if "£" in text:
        return False if "free" not in text else None
    if "free" in text and "pay" not in text:
        return True
    return None


def main_venue_address(page_html):
    """The Lodge Grounds' street address, from the site's venues page."""
    m = re.search(r"Lodge Grounds,\s*([^<.]*?\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b", _html.unescape(page_html or ""))
    return m.group(1).strip() if m else None


def ticket_link(content_html):
    m = re.search(r'href="(https?://[^"]*citizenticket[^"]*)"', content_html or "")
    return _html.unescape(m.group(1)) if m else None


def description(content_html):
    text = re.sub(r"\[/?vc_[^\]]*\]", " ", _html.unescape(content_html or ""))
    text = re.sub(r"<br\s*/?>|</p>", "\n", text)
    lines = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", l)).strip() for l in text.split("\n")]
    return "\n".join(l for l in lines if l) or None


# --- selftest -------------------------------------------------------------

# Boxes copied from fringebythesea.com show pages (2026-09-25).
RUSSELL_HOWARD = (
    '<div class="vc_acf vc_txt_align_left field_5c499a9729646"><p><b>Tuesday 4th August 2026<br />\n'
    "</b><b><strong>Big Top</strong><br />\n</b><strong>8.45pm &#8211; 10.45pm</strong></p>\n"
    "<p><b>£32</b></p>\n</div>"
)
STORY_PLAY = (
    '<div class="vc_acf vc_txt_align_left field_5c499a9729646"><p><b>Tuesday 4th August &#8211; 2.30pm-4.30pm<br />\n'
    "Wednesday 5th August &#8211; 2.30pm-4.30pm<br />\nThursday 6th August &#8211; 2.30pm-4.30pm<br />\n"
    "</b><b>Kids Zone<br />\n</b><b>Drop In / Free</b></p>\n</div>"
)


def selftest():
    first, last = "2026-07-31", "2026-08-09"
    r = read_box(box_lines(RUSSELL_HOWARD), first, last)
    assert r == {"dates": ["2026-08-04"], "sessions": [{"date": "2026-08-04", "start": "20:45"}],
                 "venue": "Big Top", "price": "£32", "unresolved": None}, r
    r = read_box(box_lines(STORY_PLAY), first, last)
    assert [s["date"] for s in r["sessions"]] == ["2026-08-04", "2026-08-05", "2026-08-06"], r
    assert {s["start"] for s in r["sessions"]} == {"14:30"} and r["venue"] == "Kids Zone"
    assert free_flag(r["price"]) is True

    def box(*lines):
        return read_box(list(lines), first, last)

    # a weekday-checked day number wins over a mistyped month
    assert box("Wednesday 5th July 2026", "Lodge Grounds", "7.30pm")["sessions"] == [{"date": "2026-08-05", "start": "19:30"}]
    assert box("Wednesday 4th August 2026", "The Dome", "7pm")["unresolved"].startswith("wednesday 4")
    # lists of days with one time; one day with several times
    r = box("Tuesday 4th and Thursday 6th August 2026", "Kids Zone", "10.30am-11am", "Free / ticketed")
    assert r["sessions"] == [{"date": "2026-08-04", "start": "10:30"}, {"date": "2026-08-06", "start": "10:30"}], r
    r = box("Friday 7th August 2026", "The Times Lounge", "12pm & 3pm", "£9")
    assert [s["start"] for s in r["sessions"]] == ["12:00", "15:00"], r
    assert box("Friday 7th August 2026", "Big Top", "8-11pm", "£55 / £30 U16")["sessions"][0]["start"] == "20:00"
    assert box("Tuesday 4th August 2026", "The Times Lounge", "10.15pm-12.00pm", "£22")["sessions"][0]["start"] == "10:15"
    # dates and times on alternate lines pair in order
    r = box("Sunday 2nd August 2026", "2pm-4pm", "Saturday 8th August 2026", "10.30am-12.30am", "Kids Zone")
    assert r["sessions"] == [{"date": "2026-08-02", "start": "14:00"}, {"date": "2026-08-08", "start": "10:30"}], r
    # what stays unresolved
    assert box("Friday 31st July – Sunday 9th August 2026", "The Nest", "10am-11pm")["unresolved"].startswith("runs")
    assert box("Daily from Friday 31st July 2026", "Drambuie Stand", "5.45pm")["unresolved"].startswith("runs") or \
        box("Daily from Friday 31st July 2026", "Drambuie Stand", "5.45pm")["unresolved"].startswith("daily")
    assert box("Friday 7th August 2026", "The Times Lounge", "10.15 & 1.30pm")["unresolved"].startswith("ambiguous")
    assert box("£35")["unresolved"] == "no date"
    assert box("Saturday 1st August – 23rd August 2026", "Hope Rooms")["unresolved"]
    assert box("Saturday 1st August – 23rd August 2026", "Hope Rooms")["venue"] == "Hope Rooms"
    r = box("Friday 31st July, Monday 3rd August, Sunday 9th August 2026", "The Kids Zone",
            "Friday and Monday 2pm-4pm", "Sunday 10am-12pm", "FREE/DROP IN")
    assert r["unresolved"].startswith("times given per weekday") and not r["sessions"], r
    r = box("Sunday 9th", "August 2026", "The Dome", "4.15pm \u2013 5.15pm", "£12/£5 (Under 25)")
    assert (r["venue"], r["sessions"]) == ("The Dome", [{"date": "2026-08-09", "start": "16:15"}]), r
    assert box("Sunday 9th August 2026", "Big Top", "7pm", "£22 / £9", "Under 16s")["venue"] == "Big Top"

    assert free_flag("FREE/DROP-IN") is True and free_flag("£12") is False
    assert free_flag("DROP-IN/PAY ON THE DAY") is None and free_flag(None) is None
    assert ticket_link('<a class="_ps2id" href="https://www.citizenticket.com/events/fringe-by-the-sea-2026/x/">') \
        == "https://www.citizenticket.com/events/fringe-by-the-sea-2026/x/"
    assert description("[vc_row][vc_column_text ]</p>\n<p>One of the UK&#8217;s best.</p>\n[/vc_column_text]") \
        == "One of the UK’s best."
    assert box_lines("<html></html>") is None
    assert place("Big Top, Lodge Grounds")["room"] == "big-top" and place("The Famous Grouse Lodge")["room"] == "lodge-stage"
    assert place("Lodge Grounds, Quality Street Gates") == {
        "venue": "lodge-grounds", "name": "Lodge Grounds", "room": None, "roomName": None, "query": None}
    seabird = place("Learning Hub, Scottish Seabird Centre, The Harbour, Harbour Terrace, North Berwick EH39 4SS")
    assert (seabird["venue"], seabird["room"]) == ("scottish-seabird-centre", "learning-hub")
    assert place("Meet outside The Scottish Seabird Centre")["room"] is None
    hotel = place("Meet outside The Marine Hotel,18 Cromwell Rd North Berwick EH39 4LZ")
    assert (hotel["venue"], hotel["query"]) == ("the-marine-hotel", "The Marine Hotel, 18 Cromwell Rd North Berwick EH39 4LZ")
    assert place("Over the Pond, Archerfield Walled Garden")["query"] == "Over the Pond, Archerfield Walled Garden, North Berwick"
    assert main_venue_address("<p>Lodge Grounds, 2C East Rd, North Berwick EH39 4HN.</p>") == "2C East Rd, North Berwick EH39 4HN"
    print("fringe-by-the-sea parse selftest: ok")


if __name__ == "__main__":
    import sys

    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
