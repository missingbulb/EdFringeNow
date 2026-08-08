#!/usr/bin/env python3
"""Scrape real ticket prices from the edfringe.com data API.

The listing API carries no money: `priceType` is a set of flags
(FREE / TWO_FOR_ONE / PAY_WHAT_YOU_WANT / …) and that is all `fetch_shows.py`
can see, which is why the site has only ever known "free vs paid". Amounts live
behind a **per-performance** query:

    performancePrices(performanceRef: "1:790001") -> { prices: [ Price ] }

**A price belongs to a performance, not to a show.** The same run routinely
sells at three different prices — previews cheaper than the main run, weekends
dearer than weekdays — and this script used to price one performance per show
and file the answer under the show. Pre-festival that one performance was
almost always the *earliest*, i.e. a preview, so a quarter of the catalogue
recorded its cheapest night as its price: Alfie Brown's £15/£16 run was
published as £8.50, read off the 5 August preview.

There is no bulk price *field* — `performancePrices` takes one ref, and the
`performances(input:)` listing query returns no amounts at all. But that is a
schema constraint, not a network one: GraphQL lets the same field be **aliased**
many times in one document, so a single request prices every performance of a
show (25 aliases ≈ 2 KB). Pricing the whole run therefore costs the same ~3,700
requests the old one-per-show pass did, which is why there is no sampling
heuristic here and no rule about previews — every performance is simply priced.
`--batch-size` caps the aliases per request; a batch the server rejects is
halved and retried, down to a single ref, so a complexity limit costs accuracy
nothing.

The result is a **cache, fetched once**: prices are set when a show goes on sale
and don't move the way ticket status does, so unlike `data/days/*.json` this
file is not on the nightly refresh path. `refresh-shows` never touches it;
re-run this script by hand if the festival re-prices.

Output (default `data/prices.json`, committed). Performances that share a price
point in the same set, so a show priced identically all run stores one:

    {"v": 2, "fetchedAt": "2026-07-30",
     "shows": {"<cmsRef>": {
        "slug": "alfie-brown-the-entertainer",
        "min": 8.5, "max": 16.0,               # run-wide, across every set
        "sets": [{"min", "max", "bands": [...], "conc", "fee"}, ...],
        "perfs": {"2026-08-05|17:50": 0, "2026-08-08|17:50": 1, ...}}}}

`perfs` keys a performance the way the rest of the pipeline names one — local
date and start time, via `normalize.local_date_start` — so the join needs no
box-office refs. `normalize.py` folds each performance's own price into that
day's file and the run-wide min/max into the catalogue; see scraper/README.md.

Entries written by the old pass (no `perfs`) are left alone and still read, as
whole-show prices, until this pass reaches them — so a part-finished migration
never blanks the site's prices.

Usage:
    python3 scraper/fetch_prices.py --slug daniel-sloss-bitter --print-raw
    python3 scraper/fetch_prices.py --slug alfie-brown-the-entertainer
    python3 scraper/fetch_prices.py --all                # every paid show (slow)
    python3 scraper/fetch_prices.py --all --limit 200    # resumable chunk
    python3 scraper/fetch_prices.py --all --batch-size 10 # smaller requests
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
from urllib.error import HTTPError

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
from normalize import is_free, local_date_start

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "data" / "prices.json"

# Alias batching keeps this at ~one request per show even though every
# performance is priced. Kinder delays than the listing crawl would make ~3,800
# requests take a working day, so the price pass runs a little faster while
# still spacing every request.
DEFAULT_MIN_DELAY = 1.0
DEFAULT_MAX_DELAY = 2.5

# Aliases per request. Most shows run under 30 performances, so the default
# prices a whole show in one go; the split-and-retry in `fetch_chunk` means this
# is a throughput knob rather than a correctness one.
DEFAULT_BATCH_SIZE = 25

CACHE_VERSION = 2

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

# The money selection, i.e. everything inside one `performancePrices { … }`.
# `pricetype` really is lower-cased in their schema.
PRICE_FIELDS = """
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
"""

# If the API rejects a field above (their schema drifts), fall back to the
# handful of fields the cache actually needs rather than losing the whole run.
PRICE_FIELDS_MINIMAL = """
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
"""


def prices_query(count: int, minimal: bool = False) -> str:
    """One query asking for `count` performances' prices at once.

    `performancePrices` takes a single ref, but a GraphQL document may select
    the same field repeatedly under different **aliases** — so N performances
    cost one request rather than N. The refs are passed as variables (`$r0`,
    `$r1`, …) rather than inlined, which keeps the document identical for every
    batch of the same size and puts the box-office refs where they can't be
    misread as query syntax.

    The selection set is repeated per alias rather than shared through a
    fragment: a fragment would have to name the wrapper type, and a wrong or
    drifted type name would fail the whole document, where repeating the fields
    depends on nothing but the fields themselves.
    """
    fields = PRICE_FIELDS_MINIMAL if minimal else PRICE_FIELDS
    decls = ", ".join(f"$r{i}: String!" for i in range(count))
    aliases = "\n".join(
        f"  p{i}: performancePrices(performanceRef: $r{i}) {{{fields}  }}"
        for i in range(count)
    )
    return f"query PerformancePrices({decls}) {{\n{aliases}\n}}"


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


def set_fingerprint(rec: dict | None) -> tuple:
    """Comparable identity of a price record — two performances sharing this
    are selling exactly the same thing and collapse into one stored set.

    Covers the concession and the booking fee as well as the bands: a preview
    that costs the same as the main run but carries a different concession is
    still a different price point, and folding the two together would lose it.
    """
    if not rec:
        return ()
    return (
        tuple((b["type"], b["value"], b.get("total")) for b in rec["bands"]),
        rec.get("conc"),
        rec.get("fee"),
    )


def performance_key(perf: dict) -> str | None:
    """How the cache names one performance: "2026-08-05|17:50".

    Local date and start time, from the pipeline's single time-zone crossing
    (`normalize.local_date_start`) — the same identity the master, the day files
    and the availability sidecar use, so `normalize.py` joins prices onto
    performances without needing box-office refs on either side. None when the
    stamp is missing or unparseable, so the caller can skip rather than invent.
    """
    when = local_date_start(perf.get("dateTime"))
    if not when:
        return None
    return f"{when[0]}|{when[1]}"


def build_show_entry(slug: str | None, priced: list[tuple[str, dict]]) -> dict | None:
    """One show's cache entry from its performances' price records.

    `priced` is [(performance key, price record), …]. Records are de-duplicated
    by `set_fingerprint` into `sets`, and `perfs` maps each performance to the
    set it sells — so a show priced identically all run stores one set and 25
    small integers, while one with previews and a weekend uplift stores three.

    `min`/`max` are the run-wide extremes across every set: what the catalogue
    quotes as the show's price range, and the only price the planner shows.
    """
    if not priced:
        return None
    sets: list[dict] = []
    index: dict[tuple, int] = {}
    perfs: dict[str, int] = {}
    for key, rec in priced:
        fp = set_fingerprint(rec)
        if fp not in index:
            index[fp] = len(sets)
            sets.append(rec)
        perfs[key] = index[fp]
    values = [b["value"] for s in sets for b in s["bands"]]
    return {
        "slug": slug,
        "min": min(values),
        "max": max(values),
        "sets": sets,
        "perfs": dict(sorted(perfs.items())),
    }


def is_per_performance(entry: dict | None) -> bool:
    """Whether a cache entry carries per-performance prices (this pass) rather
    than a single whole-show amount (the old one).

    Drives resumption: `--all` skips a show already priced this way, but
    re-prices one left over from the old pass, so a migration completes by
    simply re-running rather than needing the cache thrown away.
    """
    return bool(entry) and isinstance(entry.get("perfs"), dict) and bool(entry["perfs"])


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


class BatchRejected(RuntimeError):
    """The server refused a batched document — too many aliases, too complex, or
    a field it doesn't like. Recoverable by sending fewer aliases."""


