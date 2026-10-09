#!/usr/bin/env python3
"""Pure transforms turning Confederation House's Oud Festival pages into raw records.

The festival's programme is one listing page, `/page_18014` (Hebrew), holding a
card per concert:

    <div class="event ..."><a href="page_NNNNN"><div class="image"><img src="Media/Uploads/..jpg">
      <div class="desc">heading, <br>-separated</div>
      <div class="datetime">חמישי, 5.11.26 | 21:00</div><div class="location">hall, venue</div>

and each card links to the concert's own page, whose `<h1>` repeats the heading,
whose slider carries a picture (`data-src`), whose `editor_text` is the blurb
(with performers, a photo credit and a festival-dates footer), and whose
`properties` block prints the date, time, location, "מחיר כרטיס: 90 ש"ח" and a
ticket link ("לרכישת כרטיסים באתר בימות").

Everything stays in the site's words; the converter decides what a location is.
No network and no files, so `--selftest` proves the whole surface offline
against `samples/`, trimmed from the pages as fetched on 2026-09-27.
"""

import html
import os
import re
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = "https://www.confederationhouse.org"

CARD_RE = re.compile(r'<div class="event\b[^"]*">(.*?)</a><a class="btn"', re.S)
PAGE_RE = re.compile(r'href="page_(\d+)"')
IMG_RE = re.compile(r'<img[^>]*\bsrc="([^"]+)"')
DESC_RE = re.compile(r'<div class="desc">(.*?)</div>', re.S)
DATETIME_RE = re.compile(r'<div class="datetime">(.*?)</div>', re.S)
LOCATION_RE = re.compile(r'<div class="location">(.*?)</div>', re.S)
# "חמישי, 5.11.26 | 21:00" / "מוצ"ש, 7.11.26" — a weekday, then d.m.yy.
DATE_RE = re.compile(r"(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})\b")
TIME_RE = re.compile(r"\b(\d{1,2}):(\d{2})\b")
H1_RE = re.compile(r"<h1>(.*?)</h1>", re.S)
SLIDE_RE = re.compile(r'class="sp-image"[^>]*\bdata-src="([^"]+)"')
BLURB_RE = re.compile(r"class='editor_text'>(.*?)</div>", re.S)
PROPS_RE = re.compile(r'<div class="properties">(.*?)</div>', re.S)
PROP_RE = re.compile(r'<b>\s*([^<:]+?)\s*:\s*</b></span><span[^>]*>(.*?)</span>', re.S)
TICKET_RE = re.compile(r'<a id="external-link" href="([^"]+)"')
# The page's own heading line for the festival, which every card and page leads with.
FESTIVAL_LINE_RE = re.compile(r"^פסטיבל העוד(\s+הבינלאומי)?\s*[-–]?\s*")
# The blurb's footer: "פסטיבל העוד הבינלאומי 2026 / 12-5 בנובמבר 2026".
YEAR_RE = re.compile(r"פסטיבל העוד הבינלאומי\s+(\d{4})")
CREDIT_RE = re.compile(r"(^|\s)צילו(ם|מים)\s*:")
SHEKELS_RE = re.compile(r"(\d+(?:\.\d+)?)")


def text(fragment):
    """Markup -> one line of plain text, whitespace collapsed."""
    # Inline tags sit inside words ("נ<strong>אבע'"), so they vanish; any other
    # tag separates.
    fragment = re.sub(r"</?(strong|b|em|i|u|span|a)\b[^>]*>", "", fragment)
    fragment = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", html.unescape(fragment).replace("\xa0", " ")).strip()


def lines(fragment):
    """Markup split on <br> -> its non-empty plain-text lines."""
    return [t for t in (text(part) for part in re.split(r"<br\s*/?>", fragment)) if t]


def absolute(src):
    """A site-relative upload path -> an absolute, percent-encoded URL."""
    src = src.strip()
    if src.startswith("http"):
        return src
    return SITE + "/" + urllib.parse.quote(src.lstrip("/"))


def iso_date(value):
    """"שישי, 6.11.26" -> "2026-11-06"; None when no d.m.yy is printed."""
    match = DATE_RE.search(value or "")
    if not match:
        return None
    day, month, year = (int(g) for g in match.groups())
    if year < 100:
        year += 2000
    return "%04d-%02d-%02d" % (year, month, day)


def hhmm(value):
    match = TIME_RE.search(value or "")
    return "%02d:%s" % (int(match.group(1)), match.group(2)) if match else None


def title_lines(heading):
    """A heading's lines with the leading festival name taken off.

    "פסטיבל העוד - מופע פתיחה" keeps "מופע פתיחה"; a line that is only the
    festival's name disappears.
    """
    out = []
    for i, line in enumerate(heading):
        if i == 0:
            line = FESTIVAL_LINE_RE.sub("", line).strip(" -–")
        if line:
            out.append(line)
    return out


def listing(page):
    """The listing page -> one card per concert, in the page's order."""
    cards = []
    for block in CARD_RE.findall(page):
        page_id = PAGE_RE.search(block)
        desc = DESC_RE.search(block)
        when = DATETIME_RE.search(block)
        where = LOCATION_RE.search(block)
        img = IMG_RE.search(block)
        heading = lines(desc.group(1)) if desc else []
        stamp = text(when.group(1)) if when else ""
        cards.append({
            "pageId": int(page_id.group(1)) if page_id else None,
            "heading": heading,
            "titleLines": title_lines(heading),
            "datetime": stamp,
            "date": iso_date(stamp),
            "start": hhmm(stamp.split("|", 1)[1] if "|" in stamp else stamp),
            "location": text(where.group(1)) if where else None,
            "image": absolute(img.group(1)) if img else None,
        })
    return cards


