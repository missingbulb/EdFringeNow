#!/usr/bin/env python3
"""Smarticket: the Israeli box-office platform whose tenants several festivals sell through.

A tenant is `https://<tenant>.smarticket.co.il/`. A festival is either the
tenant itself or one of its categories, a page (`/<category name>`) that lists
one card per performance:

    <a href="<show slug>" … class="col-xs-12 show …" data-label="<performance id>">

Each performance has its own page, `https://<tenant>.smarticket.co.il/<show slug>/?id=<performance id>`,
server-rendered with a schema.org `Event` in JSON-LD (name, start and end,
place, running time, the price on sale and its availability, the show's
picture) and the show's full description (`txt_container`).

This module turns those into one raw programme per edition, in Smarticket's own
vocabulary. Parsing is pure; `build` fetches only through the `fetch_page`
callable it is handed, and `run` is the hand-run fetcher's entry point.

    python3 scraper/festivals/platforms/smarticket.py --selftest
"""

import html
import json
import re
import sys
import urllib.parse

FETCHER_VERSION = 1

_CARD = re.compile(r'<a\s+href="([^"]+)"[^>]*?class="col-xs-12 show\b[^"]*"[^>]*?data-label="(\d+)"', re.S)
_LD = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
_BLOCK_END = re.compile(r"</(p|div|li|h[1-6])\s*>|<br\s*/?>", re.I)
_TAG = re.compile(r"<[^>]+>")


def listing(page):
    """The listing's cards -> [(show slug, performance id)], in order, each once."""
    seen, out = set(), []
    for slug, perf in _CARD.findall(page):
        key = (html.unescape(slug), int(perf))
        if key not in seen:
            seen.add(key)
            out.append(key)
    return out


def text_of(markup):
    """Description HTML as plain paragraphs, or None when it holds no text."""
    if not markup:
        return None
    value = html.unescape(_TAG.sub("", _BLOCK_END.sub("\n", markup)))
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in value.split("\n")]
    return "\n".join(line for line in lines if line) or None


def _minutes(duration):
    found = re.match(r"^PT(?:(\d+)H)?(?:(\d+)M)?$", duration or "")
    if not found or not any(found.groups()):
        return None
    return int(found.group(1) or 0) * 60 + int(found.group(2) or 0)


def performance(page):
    """A performance page -> its facts, from the page's JSON-LD Event and description."""
    event = None
    for block in _LD.findall(page):
        data = json.loads(block)
        if isinstance(data, dict) and data.get("@type") == "Event":
            event = data
            break
    if event is None:
        raise ValueError("the performance page carries no JSON-LD Event")
    offers = event.get("offers") or {}
    location = event.get("location") or {}
    description = re.search(r'<div class="txt_container">\s*<h2[^>]*>.*?</h2>(.*?)</div>', page, re.S)
    images = event.get("image") or []
    return {
        "name": html.unescape(event.get("name") or "").strip() or None,
        "startDate": event.get("startDate"),
        "endDate": event.get("endDate"),
        "durationMin": _minutes(event.get("duration")),
        "location": (location.get("name") or "").strip() or None,
        "streetAddress": (location.get("streetAddress") or "").strip() or None,
        "price": offers.get("price"),
        "priceCurrency": offers.get("priceCurrency"),
        "availability": offers.get("availability"),
        "offerUrl": offers.get("url"),
        "image": images[0] if isinstance(images, list) and images else (images or None),
        "brief": (event.get("description") or "").strip() or None,
        "description": text_of(description.group(1)) if description else None,
    }


def build(base, listing_path, edition, fetch_page):
    """The edition's performances on the listing page, oldest first.

    `base` is the tenant's root URL; `fetch_page(url)` answers a page's HTML.
    A listing can be a tenant's whole season, so only performances inside the
    edition's dates are the festival's.
    """
    listing_url = urllib.parse.urljoin(base, listing_path)
    cards = listing(fetch_page(listing_url) or "")
    if not cards:
        raise ValueError("%s lists no performances" % listing_url)
    urls = [urllib.parse.urljoin(base, "%s/?id=%d" % (urllib.parse.quote(slug, safe="/%"), perf)) for slug, perf in cards]
    records = []
    for (slug, perf), url in zip(cards, urls):
        facts = performance(fetch_page(url) or "")
        day = (facts["startDate"] or "")[:10]
        if not edition["first"] <= day <= edition["last"]:
            continue
        records.append({"id": perf, "show": slug, "url": url, **facts})
    records.sort(key=lambda r: (r["startDate"], r["id"]))
    return {"tenant": base, "listing": listing_url, "edition": edition["id"], "performances": records}


