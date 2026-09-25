"""Pure transforms that turn the free street programme page into raw sections of cards.

`https://akko-festival-shows.vercel.app` is a single static page. The municipality's
agency built it as the programme of מופעי חוצות. The page states its dates once,
in its description, as "28–30.9.26". Its programme is a run of `<section>`s, each
headed by an `<h2>` naming a zone of the Old City (רחוב ויצמן, מתחם הבאר, ...),
and each holding `<article>` cards. A card reads, in document order:

    <img>                               the card's picture
    <ul><li>chip</li>...</ul>           genre chips ("פסל חי", "מופע מוזיקלי"); the
                                        paid show lists its tags after the title
    <h3>title <span lang="en">English title</span></h3>
    שעות הופעה · NN דק׳ כל הופעה        the running time, when the card has one
    <dl><dt>day</dt><dd>times</dd>...   "שני 28.9" or "בכל ימי הפסטיבל", then
                                        start times "18:00 · 19:20" or a window
                                        "18:00–21:30" for something continuous
    <p>...</p>                          the synopsis
    <details><li>credit</li>...         credits
    NN ₪, <a href=...>                  only on the paid Knights' Halls show

One section, "פסטיבל תיאטרון עכו", holds only a poster linking to the theatre
centre's own programme (the acco-tc source). This parser counts those posters
and does not read them as cards.

The parser keys off elements and the page's words, not its class names, so a
restyle that keeps the markup's shape does not break it. There is no network
access and no file writing here. `--selftest` proves the parser offline against
`samples/programme.html`, the page as fetched on 2026-09-25.
"""

import html.parser
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
# "40 דק׳ כל הופעה": minutes per performance. "כל 5 דקות מתחיל סבב" (a new
# round every 5 minutes) is not a running time, so "each performance" is required.
DURATION_RE = re.compile(r"(\d{1,3})\s*דק\S*\s+כל הופעה")
PRICE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*₪|₪\s*(\d+(?:\.\d+)?)")
SCHEDULE_HEADING = "שעות הופעה"
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


def parse_row(day_text, times_text, days, year):
    """One schedule row, its day ("שני 28.9" / "בכל ימי הפסטיבל") and its times,
    -> [{date, start, end}], `end` only for a window. A row whose day cannot be
    pinned is dropped rather than guessed."""
    if EVERY_DAY in day_text:
        on = list(days)
    else:
        on = []
        for day, month in DAY_MONTH_RE.findall(day_text):
            try:
                on.append(date(year, int(month), int(day)).isoformat())
            except ValueError:
                pass
    slots = []
    for start, end in WINDOW_RE.findall(times_text):
        if _hhmm(start) and _hhmm(end):
            slots.append((_hhmm(start), _hhmm(end)))
    for start in TIME_RE.findall(WINDOW_RE.sub(" ", times_text)):
        if _hhmm(start):
            slots.append((_hhmm(start), None))
    return [{"date": d, "start": s, "end": e} for d in on for s, e in slots]


def _text(parts):
    text = re.sub(r"\s+", " ", "".join(parts)).strip()
    return re.sub(r"[‎‏‪-‮⁦-⁩​]", "", text).strip()


class _Page(html.parser.HTMLParser):
    """Sections of raw cards, each card the page's own text pieces by role."""

    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.sections = []
        self.posters = 0
        self.section = None
        self.card = None
        self.stack = []
        self.buf = None      # (role, parts) of the element being read
        self.en = None       # parts of the English title span
        self.skip = 0

    def _inside(self, tag):
        return tag in self.stack

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ("script", "style", "svg", "button", "summary"):
            self.skip += 1
            return
        if tag not in ("img", "br", "meta", "link", "source", "input"):
            self.stack.append(tag)
        if tag == "section":
            self.section = {"heading": None, "cards": []}
            self.sections.append(self.section)
        elif tag == "article" and self.section is not None:
            self.card = {"chips": [], "title": [], "titleEn": None, "lines": [], "rows": [],
                         "blurb": [], "credits": [], "image": None, "links": []}
        elif tag == "img" and self.card is not None and self.card["image"] is None and attrs.get("src"):
            self.card["image"] = urllib.parse.urljoin(self.base, attrs["src"])
        elif tag == "a" and attrs.get("href"):
            href = attrs["href"]
            if self.card is not None:
                self.card["links"].append(href)
            elif self.section is not None and self.section["heading"] == THEATRE_SECTION and THEATRE_HOST in href:
                self.posters += 1
        elif tag == "span" and attrs.get("lang") == "en" and self._inside("h3"):
            self.en = []
        if tag in ("h2", "h3", "li", "dt", "dd", "p") and self.buf is None:
            self.buf = (tag, [])

    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg", "button", "summary"):
            self.skip = max(0, self.skip - 1)
            return
        if tag == "span" and self.en is not None:
            self.card["titleEn"] = _text(self.en) or None
            self.en = None
        if self.buf is not None and self.buf[0] == tag:
            self._close(tag, _text(self.buf[1]))
            self.buf = None
        if tag == "article" and self.card is not None:
            self.section["cards"].append(self.card)
            self.card = None
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass

    def _close(self, tag, text):
        if not text:
            return
        if tag == "h2" and self.section is not None and self.section["heading"] is None and self.card is None:
            self.section["heading"] = text
            return
        card = self.card
        if card is None:
            return
        if tag == "h3":
            card["title"] = text
        elif tag == "dt":
            card["rows"].append([text, ""])
        elif tag == "dd" and card["rows"]:
            card["rows"][-1][1] = text
        elif tag == "li" and self._inside("details"):
            card["credits"].append(text)
        elif tag == "li":
            card["chips"].append(text)
        elif tag == "p":
            card["lines"].append(text)

    def handle_data(self, data):
        if self.skip:
            return
        if self.en is not None:
            self.en.append(data)
        elif self.buf is not None:
            self.buf[1].append(data)


