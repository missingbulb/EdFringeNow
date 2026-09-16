#!/usr/bin/env python3
"""Scrape the Jerusalem Comedy Festival into site/data/jerusalem/.

A ONE-SHOT scrape, deliberately: this festival publishes a fixed five-night
programme, sells through two external ticketers, and posts no live availability
or cancellations, so there is nothing for a nightly job to refresh. Run it when
the programme changes and commit what it writes — there is no scheduled task,
and adding one would be inventing work the source cannot feed.

    python3 scraper/jerusalem/fetch.py --year 2026

The parsing half lives in parse.py and is proven offline by its own self-test;
this module is only the network and the file writing.
"""

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import parse as jparse  # noqa: E402  (path set above so this runs as a script)

SITE = "https://comedy-festival.co.il"
REST = SITE + "/wp-json/wp/v2"
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# The catalogue is served to the browser, so it belongs in the published tree;
# the raw page cache is this scrape's own working data and stays out of it.
OUT_DIR = os.path.join(REPO_ROOT, "site", "data", "jerusalem")
CACHE_DIR = os.path.join(REPO_ROOT, "data", "jerusalem", "raw_pages")

# Nominatim asks every caller to identify itself and to stay under one request a
# second; both are honoured here because the eight venues are geocoded once.
GEOCODER = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "EdFringeNow-jerusalem-scraper/1.0 (+https://www.edfringenow.com)"
GEOCODE_PAUSE_SECONDS = 1.1


def get(url, as_json=True, attempts=4):
    """One GET, retried on a dropped connection.

    Both hosts this talks to reset a connection occasionally, and a scrape that
    dies two thirds of the way through leaves a half-written catalogue — so a
    transport failure is retried with a widening pause, while an HTTP error
    (which will not fix itself) is raised on the spot.
    """
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                body = response.read().decode("utf-8")
            return json.loads(body) if as_json else body
        except urllib.error.HTTPError:
            raise
        except (urllib.error.URLError, OSError):
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)


def rest(path, **params):
    params.setdefault("per_page", 100)
    return get(REST + "/" + path + "?" + urllib.parse.urlencode(params))


