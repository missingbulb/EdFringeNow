"""Pure transforms turning edfilmfest.org's What's On page and WP REST films into records.

No network and no filesystem outside `--selftest`'s committed sample: fetch.py
talks to the site and hands the bytes here.

Where the site carries what, as read on 2026-09-25 (after the 2026 edition):

  * `/whats-on/` is the whole programme, server-rendered twice — a date view
    (`#view-date`, one `<section id="date-YYYY-MM-DD">` per day) and an A-Z view.
    Each day section renders its films twice again, a "Normal grid" and a
    "Simplified list"; only the grid is read, so every showing is read once.
  * A bookable showing is an `<a data-action="open-ticket-panel">` carrying the
    showing's post id, the ticketing system's id (`data-showing-api-id`), date
    and time, venue label, access services and a `data-tickets` JSON of price
    bands with a remaining-seat `availability`.
  * A sold-out showing is a bare `<a title="Sold out">HH:MM</a>`: no id, no venue,
    no price — its day comes from the enclosing section.
  * The film's own page lists no showings once they are past, and the REST
    `showings` records carry only a title; venue and price live nowhere but here.
  * WP REST `wp/v2/film` gives identity and taxonomy (programme type, strands,
    genres) for the films tagged with the edition's `festival` term.
"""

import html as _html
import json
import os
import re
import sys

