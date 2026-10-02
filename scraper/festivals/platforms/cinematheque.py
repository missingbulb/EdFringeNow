#!/usr/bin/env python3
"""The Tel Aviv Cinematheque's festival programme pages, which several film festivals share.

A festival hosted at the Cinematheque (cinema.co.il) has a programme page,
`https://www.cinema.co.il/<festival>-programme/`, whose "by date" tab is one
card per screening. The page renders the first ten; the rest come ten at a
time from the theme's own load-more call, which the page's script makes as

    POST https://www.cinema.co.il/wp-admin/admin-ajax.php
         action=load_more_posts&paged=<n>&category_id=<the festival's category>

and which answers the same card markup (an empty body past the last page).
The page names the category in its active filter tab (`data-filters="movie-cat-557"`,
whose label is the festival and its year) and the card count in `data-total-posts`.

Each card carries: the screening's post id (`event_id-<n>`), the film's page,
its title line, a "country / year / length" line, director and language lines,
the blurb, the screening's "HH:MM DD/MM/YYYY" and hall, the ticket link, and
the film's still. Everything is kept in the page's own words.

Parsing is pure; `build` fetches only through the callables it is handed, and
`run` is the hand-run fetcher's entry point.

    python3 scraper/festivals/platforms/cinematheque.py --selftest
"""

import html
import re
import sys

FETCHER_VERSION = 1
AJAX = "https://www.cinema.co.il/wp-admin/admin-ajax.php"
PAGE_SIZE = 10

_CARD = re.compile(r'<div class="fest-box-parent-wrapper alm-listing event_id-(\d+)[^"]*"')
_TAG = re.compile(r"<[^>]+>")


def _text(markup):
    value = html.unescape(_TAG.sub(" ", markup or ""))
    return re.sub(r"\s+", " ", value).strip() or None


def category(page):
    """The page's festival filter -> {id, label}, or None."""
    found = re.search(r'<li data-filters="movie-cat-(\d+)"[^>]*class="my-active">\s*<a[^>]*>([^<]*)</a>', page)
    if not found:
        return None
    return {"id": int(found.group(1)), "label": html.unescape(found.group(2)).strip()}


def total_posts(page):
    found = re.search(r'id="nav-movie"[^>]*data-total-posts="(\d+)"', page)
    return int(found.group(1)) if found else None


def by_date_tab(page):
    """The page's first ("by date") tab, without the "by film" tab after it."""
    start = page.find('id="nav-movie"')
    end = page.find('id="nav-date"')
    return page[start:end] if start >= 0 and end > start else ""


def _labelled(markup, label):
    found = re.search(r"<h4>\s*%s:?([^<]*)</h4>" % label, markup)
    return _text(found.group(1)) if found else None


def cards(markup):
    """Every screening card in `markup`, in order, in the page's own words."""
    starts = [(m.start(), int(m.group(1))) for m in _CARD.finditer(markup)]
    out = []
    for index, (start, post) in enumerate(starts):
        end = starts[index + 1][0] if index + 1 < len(starts) else len(markup)
        card = markup[start:end]
        title = re.search(r'<div class="title">\s*<h3[^>]*>\s*<a href="([^"]+)">(.*?)</a>', card, re.S)
        meta = re.search(r'<div class="title">.*?<p>(.*?)</p>', card, re.S)
        paragraph = re.search(r'<div class="paragraph">(.*?)</div>', card, re.S)
        when = re.search(r'class="date-set-here">\s*(\d{1,2}:\d{2})\s+(\d{1,2})/(\d{1,2})/(\d{4})\s*<', card)
        hall = re.search(r'class="date-set-here">.*?</h5>\s*<h5>\s*/?\s*([^<]*)</h5>', card, re.S)
        image = re.search(r'<img[^>]*?(?:data-src|src)="(https?://[^"]+)"', card)
        order = re.search(r'<a href="([^"]+)" class="order-btn">', card)
        if not (title and when):
            raise ValueError("card event_id-%d has no title or no screening time" % post)
        blurb = None
        if paragraph:
            blurb = _text(re.sub(r"<h4>.*?</h4>", " ", paragraph.group(1), flags=re.S))
        hour, day, month, year = when.groups()
        out.append({
            "post": post,
            "url": html.unescape(title.group(1)),
            "title": _text(title.group(2)),
            "meta": _text(meta.group(1)) if meta else None,
            "director": _labelled(paragraph.group(1), "בימוי") if paragraph else None,
            "language": _labelled(paragraph.group(1), "שפה") if paragraph else None,
            "blurb": blurb,
            "date": "%s-%02d-%02d" % (year, int(month), int(day)),
            "start": "%02d:%s" % (int(hour.split(":")[0]), hour.split(":")[1]),
            "hall": _text(hall.group(1)) if hall else None,
            "imageUrl": image.group(1) if image else None,
            "ticketUrl": html.unescape(order.group(1)) if order else None,
        })
    return out


