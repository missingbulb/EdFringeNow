#!/usr/bin/env python3
"""Eventotron: the WordPress box-office plugin several open-access festivals run on.

Brighton Fringe (brightonfringe.org) and the Leicester Comedy Festival
(events.comedy-festival.co.uk) both sell through it, so one module reads both.
Each festival's `sources/eventotron/fetch.py` names its site and hands over;
everything that is about the platform rather than one festival lives here.

What the platform exposes, and where:

  * the WP REST API (`wp/v2/events`, `wp/v2/venues`, `wp/v2/genres`) is open and
    unauthenticated: identity, blurb, genre and venue membership per event;
  * a performance's date, start, venue, price bands and cancelled / sold-out
    mark are NOT in REST — the plugin renders them into each event page's
    `etron-perf-row` blocks, which `perf_rows` reads;
  * a venue's coordinates and street address are only on the venue's own page
    (`venue_details`).

The two sites run different page templates of the same plugin (Brighton writes
"May 31, 2026" and "4:00 pm", Leicester "Wed 1st Apr 8.00pm"), so the parsers
accept both and the self-test pins each on a sample copied from the live pages.

Parsing is pure (no network, no files); `build` is the only function that
fetches, through the `fetch_json` / `fetch_pages` callables it is handed.
"""

import html as _html
import re
import sys
from datetime import date

MONTHS = {m: i + 1 for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"))}

_ROW_RE = re.compile(r'<div class="etron-perf-row[^"]*"[^>]*>(.*?)(?=<div class="etron-perf-row|<div id="etron-extended-block"|\Z)', re.S)
_COLUMN_RE = re.compile(r'<div class="etron-perf-column etron-perf-column-(one|two|three|four)">(.*?)</div>', re.S)
_VENUE_LINK_RE = re.compile(r'<a[^>]*class="etron-link venue-link"[^>]*href="/venues/([^"/]+)/?"[^>]*>(.*?)</a>', re.S)
# "May 31, 2026" (Brighton) or "Wed 1st Apr" (Leicester, which prints no year).
_DATE_LONG_RE = re.compile(r"\b([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})\b")
_DATE_SHORT_RE = re.compile(r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Z][a-z]{2,})\b")
_TIME_RE = re.compile(r"\b(\d{1,2})(?:[:.](\d{2}))?\s*([ap])\.?m\b", re.I)
_NOON_RE = re.compile(r"\b(12\s*)?noon\b", re.I)
_MIDNIGHT_RE = re.compile(r"\bmidnight\b", re.I)
_BAND_RE = re.compile(r"<strong>\s*([^<:]+?)\s*:\s*</strong>\s*([^<]*)", re.S)
_AMOUNT_RE = re.compile(r"(?:£|&pound;)\s*(\d+(?:\.\d{1,2})?)")
_LATLNG_RE = re.compile(r'name="etronfilterlat" value="(-?\d+\.\d+)"\s*/?>\s*<input type="hidden" name="etronfilterlng" value="(-?\d+\.\d+)"')
_MAPS_Q_RE = re.compile(r"google\.com/maps/embed/v1/place\?[^\"']*?q=(-?\d+\.\d+),(-?\d+\.\d+)")
_ADDRESS_RE = re.compile(r'<h4 class="etron-detail-item">Address</h4>(.*?)<(?:div|h4)\b', re.S)
_P_RE = re.compile(r'<p class="etron-detail-item">(.*?)</p>', re.S)
# The plugin's own marks in the fourth column. Anything else there is kept as
# text in raw and read as no mark.
STATUS_MARKS = (("cancelled", "cancelled"), ("canceled", "cancelled"), ("sold out", "sold-out"), ("postponed", "cancelled"))