def price(value):
    """"90 ש"ח" -> (90, 90); "90-120 ש"ח" -> (90, 120); nothing printed -> (None, None)."""
    amounts = [float(a) for a in SHEKELS_RE.findall(value or "")]
    if not amounts:
        return None, None
    lo, hi = min(amounts), max(amounts)
    return (int(lo) if lo.is_integer() else lo), (int(hi) if hi.is_integer() else hi)


def blurb(fragment):
    """The editor_text -> its paragraphs as text, less photo credits, the
    festival-dates footer and embedded pictures."""
    kept = []
    for para in re.findall(r"<p>(.*?)</p>", fragment, re.S):
        body = "\n".join(line for line in lines(para) if not CREDIT_RE.search(line))
        if not body or YEAR_RE.search(body):
            continue
        kept.append(body)
    return "\n\n".join(kept) or None


def detail(page):
    """A concert's own page -> its heading, picture, blurb and printed properties."""
    h1 = H1_RE.search(page)
    heading = lines(h1.group(1)) if h1 else []
    props = {}
    block = PROPS_RE.search(page)
    if block:
        for label, value in PROP_RE.findall(block.group(1)):
            props[text(label)] = text(value)
    ticket = TICKET_RE.search(page)
    slide = SLIDE_RE.search(page)
    body = BLURB_RE.search(page)
    year = YEAR_RE.search(text(body.group(1))) if body else None
    lo, hi = price(props.get("מחיר כרטיס"))
    return {
        "heading": heading,
        "titleLines": title_lines(heading),
        "date": iso_date(props.get("תאריך")),
        "start": hhmm(props.get("שעה")),
        "location": props.get("מיקום"),
        "priceText": props.get("מחיר כרטיס"),
        "priceMin": lo,
        "priceMax": hi,
        "phone": props.get("לרכישת כרטיסים בטלפון"),
        "ticketUrl": ticket.group(1).strip() if ticket else None,
        "image": absolute(slide.group(1)) if slide else None,
        "blurb": blurb(body.group(1)) if body else None,
        "year": int(year.group(1)) if year else None,
    }


def selftest():
    with open(os.path.join(HERE, "samples", "listing.html"), encoding="utf-8") as handle:
        cards = listing(handle.read())
    assert len(cards) == 16, len(cards)
    first = cards[0]
    assert first["pageId"] == 21040 and first["date"] == "2026-11-05" and first["start"] == "21:00", first
    assert first["location"] == "אולם שרובר, תיאטרון ירושלים", first
    assert first["titleLines"][0] == "מופע פתיחה", first
    assert first["image"] == SITE + "/Media/Uploads/" + urllib.parse.quote("ארוע2_דודו_טסה_סופי.jpg"), first
    sabbath = next(c for c in cards if c["pageId"] == 21046)
    assert sabbath["date"] == "2026-11-07" and sabbath["location"] == "בית הקונפדרציה", sabbath
    khan = next(c for c in cards if c["pageId"] == 21052)
    assert khan["titleLines"] == ["עומרי מור מארח את שלמה בר"] and khan["location"] == "תיאטרון החאן", khan
    assert all(c["image"] and c["date"] and c["start"] for c in cards)

    with open(os.path.join(HERE, "samples", "page_21043.html"), encoding="utf-8") as handle:
        trio = detail(handle.read())
    assert trio["titleLines"] == ["טריו וסים עודה: הדרך לאקסטזה"], trio
    assert (trio["date"], trio["start"], trio["location"]) == ("2026-11-06", "12:00", "בית הקונפדרציה"), trio
    assert (trio["priceText"], trio["priceMin"], trio["priceMax"]) == ('90 ש"ח', 90, 90), trio
    assert trio["ticketUrl"] == "https://bit.ly/4x5XNFQ" and trio["phone"] == "6226*", trio
    assert trio["image"] == SITE + "/Media/Uploads/" + urllib.parse.quote("טריו_וסים_עודה(1).jpg"), trio
    assert trio["year"] == 2026, trio
    assert trio["blurb"].startswith("נגן העוד, המלחין והחוקר") and "צילום" not in trio["blurb"], trio["blurb"]
    assert "2026" not in trio["blurb"], trio["blurb"]
    # A bold run inside a word does not split it.
    assert "נאבע' אבו נקולא" in trio["blurb"], trio["blurb"]

    with open(os.path.join(HERE, "samples", "page_21058.html"), encoding="utf-8") as handle:
        greek = detail(handle.read())
    # This page prints no phone line; the rest is there.
    assert greek["phone"] is None and greek["priceMin"] == 180, greek
    assert greek["location"] == "אולם רבקה קראון, תיאטרון ירושלים", greek
    assert greek["titleLines"] == ["באביס צרטוס וארטי קטימה", "נשמה יוונית - מהרבטיקו ועד סמירנאיקה"], greek

    assert price(None) == (None, None) and price("90-120 ש\"ח") == (90, 120)
    assert iso_date("מוצ\"ש, 7.11.26") == "2026-11-07" and iso_date("") is None
    assert title_lines(["פסטיבל העוד הבינלאומי", "מופע סיום", "טיפקס"]) == ["מופע סיום", "טיפקס"]
    print("confederation-house parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        sys.exit("usage: parse.py --selftest")
