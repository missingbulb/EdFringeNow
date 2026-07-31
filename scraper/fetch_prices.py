#!/usr/bin/env python3
"""Scrape real ticket prices from the edfringe.com data API.

The listing API carries no money: `priceType` is a set of flags
(FREE / TWO_FOR_ONE / PAY_WHAT_YOU_WANT / …) and that is all `fetch_shows.py`
can see, which is why the site has only ever known "free vs paid". Amounts live
behind a **separate, per-performance** query:

    performancePrices(performanceRef: "1:790001") -> { prices: [ Price ] }

There is no bulk endpoint. Price *bands*, though, are set per show and repeat
across that show's performances, so one call per show is enough to learn what a
ticket costs — and `--sample-performances` re-checks that assumption by pricing
several performances of the same show and comparing the bands.

The result is a **cache, fetched once**: prices are a property of the show, not
of the day, so unlike `data/days/*.json` this file is not on the nightly refresh
path. `refresh-shows` never touches it; re-run this script by hand if the
festival re-prices.

Output (default `data/prices.json`, committed):

    {"v": 1, "fetchedAt": "2026-07-30",
     "shows": {"<cmsRef>": {"slug", "min", "max", "conc", "bands": [...], ...}}}

`normalize.py` folds `min`/`max`/`conc` into the master and the wire files; see
scraper/README.md.

Usage:
    python3 scraper/fetch_prices.py --slug daniel-sloss-bitter --print-raw
    python3 scraper/fetch_prices.py --slug daniel-sloss-bitter --sample-performances 3
    python3 scraper/fetch_prices.py --all                # every paid show (slow)
    python3 scraper/fetch_prices.py --all --limit 200    # resumable chunk
    python3 scraper/fetch_prices.py --selftest           # offline transform test
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import date
from pathlib import Path

# Same directory as this script, so a plain import works however it is launched.
from fetch_shows import (
    DEFAULT_PASSWORD,
    DEFAULT_PER,
    DEFAULT_SEED,
    DEFAULT_USERNAME,
    GRAPHQL_URL,
    elapsed,
    fetch_events_page,
    get_token,
    post_json,
)
from normalize import is_free

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "data" / "prices.json"

# Prices are per show, not per day: one call per show is the whole festival.
# Kinder delays than the listing crawl would make ~3,800 calls take a working
# day, so the price pass runs a little faster while still spacing every request.
DEFAULT_MIN_DELAY = 1.0
DEFAULT_MAX_DELAY = 2.5

CACHE_VERSION = 1

# One show by slug — the site's own URLs are slugs (/tickets/whats-on/<slug>).
# Only the fields the price pass needs: which performances exist, and the
# boxOfficeId that `performancePrices` keys off.
#
# Both refs below are declared `String!` even though the schema's arguments are
# nullable: a non-null variable is legal in a nullable position, but not the
# reverse, and `event(id:)` turned out to be `String!` on the live API.
EVENT_QUERY = """
    query EventBySlug($id: String!) {
  event(id: $id, isSlug: true) {
    id
    title
    slug
    cmsRef
    priceType
    freeTicketed
    performances {
      id
      dateTime
      cancelled
      soldOut
      ticketStatus
      boxOfficeId
      boxOfficeRef
    }
  }
}
    """

# The money query. `pricetype` really is lower-cased in their schema.
PRICES_QUERY = """
    query PerformancePrices($performanceRef: String!) {
  performancePrices(performanceRef: $performanceRef) {
    success
    error
    message
    result {
      performanceId
      isFromAllocation
      performancePercentageRemaining
      performanceAvailabilityLevel
      prices {
        priceBandId
        pricetype
        priceValue
        totalPrice
        transactionFeesPrice
        outsideFeesPrice
        feeInTicketPrice
        description
        availabilityLevel
        hideFullPrice
        concessions {
          code
          title
          concPrice
        }
      }
    }
  }
}
    """

# If the API rejects a field above (their schema drifts), fall back to the
# handful of fields the cache actually needs rather than losing the whole run.
PRICES_QUERY_MINIMAL = """
    query PerformancePrices($performanceRef: String!) {
  performancePrices(performanceRef: $performanceRef) {
    success
    message
    result {
      performanceId
      prices {
        pricetype
        priceValue
        totalPrice
        transactionFeesPrice
        description
        concessions {
          title
          concPrice
        }
      }
    }
  }
}
    """


# --------------------------------------------------------------------------- #
# Transform — pure, and covered by --selftest (the only check that runs offline)
# --------------------------------------------------------------------------- #

def coerce_money(raw) -> float | None:
    """A price field as a number of pounds, or None when it isn't one.

    The API returns amounts as JSON numbers, but has been seen to send strings
    ("18.00", "£18.00") for some bands, so both are accepted. Values round to
    pence: money read back as 12.000000000000002 would print wrong.
    """
    if isinstance(raw, bool) or raw is None:
        return None
    if isinstance(raw, (int, float)):
        return round(float(raw), 2)
    if isinstance(raw, str):
        cleaned = raw.replace("£", "").replace(",", "").strip()
        try:
            return round(float(cleaned), 2)
        except ValueError:
            return None
    return None


def extract_bands(result: dict) -> list[dict]:
    """The distinct full-price bands of one performance, cheapest first.

    One `Price` per band ("Price A", "Price B", …). Bands with no usable
    `priceValue` are dropped rather than guessed at, and exact duplicates are
    collapsed — some shows repeat a band per seating area.
    """
    bands: list[dict] = []
    seen: set[tuple] = set()
    for p in (result or {}).get("prices") or []:
        value = coerce_money(p.get("priceValue"))
        if value is None:
            continue
        label = (p.get("pricetype") or p.get("description") or "").strip()
        key = (label, value)
        if key in seen:
            continue
        seen.add(key)
        band = {"type": label, "value": value}
        total = coerce_money(p.get("totalPrice"))
        if total is not None and total != value:
            band["total"] = total          # face value + booking fee
        bands.append(band)
    bands.sort(key=lambda b: (b["value"], b["type"]))
    return bands


def cheapest_concession(result: dict) -> float | None:
    """The lowest concession a punter can actually buy, or None.

    **£0 concessions are excluded.** Nearly every show carries a free
    "Personal Assistant" band — the companion ticket for a disabled patron's
    carer, not a price anyone chooses. Taking the literal minimum would record
    a £29.50 show as "concessions from £0" and, worse, hand the price filter a
    zero to sort and bucket on. Only paid concessions (student, child, …) count.
    """
    values = [
        v for p in (result or {}).get("prices") or []
        for v in (coerce_money(c.get("concPrice")) for c in p.get("concessions") or [])
        if v is not None and v > 0
    ]
    return min(values) if values else None


def booking_fee(result: dict) -> float | None:
    """The per-ticket booking fee added on top, or None when there is none.

    The live API returns `totalPrice == priceValue` with the fee broken out in
    `transactionFeesPrice` and `feeInTicketPrice: false` — i.e. the band value
    is the advertised face price and the fee is charged at checkout. Recorded
    separately so the site can quote the face price (what the filter matches)
    and still be honest about the total.
    """
    values = [
        v for v in (coerce_money(p.get("transactionFeesPrice"))
                    for p in (result or {}).get("prices") or [])
        if v is not None and v > 0
    ]
    return max(values) if values else None


def price_record(result: dict) -> dict | None:
    """One show's cache entry from one performance's price response.

    None when the performance carries no usable band — a show with nothing to
    price is left out of the cache entirely rather than recorded as £0, which
    would read as "free".
    """
    bands = extract_bands(result)
    if not bands:
        return None
    values = [b["value"] for b in bands]
    rec = {"min": min(values), "max": max(values), "bands": bands}
    conc = cheapest_concession(result)
    if conc is not None:
        rec["conc"] = conc
    fee = booking_fee(result)
    if fee is not None:
        rec["fee"] = fee
    return rec


def band_fingerprint(rec: dict | None) -> tuple:
    """Comparable identity of a price record — what `--sample-performances`
    checks is stable across a show's performances."""
    if not rec:
        return ()
    return tuple((b["type"], b["value"]) for b in rec["bands"])


