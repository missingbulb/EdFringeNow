"""Pure transforms that turn the free street programme page into raw sections of cards.

`https://akko-festival-shows.vercel.app` is a single static page. The municipality's
agency built it as the programme of מופעי חוצות. The page states its dates once,
as "28–30.9.26". Its programme is a run of sections, and each section heading is a
zone of the Old City: רחוב ויצמן, מתחם הבאר, and so on. Each section holds cards.
A card has these parts:

    <title>
    <genre line>
    NN דק׳ כל הופעה              (optional running time)
    <schedule>                   one or more lines, see parse_schedule
    NN ₪                         (only on the one paid attraction)

One more section, "פסטיבל תיאטרון עכו", holds only posters that link to the
theatre centre's own programme (the acco-tc source). This parser counts those
posters and does not read them as cards.

There is no network access and no file writing here. `--selftest` proves the parser
offline against `samples/programme.html`. That sample is a reconstruction, like the
acco-tc sample (see ../../README.md). Replace it with the real page on the first
hand-run fetch.
"""

import os
import re
import sys
import urllib.parse
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import page_blocks

# "28–30.9.26": first day, last day, month, two-digit year.
DATES_RE = re.compile(r"(?<!\d)(\d{1,2})\s*[–—-]\s*(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?!\d)")
TIME = r"(\d{1,2}:\d{2})"
WINDOW_RE = re.compile(TIME + r"\s*[–—-]\s*" + TIME)
TIME_RE = re.compile(TIME)
DAY_MONTH_RE = re.compile(r"(?<![\d:.])(\d{1,2})\.(\d{1,2})(?![\d:])")
DURATION_RE = re.compile(r"(\d{1,3})\s*דק")
PRICE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*₪|₪\s*(\d+(?:\.\d+)?)")
EVERY_DAY = "בכל ימי הפסטיבל"
THEATRE_SECTION = "פסטיבל תיאטרון עכו"
THEATRE_HOST = "acco-tc.com"


def page_dates(tokens):
    """(year, [ISO day, ...]) from the page's own "28–30.9.26", or (None, [])."""
    for token in tokens:
        if token["kind"] != "text":
            continue
        match = DATES_RE.search(token["text"])
        if match:
            first, last, month, year = (int(g) for g in match.groups())
            year = year + 2000 if year < 100 else year
            start = date(year, month, first)
            return year, [(start + timedelta(days=n)).isoformat() for n in range(last - first + 1)]
    return None, []


def _hhmm(text):
    hour, minute = (int(x) for x in text.split(":"))
    return "%02d:%02d" % (hour, minute) if hour <= 23 and minute <= 59 else None


def parse_schedule(text, days, year):
    """A card's schedule -> [{date, start, end}], `end` only for a window.

    The grammar is small. Segments are separated by "|". Each segment names its
    days, either "בכל ימי הפסטיבל" or a weekday and a D.M. Then come start times
    separated by "·", or a window "18:00–21:30" for something that runs
    continuously. A segment with times but no day it can pin is dropped rather
    than guessed.
    """
    out = []
    for segment in text.split("|"):
        if EVERY_DAY in segment:
            on = list(days)
        else:
            on = []
            for day, month in DAY_MONTH_RE.findall(segment):
                try:
                    on.append(date(year, int(month), int(day)).isoformat())
                except ValueError:
                    pass
        if not on:
            continue
        slots = []
        for start, end in WINDOW_RE.findall(segment):
            if _hhmm(start) and _hhmm(end):
                slots.append((_hhmm(start), _hhmm(end)))
        for start in TIME_RE.findall(WINDOW_RE.sub(" ", segment)):
            if _hhmm(start):
                slots.append((_hhmm(start), None))
        for d in on:
            for start, end in slots:
                out.append({"date": d, "start": start, "end": end})
    out.sort(key=lambda p: (p["date"], p["start"]))
    return out


