#!/usr/bin/env python3
"""Scrape all Edinburgh Fringe shows from the edfringe.com data API.

The edfringe.com "What's On" listing is a Next.js app that loads shows
client-side from a GraphQL API; the HTML pages are an empty shell. This script
talks to that API directly, which is both far cleaner (structured JSON) and
much kinder to the site than rendering HTML.

Flow:
  1. POST /token with the site's public anonymous credentials -> bearer token.
  2. POST /graphql `EventsSearch` for each page (50 shows per page), paging
     until every show has been fetched. `total` from the first response tells
     us how many pages there are (~77).

Output (default data/raw_pages/):
  * page_NN.json   - the raw `events` payload for each page (for later re-use)
  * shows.json     - all show results flattened into a single array

Behaviour mirrors the original downloader: a random delay between requests,
resumable (existing page files are skipped), atomic writes.

Usage:
    python3 scraper/fetch_shows.py                  # fetch every page
    python3 scraper/fetch_shows.py --min-delay 4 --max-delay 9
    python3 scraper/fetch_shows.py --force          # re-fetch all pages
    python3 scraper/fetch_shows.py --per 50 --season EDFRINGE-2026
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

API_BASE = "https://edfringe-tikketr-web-api.equhost.com"
TOKEN_URL = f"{API_BASE}/token"
GRAPHQL_URL = f"{API_BASE}/graphql"

# Public anonymous credentials embedded in the site's JavaScript. They only
# grant read access to the same public listing the website shows to everyone.
DEFAULT_USERNAME = "anonymous"
DEFAULT_PASSWORD = "2add50c2-ac54-4c1e-b5bc-f8d9ca66a067"

DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw_pages"
DEFAULT_PER = 50
# Fixed seed so the server's ordering is stable across paged requests; without
# it a randomised sort could duplicate/skip shows between pages.
DEFAULT_SEED = "123"

# The exact EventsSearch operation the website sends (captured from the app).
EVENTS_SEARCH_QUERY = """
    query EventsSearch($criteria: SearchCriteriaInput!) {
  events(input: $criteria) {
    total
    page
    per
    results {
      ...EventSearchResult
    }
  }
}

    fragment EventSearchResult on EventDetail {
  id
  title
  genre
  startingDate
  endingDate
  datesDisplay
  hasVariousStartingTime
  duration
  boxOfficeRef
  accessibility
  accessibilityNotes
  distance
  cmsRef
  slug
  priceType
  freeTicketed
  canceleld
  performances {
    ...PerformanceMaster
  }
  presentedBy
  description
  ageRestriction
  venues {
    title
    slug
  }
  spaces {
    id
    title
    venueName
    venueCode
  }
  images {
    url
    imageType
    boxOfficeId
    cmsId
  }
  attributes {
    id
    key
    attributeTypes
    value
    eventCode
  }
}

    fragment PerformanceMaster on PerformanceMaster {
  id
  title
  dateTime
  estimatedEndDateTime
  status
  duration
  notes
  cancelled
  soldOut
  boxOfficeId
  boxOfficeRef
  ticketsAvailable
  accessibility
  ticketStatus
  badges {
    label
    colour
  }
  concessions {
    code
    concessionRef
    description
    scheme_ref
    title
  }
}
    """

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
REQUEST_TIMEOUT = 30
MAX_RETRIES = 3


def post_json(url: str, payload: dict, token: str | None = None) -> dict:
    """POST JSON, retrying transient failures, returning the decoded response."""
    body = json.dumps(payload).encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
        "Origin": "https://www.edfringe.com",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            req = Request(url, data=body, headers=headers, method="POST")
            with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except HTTPError as exc:
            # Auth expiry or bad request won't fix themselves on retry.
            if exc.code in (400, 401, 403):
                raise
            last_err = exc
        except (URLError, json.JSONDecodeError) as exc:
            last_err = exc
        if attempt < MAX_RETRIES:
            backoff = 2 ** attempt
            print(f"    retry {attempt}/{MAX_RETRIES - 1} after {backoff}s "
                  f"({last_err})", file=sys.stderr)
            time.sleep(backoff)
    raise RuntimeError(f"POST {url} failed: {last_err}")


def get_token(username: str, password: str) -> str:
    data = post_json(TOKEN_URL, {"username": username, "password": password})
    token = data.get("token")
    if not token:
        raise RuntimeError(f"no token in response: {data}")
    return token


def fetch_events_page(token: str, page: int, per: int, seed: str) -> dict:
    payload = {
        "query": EVENTS_SEARCH_QUERY,
        "variables": {"criteria": {
            "page": page,
            "per": per,
            "sortBy": "TITLE",
            "sortBySeed": seed,
            "recentlyAdded": "ANY",
        }},
        "operationName": "EventsSearch",
    }
    data = post_json(GRAPHQL_URL, payload, token=token)
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors on page {page}: {data['errors']}")
    return data["data"]["events"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR,
                        help=f"output directory (default {DEFAULT_OUT_DIR})")
    parser.add_argument("--per", type=int, default=DEFAULT_PER,
                        help=f"shows per page (default {DEFAULT_PER})")
    parser.add_argument("--seed", default=DEFAULT_SEED,
                        help="sortBySeed for stable paging (default %(default)s)")
    parser.add_argument("--season", default="EDFRINGE-2026",
                        help="season code, informational (default %(default)s)")
    parser.add_argument("--username", default=DEFAULT_USERNAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--min-delay", type=float, default=4.0,
                        help="minimum delay between requests, seconds (default 4)")
    parser.add_argument("--max-delay", type=float, default=9.0,
                        help="maximum delay between requests, seconds (default 9)")
    parser.add_argument("--max-pages", type=int, default=None,
                        help="cap the number of pages (default: all)")
    parser.add_argument("--force", action="store_true",
                        help="re-fetch pages even if they already exist")
    args = parser.parse_args()

    if args.min_delay > args.max_delay:
        parser.error("--min-delay must not exceed --max-delay")

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    print("Authenticating...")
    token = get_token(args.username, args.password)

    # First page tells us the total so we know how many pages to fetch.
    print("Fetching page 1 to determine total...")
    first = fetch_events_page(token, 1, args.per, args.seed)
    total = first["total"]
    total_pages = max(1, math.ceil(total / args.per))
    if args.max_pages:
        total_pages = min(total_pages, args.max_pages)
    width = max(2, len(str(total_pages)))
    print(f"{total} shows across {total_pages} pages (per={args.per})")

    all_shows: list[dict] = []

    def save_page(page: int, events: dict) -> None:
        dest = out_dir / f"page_{page:0{width}d}.json"
        tmp = dest.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(events, ensure_ascii=False, indent=1))
        tmp.replace(dest)

    fetched = skipped = failed = 0
    for page in range(1, total_pages + 1):
        dest = out_dir / f"page_{page:0{width}d}.json"
        if dest.exists() and not args.force:
            try:
                events = json.loads(dest.read_text())
                all_shows.extend(events.get("results", []))
                print(f"[{page}/{total_pages}] skip (exists): {dest.name}")
                skipped += 1
                continue
            except (json.JSONDecodeError, OSError):
                pass  # fall through and re-fetch a corrupt file

        if page == 1:
            events = first
        else:
            print(f"[{page}/{total_pages}] EventsSearch page={page}")
            try:
                events = fetch_events_page(token, page, args.per, args.seed)
            except Exception as exc:  # noqa: BLE001
                print(f"    ERROR: {exc}", file=sys.stderr)
                failed += 1
                continue

        results = events.get("results", [])
        save_page(page, events)
        all_shows.extend(results)
        print(f"    saved {len(results)} shows -> {dest.name}")
        fetched += 1

        if page < total_pages:
            delay = random.uniform(args.min_delay, args.max_delay)
            print(f"    sleeping {delay:.1f}s")
            time.sleep(delay)

    # Flatten everything into one file for convenience.
    shows_path = out_dir / "shows.json"
    shows_path.write_text(json.dumps(all_shows, ensure_ascii=False, indent=1))
    print(f"\nDone. fetched={fetched} skipped={skipped} failed={failed}")
    print(f"Total shows collected: {len(all_shows)} -> {shows_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