def clean_text(raw):
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = _html.unescape(text).replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def parse_time(text):
    """'4:00 pm', '8.00pm', '7pm', '12 noon' -> 'HH:MM'; None when no time is printed."""
    if _NOON_RE.search(text):
        return "12:00"
    if _MIDNIGHT_RE.search(text):
        return "00:00"
    m = _TIME_RE.search(text)
    if not m:
        return None
    hour, minute, half = int(m.group(1)), int(m.group(2) or 0), m.group(3).lower()
    if not (1 <= hour <= 12 and 0 <= minute < 60):
        return None
    hour = hour % 12 + (12 if half == "p" else 0)
    return "%02d:%02d" % (hour, minute)


def parse_date(text, year):
    """'May 31, 2026' or 'Wed 1st Apr' (year from the edition) -> ISO; None when absent."""
    m = _DATE_LONG_RE.search(text)
    if m and m.group(1)[:3].lower() in MONTHS:
        return date(int(m.group(3)), MONTHS[m.group(1)[:3].lower()], int(m.group(2))).isoformat()
    m = _DATE_SHORT_RE.search(text)
    if m and m.group(2)[:3].lower() in MONTHS:
        return date(int(year), MONTHS[m.group(2)[:3].lower()], int(m.group(1))).isoformat()
    return None


def price_bands(column_html):
    """[{band, text, amount}] — the site's own band names; amount None when not a £ figure."""
    bands = []
    for name, value in _BAND_RE.findall(column_html):
        text = clean_text(value)
        amount = _AMOUNT_RE.search(value)
        bands.append({
            "band": clean_text(name),
            "text": text,
            "amount": float(amount.group(1)) if amount else None,
        })
    return bands


def ticketing_label(column_html):
    """The plugin's ticketing kind ("paid", "pwyw", "free", "unticketed"...), printed
    after an empty `<strong><b></strong>` marker; None where the template has none."""
    marker = column_html.rfind("<b></strong>")
    return clean_text(column_html[marker + len("<b></strong>"):]) or None if marker >= 0 else None


def perf_rows(page_html, year):
    """Every `etron-perf-row` on an event page, in the site's vocabulary.

    A row whose date or start cannot be read is still returned (with None) so
    the fetcher can count it as skipped rather than lose it silently.
    """
    rows = []
    block = page_html.find('id="etron-perfs-block"')
    if block < 0:
        return rows
    for row in _ROW_RE.findall(page_html[block:]):
        columns = dict(_COLUMN_RE.findall(row))
        first = columns.get("one", "")
        venue = _VENUE_LINK_RE.search(first)
        when = clean_text(_VENUE_LINK_RE.sub(" ", first))
        mark_text = clean_text(columns.get("four", ""))
        status = next((ours for theirs, ours in STATUS_MARKS if theirs in mark_text.lower()), None)
        two = columns.get("two", "")
        rows.append({
            "date": parse_date(when, year),
            "start": parse_time(when),
            "when": when,
            "venue": venue.group(1) if venue else None,
            "venueName": clean_text(venue.group(2)) if venue else None,
            "prices": price_bands(two),
            "ticketing": ticketing_label(two),
            "mark": mark_text or None,
            "status": status,
        })
    return rows


def venue_details(page_html):
    """{lat, lng, address} from a venue page; each None when the page does not print it."""
    lat = lng = None
    m = _LATLNG_RE.search(page_html) or _MAPS_Q_RE.search(page_html)
    if m:
        lat, lng = round(float(m.group(1)), 6), round(float(m.group(2)), 6)
    address = None
    a = _ADDRESS_RE.search(page_html)
    if a:
        lines = [clean_text(p) for p in _P_RE.findall(a.group(1))]
        address = ", ".join(line for line in lines if line) or None
    return {"lat": lat, "lng": lng, "address": address}