def run(festival_dir, base, listing_path, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live tenant, guard, write raw."""
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch a Smarticket listing's performances into their raw folder.")
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    cache = registry.cache_dir(festival, edition["id"], source_id)
    try:
        programme = build(base, listing_path, edition, lambda url: common.cached_page(cache, url))
    except ValueError as error:
        raise common.FetchRefused("%s; nothing written" % error)
    common.guard_dates(edition, [p["startDate"][:10] for p in programme["performances"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[programme["listing"], base + "<show slug>/?id=<performance id>"],
        notes="The listing's performance cards, then each performance's own page: its JSON-LD Event "
              "(start, place, running time, price on sale, availability, picture) and description "
              "(scraper/festivals/platforms/smarticket.py).",
    )
    print("%d performances of %d shows" % (len(programme["performances"]), len({p["show"] for p in programme["performances"]})))


def selftest():
    # Shapes copied from galil-elion.smarticket.co.il, 2026-10-02, trimmed.
    listing_page = '''<a href="_2__שלומי_שבן_והפסנתר"
        aria-labelledby="x" class="col-xs-12 show wow pulse default" data-label="5293" data-type="default">
        <a href="_9_next_year" class="col-xs-12 show default" data-label="7000">'''
    perf_page = '''<h1><span class="title-name">[2] שלומי שבן והפסנתר</span></h1>
    <div class="txt_container"><h2 class="lined" id="show_theater_txt">פרטים נוספים</h2>
    <p><span>אחד היוצרים &amp; המקוריים.</span></p>\n<p><span>קרדיט צילום: דודי חסון</span></p></div>
    <script type="application/ld+json" nonce="x">{"@context": "https://schema.org", "@type": "Event",
      "name": "[2] שלומי שבן והפסנתר", "startDate": "%s", "endDate": "2026-10-28T21:40:00",
      "location": {"@type": "Place", "name": "בית העם כפר בלום", "streetAddress": "חניה"},
      "description": "שלומי שבן מופע סולו.\\n\\n \\n", "duration": "PT1H10M",
      "offers": {"@type": "Offer", "url": "https://t.test/event/5293", "price": "150", "priceCurrency": "ILS",
                 "availability": "https://schema.org/InStock"},
      "image": ["https://t.test//uploads/thumbs/a.jpg"]}</script>'''
    pages = {
        "https://t.test/%D7%A4%D7%A1%D7%98%D7%99%D7%91%D7%9C": listing_page,
        "https://t.test/_2__%D7%A9%D7%9C%D7%95%D7%9E%D7%99_%D7%A9%D7%91%D7%9F_%D7%95%D7%94%D7%A4%D7%A1%D7%A0%D7%AA%D7%A8/?id=5293":
            perf_page % "2026-10-28T20:30:00",
        "https://t.test/_9_next_year/?id=7000": perf_page % "2027-10-28T20:30:00",
    }
    programme = build("https://t.test/", "%D7%A4%D7%A1%D7%98%D7%99%D7%91%D7%9C",
                      {"id": "2026", "first": "2026-10-28", "last": "2026-11-01"}, pages.get)
    rows = programme["performances"]
    assert [r["id"] for r in rows] == [5293], rows
    row = rows[0]
    assert (row["show"], row["startDate"], row["location"]) == ("_2__שלומי_שבן_והפסנתר", "2026-10-28T20:30:00", "בית העם כפר בלום")
    assert (row["price"], row["availability"], row["durationMin"]) == ("150", "https://schema.org/InStock", 70)
    assert row["image"] == "https://t.test//uploads/thumbs/a.jpg"
    assert row["description"] == "אחד היוצרים & המקוריים.\nקרדיט צילום: דודי חסון", row["description"]
    assert row["brief"] == "שלומי שבן מופע סולו."
    try:
        performance("<html></html>")
    except ValueError:
        pass
    else:
        raise AssertionError("a page with no Event must be refused")
    print("smarticket platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: smarticket.py --selftest")
    selftest()