def build(page_url, page, fetch_more):
    """Every screening on the programme: the page's own cards, then each load-more page.

    `fetch_more(category_id, paged)` answers one load-more page's markup.
    """
    festival = category(page)
    total = total_posts(page)
    if festival is None or total is None:
        raise ValueError("%s carries no festival filter or card count" % page_url)
    screenings = cards(by_date_tab(page))
    paged = 1
    while len(screenings) < total:
        paged += 1
        more = cards(fetch_more(festival["id"], paged) or "")
        if not more:
            break
        screenings.extend(more)
    if len(screenings) != total:
        raise ValueError("the page counts %d screenings but %d were read" % (total, len(screenings)))
    posts = [s["post"] for s in screenings]
    if len(set(posts)) != len(posts):
        raise ValueError("a screening was read twice across load-more pages")
    return {"site": page_url, "category": festival, "screenings": screenings}


def run(festival_dir, page_url, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live pages, guard, write raw.

    The edition is the year in the festival filter's own label ("פסטיבל גאה 2026").
    """
    import os
    import urllib.parse
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch a Tel Aviv Cinematheque festival programme into its raw folder.")
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    page = common.cached_page(registry.cache_dir(festival, edition["id"], source_id), page_url) or ""
    label = (category(page) or {}).get("label", "")
    if not re.search(r"\b%s\b" % edition["id"], label):
        raise common.FetchRefused("the programme's filter is %r, not edition %s; nothing written" % (label, edition["id"]))

    def fetch_more(category_id, paged):
        body = urllib.parse.urlencode({"action": "load_more_posts", "paged": paged, "category_id": category_id})
        return common.post(AJAX, body.encode(), as_json=False,
                           headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})

    try:
        programme = build(page_url, page, fetch_more)
    except ValueError as error:
        raise common.FetchRefused("%s; nothing written" % error)
    common.guard_dates(edition, [s["date"] for s in programme["screenings"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[page_url, AJAX + " (POST action=load_more_posts&paged=<n>&category_id=<id>)"],
        notes="One card per screening from the programme page's by-date tab and the theme's own "
              "load-more call, in the page's own words (scraper/festivals/platforms/cinematheque.py).",
    )
    print("%d screenings of %d films" % (len(programme["screenings"]), len({s["url"] for s in programme["screenings"]})))


def selftest():
    # Shapes copied from TLVFest 2026's programme page, 2026-10-02, trimmed.
    card = '''<div class="fest-box-parent-wrapper alm-listing event_id-%d movie-cat-557" grid-data="movie-cat-557">
      <h4 class="by-date-title">22.10, חמישי</h4><div class="festival-grid-box"><div class="img-wraper">
      <img  alt="img" data-src="https://www.cinema.co.il/wp-content/uploads/2026/09/x.jpg" class="lazyload" src="data:image/gif;base64,R0"></div>
      <div class="text-content"><ul></ul><div class="title"><h3 class="21476">
      <a href="https://www.cinema.co.il/event/%%d7%%a2/">עורבים | הקרנה+שיחה | פסטיבל גאה 2026</a></h3>
      <p>ישראל /  1988 /  אורך:70</p></div><div class="paragraph"><h4> בימוי:איילת מנחמי </h4>
      <h4> שפה:עברית, תרגום לעברית  </h4> עורבים | Crows מגי בת ה-17 &amp; עוד.  </div>
      <div class="content-detail"><div class="text set-here"><h5 class="date-set-here">%s</h5><h5> / אולם 2</h5></div>
      <div class="text-left"><a href="https://cintlv.pres.global/order/134316" class="order-btn">להזמנה</a></div></div></div></div></div>'''
    page = ('<li data-filters="movie-cat-557" class="my-active">\n<a href="?cat=557" style="color: inherit;"> פסטיבל גאה 2026</a>'
            '<div class="x" id="nav-movie" role="tabpanel" data-total-posts="3">' + card % (1, "18:00 22/10/2026")
            + '<div id="nav-date" data-total-posts="3">' + card % (9, "18:00 22/10/2026"))
    more = {2: card % (2, "9:30 23/10/2026") + card % (3, "21:00 31/10/2026"), 3: ""}
    asked = []

    def fetch_more(category_id, paged):
        asked.append((category_id, paged))
        return more[paged]

    assert category(page) == {"id": 557, "label": "פסטיבל גאה 2026"}
    programme = build("https://www.cinema.co.il/p/", page, fetch_more)
    assert asked == [(557, 2)], asked
    rows = programme["screenings"]
    assert [r["post"] for r in rows] == [1, 2, 3], rows
    first = rows[0]
    assert first["title"] == "עורבים | הקרנה+שיחה | פסטיבל גאה 2026" and first["meta"] == "ישראל / 1988 / אורך:70"
    assert (first["director"], first["language"]) == ("איילת מנחמי", "עברית, תרגום לעברית")
    assert first["blurb"] == "עורבים | Crows מגי בת ה-17 & עוד.", first["blurb"]
    assert (first["date"], first["start"], first["hall"]) == ("2026-10-22", "18:00", "אולם 2")
    assert first["imageUrl"] == "https://www.cinema.co.il/wp-content/uploads/2026/09/x.jpg"
    assert first["ticketUrl"] == "https://cintlv.pres.global/order/134316"
    assert rows[1]["start"] == "09:30" and rows[1]["date"] == "2026-10-23"
    try:
        build("u", page.replace('data-total-posts="3"', 'data-total-posts="4"', 1), lambda c, p: more.get(p, ""))
    except ValueError:
        pass
    else:
        raise AssertionError("a short read must be refused")
    print("cinematheque platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: cinematheque.py --selftest")
    selftest()