def priceable_performances(event: dict) -> list[dict]:
    """The performances worth pricing, in date order: not cancelled, and
    carrying the `boxOfficeId` that `performancePrices` keys off."""
    out = [
        p for p in (event or {}).get("performances") or []
        if not p.get("cancelled") and p.get("boxOfficeId")
    ]
    out.sort(key=lambda p: p.get("dateTime") or "")
    return out


def show_key(event: dict) -> str:
    """The id the rest of the pipeline knows a show by — `normalize_event`'s."""
    return event.get("cmsRef") or str(event.get("id"))


# --------------------------------------------------------------------------- #
# Network
# --------------------------------------------------------------------------- #

def fetch_event(token: str, slug: str) -> dict:
    data = post_json(GRAPHQL_URL, {
        "query": EVENT_QUERY,
        "variables": {"id": slug},
        "operationName": "EventBySlug",
    }, token=token)
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors for slug {slug!r}: {data['errors']}")
    event = (data.get("data") or {}).get("event")
    if not event:
        raise RuntimeError(f"no event returned for slug {slug!r}")
    return event


def fetch_performance_prices(token: str, ref: str, minimal: bool = False) -> dict:
    """The raw `performancePrices` wrapper for one performance reference."""
    query = PRICES_QUERY_MINIMAL if minimal else PRICES_QUERY
    data = post_json(GRAPHQL_URL, {
        "query": query,
        "variables": {"performanceRef": ref},
        "operationName": "PerformancePrices",
    }, token=token)
    if "errors" in data:
        if not minimal:
            print(f"    field error on the full price query, retrying minimal: "
                  f"{data['errors']}", file=sys.stderr)
            return fetch_performance_prices(token, ref, minimal=True)
        raise RuntimeError(f"GraphQL errors for performanceRef {ref!r}: {data['errors']}")
    return (data.get("data") or {}).get("performancePrices") or {}


