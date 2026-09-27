"""Pure transforms turning the Tel Aviv Festival's programme page into raw records.

`https://telavivfestival.co.il/program` is a Next.js page whose whole programme
rides in its React Server Components payload: the string argument of every
`self.__next_f.push([1, "..."])` script, concatenated. In that payload sit

  * `"settings":{...}` — the pass (`passName`, `passLabel`, `passPrice`) and notes;
  * `"days":[...]` — one record per programme block: `id`, `date` ("4.11", no
    year), `dow` ("יום ד׳"), `title`, `venue`, `kind`, `blurb`, and on the
    museum nights the pass's `passUrl`;
  * `"shows":[...]` — one record per show: `id`, `dayId`, `time`, an optional
    `times` list of further performances, `venue`, `area`, `ticket`
    (pass | addon | separate | free), `status` (live | soldout), `name`, `sub`,
    `about`, `photo` (a path on the site), `duration`, Ticketmaster links
    (`tmUrl`, `comboUrl`) and prices (`price`, `addonPrice`).

The records are kept as the site writes them. The one thing added is each day's
`isoDate`: the page never prints a year beside a day, so the year is the page's
own (its title, "פסטיבל תל־אביב 2026"), and a day whose printed weekday does not
fall on that date is refused rather than guessed.

No network and no files, so `--selftest` proves the whole surface offline
against `samples/program.html`, the page as fetched on 2026-09-27.
"""

import json
import os
import re
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))

PUSH_RE = re.compile(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)')
TITLE_YEAR_RE = re.compile(r"<title>[^<]*פסטיבל תל.אביב (\d{4})")
DAY_DATE_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})$")
# "יום א׳" .. "יום ש׳": the Hebrew letter numbers the weekday from Sunday.
DOW_LETTERS = "אבגדהוש"


class ParseError(ValueError):
    """The page no longer has the shape this parser reads."""


def payload(html):
    """The RSC payload: every pushed string, decoded and concatenated."""
    parts = PUSH_RE.findall(html)
    if not parts:
        raise ParseError("no self.__next_f.push payload on the page")
    return "".join(json.loads(part) for part in parts)


def _value(text, key, opener):
    """The JSON value after the first `"key":` whose value opens with `opener`."""
    marker = '"%s":%s' % (key, opener)
    at = text.find(marker)
    if at < 0:
        raise ParseError("no %s in the payload" % marker)
    value, _ = json.JSONDecoder().raw_decode(text, at + len(marker) - 1)
    return value


def page_year(html):
    """The year the page names in its title, or None."""
    match = TITLE_YEAR_RE.search(html)
    return int(match.group(1)) if match else None


def day_date(day, year):
    """A day's "4.11" in `year`, as ISO; its printed weekday must agree."""
    match = DAY_DATE_RE.match(day["date"])
    if not match:
        raise ParseError("day %s: date %r is not day.month" % (day["id"], day["date"]))
    on = date(year, int(match.group(2)), int(match.group(1)))
    letters = [ch for ch in day.get("dow", "") if ch in DOW_LETTERS]
    # isoweekday: Monday 1 .. Sunday 7; the Hebrew week starts on Sunday.
    if not letters or DOW_LETTERS.index(letters[-1]) != on.isoweekday() % 7:
        raise ParseError(
            "day %s: %s.%d falls on %s, not %r — the page may be another year's"
            % (day["id"], day["date"], year, on.strftime("%A"), day.get("dow"))
        )
    return on.isoformat()


def programme(html, year):
    """{settings, days, shows} as the page carries them, each day with its isoDate."""
    text = payload(html)
    days = _value(text, "days", "[")
    shows = _value(text, "shows", "[")
    settings = _value(text, "settings", "{")
    for day in days:
        day["isoDate"] = day_date(day, year)
    known = {day["id"] for day in days}
    stray = sorted({show["dayId"] for show in shows} - known)
    if stray:
        raise ParseError("shows on days the page does not list: %s" % stray)
    return {"settings": settings, "days": days, "shows": shows}


def selftest():
    with open(os.path.join(HERE, "samples", "program.html"), encoding="utf-8") as handle:
        html = handle.read()
    assert page_year(html) == 2026
    raw = programme(html, 2026)
    assert raw["settings"]["passPrice"] == 159, raw["settings"]
    assert [d["id"] for d in raw["days"]] == ["opening", "wed", "thu", "fri-noon", "fri-night", "closing"]
    assert [d["isoDate"] for d in raw["days"]] == [
        "2026-11-01", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-06", "2026-11-08"]
    assert raw["days"][1]["passUrl"].startswith("https://www.ticketmaster.co.il/"), raw["days"][1]
    shows = {s["id"]: s for s in raw["shows"]}
    assert len(raw["shows"]) == 59, len(raw["shows"])
    shimi = shows["wed-shimi"]
    assert (shimi["ticket"], shimi["addonPrice"], shimi["venue"]) == ("addon", 50, "אולם רקנאטי"), shimi
    assert shimi["photo"] == "/artists/wed-shimi.jpg"
    assert shows["thu-ciam"]["status"] == "soldout"
    assert shows["thu-drummer"]["times"] == ["22:15", "23:15"]
    assert shows["fri-caspi"]["price"] == 209 and shows["fri-twil"]["ticket"] == "free"
    # Next year's page: 1.11.2027 is a Monday, so "יום א׳" gives it away.
    try:
        day_date({"id": "opening", "date": "1.11", "dow": "יום א׳"}, 2027)
    except ParseError:
        pass
    else:
        raise AssertionError("a weekday that disagrees with the year must be refused")
    assert page_year("<title>התוכניה | פסטיבל תל־אביב 2027</title>") == 2027
    assert page_year("<title>x</title>") is None
    print("tel-aviv-festival festival-site parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