FILM_URL_RE = re.compile(r'href="(https://www\.edfilmfest\.org/film/([^/"]+)/)"')
BUTTON_RE = re.compile(r"<a\s([^>]*)>([\s\S]*?)</a>")
ATTR_RE = re.compile(r'(data-[a-z-]+|title|class)=(?:"([^"]*)"|\'([^\']*)\')')
SHOWING_TIME_RE = re.compile(r"^\w{3} (\d{1,2}) (\w{3}) (\d{4}) \| (\d{2}):(\d{2})$")
MONTHS = {m: i for i, m in enumerate(
    ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"), 1)}


def clean_text(raw):
    if raw is None:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw)
    return re.sub(r"\s+", " ", _html.unescape(text)).strip()


def _attrs(tag_attrs):
    return {k: _html.unescape(a if a else b) for k, a, b in ATTR_RE.findall(tag_attrs)}


def _hhmm(text):
    m = re.search(r"\b(\d{1,2}):(\d{2})\b", text)
    return "%02d:%02d" % (int(m.group(1)), int(m.group(2))) if m else None


def showing_datetime(label):
    """("Thu 13 Aug 2026 | 21:00") -> ("2026-08-13", "21:00"), or None."""
    m = SHOWING_TIME_RE.match(label.strip())
    if not m or m.group(2) not in MONTHS:
        return None
    return ("%s-%02d-%02d" % (m.group(3), MONTHS[m.group(2)], int(m.group(1))),
            "%s:%s" % (m.group(4), m.group(5)))


def duration_minutes(line):
    """("102 mins, Louis Paxton") -> 102; None when the line gives no minutes."""
    m = re.match(r"\s*(\d+)\s*mins?\b", line or "")
    return int(m.group(1)) if m else None


def _date_view(page):
    start = page.find('<div id="view-date"')
    if start < 0:
        raise ValueError("no #view-date on the What's On page; the layout has changed")
    end = page.find('<div id="view-alpha"', start)
    return page[start:end if end > 0 else len(page)]


def parse_article(article, day):
    """One grid card: the film it shows and that day's showings of it."""
    film = FILM_URL_RE.search(article)
    if not film:
        return None
    title = re.search(r"<h3[^>]*>([\s\S]*?)</h3>", article)
    image = re.search(r'<img[^>]*\ssrc="([^"]+)"', article)
    cert = re.search(r'<span class="flex relative min-w-6[^"]*">([\s\S]*?)</span>', article)
    badge = re.search(r'<span class="bg-black text-base font-light border-l-2[^"]*">([\s\S]*?)</span>', article)
    byline = re.search(r'<p class="text-base font-normal mb-6">([\s\S]*?)</p>', article)
    buttons_at = article.find("flex flex-wrap gap-2")
    showings = []
    for attrs_text, inner in BUTTON_RE.findall(article[buttons_at:] if buttons_at >= 0 else ""):
        attrs = _attrs(attrs_text)
        if attrs.get("data-action") == "open-ticket-panel":
            when = showing_datetime(attrs["data-showing-time"])
            if when is None or when[0] != day:
                raise ValueError("showing %s says %r inside the %s section"
                                 % (attrs.get("data-showing-id"), attrs.get("data-showing-time"), day))
            showings.append({
                "date": when[0],
                "start": when[1],
                "showingId": int(attrs["data-showing-id"]),
                "apiId": attrs["data-showing-api-id"],
                "venue": attrs["data-showing-venue"],
                "accessibility": [a.strip() for a in attrs.get("data-accessibility", "").split(",") if a.strip()],
                "soldOut": False,
                "tickets": json.loads(attrs.get("data-tickets") or "[]"),
            })
        elif attrs.get("title", "").lower() == "sold out":
            start = _hhmm(clean_text(inner))
            if start is None:
                raise ValueError("a sold-out button with no time on %s" % day)
            showings.append({"date": day, "start": start, "showingId": None, "apiId": None,
                             "venue": None, "accessibility": [], "soldOut": True, "tickets": []})
    runline = clean_text(byline.group(1)) if byline else ""
    return {
        "slug": film.group(2),
        "url": film.group(1),
        "title": clean_text(title.group(1)) if title else "",
        "image": image.group(1) if image else None,
        "certificate": clean_text(cert.group(1)) if cert else None,
        "badge": clean_text(badge.group(1)) if badge else None,
        "byline": runline or None,
        "duration": duration_minutes(runline),
        "showings": showings,
    }


def whats_on(page):
    """The What's On page -> {slug: film card with all its showings}, grid only."""
    films = {}
    view = _date_view(page)
    for chunk in re.split(r'<section id="date-', view)[1:]:
        day = chunk[:10]
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", day):
            raise ValueError("unreadable day section %r" % chunk[:20])
        cut = chunk.find("<!-- Simplified list")
        grid = chunk[:cut] if cut >= 0 else chunk
        for article in re.findall(r"<article[\s\S]*?</article>", grid):
            card = parse_article(article, day)
            if card is None:
                continue
            known = films.setdefault(card["slug"], dict(card, showings=[]))
            known["showings"].extend(card["showings"])
    for film in films.values():
        film["showings"].sort(key=lambda s: (s["date"], s["start"], s["venue"] or ""))
    return films


def rest_film(record, programme_types):
    """A wp/v2/film record -> the fields the listing lacks, in the site's own slugs."""
    classes = record.get("class_list") or []
    return {
        "id": record["id"],
        "slug": record["slug"],
        "title": clean_text(record["title"]["rendered"]),
        "url": record["link"],
        "excerpt": _excerpt(record.get("excerpt", {}).get("rendered", "")),
        "programmeTypes": [programme_types[i]["slug"] for i in record.get("programme_type", []) if i in programme_types],
        "strands": [c[len("strands-"):] for c in classes if c.startswith("strands-")],
        "genres": [c[len("genre-"):] for c in classes if c.startswith("genre-")],
        "premiere": next((c[len("premiere_status-"):] for c in classes if c.startswith("premiere_status-")), None),
    }


def _excerpt(rendered):
    # WordPress appends a "Continue reading" link to a cut excerpt; it is chrome, not copy.
    rendered = re.sub(r'<a [^>]*>Continue reading[\s\S]*?</a>', "", rendered)
    text = clean_text(rendered)
    return text or None


# --- self-test -------------------------------------------------------------

SAMPLE_FILM = {
    "id": 8750, "slug": "hope", "link": "https://www.edfilmfest.org/film/hope/",
    "title": {"rendered": "Hope"},
    "excerpt": {"rendered": "<p>A rural Korean village is under attack from a mysterious creature laying waste"
                            " to buildings.<a href=\"https://www.edfilmfest.org/film/hope/\">Continue reading "
                            "<span class=\"sr-only\">&#8220;Hope&#8221;</span></a></p>\n"},
    "programme_type": [292],
    "class_list": ["post-8750", "film", "language-korean", "strands-out-of-competition",
                   "premiere_status-uk-premiere", "festival-edinburgh-international-film-festival-2026",
                   "genre-action", "genre-science-fiction", "programme_type-feature"],
}


def selftest():
    assert showing_datetime("Thu 13 Aug 2026 | 21:00") == ("2026-08-13", "21:00")
    assert showing_datetime("13 Aug 2026") is None
    assert duration_minutes("102 mins, Louis Paxton") == 102
    assert duration_minutes("Louis Paxton") is None

    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "samples", "whats-on.html"),
              encoding="utf-8") as handle:
        films = whats_on(handle.read())
    # The sample's "Simplified list" card (a Monkey Barrel showing) is the same
    # programme drawn again, and is never read.
    assert sorted(films) == ["out-there", "the-incomer", "these-violent-delights"], sorted(films)
    assert all(s["venue"] != "Monkey Barrel Comedy MB3" for f in films.values() for s in f["showings"])

    incomer = films["the-incomer"]
    assert incomer["title"] == "The Incomer" and incomer["duration"] == 102, incomer
    assert incomer["certificate"] == "15+" and incomer["badge"] == "International Premiere", incomer
    first = incomer["showings"][0]
    assert (first["date"], first["start"], first["venue"], first["showingId"]) == \
        ("2026-08-14", "13:00", "EIFF @ Cineworld", 7496), first
    assert first["tickets"][0]["full_price"] == "12", first["tickets"]

    out_there = films["out-there"]["showings"]
    assert out_there == [{"date": "2026-08-14", "start": "15:00", "showingId": None, "apiId": None,
                          "venue": None, "accessibility": [], "soldOut": True, "tickets": []}], out_there

    mixed = films["these-violent-delights"]["showings"]
    assert [s["soldOut"] for s in mixed].count(True) == 1 and len(mixed) == 2, mixed

    film = rest_film(SAMPLE_FILM, {292: {"slug": "feature", "name": "Feature"}})
    assert film["programmeTypes"] == ["feature"] and film["strands"] == ["out-of-competition"], film
    assert film["genres"] == ["action", "science-fiction"] and film["premiere"] == "uk-premiere", film
    assert film["excerpt"].endswith("buildings."), film["excerpt"]
    print("eiff festival-site parse selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: parse.py --selftest")
    selftest()