def build(site, edition, fetch_json, fetch_pages):
    """The edition's programme from one Eventotron site, in the site's vocabulary.

    `fetch_json(path_with_query)` answers a REST path under `/wp-json/wp/v2/`;
    `fetch_pages(urls)` answers each URL's HTML page, in order, None where the
    site 404s it — a batch, so the caller can fetch a whole programme's pages
    concurrently. Events whose every performance falls
    outside the edition are recorded in `outOfEdition`, not dropped silently —
    both sites keep year-round events (previews, "best of" nights) in the same
    post type.
    """
    lo, hi = edition["first"], edition["last"]
    year = int(edition["id"])
    genres = {g["id"]: {"slug": g["slug"], "name": clean_text(g["name"])}
              for g in rest_all(fetch_json, "genres", "id,slug,name")}
    venue_posts = {v["slug"]: v for v in rest_all(fetch_json, "venues", "id,slug,link,title")}
    events = rest_all(fetch_json, "events", "id,slug,link,title,content,genres,featured_media,modified_gmt")

    shows, out_of_edition, unparsed, cancelled = [], [], [], 0
    used_venues = {}
    pages = fetch_pages([event["link"] for event in events])
    for event, page in zip(events, pages):
        rows = perf_rows(page or "", year)
        performances = []
        for row in rows:
            if row["date"] is None or row["start"] is None or row["venue"] is None:
                unparsed.append({"slug": event["slug"], "when": row["when"], "venue": row["venue"]})
                continue
            if row["status"] == "cancelled":
                cancelled += 1
                continue
            if not lo <= row["date"] <= hi:
                continue
            performances.append({k: row[k] for k in ("date", "start", "venue", "prices", "ticketing", "mark", "status")})
            used_venues.setdefault(row["venue"], row["venueName"])
        if not performances:
            out_of_edition.append(event["slug"])
            continue
        shows.append({
            "id": event["id"],
            "slug": event["slug"],
            "title": clean_text(event["title"]["rendered"]),
            "url": event["link"],
            "genres": [genres[g]["slug"] for g in event.get("genres", []) if g in genres],
            "description": clean_text(event["content"]["rendered"]) or None,
            "modified": event.get("modified_gmt"),
            "performances": sorted(performances, key=lambda p: (p["date"], p["start"], p["venue"])),
        })

    venues = []
    venue_urls = [venue_posts[slug]["link"] if slug in venue_posts else "%s/venues/%s/" % (site, slug)
                  for slug in sorted(used_venues)]
    for slug, url, page in zip(sorted(used_venues), venue_urls, fetch_pages(venue_urls)):
        post = venue_posts.get(slug)
        details = venue_details(page or "")
        venues.append({
            "slug": slug,
            "name": clean_text(post["title"]["rendered"]) if post else used_venues[slug],
            "url": url,
            **details,
        })

    shows.sort(key=lambda s: (s["performances"][0]["date"], s["performances"][0]["start"], s["slug"]))
    return {
        "site": site,
        "edition": edition["id"],
        "genres": sorted(({"slug": g["slug"], "name": g["name"]} for g in genres.values()), key=lambda g: g["slug"]),
        "venues": venues,
        "shows": shows,
        "outOfEdition": sorted(out_of_edition),
        "unparsedRows": unparsed,
        "cancelledPerformances": cancelled,
    }


FETCHER_VERSION = 1