def fetch_chunk(token: str, refs: list[str], print_raw: bool = False,
                minimal: bool = False) -> dict[str, dict]:
    """`{ref: performancePrices wrapper}` for one batch, in a single request.

    Alias batching is standard GraphQL, but servers are entitled to cap document
    complexity or alias count, and this one's limit is unknown. So a rejected
    batch is **halved and retried** rather than failed: whatever the cap turns
    out to be, the pass converges on it automatically and still prices every
    performance — just in more requests. Down at a single ref the fallback is
    the smaller selection (a drifted field), and only then is that one
    performance given up on, as an empty wrapper the caller reads as "no price".

    Auth failures are re-raised immediately: they are not a batch-size problem
    and splitting would just replay them.
    """
    try:
        data = post_json(GRAPHQL_URL, {
            "query": prices_query(len(refs), minimal),
            "variables": {f"r{i}": ref for i, ref in enumerate(refs)},
            "operationName": "PerformancePrices",
        }, token=token)
        if data.get("errors"):
            raise BatchRejected(str(data["errors"]))
        payload = data.get("data") or {}
        out = {ref: payload.get(f"p{i}") or {} for i, ref in enumerate(refs)}
        if print_raw:
            print(f"--- raw performancePrices x{len(refs)} ---")
            print(json.dumps(out, ensure_ascii=False, indent=2))
        return out
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise
        err: Exception = exc
    except RuntimeError as exc:      # BatchRejected, or post_json giving up
        err = exc

    if len(refs) > 1:
        mid = len(refs) // 2
        print(f"    batch of {len(refs)} rejected ({err}); splitting",
              file=sys.stderr)
        out = fetch_chunk(token, refs[:mid], print_raw, minimal)
        out.update(fetch_chunk(token, refs[mid:], print_raw, minimal))
        return out
    if not minimal:
        print(f"    field error on the full price query, retrying minimal: {err}",
              file=sys.stderr)
        return fetch_chunk(token, refs, print_raw, minimal=True)
    print(f"    no prices for {refs[0]}: {err}", file=sys.stderr)
    return {refs[0]: {}}


