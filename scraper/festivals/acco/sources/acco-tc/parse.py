"""Pure transforms turning the Acco Theatre Centre's festival page into raw lines.

`https://www.acco-tc.com/shows/accofestival/` is one hand-built Elementor page:
a heading naming the year ("פסטיבל תיאטרון עכו 2026"), then per day a heading
("27.9 ראשון") followed by one line per performance,

    HH:MM <title> – <label> [| <label> ...]

each ticketed line linking to its own eventer.co.il page. The labels are the
page's own words (הפקת מקור, הצגה אורחת, בכורה, הצגות חממה, כניסה חופשית, a
hall name, a sold-out mark); they are kept as written, and turning them into our
categories and statuses is the converter's job.

No network and no files, so `--selftest` proves the whole surface offline
against `samples/programme.html`. That sample is a reconstruction: no session
that wrote it could read the page's bytes (see ../../README.md), so its markup
is the grammar the page was read as, not a capture. The first hand-run fetch on
a machine that reaches the site is what confirms it; replace the sample with
the real page then.
"""

import os
import re
import sys
import urllib.parse
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import page_blocks

YEAR_RE = re.compile(r"פסטיבל\s+תיאטרון\s+עכו\s+(\d{4})")
LINE_RE = re.compile(r"^(\d{1,2}):(\d{2})\s+(.+)$")
# "27.9" / "27.9 ראשון" / "יום ראשון 27.9": a short line with a day.month and no time.
DAY_RE = re.compile(r"(?<![\d:.])(\d{1,2})\.(\d{1,2})(?![\d:])")
LABEL_SPLIT_RE = re.compile(r"\s*[|,;/]\s*|\s+[–—-]\s+")
# The page's sold-out mark was read, not captured, so both spellings it could
# plausibly take are accepted; a mark in neither stays a plain label in raw,
# where a reviewer sees it.
SOLD_OUT_RE = re.compile(r"sold\s*-?\s*out|אזל|נמכר", re.I)
HALL_PREFIX = "אולם"
TICKET_HOST = "eventer.co.il"


def page_year(tokens):
    """The year the page says it programmes, or None."""
    for token in tokens:
        if token["kind"] == "text":
            match = YEAR_RE.search(token["text"])
            if match:
                return int(match.group(1))
    return None


def ticket_url(hrefs):
    """The line's eventer link, without the tracking query the page appends."""
    for href in hrefs:
        parts = urllib.parse.urlsplit(href)
        if parts.netloc.endswith(TICKET_HOST):
            return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))
    return None


def parse_line(text):
    """'17:00 האמת השלישית – בכורה | לנשים בלבד' -> start, title, labels, hall, soldOut."""
    match = LINE_RE.match(text)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour > 23 or minute > 59:
        return None
    rest = match.group(3)
    head = re.split(r"\s+[–—-]\s+", rest, maxsplit=1)
    title = head[0].strip()
    labels, hall, sold_out = [], None, False
    for label in LABEL_SPLIT_RE.split(head[1]) if len(head) > 1 else []:
        label = label.strip()
        if not label:
            continue
        if SOLD_OUT_RE.search(label):
            sold_out = True
        elif label.startswith(HALL_PREFIX) and hall is None:
            hall = label
        else:
            labels.append(label)
    return {"start": "%02d:%02d" % (hour, minute), "title": title, "labels": labels, "hall": hall, "soldOut": sold_out}


def programme(tokens, year):
    """Every performance line under a day heading, in page order."""
    lines = []
    on = None
    for token in tokens:
        if token["kind"] != "text":
            continue
        text = token["text"]
        line = parse_line(text)
        if line is not None:
            if on is None:
                continue  # a timed line before any day heading belongs to no date
            line["date"] = on
            line["ticketUrl"] = ticket_url(token["hrefs"])
            lines.append({k: line[k] for k in ("date", "start", "title", "labels", "hall", "soldOut", "ticketUrl")})
            continue
        day = DAY_RE.search(text)
        if day and len(text) <= 30 and not YEAR_RE.search(text):
            try:
                on = date(year, int(day.group(2)), int(day.group(1))).isoformat()
            except ValueError:
                on = None
    return lines


def selftest():
    page_blocks.selftest()
    with open(os.path.join(HERE, "samples", "programme.html"), encoding="utf-8") as handle:
        tokens = page_blocks.blocks(handle.read())
    assert page_year(tokens) == 2026
    lines = programme(tokens, 2026)
    assert [(l["date"], l["start"], l["title"]) for l in lines] == [
        ("2026-09-27", "17:00", "האמת השלישית"),
        ("2026-09-27", "21:00", "טריו ג'אז"),
        ("2026-09-28", "16:00", "מוגן כמו רחם"),
        ("2026-09-28", "21:00", "השומר"),
        ("2026-10-01", "16:00", "חזרתי"),
    ], lines
    first, concert, sold, unlinked, incubator = lines
    assert first["labels"] == ["בכורה", "לנשים בלבד"], first
    # The tracking query the page appends is not part of the ticket link.
    assert first["ticketUrl"] == "https://www.eventer.co.il/accofestivalhaemet3", first
    assert concert["labels"] == ["כניסה חופשית"] and concert["hall"] == "אולם הפואייה", concert
    assert concert["ticketUrl"] is None
    assert sold["soldOut"] is True and sold["labels"] == ["הצגה אורחת"], sold
    assert unlinked["ticketUrl"] is None and unlinked["soldOut"] is False
    assert incubator["labels"] == ["הצגות חממה"], incubator
    # A page that has rolled over to another year says so in its heading.
    assert page_year(page_blocks.blocks("<h1>פסטיבל תיאטרון עכו 2027</h1>")) == 2027
    assert page_year(page_blocks.blocks("<h1>פסטיבל</h1>")) is None
    assert parse_line("25:00 x") is None
    print("acco-tc parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