def run(festival_dir, site, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live site, guard, write raw.

    The one function here that touches network and disk, through `common`.
    """
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch %s's Eventotron programme into its raw folder." % site)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    cache = registry.cache_dir(festival, edition["id"], source_id)
    rest = site + "/wp-json/wp/v2/"
    programme = build(site, edition, lambda path: common.get(rest + path),
                      lambda urls: common.fetch_all(lambda url: common.cached_page(cache, url), urls))
    common.guard_dates(edition, [p["date"] for s in programme["shows"] for p in s["performances"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[rest + "events", rest + "venues", rest + "genres", site + "/events/<slug>/", site + "/venues/<slug>/"],
        notes="WP REST gives identity, blurb and genres; date, start, venue, price bands and marks are read "
              "from each event page's etron-perf-row blocks, coordinates and address from each venue page "
              "(scraper/festivals/platforms/eventotron.py).",
    )
    print("%d shows, %d performances, %d venues; %d events outside the edition, %d unparsed rows, %d cancelled" % (
        len(programme["shows"]), sum(len(s["performances"]) for s in programme["shows"]), len(programme["venues"]),
        len(programme["outOfEdition"]), len(programme["unparsedRows"]), programme["cancelledPerformances"]))


def rest_all(fetch_json, post_type, fields, per_page=100):
    """Every record of one REST collection, page by page until a short page."""
    records, page = [], 1
    while True:
        batch = fetch_json("%s?per_page=%d&page=%d&_fields=%s" % (post_type, per_page, page, fields))
        records.extend(batch)
        if len(batch) < per_page:
            return records
        page += 1


# --- self-test: samples copied from the live pages, 2026-09-25 --------------

BRIGHTON_ROW = """<div id="etron-perfs-block" style="scroll-margin-top: 40px;">
<div class="etron-perf-row perfdate2026-05-31" style="  ">
		<div class="etron-perf-column etron-perf-column-one">
			<h4 class="etron-detail-item">May 31, 2026 </h4><h5 class="etron-detail-item">7:00 pm</h5><p class="etron-detail-item"><a target="_blank" class="etron-link venue-link" href="/venues/laughing-horse-ao-hostel-bar-front-room">Laughing Horse @ a&amp;o Hostel bar (Front Room)</a></p>
		</div>
		<div class="etron-perf-column etron-perf-column-two">
			<h4 class="etron-detail-item"><strong>Standard: </strong> FREE (PWYW)</h4><strong><b></strong> pwyw
		</div>
		<div class="etron-perf-column etron-perf-column-three">
			<h4 class="etron-detail-item">  </h4>
		</div>
		<div class="etron-perf-column etron-perf-column-four">
			<span class="etron-cancelled" style="font-weight: bold; color: red;">CANCELLED</span>
			</div>
</div>
<div class="etron-perf-row perfdate2026-05-30" style="  ">
		<div class="etron-perf-column etron-perf-column-one">
			<h4 class="etron-detail-item">May 30, 2026 </h4><h5 class="etron-detail-item">4:00 pm</h5><p class="etron-detail-item"><a target="_blank" class="etron-link venue-link" href="/venues/brighton-fringe-streaming">Brighton Fringe Streaming</a></p>
		</div>
		<div class="etron-perf-column etron-perf-column-two">
			<h4 class="etron-detail-item"><strong>Standard: </strong> &pound;5</h4><h4 class="etron-detail-item"><strong>Concession: </strong> &pound;4.50</h4><strong><b></strong> paid
		</div>
		<div class="etron-perf-column etron-perf-column-three">
		</div>
		<div class="etron-perf-column etron-perf-column-four">
			</div>
</div>
			</div>
			<div id="etron-extended-block">"""

LEICESTER_ROW = """<div id="etron-perfs-block">
                <div class="etron-perf-row">
		<div class="etron-perf-column etron-perf-column-one">
			<h4 class="etron-detail-item">Wed 11th Feb 8.00pm</h4><h4 class="etron-detail-item"><a target="_blank" class="etron-link venue-link" href="/venues/the-big-difference">The Big Difference</a></h4>
		</div>
		<div class="etron-perf-column etron-perf-column-two">
			<h4 class="etron-detail-item"><strong>Full: </strong> &pound;8 </h4>
		</div>
		<div class="etron-perf-column etron-perf-column-three">
		</div>
		<div class="etron-perf-column etron-perf-column-four">
		</div>
</div>
            </div>
            <div id="etron-extended-block">"""

VENUE_PAGE = """<iframe src="https://www.google.com/maps/embed/v1/place?key=K&q=50.82027916813313,-0.13793796300888062&zoom=15"> </iframe>
<div class="venue_section_header" class="etron-detail-item">Venue Details</div><h4 class="etron-detail-item">Address</h4><p class="etron-detail-item">41-42 Old Steine</p><p class="etron-detail-item">East Sussex</p><div class="my_spacer" class="etron-detail-item"> </div>"""


def selftest():
    assert parse_time("4:00 pm") == "16:00"
    assert parse_time("Wed 11th Feb 8.00pm") == "20:00"
    assert parse_time("7pm") == "19:00"
    assert parse_time("12:30 am") == "00:30"
    assert parse_time("12 noon") == "12:00"
    assert parse_time("all day") is None
    assert parse_date("May 31, 2026", 2026) == "2026-05-31"
    assert parse_date("Wed 11th Feb 8.00pm", 2026) == "2026-02-11"
    assert parse_date("TBC", 2026) is None

    rows = perf_rows(BRIGHTON_ROW, 2026)
    assert len(rows) == 2, rows
    assert rows[0]["status"] == "cancelled" and rows[0]["start"] == "19:00"
    assert rows[0]["venue"] == "laughing-horse-ao-hostel-bar-front-room"
    assert rows[0]["venueName"] == "Laughing Horse @ a&o Hostel bar (Front Room)"
    assert rows[0]["prices"] == [{"band": "Standard", "text": "FREE (PWYW)", "amount": None}]
    assert rows[0]["ticketing"] == "pwyw", rows[0]["ticketing"]
    assert rows[1]["status"] is None and rows[1]["mark"] is None
    assert [b["amount"] for b in rows[1]["prices"]] == [5.0, 4.5]
    assert rows[1]["ticketing"] == "paid"
    # A band printed outside its own <h4> is still a band, and not the label.
    two = '<h4 class="etron-detail-item"><strong>Standard: </strong> &pound;10</h4><strong>Conc:</strong> &pound;8<strong><b></strong> paid\t'
    assert [b["amount"] for b in price_bands(two)] == [10.0, 8.0] and ticketing_label(two) == "paid"

    rows = perf_rows(LEICESTER_ROW, 2026)
    assert rows == [{
        "date": "2026-02-11", "start": "20:00", "when": "Wed 11th Feb 8.00pm",
        "venue": "the-big-difference", "venueName": "The Big Difference",
        "prices": [{"band": "Full", "text": "£8", "amount": 8.0}],
        "ticketing": None, "mark": None, "status": None,
    }], rows
    assert perf_rows("<html>no block</html>", 2026) == []

    assert venue_details(VENUE_PAGE) == {"lat": 50.820279, "lng": -0.137938, "address": "41-42 Old Steine, East Sussex"}
    assert venue_details("<p>nothing</p>") == {"lat": None, "lng": None, "address": None}

    # build(), end to end over a two-event fake site: one in the edition, one
    # (a "best of" night after it) recorded as out of edition.
    pages = {
        "https://x/events/a/": BRIGHTON_ROW,
        "https://x/events/b/": LEICESTER_ROW.replace("11th Feb", "1st Apr"),
        "https://x/venues/brighton-fringe-streaming/": VENUE_PAGE,
    }
    rest = {
        "genres": [{"id": 1, "slug": "comedy", "name": "Comedy"}],
        "venues": [{"id": 9, "slug": "brighton-fringe-streaming", "link": "https://x/venues/brighton-fringe-streaming/",
                    "title": {"rendered": "Brighton Fringe Streaming"}}],
        "events": [
            {"id": 1, "slug": "a", "link": "https://x/events/a/", "title": {"rendered": "A &amp; B"},
             "content": {"rendered": "<p>Blurb</p>"}, "genres": [1], "modified_gmt": "2026-05-01T00:00:00"},
            {"id": 2, "slug": "b", "link": "https://x/events/b/", "title": {"rendered": "B"},
             "content": {"rendered": ""}, "genres": [], "modified_gmt": "2026-05-01T00:00:00"},
        ],
    }
    programme = build(
        "https://x", {"id": "2026", "first": "2026-05-01", "last": "2026-05-31"},
        lambda path: rest[path.split("?")[0]] if "page=1&" in path else [],
        lambda urls: [pages[url] for url in urls],
    )
    assert [s["slug"] for s in programme["shows"]] == ["a"]
    assert programme["shows"][0]["title"] == "A & B"
    assert len(programme["shows"][0]["performances"]) == 1
    assert programme["outOfEdition"] == ["b"]
    assert programme["cancelledPerformances"] == 1
    assert programme["venues"][0]["lat"] == 50.820279
    print("eventotron platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: eventotron.py --selftest")
    selftest()
