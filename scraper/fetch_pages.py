#!/usr/bin/env python3
"""Download the Edinburgh Fringe "What's On" listing pages for later extraction.

Stage 1 of scraping edfringe.com: fetch the paginated listing HTML and store it
on disk so that later parsing/extraction never has to hit the live site again.

Pages live at:
    https://www.edfringe.com/tickets/whats-on?page=PAGE_NUMBER
with PAGE_NUMBER running 1..77 (by default).

Behaviour:
  * Polite: sleeps a random delay (default 4-9s) between requests.
  * Resumable: skips pages already downloaded (unless --force). Safe to re-run.
  * Each page is written atomically to data/raw_pages/page_XX.html.

Usage:
    python3 scraper/fetch_pages.py                 # fetch pages 1..77
    python3 scraper/fetch_pages.py --start 10 --end 20
    python3 scraper/fetch_pages.py --force         # re-download everything
    python3 scraper/fetch_pages.py --min-delay 4 --max-delay 9
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

BASE_URL = "https://www.edfringe.com/tickets/whats-on?page={page}"
DEFAULT_START = 1
DEFAULT_END = 77
DEFAULT_OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw_pages"

# A normal browser UA — the listing is public, this just avoids a default
# urllib UA that some sites reject.
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30  # seconds
MAX_RETRIES = 3       # per page, for transient network/5xx errors


def fetch(url: str) -> bytes:
    """Fetch a URL, retrying transient failures with exponential backoff."""
    last_err: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        req = Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                return resp.read()
        except HTTPError as exc:
            # 4xx (other than 429) won't fix themselves — fail fast.
            if exc.code != 429 and 400 <= exc.code < 500:
                raise
            last_err = exc
        except URLError as exc:
            last_err = exc
        if attempt < MAX_RETRIES:
            backoff = 2 ** attempt
            print(f"    retry {attempt}/{MAX_RETRIES - 1} after {backoff}s "
                  f"({last_err})", file=sys.stderr)
            time.sleep(backoff)
    raise RuntimeError(f"failed to fetch {url}: {last_err}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--start", type=int, default=DEFAULT_START,
                        help=f"first page number (default {DEFAULT_START})")
    parser.add_argument("--end", type=int, default=DEFAULT_END,
                        help=f"last page number, inclusive (default {DEFAULT_END})")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR,
                        help="directory to store page HTML "
                             f"(default {DEFAULT_OUT_DIR})")
    parser.add_argument("--min-delay", type=float, default=4.0,
                        help="minimum delay between requests, seconds (default 4)")
    parser.add_argument("--max-delay", type=float, default=9.0,
                        help="maximum delay between requests, seconds (default 9)")
    parser.add_argument("--force", action="store_true",
                        help="re-download pages even if they already exist")
    args = parser.parse_args()

    if args.min_delay > args.max_delay:
        parser.error("--min-delay must not exceed --max-delay")

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    # Zero-pad to the width of the largest page number for tidy sorting.
    width = max(2, len(str(args.end)))

    pages = list(range(args.start, args.end + 1))
    print(f"Fetching pages {args.start}..{args.end} into {out_dir}")

    fetched = skipped = failed = 0
    for i, page in enumerate(pages):
        dest = out_dir / f"page_{page:0{width}d}.html"
        if dest.exists() and not args.force:
            print(f"[{page}/{args.end}] skip (exists): {dest.name}")
            skipped += 1
            continue

        url = BASE_URL.format(page=page)
        print(f"[{page}/{args.end}] GET {url}")
        try:
            body = fetch(url)
        except Exception as exc:  # noqa: BLE001 - report and continue
            print(f"    ERROR: {exc}", file=sys.stderr)
            failed += 1
            continue

        # Atomic write so an interrupted run never leaves a truncated file.
        tmp = dest.with_suffix(".html.tmp")
        tmp.write_bytes(body)
        tmp.replace(dest)
        print(f"    saved {len(body):,} bytes -> {dest.name}")
        fetched += 1

        # Sleep only when another request will follow.
        if i < len(pages) - 1:
            delay = random.uniform(args.min_delay, args.max_delay)
            print(f"    sleeping {delay:.1f}s")
            time.sleep(delay)

    print(f"\nDone. fetched={fetched} skipped={skipped} failed={failed}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