def fetch_performance_prices(token: str, refs: list[str], batch_size: int,
                             delay: tuple[float, float],
                             print_raw: bool = False) -> dict[str, dict]:
    """Every ref's price wrapper, in `ceil(len(refs) / batch_size)` requests."""
    out: dict[str, dict] = {}
    for i in range(0, len(refs), batch_size):
        out.update(fetch_chunk(token, refs[i:i + batch_size], print_raw))
        if i + batch_size < len(refs):
            time.sleep(random.uniform(*delay))
    return out


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
    """The existing cache, or an empty one.

    A v1 cache (whole-show prices) is loaded as-is rather than discarded: its
    entries stay readable by normalize.py, and `run` re-prices them one show at
    a time. Throwing it away would blank every price on the site until a full
    ~3,700-request pass finished.
    """
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


def price_one_show(token: str, event: dict, batch_size: int,
                   delay: tuple[float, float],
                   print_raw: bool) -> tuple[dict | None, str]:
    """Price every performance of one show. Returns (cache entry, note).

    No sampling and no choosing a "representative" performance: the whole run is
    priced, which is what makes the day files able to quote the price of the
    night someone is actually looking at.
    """
    perfs = priceable_performances(event)
    if not perfs:
        return None, "no priceable performance (all cancelled or no boxOfficeId)"

    refs = [p["boxOfficeId"] for p in perfs]
    wrappers = fetch_performance_prices(token, refs, batch_size, delay, print_raw)

    priced: list[tuple[str, dict]] = []
    for perf in perfs:
        wrapper = wrappers.get(perf["boxOfficeId"]) or {}
        if wrapper and not wrapper.get("success", True):
            print(f"    performancePrices({perf['boxOfficeId']}) unsuccessful: "
                  f"{wrapper.get('message') or wrapper.get('error')}",
                  file=sys.stderr)
        rec = price_record(wrapper.get("result") or {})
        key = performance_key(perf)
        if rec is None or key is None:
            continue
        priced.append((key, rec))

    entry = build_show_entry(event.get("slug"), priced)
    if entry is None:
        return None, f"no price bands on any of {len(perfs)} performances"

    n_sets = len(entry["sets"])
    note = f"{len(priced)}/{len(perfs)} performances"
    if n_sets > 1:
        # The whole reason this pass exists: one show, several price points.
        note += f", {n_sets} price points"
    if len(priced) < len(perfs):
        note += " (some unpriced)"
    return entry, note


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
        # Already priced per performance -> nothing to do. An entry left by the
        # old whole-show pass is NOT skipped: re-running is how the cache
        # migrates, one show at a time, without ever being emptied.
        if is_per_performance(cache["shows"].get(key)) and not args.force:
            skipped += 1
            continue
        if args.limit and priced + empty + failed >= args.limit:
            print(f"[{elapsed()}] --limit {args.limit} reached; stopping "
                  f"(re-run to continue)")
            break
        try:
            rec, note = price_one_show(token, event, args.batch_size,
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
            print(f"[{elapsed()}] [{i}/{len(events)}] {key} "
                  f"{event.get('title')!r}: £{rec['min']:.2f}–£{rec['max']:.2f}"
                  f"{' — ' + note if note else ''}")
            priced += 1
            # Written as we go: a 3,800-request pass must survive interruption.
            if priced % 25 == 0:
                save_cache(out_path, cache)
        if i < len(events):
            time.sleep(random.uniform(*delay))

    save_cache(out_path, cache)
    legacy = sum(1 for e in cache["shows"].values() if not is_per_performance(e))
    print(f"\n[{elapsed()}] Done. priced={priced} cached-already={skipped} "
          f"no-price={empty} failed={failed}")
    print(f"[{elapsed()}] {len(cache['shows'])} shows in {out_path}"
          + (f" — {legacy} still on whole-show prices from the old pass "
             f"(re-run to migrate them)" if legacy else ""))
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

    # Two performances priced identically share a fingerprint, so they collapse
    # into one stored set; a re-priced band breaks it and earns its own.
    cheaper = price_record({"prices": [{"pricetype": "Price A", "priceValue": 10.0}]})
    assert set_fingerprint(rec) == set_fingerprint(price_record(FIXTURE_RESULT))
    assert set_fingerprint(rec) != set_fingerprint(cheaper)
    assert set_fingerprint(None) == ()
    # Same bands, different concession -> still a different price point.
    conc_a = price_record({"prices": [{"pricetype": "A", "priceValue": 18.0,
                                       "concessions": [{"title": "Student",
                                                        "concPrice": "14.00"}]}]})
    conc_b = price_record({"prices": [{"pricetype": "A", "priceValue": 18.0}]})
    assert set_fingerprint(conc_a) != set_fingerprint(conc_b)

    # A performance is named by local date + start — the pipeline's own identity
    # for one, so normalize.py can join prices on without box-office refs. 16:50Z
    # in August is 17:50 in Edinburgh (BST), as it is everywhere else here.
    assert performance_key({"dateTime": "2026-08-05T16:50:00.000Z"}) == "2026-08-05|17:50"
    assert performance_key({"dateTime": None}) is None
    assert performance_key({}) is None

    # The whole point of the rewrite: one show, several price points, each
    # performance mapped to the one it actually sells. The preview and the main
    # run differ, so both are kept; the two main-run dates share a set.
    entry = build_show_entry("a-show", [
        ("2026-08-05|17:50", cheaper),
        ("2026-08-08|17:50", rec),
        ("2026-08-09|17:50", price_record(FIXTURE_RESULT)),
    ])
    assert len(entry["sets"]) == 2, entry["sets"]
    assert entry["perfs"] == {"2026-08-05|17:50": 0, "2026-08-08|17:50": 1,
                              "2026-08-09|17:50": 1}, entry["perfs"]
    # Run-wide extremes span every set — £10 preview through the £29.50 top band.
    assert entry["min"] == 10.0 and entry["max"] == 29.5, entry
    assert entry["slug"] == "a-show"
    # A show priced the same all run stores exactly one set, not one per date.
    same = build_show_entry("s", [(f"2026-08-{d:02d}|20:00", price_record(FIXTURE_RESULT))
                                  for d in range(5, 25)])
    assert len(same["sets"]) == 1 and len(same["perfs"]) == 20, same
    assert build_show_entry("s", []) is None

    # Resumption keys off per-performance data, so the old pass's entries are
    # re-priced rather than skipped — that is how the cache migrates.
    assert is_per_performance(entry) is True
    assert is_per_performance({"min": 8.5, "max": 8.5, "bands": []}) is False
    assert is_per_performance({"perfs": {}}) is False
    assert is_per_performance(None) is False

    # The batched document: one alias and one variable per ref, every alias
    # asking the same question of a different performance.
    q = prices_query(3)
    assert q.count("performancePrices(performanceRef:") == 3, q
    assert "$r0: String!, $r1: String!, $r2: String!" in q, q
    assert "p2: performancePrices(performanceRef: $r2)" in q, q
    assert "priceBandId" in q and "concPrice" in q
    # The minimal fallback drops the fields the cache doesn't need, and keeps
    # the alias structure so a split batch can still use it.
    assert "priceBandId" not in prices_query(2, minimal=True)
    assert prices_query(1, minimal=True).count("performancePrices(") == 1

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
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        metavar="N",
                        help="performances priced per request, as GraphQL "
                             "aliases (default %(default)s). A batch the server "
                             "rejects is halved and retried, so this trades "
                             "requests for document size, never accuracy")
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
    if args.batch_size < 1:
        parser.error("--batch-size must be at least 1")
    # The whole-festival pass is thousands of live calls; it has to be asked for.
    if not args.slug and not args.all:
        parser.error("pass --slug SLUG for one show, or --all for the full pass")
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
