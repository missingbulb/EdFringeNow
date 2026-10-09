#!/usr/bin/env python3
"""Pure parsing of the Red Sea Jazz Festival's lineup page (no network, no files).

redseajazz.co.il/lineup/ is server-rendered: one `<section class="day-block"
id="YYYY-MM-DD">` per festival day, each holding one `show-card` per show with
its stage (`data-stage`), artist page (`data-href`), picture, start time, name,
tag (premiere, "free entry"…), subtitle and Ticketmaster link. The nightly jam
session card carries no time of its own; its subtitle says when it starts
("מ-23:30 …"). The page's title names its year ("ליינאפ 2026").

    python3 scraper/festivals/red_sea_jazz/sources/festival-site/parse.py --selftest
"""

import html
import os
import re
import sys

SAMPLES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples")

_DAY = re.compile(r'<section class="day-block" id="(\d{4}-\d{2}-\d{2})">')
_CARD = re.compile(r'<div class="show-card(?: [^"]*)?" data-stage="([^"]*)"(?: data-href="([^"]*)")?>')
_FROM = re.compile(r"מ-(\d{1,2}:\d{2})")


def _text(markup):
    value = html.unescape(re.sub(r"<[^>]+>", " ", markup or ""))
    return re.sub(r"\s+", " ", value).strip() or None


def page_year(page):
    found = re.search(r"<title>[^<]*?(\d{4})", page)
    return int(found.group(1)) if found else None


def _field(card, name):
    found = re.search(r'<(?:div|span) class="show-card-%s"[^>]*>(.*?)</(?:div|span)>' % name, card, re.S)
    return _text(found.group(1)) if found else None


def shows(page):
    """Every show card of the lineup's day blocks, in page order, in the page's own words."""
    end = page.find("</main>")
    body = page[:end] if end > 0 else page
    days = [(m.start(), m.group(1)) for m in _DAY.finditer(body)]
    out = []
    for index, (start, day) in enumerate(days):
        stop = days[index + 1][0] if index + 1 < len(days) else len(body)
        block = body[start:stop]
        cards = list(_CARD.finditer(block))
        for n, card_match in enumerate(cards):
            card = block[card_match.start():cards[n + 1].start() if n + 1 < len(cards) else len(block)]
            time = _field(card, "time")
            sub = _field(card, "sub")
            stated = None
            if time is None and sub and _FROM.search(sub):
                stated = _FROM.search(sub).group(1)
            image = re.search(r'<img[^>]*?\ssrc="([^"]+)"', card)
            tickets = re.search(r'class="show-card-tickets-link" href="([^"]+)"', card)
            out.append({
                "date": day,
                "time": time,
                "startStated": stated,
                "stage": html.unescape(card_match.group(1)),
                "artistUrl": html.unescape(card_match.group(2)) if card_match.group(2) else None,
                "name": _field(card, "name"),
                "tag": _field(card, "tag"),
                "sub": sub,
                "imageUrl": image.group(1) if image else None,
                "ticketUrl": html.unescape(tickets.group(1)) if tickets else None,
            })
    return out


def selftest():
    with open(os.path.join(SAMPLES, "lineup.html"), encoding="utf-8") as handle:
        page = handle.read()
    assert page_year(page) == 2026
    rows = shows(page)
    assert len(rows) == 46, len(rows)
    first = rows[0]
    assert (first["date"], first["time"], first["stage"], first["name"]) == ("2026-11-11", "18:30", "Red note club", "דני גוטפריד והמייסדים"), first
    assert first["tag"] == "מופע פותח" and first["ticketUrl"] == "https://www.ticketmaster.co.il/event/MRN19/ALL/iw"
    assert first["imageUrl"].endswith("RSJF26s_1200x900_DANNI-768x576.jpg")
    assert first["artistUrl"].startswith("https://redseajazz.co.il/artist/")
    aybie = next(r for r in rows if r["name"] == "Aybie Group")
    assert (aybie["tag"], aybie["ticketUrl"], aybie["stage"]) == ("כניסה חופשית", None, "Jasper08 מלון אגמים")
    jams = [r for r in rows if r["time"] is None]
    assert len(jams) == 3 and all(r["startStated"] == "23:30" for r in jams), jams
    assert sorted({r["date"] for r in rows}) == ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]
    print("red sea jazz parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