def collect_shows(token: str, per: int, seed: str, delay: tuple[float, float],
                  max_pages: int | None) -> list[dict]:
    """Every show in the listing, paged — the price pass's work list.

    Uses the same `EventsSearch` operation as `fetch_shows.py` (~77 pages)
    rather than the git-ignored raw cache, so this script stands on its own.
    """
    shows: list[dict] = []
    page = 1
    total_pages = None
    while total_pages is None or page <= total_pages:
        events = fetch_events_page(token, page, per, seed)
        if total_pages is None:
            total = events.get("total") or 0
            total_pages = max(1, -(-total // per))
            if max_pages:
                total_pages = min(total_pages, max_pages)
            print(f"[{elapsed()}] listing: {total} shows over {total_pages} pages")
        shows.extend(events.get("results") or [])
        print(f"[{elapsed()}] listing page {page}/{total_pages} "
              f"({len(shows)} shows so far)")
        page += 1
        if page <= total_pages:
            time.sleep(random.uniform(*delay))
    return shows


# --------------------------------------------------------------------------- #
# Cache
# --------------------------------------------------------------------------- #

def load_cache(path: Path) -> dict:
    if path.exists():
        try:
            cache = json.loads(path.read_text())
            if isinstance(cache.get("shows"), dict):
                return cache
        except (json.JSONDecodeError, OSError) as exc:
            print(f"  WARNING: unreadable cache at {path} ({exc}); starting fresh",
                  file=sys.stderr)
    return {"v": CACHE_VERSION, "shows": {}}


def save_cache(path: Path, cache: dict) -> None:
    cache["v"] = CACHE_VERSION
    cache["fetchedAt"] = date.today().isoformat()
    cache["shows"] = dict(sorted(cache["shows"].items()))
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
    tmp.replace(path)


def price_one_show(token: str, event: dict, samples: int, delay: tuple[float, float],
                   print_raw: bool) -> tuple[dict | None, str]:
    """Price one show. Returns (cache entry, note).

    `samples` > 1 prices several performances and reports whether their bands
    agree — the check behind "one call per show is enough".
    """
    perfs = priceable_performances(event)
    if not perfs:
        return None, "no priceable performance (all cancelled or no boxOfficeId)"

    picked = perfs[:max(1, samples)]
    records: list[tuple[dict, dict | None]] = []
    for i, perf in enumerate(picked):
        ref = perf["boxOfficeId"]
        wrapper = fetch_performance_prices(token, ref)
        if print_raw:
            print(f"--- raw performancePrices({ref}) "
                  f"[{perf.get('dateTime')}] ---")
            print(json.dumps(wrapper, ensure_ascii=False, indent=2))
        if not wrapper.get("success", True):
            print(f"    performancePrices({ref}) unsuccessful: "
                  f"{wrapper.get('message') or wrapper.get('error')}", file=sys.stderr)
        records.append((perf, price_record(wrapper.get("result") or {})))
        if i + 1 < len(picked):
            time.sleep(random.uniform(*delay))

    perf, rec = records[0]
    if rec is None:
        return None, f"no price bands on {perf.get('dateTime')}"

    rec = dict(rec)
    rec["slug"] = event.get("slug")
    rec["ref"] = perf["boxOfficeId"]
    rec["date"] = (perf.get("dateTime") or "")[:10]

    note = ""
    if len(records) > 1:
        prints = {band_fingerprint(r) for _, r in records if r}
        agree = len(prints) == 1
        rec["sampled"] = len(records)
        if not agree:
            # Bands differ across performances; the cache keeps the first, but
            # say so loudly — it would mean per-show pricing is not the whole story.
            rec["varies"] = True
        note = (f"bands {'agree' if agree else 'DIFFER'} across "
                f"{len(records)} performances")
    return rec, note


def run(args) -> int:
    delay = (args.min_delay, args.max_delay)
    out_path = Path(args.out)
    cache = load_cache(out_path)

    print(f"[{elapsed()}] Authenticating...")
    token = get_token(args.username, args.password)

    if args.slug:
        events = [fetch_event(token, args.slug)]
        print(f"[{elapsed()}] {events[0].get('title')} "
              f"({len(events[0].get('performances') or [])} performances)")
    else:
        listing = collect_shows(token, args.per, args.seed, delay, args.max_pages)
        # Free shows have nothing to price — skip them rather than spend a call
        # to be told so. normalize.py already reads £0 off the `free` flag.
        events = [e for e in listing if e and not is_free(e)]
        print(f"[{elapsed()}] {len(events)} paid shows to price "
              f"({len(listing) - len(events)} free, skipped)")

    priced = skipped = empty = failed = 0
    for i, event in enumerate(events, 1):
        key = show_key(event)
        if key in cache["shows"] and not args.force:
            skipped += 1
            continue
        if args.limit and priced + empty + failed >= args.limit:
            print(f"[{elapsed()}] --limit {args.limit} reached; stopping "
                  f"(re-run to continue)")
            break
        try:
            rec, note = price_one_show(token, event, args.sample_performances,
                                       delay, args.print_raw)
        except Exception as exc:  # noqa: BLE001 — one bad show must not end the pass
            print(f"[{elapsed()}] [{i}/{len(events)}] {key}: ERROR {exc}",
                  file=sys.stderr)
            failed += 1
            continue
        if rec is None:
            print(f"[{elapsed()}] [{i}/{len(events)}] {key}: {note}")
            empty += 1
        else:
            cache["shows"][key] = rec
            conc = f", conc £{rec['conc']:.2f}" if "conc" in rec else ""
            print(f"[{elapsed()}] [{i}/{len(events)}] {key} "
                  f"{event.get('title')!r}: £{rec['min']:.2f}–£{rec['max']:.2f}"
                  f"{conc} ({len(rec['bands'])} bands){' — ' + note if note else ''}")
            priced += 1
            # Written as we go: a 3,800-call pass must survive being interrupted.
            if priced % 25 == 0:
                save_cache(out_path, cache)
        if i < len(events):
            time.sleep(random.uniform(*delay))

    save_cache(out_path, cache)
    print(f"\n[{elapsed()}] Done. priced={priced} cached-already={skipped} "
          f"no-price={empty} failed={failed}")
    print(f"[{elapsed()}] {len(cache['shows'])} shows in {out_path}")
    return 1 if failed else 0


# --------------------------------------------------------------------------- #
# Self-test — the price transform, offline (no network, no scraped data)
# --------------------------------------------------------------------------- #

# The live `performancePrices(1:790001)` result for Daniel Sloss: BITTER,
# captured verbatim off the API (14 Aug 2026). Real data rather than an invented
# shape, because two of its details are exactly what the transform has to get
# right: amounts arrive as **strings**, and the only "concession" is the £0.00
# Personal Assistant companion ticket.
FIXTURE_RESULT = {
    "performanceId": "1:790001",
    "isFromAllocation": True,
    "performancePercentageRemaining": 0,
    "performanceAvailabilityLevel": None,
    "prices": [
        {"priceBandId": 2720, "pricetype": "Price A", "priceValue": "29.50",
         "totalPrice": "29.50", "transactionFeesPrice": "1.50",
         "outsideFeesPrice": "0", "feeInTicketPrice": False, "description": "",
         "availabilityLevel": None, "hideFullPrice": False,
         "concessions": [{"code": "PA", "title": "Personal Assistant",
                          "concPrice": "0.00"}]},
        {"priceBandId": 2721, "pricetype": "Price B", "priceValue": "25.00",
         "totalPrice": "25.00", "transactionFeesPrice": "1.50",
         "outsideFeesPrice": "0", "feeInTicketPrice": False, "description": "",
         "availabilityLevel": None, "hideFullPrice": False,
         "concessions": [{"code": "PA", "title": "Personal Assistant",
                          "concPrice": "0.00"}]},
        {"priceBandId": 2722, "pricetype": "Price C", "priceValue": "22.50",
         "totalPrice": "22.50", "transactionFeesPrice": "1.50",
         "outsideFeesPrice": "0", "feeInTicketPrice": False, "description": "",
         "availabilityLevel": None, "hideFullPrice": False,
         "concessions": [{"code": "PA", "title": "Personal Assistant",
                          "concPrice": "0.00"}]},
    ],
}


def selftest() -> int:
    assert coerce_money(12) == 12.0
    assert coerce_money("29.50") == 29.5, "the API sends amounts as strings"
    assert coerce_money("£18.00") == 18.0
    assert coerce_money("1,024.5") == 1024.5
    assert coerce_money(12.000000000000002) == 12.0, "money must round to pence"
    assert coerce_money(None) is None and coerce_money("free") is None
    assert coerce_money(True) is None, "a bool is not an amount"

    # The real response: three bands, cheapest first, no `total` (totalPrice
    # equals the face value — the fee is charged separately).
    bands = extract_bands(FIXTURE_RESULT)
    assert bands == [
        {"type": "Price C", "value": 22.5},
        {"type": "Price B", "value": 25.0},
        {"type": "Price A", "value": 29.5},
    ], bands
    # The £0.00 Personal Assistant ticket is not a concession price.
    assert cheapest_concession(FIXTURE_RESULT) is None
    assert booking_fee(FIXTURE_RESULT) == 1.5

    rec = price_record(FIXTURE_RESULT)
    assert rec["min"] == 22.5 and rec["max"] == 29.5 and rec["fee"] == 1.5, rec
    assert "conc" not in rec, "a £0 companion ticket must not become the price"

    # A genuine paid concession alongside the free companion band is kept.
    with_conc = {"prices": [
        {"pricetype": "Price A", "priceValue": "18.00", "concessions": [
            {"code": "PA", "title": "Personal Assistant", "concPrice": "0.00"},
            {"code": "STU", "title": "Student", "concPrice": "14.00"}]},
    ]}
    assert cheapest_concession(with_conc) == 14.0
    assert price_record(with_conc)["conc"] == 14.0
    # No fee quoted -> no `fee` key rather than a zero to render.
    assert "fee" not in price_record(with_conc)

    # A band repeated per seating area collapses; one with no usable amount is
    # dropped rather than guessed at; `total` is carried only when it differs
    # from the face value (a fee baked into the ticket price).
    messy = {"prices": [
        {"pricetype": "Price A", "priceValue": 18.0, "totalPrice": 19.5},
        {"pricetype": "Price A", "priceValue": 18.0, "totalPrice": 19.5},
        {"pricetype": "Price B", "priceValue": None},
    ]}
    assert extract_bands(messy) == [{"type": "Price A", "value": 18.0, "total": 19.5}]
    # A show with nothing priceable is left out of the cache, not recorded as £0.
    assert price_record({"prices": []}) is None
    assert price_record({}) is None
    assert price_record({"prices": [{"pricetype": "A"}]}) is None
    # No concessions -> no `conc` key at all (rather than a null to filter on).
    assert "conc" not in price_record({"prices": [{"pricetype": "A", "priceValue": 9.0}]})

    # Two performances priced identically share a fingerprint; a re-priced band
    # breaks it — that difference is what --sample-performances reports.
    assert band_fingerprint(rec) == band_fingerprint(price_record(FIXTURE_RESULT))
    cheaper = {"prices": [{"pricetype": "Price A", "priceValue": 10.0}]}
    assert band_fingerprint(rec) != band_fingerprint(price_record(cheaper))
    assert band_fingerprint(None) == ()

    # Only performances that can be priced are offered up, in date order.
    event = {"performances": [
        {"boxOfficeId": "1:2", "dateTime": "2026-08-09T20:00:00.000Z"},
        {"boxOfficeId": "1:1", "dateTime": "2026-08-07T20:00:00.000Z"},
        {"boxOfficeId": "1:3", "dateTime": "2026-08-08T20:00:00.000Z",
         "cancelled": True},
        {"dateTime": "2026-08-10T20:00:00.000Z"},
    ]}
    assert [p["boxOfficeId"] for p in priceable_performances(event)] == ["1:1", "1:2"]
    assert priceable_performances({}) == []

    # The cache is keyed by the same show id normalize.py uses.
    assert show_key({"cmsRef": "202610THING", "id": 103540}) == "202610THING"
    assert show_key({"id": 103540}) == "103540"

    print("selftest OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slug", help="price a single show by its edfringe slug")
    parser.add_argument("--all", action="store_true",
                        help="price every paid show in the listing (~3,800 calls)")
    parser.add_argument("--out", default=str(DEFAULT_OUT),
                        help=f"cache file (default {DEFAULT_OUT})")
    parser.add_argument("--sample-performances", type=int, default=1, metavar="N",
                        help="price N performances per show and report whether "
                             "their bands agree (default 1)")
    parser.add_argument("--limit", type=int, default=None,
                        help="stop after N newly priced shows (resumable chunk)")
    parser.add_argument("--force", action="store_true",
                        help="re-price shows already in the cache")
    parser.add_argument("--print-raw", action="store_true",
                        help="dump the raw performancePrices JSON to stdout")
    parser.add_argument("--per", type=int, default=DEFAULT_PER)
    parser.add_argument("--seed", default=DEFAULT_SEED)
    parser.add_argument("--max-pages", type=int, default=None)
    parser.add_argument("--username", default=DEFAULT_USERNAME)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    parser.add_argument("--min-delay", type=float, default=DEFAULT_MIN_DELAY)
    parser.add_argument("--max-delay", type=float, default=DEFAULT_MAX_DELAY)
    parser.add_argument("--selftest", action="store_true",
                        help="run the built-in transform test and exit")
    args = parser.parse_args()

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(line_buffering=True)
        except (AttributeError, ValueError):
            pass

    if args.selftest:
        return selftest()
    if args.min_delay > args.max_delay:
        parser.error("--min-delay must not exceed --max-delay")
    # The whole-festival pass is thousands of live calls; it has to be asked for.
    if not args.slug and not args.all:
        parser.error("pass --slug SLUG for one show, or --all for the full pass")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