def event_page(slug, url):
    """The event's rendered page, cached on disk so re-runs need no network."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, slug + ".html")
    if os.path.exists(path) and os.path.getsize(path) > 1024:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    body = get(url, as_json=False)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
    return body


def geocode(address):
    """Street address -> (lat, lng), or None when the geocoder has no match.

    A venue with no coordinates is kept in the file without them: the planner
    falls back to its flat inter-show gap where it cannot measure a distance,
    which is honest, whereas a guessed point would quietly mis-time a walk.
    """
    query = urllib.parse.urlencode({"q": address, "format": "json", "limit": 1})
    try:
        results = get(GEOCODER + "?" + query)
    except Exception as error:  # noqa: BLE001 — one venue's failure isn't fatal
        print("  geocode failed for %s: %s" % (address, error), file=sys.stderr)
        return None
    if not results:
        return None
    return round(float(results[0]["lat"]), 6), round(float(results[0]["lon"]), 6)


def build(year):
    year_terms = {t["name"]: t["id"] for t in rest("event-year")}
    if str(year) not in year_terms:
        raise SystemExit("no event-year term for %s (have %s)" % (year, sorted(year_terms)))
    year_term = year_terms[str(year)]

    locations = {t["id"]: t for t in rest("eventlocation")}
    categories = {t["id"]: t for t in rest("event-type")}
    date_posts = {p["id"]: p for p in rest("dates")}
    all_dates = set(date_posts)

    events = [e for e in rest("events") if year_term in e.get("event-year", [])]
    print("%d events tagged %s" % (len(events), year))

    venue_addresses = {}
    skipped = []
    shows = []
    for event in events:
        page = event_page(event["slug"], event["link"])
        performances = jparse.page_performances(page, all_dates, year)
        if not performances:
            # The four "family events on <weekday>" pages are placeholders: no
            # date, no venue, no blurb. They are recorded rather than dropped
            # silently, so a future run that finds them filled in is a visible
            # change rather than a surprise.
            skipped.append(event["slug"])
            continue

        venue_ids = []
        for performance in performances:
            terms = date_posts[performance["id"]].get("eventlocation") or []
            venue_id = terms[0] if terms else None
            performance["venue"] = venue_id
            if venue_id is not None and venue_id not in venue_ids:
                venue_ids.append(venue_id)

        address = jparse.page_address(page, [locations[v]["name"] for v in venue_ids if v in locations])
        if address and len(venue_ids) == 1:
            venue_addresses.setdefault(venue_ids[0], address)

        shows.append(
            {
                "slug": event["slug"],
                "title": jparse.clean_text(event["title"]["rendered"]),
                "url": event["link"],
                "categories": [
                    categories[c]["slug"] for c in event.get("event-type", []) if c in categories
                ],
                "categoryNames": [
                    jparse.clean_text(categories[c]["name"])
                    for c in event.get("event-type", [])
                    if c in categories
                ],
                "description": jparse.page_description(page),
                "image": jparse.page_image(page),
                "duration": jparse.page_duration_minutes(page),
                "performances": [
                    {
                        "date": p["date"],
                        "start": p["start"],
                        "venue": venue_key(locations, p["venue"]),
                        "ticketUrl": p["ticketUrl"],
                        "free": p["free"],
                    }
                    for p in performances
                ],
            }
        )

    used = sorted({p["venue"] for s in shows for p in s["performances"] if p["venue"]})
    by_key = {venue_key(locations, i): i for i in locations}
    venues = []
    for key in used:
        term = locations[by_key[key]]
        address = venue_addresses.get(term["id"])
        coords = geocode(address) if address else None
        if address:
            time.sleep(GEOCODE_PAUSE_SECONDS)
        venues.append(
            {
                "code": key,
                "name": jparse.clean_text(term["name"]),
                "address": address,
                "lat": coords[0] if coords else None,
                "lng": coords[1] if coords else None,
            }
        )
        print("  venue %s -> %s" % (venues[-1]["name"], coords))

    dates = sorted({p["date"] for s in shows for p in s["performances"]})
    shows.sort(key=lambda s: (s["performances"][0]["date"], s["performances"][0]["start"], s["slug"]))
    return {
        "festival": {
            "id": "jerusalem-comedy",
            "name": "Jerusalem Comedy Festival",
            "nameLocal": "פסטיבל הקומדיה הישראלי",
            "city": "Jerusalem",
            "lang": "he",
            "timezone": "Asia/Jerusalem",
            "site": SITE,
            "year": year,
            "firstDate": dates[0],
            "lastDate": dates[-1],
        },
        "venues": venues,
        "skipped": skipped,
        "categories": sorted(
            {
                (c, n)
                for s in shows
                for c, n in zip(s["categories"], s["categoryNames"])
            }
        ),
        "shows": shows,
    }


def venue_key(locations, term_id):
    if term_id is None or term_id not in locations:
        return None
    return jparse.venue_code(locations[term_id]["slug"], term_id)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--selftest", action="store_true", help="run parse.py's offline self-test")
    args = parser.parse_args()
    if args.selftest:
        jparse.selftest()
        return

    catalogue = build(args.year)
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "shows.json")
    # Hebrew is written through as Hebrew: an \uXXXX-escaped file is valid JSON
    # but unreadable in a diff, which is where this data is reviewed.
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(catalogue, handle, ensure_ascii=False, indent=1, sort_keys=False)
        handle.write("\n")
    print(
        "wrote %s — %d shows, %d performances, %d venues"
        % (
            os.path.relpath(path, REPO_ROOT),
            len(catalogue["shows"]),
            sum(len(s["performances"]) for s in catalogue["shows"]),
            len(catalogue["venues"]),
        )
    )


if __name__ == "__main__":
    main()
