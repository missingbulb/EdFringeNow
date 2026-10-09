#!/usr/bin/env python3
"""Measure each festival's popularity: Wikipedia pageviews over the last 12 full months.

    python3 scraper/festivals/popularity.py                # every festival with a `wikidata` QID
    python3 scraper/festivals/popularity.py <festival-id>…  # just those
    python3 scraper/festivals/popularity.py --find         # Wikidata candidates for festivals with no QID

The festival's article in every language edition is found through its Wikidata
item (`wikidata = "Q…"` in festival.toml, set by a person after `--find`, never
guessed here), and the user pageviews of each article over the window are
summed. The result is written to `<festival dir>/popularity.json`, which the
registry carries into `site/data/festivals/index.json` as `popularity`; re-run
`python3 scraper/convert/to_serving.py --index` afterwards.

An item with no Wikipedia article has no popularity: its file is removed rather
than written as zero, so the year strip falls back to the festival's event
count. Runs by hand, like the fetchers; Wikimedia rate-limits shared addresses
hard, so requests are paced and a 429 waits out its Retry-After.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timezone

import registry

USER_AGENT = "EdFringeNow-popularity/1.0 (https://www.edfringenow.com)"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
PAGEVIEWS = ("https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
             "%s/all-access/user/%s/monthly/%s/%s")
MEASURE = "wikipedia-user-pageviews-12-months"
FILENAME = "popularity.json"
PACE_SECONDS = 1.0
MAX_ATTEMPTS = 8

_last_request = [0.0]


def get_json(url):
    """The decoded body, or None on a 404 (pageviews: no data for that article)."""
    for attempt in range(MAX_ATTEMPTS):
        wait = PACE_SECONDS - (time.monotonic() - _last_request[0])
        if wait > 0:
            time.sleep(wait)
        _last_request[0] = time.monotonic()
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            if error.code in (429, 502, 503, 504) and attempt + 1 < MAX_ATTEMPTS:
                delay = int(error.headers.get("Retry-After") or 0) or 5 * 2 ** attempt
                print("  %d, waiting %ds" % (error.code, delay), file=sys.stderr)
                time.sleep(delay)
                continue
            raise
    raise RuntimeError("unreachable")


def window(today):
    """The last 12 full months before `today`: (first month, last month) as YYYY-MM."""
    year, month = today.year, today.month - 1
    if month == 0:
        year, month = year - 1, 12
    last = "%04d-%02d" % (year, month)
    first_year, first_month = (year, month + 1) if month < 12 else (year + 1, 1)
    first = "%04d-%02d" % (first_year - 1, first_month)
    return first, last


def month_end(month):
    year, mon = int(month[:4]), int(month[5:])
    following = date(year + (mon == 12), mon % 12 + 1, 1)
    return (following.toordinal() - 1)


def wikipedia_articles(qid):
    """{project: title} for every Wikipedia language edition the item has an article in."""
    url = "%s?%s" % (WIKIDATA_API, urllib.parse.urlencode({
        "action": "wbgetentities", "ids": qid, "props": "sitelinks/urls", "format": "json",
    }))
    entity = get_json(url)["entities"][qid]
    if "missing" in entity:
        raise SystemExit("%s does not exist on Wikidata" % qid)
    if "redirects" in entity:
        raise SystemExit("%s redirects to %s; record that QID instead" % (qid, entity["id"]))
    articles = {}
    for link in entity.get("sitelinks", {}).values():
        host = urllib.parse.urlparse(link["url"]).hostname or ""
        if host.endswith(".wikipedia.org"):
            articles[host[: -len(".org")]] = link["title"]
    return articles


def views(project, title, first, last):
    start = first.replace("-", "") + "01"
    end = date.fromordinal(month_end(last)).strftime("%Y%m%d")
    article = urllib.parse.quote(title.replace(" ", "_"), safe="")
    body = get_json(PAGEVIEWS % (project, article, start, end))
    # A 404 is an article with no recorded views in the window: a real zero,
    # since the sitelink says the article exists.
    return sum(item["views"] for item in (body or {}).get("items", []))


def measure(festival, today):
    path = os.path.join(festival["_dir"], FILENAME)
    qid = festival["wikidata"]
    first, last = window(today)
    articles = wikipedia_articles(qid)
    if not articles:
        if os.path.exists(path):
            os.remove(path)
        print("%s: %s has no Wikipedia article; no popularity" % (festival["id"], qid))
        return
    counted = {}
    for project in sorted(articles):
        counted[project] = {"title": articles[project], "views": views(project, articles[project], first, last)}
    record = {
        "measure": MEASURE,
        "wikidata": qid,
        "first": first,
        "last": last,
        "fetchedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "views": sum(a["views"] for a in counted.values()),
        "articles": counted,
    }
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=False, indent=1) + "\n")
    print("%s: %d views across %d article(s), %s..%s" % (festival["id"], record["views"], len(counted), first, last))


def find(festival):
    url = "%s?%s" % (WIKIDATA_API, urllib.parse.urlencode({
        "action": "wbsearchentities", "search": festival["name"], "language": "en",
        "type": "item", "limit": 5, "format": "json",
    }))
    hits = get_json(url).get("search", [])
    print("%s (%s):" % (festival["id"], festival["name"]))
    for hit in hits:
        print("  %s  %s — %s" % (hit["id"], hit.get("label", ""), hit.get("description", "")))
    if not hits:
        print("  no candidates; try the festival's own-language name")


def main(argv):
    festivals = registry.load_all()
    if argv == ["--find"]:
        for fid in sorted(festivals):
            if "wikidata" not in festivals[fid]:
                find(festivals[fid])
        return 0
    wanted = argv or sorted(fid for fid in festivals if "wikidata" in festivals[fid])
    today = date.today()
    for fid in wanted:
        if fid not in festivals:
            print("unknown festival %r" % fid, file=sys.stderr)
            return 2
        if "wikidata" not in festivals[fid]:
            print("%s: no wikidata QID in festival.toml; run --find" % fid, file=sys.stderr)
            continue
        measure(festivals[fid], today)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