def parse_card(card, days, year):
    """One card's pieces -> its raw record."""
    title = card["title"]
    if card["titleEn"] and title.endswith(card["titleEn"]):
        title = title[: -len(card["titleEn"])].strip()
    duration, price, blurb = None, None, []
    for line in card["lines"]:
        found = DURATION_RE.search(line)
        if found and duration is None:
            duration = int(found.group(1))
            continue
        if SCHEDULE_HEADING in line:
            continue
        paid = PRICE_RE.search(line)
        if paid and price is None and len(line) < 30:
            price = float(paid.group(1) or paid.group(2))
            price = int(price) if price == int(price) else price
            continue
        blurb.append(line)
    ticket_url = next((h for h in card["links"] if urllib.parse.urlsplit(h).scheme in ("http", "https")), None)
    performances = []
    for day_text, times_text in card["rows"]:
        performances.extend(parse_row(day_text, times_text, days, year))
    performances.sort(key=lambda p: (p["date"], p["start"]))
    return {
        "title": title,
        "titleEn": card["titleEn"],
        "chips": card["chips"],
        "durationMin": duration,
        "price": price,
        "ticketUrl": ticket_url,
        "blurb": "\n\n".join(blurb) or None,
        "credits": card["credits"],
        "imageUrl": card["image"],
        "performances": performances,
    }


def programme(markup, base, year, days):
    """{sections: [{heading, items}], theatrePosters} in page order."""
    page = _Page(base)
    page.feed(markup)
    page.close()
    sections = [
        {"heading": s["heading"], "items": [parse_card(c, days, year) for c in s["cards"] if c["title"]]}
        for s in page.sections
        if s["heading"] != THEATRE_SECTION
    ]
    return {"sections": [s for s in sections if s["items"]], "theatrePosters": page.posters}


def selftest():
    page_blocks.selftest()
    days = ["2026-09-28", "2026-09-29", "2026-09-30"]
    assert len(parse_row(EVERY_DAY, "18:00 · 19:25 · 20:30", days, 2026)) == 9
    assert parse_row("רביעי 30.9", "18:40–21:00", days, 2026) == [
        {"date": "2026-09-30", "start": "18:40", "end": "21:00"}]
    # Times with no day to pin them to are dropped, never assigned a guessed day.
    assert parse_row("", "18:00 · 19:00", days, 2026) == []

    with open(os.path.join(HERE, "samples", "programme.html"), encoding="utf-8") as handle:
        markup = handle.read()
    year, found_days = page_dates(page_blocks.blocks(markup))
    assert (year, found_days) == (2026, days), (year, found_days)
    raw = programme(markup, "https://akko-festival-shows.vercel.app", year, found_days)
    assert raw["theatrePosters"] == 1, raw["theatrePosters"]
    assert [s["heading"] for s in raw["sections"]] == [
        "רחוב ויצמן", "מתחם הבאר", "חניית אולמות האבירים", "חפיר תחתון", "במת לילה",
        "מופעי שטח מסתובבים", "אולמות האבירים, בלילה וביום"], [s["heading"] for s in raw["sections"]]
    items = {i["title"]: i for s in raw["sections"] for i in s["items"]}
    assert len(items) == 62, len(items)

    broadcaster = items["השדרן"]
    assert broadcaster["titleEn"] == "The Broadcaster" and broadcaster["chips"] == ["פסל חי אינטראקטיבי"]
    assert broadcaster["durationMin"] == 40 and broadcaster["price"] is None, broadcaster
    # Days are the card's own rows: this one plays Monday and Tuesday only.
    assert [(p["date"], p["start"]) for p in broadcaster["performances"]] == [
        ("2026-09-28", "18:00"), ("2026-09-28", "19:20"), ("2026-09-28", "20:40"),
        ("2026-09-29", "18:00"), ("2026-09-29", "19:20"), ("2026-09-29", "20:40")], broadcaster
    assert broadcaster["blurb"].startswith("בזמן שהיה רק ערוץ אחד") and "שחקן: דוד בוחניק" in broadcaster["credits"]
    assert broadcaster["imageUrl"].startswith("https://akko-festival-shows.vercel.app/assets/shows/s14-480.webp")

    dj = items["דיגיי"]
    assert dj["durationMin"] is None and dj["chips"] == []
    assert dj["performances"][0] == {"date": "2026-09-28", "start": "18:00", "end": "21:30"} and len(dj["performances"]) == 3
    # "a new round every 5 minutes" is not a running time.
    assert items["הסל"]["durationMin"] is None and len(items["הסל"]["performances"]) == 9
    assert items["מלכת הלבבות"]["performances"][-1] == {"date": "2026-09-30", "start": "19:30", "end": "20:10"}
    assert items["הפסנתר הלבן"]["performances"] == [] and items["יוסי רזיאל"]["performances"] == []

    night = items["מסע לילי של אור בעכו העתיקה"]
    assert night["price"] == 59 and night["durationMin"] == 60, night
    assert night["ticketUrl"].startswith("https://web.attractinet.co.il/") and len(night["performances"]) == 6
    assert night["chips"] == ["בתשלום", "אולמות האבירים"], night["chips"]
    assert page_dates(page_blocks.blocks("<p>27–31.8.25</p>"))[0] == 2025
    print("street-programme parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