def parse_card(texts, days, year):
    """One card's text lines (title first) and links -> its raw record."""
    title = texts[0]["text"]
    genre_line = None
    duration = None
    price = None
    ticket_url = None
    schedule = []
    for token in texts[1:]:
        text = token["text"]
        if ticket_url is None:
            for href in token["hrefs"]:
                if urllib.parse.urlsplit(href).scheme in ("http", "https"):
                    ticket_url = href
                    break
        found = DURATION_RE.search(text)
        if found and duration is None and not TIME_RE.search(text):
            duration = int(found.group(1))
            continue
        paid = PRICE_RE.search(text)
        if paid and price is None:
            price = float(paid.group(1) or paid.group(2))
            price = int(price) if price == int(price) else price
            continue
        if TIME_RE.search(text):
            schedule.append(text)
            continue
        if genre_line is None:
            genre_line = text
    return {
        "title": title,
        "genreLine": genre_line,
        "durationMin": duration,
        "price": price,
        "ticketUrl": ticket_url,
        "performances": parse_schedule(" | ".join(schedule), days, year),
    }


def programme(tokens, year, days):
    """{sections: [{heading, items}], theatrePosters} in page order."""
    sections = []
    posters = 0
    current = None
    card = None
    for token in tokens:
        kind = token["kind"]
        if kind == "start" and token["tag"] == "section":
            current = {"heading": None, "items": []}
            sections.append(current)
        elif kind == "start" and token["tag"] == "article":
            card = []
        elif kind == "end" and token["tag"] == "article":
            if card and current is not None and current["heading"] != THEATRE_SECTION:
                current["items"].append(parse_card(card, days, year))
            card = None
        elif kind == "link":
            if current is not None and current["heading"] == THEATRE_SECTION and THEATRE_HOST in token["href"]:
                posters += 1
        elif kind == "text":
            if card is not None:
                card.append(token)
            elif current is not None and current["heading"] is None and token["tag"] in ("h1", "h2", "h3", "h4"):
                current["heading"] = token["text"]
    return {
        "sections": [s for s in sections if s["heading"] != THEATRE_SECTION and s["items"]],
        "theatrePosters": posters,
    }


def selftest():
    page_blocks.selftest()
    days = ["2026-09-28", "2026-09-29", "2026-09-30"]
    assert parse_schedule("בכל ימי הפסטיבל 18:00 · 19:25 · 20:30", days, 2026)[:2] == [
        {"date": "2026-09-28", "start": "18:00", "end": None},
        {"date": "2026-09-28", "start": "19:25", "end": None},
    ]
    assert len(parse_schedule("בכל ימי הפסטיבל 18:00 · 19:25 · 20:30", days, 2026)) == 9
    assert parse_schedule("שני 28.9 18:00 · 19:10 | רביעי 30.9 18:40–21:00", days, 2026) == [
        {"date": "2026-09-28", "start": "18:00", "end": None},
        {"date": "2026-09-28", "start": "19:10", "end": None},
        {"date": "2026-09-30", "start": "18:40", "end": "21:00"},
    ]
    # Times with no day to pin them to are dropped, never assigned a guessed day.
    assert parse_schedule("18:00 · 19:00", days, 2026) == []

    with open(os.path.join(HERE, "samples", "programme.html"), encoding="utf-8") as handle:
        tokens = page_blocks.blocks(handle.read())
    year, found_days = page_dates(tokens)
    assert (year, found_days) == (2026, days), (year, found_days)
    raw = programme(tokens, year, found_days)
    assert raw["theatrePosters"] == 2, raw["theatrePosters"]
    assert [s["heading"] for s in raw["sections"]] == ["רחוב ויצמן", "מופעי שטח מסתובבים", "אולמות האבירים, בלילה וביום"]
    statue, dj = raw["sections"][0]["items"]
    assert statue["title"] == "סבתא חמסה" and statue["durationMin"] == 40, statue
    assert statue["genreLine"] == "פסל חי אינטראקטיבי" and statue["price"] is None
    assert [(p["date"], p["start"]) for p in statue["performances"]][:3] == [
        ("2026-09-28", "18:10"), ("2026-09-28", "19:40"), ("2026-09-28", "21:00")]
    assert dj["durationMin"] is None and dj["performances"][0] == {"date": "2026-09-28", "start": "18:00", "end": "21:30"}
    roaming = raw["sections"][1]["items"][0]
    assert roaming["performances"] == [], roaming
    show = raw["sections"][2]["items"][0]
    assert show["price"] == 59 and show["ticketUrl"].startswith("https://web.attractinet.co.il/"), show
    assert page_dates(page_blocks.blocks("<p>27–31.8.25</p>"))[0] == 2025
    print("street-programme parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
