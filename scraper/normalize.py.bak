#!/usr/bin/env python3
"""Normalize scraped edfringe show data into website-ready JSON.

Reads the raw scrape (events + venues + genres produced by fetch_shows.py) and
emits the site's data layers:

  data/normalized/shows.json   master, normalized, one record per show with all
                               its performances. The source of truth for later
                               processing / regenerating the day files. NOT sent
                               to the browser.

  data/normalized/shows.min.json
                               the compact wire form of the master, and the file
                               the planner actually downloads. Losslessly packed
                               against the venues.json lookups: every enum (genre,
                               room, subgenre, age restriction) is an index into a
                               shared list; venueName is rebuilt from the venue
                               code + room; smallImage is dropped when it equals
                               image; booleans are 1/0; dates are an MMDD int;
                               field names are 1-3 chars. The planner rehydrates it
                               with venues.json + the availability sidecar below
                               (see plan/plan.js). Deliberately carries NOTHING
                               that changes through the day, so an unchanged
                               festival regenerates it byte-for-byte and a client
                               can hold it for days.

  data/normalized/availability.min.json
                               per-performance ticket status, split OUT of the
                               catalogue above precisely because it is the one
                               thing that moves during the festival. Self-contained
                               (it carries its own status list and indexes into
                               nothing), so the ticket refresh rewrites this file
                               alone and every other artifact stays untouched —
                               a returning visitor re-downloads availability,
                               not the whole catalogue.

  data/normalized/descriptions.min.json
                               slug -> full show description, as a sidecar the
                               planner fetches SEPARATELY and lazily. It exists
                               so the catalogue above stays small enough to block
                               on: descriptions are the bulkiest field and are
                               needed by nothing on first paint — only by the
                               hover card and by search, both of which work
                               (from the 160-char `blurb` in the catalogue) and
                               simply reach further once this lands.

  data/venues.json             shared lookup, sent once:
                               {venues, rooms, genres, subgenres, ticketStatuses,
                               ageRestrictions}. `venues` is keyed by venue code
                               ("venue number") -> name, address, postcode, lat,
                               lng; the rest are the global de-duplicated string
                               lists the day files and shows.min.json index into.

  data/days/2026-08-DD.json    one file per August FRINGE day, holding only the
                               shows performing that day with the minimum a card
                               needs. A fringe day runs 06:00 → 06:00 (see
                               FRINGE_DAY_START), so the file also carries the
                               small hours of the next morning, written with an
                               extended start time ("24:30" for 00:30).
                               Normalized: venue is referenced by code and
                               genre/room by index into the global rooms/genres
                               lists (all in venues.json). This is what the site
                               loads on open.
  data/days/index.json         list of available days + per-day counts.

Locations are normalized to a venue code plus the specific room (space) of the
show. Venue coordinates are geocoded from UK postcodes via postcodes.io and
cached in venues.json so a refresh only geocodes new venues.

Times are normalized the same way, and it matters just as much: the API stamps
performances in UTC, every file written from here carries **Edinburgh
wall-clock** ("HH:MM" against a local date), and the single conversion between
the two lives in `local_date_start`. Downstream — day files, the Now page, the
planner — no code touches a time zone; a "19:30" is 19:30 on the door.

Ticket prices come from a **second input**: data/prices.json, the fetch-once
cache written by scraper/fetch_prices.py. The listing API exposes no amounts —
only a free/paid flag — so real money is folded in here (apply_prices) and
reaches the site as `priceMin`/`priceMax`. A show absent from the cache has an
*unknown* price, which is not the same as free.

Usage:
    python3 scraper/normalize.py                     # full rebuild from raw scrape
    python3 scraper/normalize.py --merge             # upsert raw into existing master
    python3 scraper/normalize.py --no-geocode        # skip postcode lookups
    python3 scraper/normalize.py --minify-from-master  # rebuild venues.json + the
                                                     # compact shows.min.json from the
                                                     # existing master (no raw scrape)
    python3 scraper/normalize.py --selftest          # run the built-in fixture test
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW_DIR = ROOT / "data" / "raw_pages"
DEFAULT_MASTER = ROOT / "data" / "normalized" / "shows.json"
DEFAULT_MASTER_MIN = ROOT / "data" / "normalized" / "shows.min.json"
DEFAULT_AVAILABILITY = ROOT / "data" / "normalized" / "availability.min.json"
DEFAULT_DESCRIPTIONS = ROOT / "data" / "normalized" / "descriptions.min.json"
DEFAULT_VENUES = ROOT / "data" / "venues.json"
DEFAULT_DAYS_DIR = ROOT / "data" / "days"
DEFAULT_PRICES = ROOT / "data" / "prices.json"

AUGUST_PREFIX = "2026-08"
BLURB_MAX = 160

# The festival's own clock. Every time this pipeline writes is a wall-clock
# reading here — what the printed programme says, and what a visitor's watch
# says while they're standing outside the venue. See local_date_start.
FESTIVAL_TZ = ZoneInfo("Europe/London")

# Where one festival day ends and the next begins — 06:00, not midnight. The
# Now page asks "what can I still get into tonight", and at 23:50 the honest
# answer includes the 00:30 show; a midnight cut would empty the page at exactly
# the moment someone is looking for a later show. So the day file named
# 2026-08-14 holds everything from 06:00 on the 14th to 06:00 on the 15th, and a
# performance after midnight is written with an EXTENDED start time — 00:30
# becomes "24:30" — which keeps the file sorted and lets every client compare
# start times without knowing which calendar day each one falls on.
#
# THIS NUMBER IS SHARED with the front-end, which reads it from
# shared/fringe-day.js: the day the page loads, the times its wheel offers and
# the planner's night-fold all cut here too. Two different cut-offs would mean
# shows that exist on one screen and not the other, so the two copies are held
# together by a test (shared/__tests__/fringe-day.test.mjs) that reads this file.
FRINGE_DAY_START = "06:00"
FRINGE_DAY_START_MIN = 6 * 60
DAY_MINUTES = 1440

POSTCODES_IO_BULK = "https://api.postcodes.io/postcodes"

# Manual coordinate overrides for venues whose postcode the open geocoder can't
# resolve (large-user postcodes, park/marquee sites, etc.). Applied last, so
# they always win and survive a refresh. code -> (lat, lng).
MANUAL_COORDS = {
    "360": (55.940946, -3.190175),   # Underbelly's Circus Hub on the Meadows
    "147": (55.948692, -3.191961),   # National Library of Scotland
    "320": (55.977521, -3.169072),   # Brown's of Leith
    "560": (55.946273, -3.206378),   # Scott Lawrie Gallery
}

# The site's ten official genre categories (must match js/app.js GENRES).
SITE_GENRES = [
    "Cabaret and Variety",
    "Children's Shows",
    "Comedy",
    "Dance, Physical Theatre & Circus",
    "Events",
    "Exhibitions",
    "Music",
    "Musicals and Opera",
    "Spoken Word",
    "Theatre",
]


def map_genre(value: str | None, label: str | None) -> str:
    """Map an API genre (enum value + human label) to a site category."""
    text = f"{value or ''} {label or ''}".lower().replace("&", "and")
    # Order matters: check the more specific categories first.
    if "cabaret" in text or "variety" in text:
        return "Cabaret and Variety"
    if "child" in text or "kid" in text:
        return "Children's Shows"
    if "comedy" in text:
        return "Comedy"
    if "dance" in text or "physical" in text or "circus" in text:
        return "Dance, Physical Theatre & Circus"
    if "musical" in text or "opera" in text:
        return "Musicals and Opera"
    if "music" in text:
        return "Music"
    if "spoken" in text or "word" in text:
        return "Spoken Word"
    if "exhibition" in text:
        return "Exhibitions"
    if "theatre" in text or "theater" in text:
        return "Theatre"
    if "event" in text:
        return "Events"
    # Fall back to the label as-is so nothing is silently dropped.
    return (label or value or "Events").strip()


def subgenre_labels(event: dict) -> list[str]:
    """A show's subgenres as display labels (e.g. ["Stand-up", "Improv"]).

    The API gives both `subGenre` (a comma-joined human string) and `subgenres`
    (the enum list). Prefer the human string — it carries the festival's own
    casing ("Sci-Fi", "LGBTQ+", "Artist(s) of colour") that title-casing the
    enum can't reproduce — and fall back to humanising the enum. About 2% of
    shows carry no subgenre, so the list may be empty.
    """
    raw = event.get("subGenre")
    if raw:
        labels = [s.strip() for s in raw.split(",")]
    else:
        labels = [v.replace("_", " ").title() for v in event.get("subgenres") or []]
    seen: set[str] = set()
    out: list[str] = []
    for label in labels:
        key = label.lower()
        if label and key not in seen:
            seen.add(key)
            out.append(label)
    return out


def clean_description(description: str | None) -> str:
    """The full description as plain text: markdown markers dropped, whitespace
    collapsed, nothing truncated. This is what the descriptions sidecar carries;
    short_blurb() below is the same text cut to a single line for the catalogue."""
    if not description:
        return ""
    text = re.sub(r"[*_#>`]", "", description)        # drop markdown markers
    return re.sub(r"\s+", " ", text).strip()


def short_blurb(description: str | None) -> str:
    """A compact one-line blurb: strip markdown, collapse space, truncate."""
    text = clean_description(description)
    if not text:
        return ""
    if len(text) <= BLURB_MAX:
        return text
    cut = text[:BLURB_MAX].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut + "…"


def local_date_start(dt: str | None) -> tuple[str, str] | None:
    """A performance's API `dateTime` as Edinburgh wall-clock: (date, "HH:MM").

    The API stamps performances in **UTC**: "2026-08-06T11:45:00.000Z" is the
    11:45 *Zulu* instant, not a quarter to noon in Edinburgh. August runs on
    BST, an hour ahead, so reading those digits literally — which this pipeline
    used to do — filed every show an hour early. The data said so itself: the
    "7am Oboe Rave" sat at 06:00, "Jokes At Noon" at 11:00, and Shakespeare for
    Breakfast (a 10am institution) at 09:00.

    Everything downstream — the day files, the Now page's "on next", the
    planner's timeline — reads these strings as Edinburgh wall-clock and shows
    them to a visitor standing in Edinburgh. So the one conversion the pipeline
    needs happens here, at the single boundary where the API's instants become
    the site's local times, and nothing after this point touches a time zone.

    A stamp carrying no zone is read as UTC (the API has never sent one).
    Returns None for a missing or unfilable value, so callers can skip the
    performance rather than invent a time for it. Unfilable covers two shapes:
    a stamp `fromisoformat` cannot read at all, and one it reads happily whose
    conversion then lands outside the representable range — `0001-01-01T00:00Z`
    shifted onto London's pre-standard-time offset falls below `datetime.min`.
    Both are one junk performance, and neither is a reason for the pass over the
    whole catalogue to die.
    """
    if not dt:
        return None
    try:
        # fromisoformat only learned "Z" in 3.11; spell it out for older runners.
        parsed = datetime.fromisoformat(dt.strip().replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        local = parsed.astimezone(FESTIVAL_TZ)
    except (ValueError, AttributeError, OverflowError, OSError):
        return None
    return local.strftime("%Y-%m-%d"), local.strftime("%H:%M")


# Every listing image is served from this single host. The master stores only
# the trailing GUID and the client re-attaches the prefix, which trims ~50 bytes
# off each of the thousands of image fields in shows.json.
IMAGE_URL_PREFIX = "http://registration.edfringe.com/resource/image/"


def image_ref(url: str | None) -> str | None:
    """The client-facing image reference: just the GUID for the known host.

    Anything not served from the edfringe image host is kept as a full url, so
    an unexpected source still renders (the client treats a value that carries a
    scheme as an absolute url).
    """
    if not url:
        return None
    if url.startswith(IMAGE_URL_PREFIX):
        return url[len(IMAGE_URL_PREFIX):]
    return url


def primary_image(images: list | None) -> str | None:
    for img in images or []:
        if img.get("url"):
            return img["url"]
    return None


def image_of_type(images: list | None, image_type: str) -> str | None:
    """First image url whose imageType matches (case-insensitive)."""
    for img in images or []:
        if img.get("url") and (img.get("imageType") or "").lower() == image_type:
            return img["url"]
    return None


def large_image(images: list | None) -> str | None:
    """The show's full-size image ref: prefer the API's "Large" variant, else any.

    The API doesn't guarantee image order, so we can't rely on the first url
    being the large one — match on imageType explicitly.
    """
    return image_ref(image_of_type(images, "large") or primary_image(images))


def small_image(images: list | None) -> str | None:
    """The show's card-sized image ref: prefer the API's "Small" variant, else any."""
    return image_ref(image_of_type(images, "small") or primary_image(images))


def is_free(event: dict) -> bool:
    if event.get("freeTicketed"):
        return True
    pt = event.get("priceType")
    if not pt:
        return False
    # priceType may be a string, or a list of strings/objects. Treat the show
    # as free only when every price type it offers is a free one.
    items = pt if isinstance(pt, list) else [pt]
    texts = [json.dumps(x).upper() for x in items]
    return bool(texts) and all("FREE" in t for t in texts)


def normalize_event(event: dict) -> dict:
    """Reduce one raw API event to the master normalized record."""
    spaces = event.get("spaces") or []
    space = spaces[0] if spaces else {}
    venues = event.get("venues") or []

    venue_code = space.get("venueCode")
    venue_name = space.get("venueName") or (venues[0].get("title") if venues else None)
    room = space.get("title")

    duration = event.get("duration")
    try:
        duration = int(duration) if duration not in (None, "") else None
    except (ValueError, TypeError):
        duration = None

    performances = []
    for p in event.get("performances") or []:
        if p.get("cancelled"):
            continue
        when = local_date_start(p.get("dateTime"))
        if not when:
            continue
        date, start = when
        performances.append({
            "date": date,
            "start": start,
            "soldOut": bool(p.get("soldOut")),
            "status": p.get("ticketStatus") or p.get("status"),
        })
    performances.sort(key=lambda x: (x["date"], x["start"]))

    return {
        "id": event.get("cmsRef") or str(event.get("id")),
        "title": event.get("title"),
        "slug": event.get("slug"),
        "genre": map_genre(event.get("genre"), event.get("genre")),
        "subgenres": subgenre_labels(event),
        "company": event.get("presentedBy") or None,
        "duration": duration,
        "ageRestriction": event.get("ageRestriction") or None,
        "free": is_free(event),
        "image": large_image(event.get("images")),
        "smallImage": small_image(event.get("images")),
        "blurb": short_blurb(event.get("description")),
        # The untruncated text. Master-only: it is stripped out of the compact
        # catalogue (minify_master) and shipped separately, see the descriptions
        # sidecar in write_derived_outputs.
        "description": clean_description(event.get("description")),
        "venue": venue_code,
        "venueName": venue_name,
        "room": room,
        "performances": performances,
        # Real amounts don't come from the listing API at all — apply_prices
        # fills these from data/prices.json. Declared here (last, so the record
        # order is the same whether it was built from a raw scrape or reloaded
        # from an existing master) so every show has the shape, priced or not.
        "priceMin": None,
        "priceMax": None,
    }


def price_sets(entry: dict | None) -> list[dict]:
    """The distinct price points a show sells, as `{"min", "max", …}` records.

    Two cache shapes are read, because the migration to per-performance prices
    completes one show per re-run of `fetch_prices.py` (see its `load_cache`):

      * current — `sets`, one entry per distinct price point across the run.
      * legacy  — a single whole-show `min`/`max`, from the old pass that priced
        one performance and filed the answer under the show. Read as one set
        covering everything, which is exactly what the site did with it before.

    A legacy entry is very often a *preview* price (the old pass took the
    earliest performance, and pre-festival that was a preview), so it is a lower
    bound on the run rather than a reading of it. Nothing here can repair that —
    only re-fetching can — but keeping the two shapes readable means the site
    never loses its prices mid-migration.
    """
    if not entry:
        return []
    sets = entry.get("sets")
    if isinstance(sets, list) and sets:
        return [s for s in sets if s.get("min") is not None]
    if entry.get("min") is not None:
        return [{"min": entry["min"], "max": entry.get("max", entry["min"])}]
    return []


def show_price_range(entry: dict | None) -> tuple[float | None, float | None]:
    """A show's run-wide cheapest and dearest ticket, across every price point.

    This is the catalogue's answer to "what does this show cost" — a range, not
    a single figure, because a run with cheap previews and a weekend uplift
    genuinely costs a range. The day files answer the sharper question (what
    does it cost *that night*) from `performance_prices` below.
    """
    sets = price_sets(entry)
    if not sets:
        return None, None
    return (min(s["min"] for s in sets),
            max(s.get("max", s["min"]) for s in sets))


def performance_prices(prices: dict) -> dict[str, dict[str, float]]:
    """`{show id: {"YYYY-MM-DD|HH:MM": cheapest band}}` — the per-night prices.

    Built only from entries carrying `perfs`; a legacy whole-show entry
    contributes nothing here and is served by the fallback in `build_day_files`,
    which keeps its old behaviour rather than inventing per-night detail the
    cache doesn't have.

    The key is the performance's local date and start time, which is how
    `fetch_prices.performance_key` writes it and how the master names the same
    performance — the join is exact or it misses, never approximate.
    """
    out: dict[str, dict[str, float]] = {}
    for show_id, entry in ((prices or {}).get("shows") or {}).items():
        perfs, sets = entry.get("perfs"), entry.get("sets")
        if not isinstance(perfs, dict) or not isinstance(sets, list):
            continue
        by_key: dict[str, float] = {}
        for key, ix in perfs.items():
            if isinstance(ix, int) and 0 <= ix < len(sets):
                value = sets[ix].get("min")
                if value is not None:
                    by_key[key] = value
        if by_key:
            out[show_id] = by_key
    return out


def apply_prices(master: list[dict], prices: dict) -> int:
    """Attach real ticket amounts from the price cache to the master, in place.

    `prices` is `data/prices.json` as written by `fetch_prices.py` — a
    fetch-once cache keyed by the same show id the master uses. A show with no
    entry keeps `priceMin`/`priceMax` of None, which the site reads as "price
    unknown" and is *not* the same as free: only the `free` flag says free.

    What lands on the master is the **run-wide** range: `priceMin` is the
    cheapest ticket anywhere in the run and `priceMax` the dearest. The master
    is per show, so a per-night price has nowhere to live here — it goes
    straight from the cache into the day files (`build_day_files`), which are
    per performance and are the one place a single figure is honest.

    Free shows are given £0 rather than left unknown. They are skipped by the
    price pass (there is nothing to call `performancePrices` for), but their
    price is known perfectly well from the listing flag, and a filter asking
    "what can I see for under £10" must include them.

    Returns how many shows came out with a known price.
    """
    by_id = (prices or {}).get("shows") or {}
    known = 0
    for show in master:
        low, high = show_price_range(by_id.get(show["id"]))
        if low is not None:
            show["priceMin"], show["priceMax"] = low, high
        elif show.get("free"):
            show["priceMin"] = show["priceMax"] = 0.0
        else:
            show["priceMin"] = show["priceMax"] = None
        if show["priceMin"] is not None:
            known += 1
    return known


def build_venues(venues_raw: dict, existing: dict, geocode: bool) -> dict:
    """venue code -> {name, address, postcode, lat, lng}, geocoding new ones."""
    results = (venues_raw or {}).get("results") or []
    out: dict[str, dict] = {}
    to_geocode: dict[str, str] = {}   # postcode -> first venue code needing it

    for v in results:
        code = v.get("venueCode")
        if not code:
            continue
        addr = ", ".join(p for p in (v.get("address1"), v.get("address2")) if p)
        postcode = (v.get("postCode") or "").strip()
        prev = existing.get(code, {})
        rec = {
            "name": v.get("title"),
            "address": addr,
            "postcode": postcode,
            "lat": None,
            "lng": None,
        }
        # Reuse cached coordinates when the postcode is unchanged.
        if prev.get("lat") is not None and prev.get("postcode") == postcode:
            rec["lat"], rec["lng"] = prev["lat"], prev["lng"]
        elif postcode:
            to_geocode.setdefault(postcode, code)
        out[code] = rec

    if geocode and to_geocode:
        coords = geocode_postcodes(list(to_geocode.keys()))
        for code, rec in out.items():
            if rec["lat"] is None and rec["postcode"] in coords:
                rec["lat"], rec["lng"] = coords[rec["postcode"]]
        hits = sum(1 for r in out.values() if r["lat"] is not None)
        print(f"  geocoded {len(coords)} new postcodes; {hits}/{len(out)} venues located")

    # Manual overrides win over (and backfill) whatever geocoding produced.
    for code, (lat, lng) in MANUAL_COORDS.items():
        if code in out:
            out[code]["lat"], out[code]["lng"] = lat, lng
    return out


def geocode_postcodes(postcodes: list[str]) -> dict[str, tuple[float, float]]:
    """Bulk-geocode UK postcodes via postcodes.io. Best-effort: returns what it can."""
    coords: dict[str, tuple[float, float]] = {}
    for i in range(0, len(postcodes), 100):
        chunk = postcodes[i:i + 100]
        body = json.dumps({"postcodes": chunk}).encode("utf-8")
        req = Request(POSTCODES_IO_BULK, data=body,
                      headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except (URLError, HTTPError, json.JSONDecodeError) as exc:
            print(f"  WARNING: geocoding failed for a chunk: {exc}", file=sys.stderr)
            continue
        for item in data.get("result", []):
            res = item.get("result")
            if res and res.get("latitude") is not None:
                coords[item["query"]] = (round(res["latitude"], 6),
                                         round(res["longitude"], 6))
    return coords


def unify_subgenre_casing(master: list[dict]) -> None:
    """Collapse case-variant subgenres to one display casing, in place.

    The festival's free-text `subGenre` is inconsistently cased across shows, so
    the same tag arrives as both "Alternative Comedy" and "Alternative comedy" —
    which would otherwise show as two distinct tags. For each case-folded
    subgenre, pick the most title-cased variant (the festival's own labels are
    Title Case; the lowercase forms are data-entry slips, even when commoner),
    breaking ties by frequency then alphabetically. Deterministic across runs,
    and it keeps the nicer form ("LGBTQ+", "Sci-Fi", "Artist(s) of Colour").
    """
    counts: dict[str, int] = {}
    variants: dict[str, set[str]] = {}
    for show in master:
        for label in show.get("subgenres") or []:
            counts[label] = counts.get(label, 0) + 1
            variants.setdefault(label.casefold(), set()).add(label)

    def rank(v: str) -> tuple:
        titleish = sum(1 for w in v.split() if w[:1].isupper())
        return (-titleish, -counts[v], v)

    canon = {key: sorted(vs, key=rank)[0] for key, vs in variants.items()}
    for show in master:
        seen: set[str] = set()
        out: list[str] = []
        for label in show.get("subgenres") or []:
            picked = canon.get(label.casefold(), label)
            if picked.casefold() not in seen:
                seen.add(picked.casefold())
                out.append(picked)
        show["subgenres"] = out


def extend_lookup(prior: list[str] | None, values: set[str]) -> list[str]:
    """One lookup list, extended APPEND-ONLY: every entry the previous
    venues.json published keeps its index forever, and anything new is appended
    (sorted, so a rebuild is deterministic).

    This is a correctness constraint, not tidiness. A browser holds these files
    on independent clocks — shows.min.json for four days, venues.json for one
    (shared/data-cache.js) — so a four-day-old catalogue is routinely decoded
    against a venues.json fetched today. Re-sorting the whole list from scratch
    would silently shift every index under that stale catalogue and relabel
    shows' genres and rooms. Appending cannot: an index minted at any point
    stays valid for every version that follows.

    The corollary is that an entry is never dropped once published, even when
    the current master no longer uses it. These are a few hundred short strings;
    a stale-free decode is worth more than the bytes.
    """
    out = list(prior or [])
    known = set(out)
    out.extend(sorted(v for v in values if v not in known))
    return out


def build_lookups(master: list[dict],
                  prior: dict | None = None
                  ) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    """The global (genres, rooms, subgenres, ticketStatuses, ageRestrictions)
    lookup lists: every distinct genre, room, subgenre, per-performance ticket
    status and age restriction across all shows. A show references them by index
    in the day files and in shows.min.json; the lists ship once, alongside the
    venues (run()).

    `prior` is the previously published venues.json, whose ordering is preserved
    verbatim — see extend_lookup for why the lists are append-only.
    """
    prior = prior or {}
    genres = extend_lookup(prior.get("genres"), {s["genre"] for s in master if s.get("genre")})
    rooms = extend_lookup(prior.get("rooms"), {s["room"] for s in master if s.get("room")})
    subgenres = extend_lookup(prior.get("subgenres"),
                              {sg for s in master for sg in s.get("subgenres") or []})
    ticket_statuses = extend_lookup(prior.get("ticketStatuses"),
                                    {p.get("status") for s in master
                                     for p in s.get("performances") or [] if p.get("status")})
    age_restrictions = extend_lookup(prior.get("ageRestrictions"),
                                     {s["ageRestriction"] for s in master if s.get("ageRestriction")})
    return genres, rooms, subgenres, ticket_statuses, age_restrictions


def fringe_day(date: str, start: str) -> tuple[str, str]:
    """Which fringe day a performance belongs to, and its start within that day.

    A performance before FRINGE_DAY_START is part of the night before: its date
    moves back one and its start time moves forward past 24:00, so 00:30 on the
    15th is the 14th at "24:30". Everything from 06:00 on is left exactly as it
    is — including the 06:00 breakfast shows, which belong to the morning they
    happen in and not to the night that just ended.

    >>> fringe_day("2026-08-15", "00:30")
    ('2026-08-14', '24:30')
    >>> fringe_day("2026-08-15", "06:00")
    ('2026-08-15', '06:00')
    """
    hh, mm = int(start[:2]), int(start[3:5])
    minutes = hh * 60 + mm
    if minutes >= FRINGE_DAY_START_MIN:
        return date, start
    prev = (datetime.strptime(date, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    return prev, f"{hh + 24:02d}:{mm:02d}"


def build_day_files(master: list[dict], genre_ix: dict[str, int],
                    room_ix: dict[str, int], sub_ix: dict[str, int],
                    ts_ix: dict[str, int],
                    perf_prices: dict[str, dict[str, float]] | None = None
                    ) -> dict[str, list]:
    """Bucket shows by fringe day (06:00 → 06:00, see FRINGE_DAY_START) into
    minimal per-day records. A performance after midnight lands in the previous
    day's file with an extended `start` ("24:30" for 00:30) — see fringe_day.

    Each record is kept small:

      * `genre` / `room` — pointers into the global `genres` / `rooms` lookup
        lists (shipped once with the venues), not the strings themselves.
        `room` is -1 when the show has no specific room.
      * `subs` — the show's subgenres as pointers into the global `subgenres`
        lookup list; an empty list when the festival tagged none (~2%).
      * `ts` — this performance's ticket status as a pointer into the global
        `ticketStatuses` lookup (-1 if unknown). This is the reliable "can I get
        a ticket" signal; the `soldOut` flag is not (a show can be soldOut:false
        yet have no online allocation).
      * `free` / `soldOut` — 1/0 rather than true/false.
      * `pm` — **this performance's** cheapest band, from `perf_prices`. See
        below; the key and its meaning to the client are unchanged.
      * `blurb` — omitted. It is kept in the master (the scraped data) but the
        site never renders it, so it is left out of the per-day payload.

    `pm` is the one field here that is not a projection of the show. A day file
    holds performances, and a performance has a price of its own: previews are
    cheaper than the main run and weekends dearer than weekdays, so the show's
    range would be wrong on most nights and its minimum wrong on all but the
    cheapest. `perf_prices` (from `performance_prices`) supplies the actual
    figure for the night this record is on.

    Three cases, in order:

      * the performance is in `perf_prices` — use its own price.
      * the show has *no* per-performance prices at all (a legacy cache entry,
        or a free show priced from the listing flag) — fall back to the show's
        `priceMin`, which is what the day files carried before.
      * the show has per-performance prices but not for *this* one, i.e. a date
        added after the last price pass — leave `pm` off. The client reads that
        as "Price TBC", which is true. Borrowing another night's figure is the
        exact error this whole path exists to stop.
    """
    days: dict[str, list] = {}
    seen: set[tuple] = set()   # (id, day, start) — drop duplicate performances
    for show in master:
        for p in show.get("performances", []):
            # Bucket by the fringe day, not the calendar one: a 1 September
            # 00:30 show is the last night of the run, and a 1 August 00:30 show
            # belongs to a July night the festival never had, so it drops out.
            date, start = fringe_day(p["date"], p["start"])
            if not date.startswith(AUGUST_PREFIX):
                continue
            key = (show["id"], date, start)
            if key in seen:
                continue
            seen.add(key)
            rec = {
                "id": show["id"],
                "title": show["title"],
                "genre": genre_ix.get(show.get("genre"), -1),
                "subs": [sub_ix[sg] for sg in show.get("subgenres") or []
                         if sg in sub_ix],
                "venue": show["venue"],
                "room": room_ix.get(show.get("room"), -1),
                "start": start,
                "duration": show["duration"],
                "free": 1 if show["free"] else 0,
                "soldOut": 1 if p["soldOut"] else 0,
                "ts": ts_ix.get(p.get("status"), -1),
                "slug": show["slug"],
            }
            # Cheapest band of THIS performance: the Now page's price filter
            # asks "what can I see for up to £X" tonight, which the lowest band
            # on the night answers. The run-wide range lives in the planner's
            # catalogue, which isn't size-constrained the way a day file is.
            # Omitted when the price is unknown — see the docstring.
            by_key = (perf_prices or {}).get(show["id"])
            price = (by_key or {}).get(f"{p['date']}|{p['start']}")
            if price is None and not by_key:
                price = show.get("priceMin")
            if price is not None:
                rec["pm"] = price
            days.setdefault(date, []).append(rec)
    for date in days:
        days[date].sort(key=lambda x: (x["start"], x["title"] or ""))
    return days


# --------------------------------------------------------------------------- #
# Compact wire form of the master (data/normalized/shows.min.json).
#
# The planner downloads this, not the 7 MB master. It is packed against the same
# venues.json lookups the day files use, so it carries no dictionaries of its own,
# and the packing is lossless — plan/plan.js rebuilds the full records from it.
# --------------------------------------------------------------------------- #

def month_day_key(date: str) -> int:
    """A 2026 date as an MMDD integer: "2026-08-07" -> 807, "2026-07-24" -> 724.

    Every performance is in 2026 (the festival year), so the year is implied and
    only the month/day need storing; the client re-attaches "2026-".
    """
    return int(date[5:7] + date[8:10])


def venue_name_rebuildable(show: dict, venues: dict) -> bool:
    """True when a show's venueName is exactly "<room> at <venue name>" (or the
    bare venue name when it has no room), so it can be dropped from the wire form
    and rebuilt client-side from the venue code + room. False for the handful of
    shows with no resolvable venue (or any venueName that wouldn't rebuild
    byte-for-byte) — those keep their venueName verbatim, so packing stays
    lossless whatever the data does."""
    code = show.get("venue")
    if not code or code not in venues:
        return False
    name = venues[code].get("name")
    room = show.get("room")
    rebuilt = f"{room} at {name}" if room else name
    return rebuilt == show.get("venueName")


def minify_master(master: list[dict], genre_ix: dict[str, int], room_ix: dict[str, int],
                  sub_ix: dict[str, int], age_ix: dict[str, int],
                  venues: dict) -> list[dict]:
    """Pack the full master into the compact records the planner downloads.

    Each field is either shortened, indexed into a shared venues.json lookup, or
    dropped when it can be reconstructed:

      * `g`/`rm`/`ar` — genre, room and age restriction as indices into the
        global genres/rooms/ageRestrictions lists (-1 when absent).
      * `sg` — subgenres as indices into the global subgenres list.
      * `vn` — venueName, kept ONLY when it can't be rebuilt from `v` + `rm`
        (venue_name_rebuildable); present-but-null for the no-venue shows.
      * `si` — smallImage, kept ONLY when it differs from `im` (image); otherwise
        the client mirrors image.
      * `f` — free as 1/0.
      * `p[].d` — the performance date as an MMDD int.
      * `im` — the bare image GUID; the client re-attaches the host prefix.

    Each performance keeps only its identity — the date and start time that name
    it. Its ticket status and soldOut flag are the two fields that change through
    the day, and they live in the availability sidecar (build_availability) so
    this file can be cached for days without freezing them. rehydrateShows in
    plan/lib/hydrate.js puts the two halves back together.
    """
    out: list[dict] = []
    for s in master:
        rec: dict = {
            "i": s["id"],
            "t": s["title"],
            "sl": s["slug"],
            "g": genre_ix.get(s.get("genre"), -1),
            "sg": [sub_ix[sg] for sg in s.get("subgenres") or [] if sg in sub_ix],
            "c": s.get("company"),
            "d": s.get("duration"),
            "ar": age_ix.get(s.get("ageRestriction"), -1),
            "f": 1 if s.get("free") else 0,
            "im": s.get("image"),
        }
        # Real ticket prices, in pounds. Omitted entirely when unknown, which
        # the client must not confuse with free (`f`) — see apply_prices.
        if s.get("priceMin") is not None:
            rec["pm"] = s["priceMin"]
            if s.get("priceMax") not in (None, s["priceMin"]):
                rec["px"] = s["priceMax"]
        if s.get("smallImage") != s.get("image"):
            rec["si"] = s.get("smallImage")
        rec["b"] = s.get("blurb") or ""
        rec["v"] = s.get("venue")
        if not venue_name_rebuildable(s, venues):
            rec["vn"] = s.get("venueName")
        rec["rm"] = room_ix.get(s.get("room"), -1)
        rec["p"] = [{
            "d": month_day_key(p["date"]),
            "s": p["start"],
        } for p in s.get("performances") or []]
        out.append(rec)
    return out


def performance_keys(performances: list[dict]) -> list[str]:
    """Name each of a show's performances: ["807|21:15", "807|21:15#1", ...].

    Deliberately content-addressed rather than positional. The sidecar and the
    catalogue are cached on different clocks, so the client may hold a
    four-day-old catalogue beside availability fetched an hour ago; a bare index
    into the performance array would silently misalign the moment a show gained
    or lost a date. A date plus a start time names the same performance in both
    files or matches nothing at all.

    A handful of shows (4 of 4114) list the same date and start twice, with
    genuinely different ticket statuses — a preview and a regular sitting, say.
    Those are not the same performance and must not collapse into one, so the
    second and later occurrences carry a "#n" suffix. It is positional, and so
    carries the misalignment risk the rest of this scheme avoids; it is confined
    to the duplicates, where there is nothing else to tell them apart.

    plan/lib/hydrate.js walks the same array in the same order — keep the two in
    step.
    """
    seen: dict[str, int] = {}
    keys: list[str] = []
    for p in performances:
        base = f"{month_day_key(p['date'])}|{p['start']}"
        n = seen.get(base, 0)
        seen[base] = n + 1
        keys.append(base if n == 0 else f"{base}#{n}")
    return keys


def join_fingerprint(master: list[dict]) -> str:
    """A short hash of the join surface between shows.min.json and this sidecar:
    every show id and every performance key, in catalogue order.

    The sidecar names performances by date and start time, which is stable right
    up until a start time is *corrected* — and then it isn't. #274 shifted every
    performance by an hour (the API's dateTime is UTC), and a client holding the
    previous day's catalogue against the next day's sidecar matched 6% of its
    keys, so 94% of the festival came back status-unknown and drew as sold out
    (#309). The two files are cached on different clocks (four days vs one), so
    they are routinely joined across generations; nothing told the client when
    those generations had stopped agreeing.

    This does. Both files are written from the same master in the same breath, so
    the sidecar can record the catalogue it was built for, and the client can
    recompute it from the catalogue it actually holds.

    FNV-1a/32 over UTF-8: small, dependency-free, and cheap enough to mirror in
    JavaScript — see joinFingerprint in plan/lib/hydrate.js, which MUST produce
    the same value. plan/lib/__tests__/hydrate.test.mjs pins the two together by
    checking the committed catalogue against the committed sidecar's "k".
    """
    h = 0x811C9DC5
    def feed(text: str) -> None:
        nonlocal h
        for byte in text.encode("utf-8"):
            h ^= byte
            h = (h * 0x01000193) & 0xFFFFFFFF
    for show in master:
        feed(f'{show["id"]}\n')
        for key in performance_keys(show.get("performances") or []):
            feed(f"{key},")
    return format(h, "08x")


def build_availability(master: list[dict]) -> dict:
    """The availability sidecar: {"v", "k", "ts", "a", "o"}.

      * `k`  — the join fingerprint of the catalogue this was built alongside
        (see join_fingerprint). A client whose catalogue hashes to something else
        is holding two files that no longer describe the same festival, and must
        refetch rather than join them.

      * `ts` — this file's OWN ticket-status list. Unlike the day files and the
        catalogue, the sidecar indexes into nothing external: it is rewritten
        alone, and must not depend on venues.json having been refetched in the
        same breath.
      * `a`  — {show id: {performance key: index into `ts`}}. Performances with
        no status at all are omitted rather than mapped to -1; the client reads a
        missing entry as "unknown", which is what it is.
      * `o`  — {show id: [performance key, ...]} for sold-out performances only.
        A separate map because the flag is almost always false (the festival
        reports a lost allocation as a *status*, not as soldOut — see
        SCRAPING.md), so a per-performance boolean would cost far more than the
        handful of keys it carries.

    Everything here is derived from the master, which stays the single source of
    truth: the sidecar is a projection of it, never an input.
    """
    statuses = sorted({p.get("status") for s in master
                       for p in s.get("performances") or [] if p.get("status")})
    ix = {s: i for i, s in enumerate(statuses)}
    avail: dict[str, dict[str, int]] = {}
    sold: dict[str, list[str]] = {}
    for show in master:
        performances = show.get("performances") or []
        by_key: dict[str, int] = {}
        sold_keys: list[str] = []
        for key, p in zip(performance_keys(performances), performances):
            status = p.get("status")
            if status:
                by_key[key] = ix[status]
            if p.get("soldOut"):
                sold_keys.append(key)
        if by_key:
            avail[show["id"]] = by_key
        if sold_keys:
            sold[show["id"]] = sold_keys
    return {"v": 1, "k": join_fingerprint(master), "ts": statuses,
            "a": avail, "o": sold}


def build_descriptions(master: list[dict]) -> dict:
    """The descriptions sidecar: {"v": 1, "d": {slug: text}}.

    Falls back to a show's `blurb` when it has no `description` — masters
    scraped before descriptions were retained carry only the truncated blurb,
    and half a sentence is still better for search than nothing. Shows with
    neither are omitted entirely rather than mapped to "", which keeps the file
    to what it is actually for.

    Not packed against venues.json like the other wire files: it is keyed by
    slug and indexes into nothing, so it can be regenerated, cached and expired
    on its own schedule without touching the lookup lists.
    """
    out: dict[str, str] = {}
    for show in master:
        slug = show.get("slug")
        text = show.get("description") or show.get("blurb") or ""
        if slug and text:
            out[slug] = text
    return {"v": 1, "d": out}


def load_events(raw_dir: Path) -> list[dict]:
    shows_json = raw_dir / "shows.json"
    if shows_json.exists():
        return json.loads(shows_json.read_text())
    events: list[dict] = []
    for page in sorted(raw_dir.glob("page_*.json")):
        events.extend(json.loads(page.read_text()).get("results", []))
    return events


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    tmp.replace(path)


def load_prices(path: Path) -> dict:
    """The ticket-price cache, or an empty one when it hasn't been fetched yet.

    Deliberately forgiving: prices are a separate, manually-run pass
    (`fetch_prices.py`), so a normalize run must not fail — or silently produce
    a site with no prices *without saying so* — just because the cache is
    missing. The caller reports the coverage it got.
    """
    if not path.exists():
        print(f"  no price cache at {path} — every show's price will be unknown "
              f"(run scraper/fetch_prices.py --all)", file=sys.stderr)
        return {}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  WARNING: unreadable price cache at {path} ({exc}); "
              f"prices will be unknown", file=sys.stderr)
        return {}


def write_derived_outputs(master: list[dict], venues: dict, venues_path: Path,
                          days_dir: Path, master_min_path: Path,
                          descriptions_path: Path, prices_path: Path,
                          availability_path: Path) -> int:
    """Write everything derived from the master + venue map: the shared lookup
    file (venues.json), the per-day now-page files, the compact planner file
    (shows.min.json) and its availability + descriptions sidecars. Returns the
    number of day files written.

    The lookup lists are built once here and indexed into by both the day files
    and shows.min.json, so the two stay in lockstep with a single source of truth.

    Every output is a pure function of the master, the venue map and the price
    cache, so re-running it over an unchanged master rewrites every file
    byte-for-byte identically. The ticket refresh leans on exactly that:
    it touches the master's statuses and calls this, and only the files that
    actually carry a status come back changed.
    """
    # Real ticket amounts, folded in before anything is packed so the master and
    # both wire forms agree on what a show costs. The master (and so the
    # planner's catalogue) gets the run-wide range; the day files below get each
    # performance's own price, which is a different and sharper claim.
    prices = load_prices(prices_path)
    known = apply_prices(master, prices)
    perf_prices = performance_prices(prices)
    per_night = sum(1 for s in master if s["id"] in perf_prices)
    print(f"  priced {known}/{len(master)} shows from {prices_path.name} "
          f"({per_night} per performance)")
    legacy = known - per_night - sum(1 for s in master if s.get("free")
                                     and s["id"] not in perf_prices)
    if legacy > 0:
        print(f"  WARNING: {legacy} shows still carry a single whole-show price "
              f"from the old pass — usually a preview, so understated. Re-run "
              f"scraper/fetch_prices.py --all to migrate them.", file=sys.stderr)

    # The lookup lists extend the ones already published rather than being
    # re-derived from scratch — see extend_lookup: clients decode a cached
    # catalogue against a newer venues.json, so indices must never move.
    prior_lookups = json.loads(venues_path.read_text()) if venues_path.exists() else {}
    genres, rooms, subgenres, ticket_statuses, age_restrictions = build_lookups(
        master, prior_lookups)
    write_json(venues_path, {"venues": venues, "rooms": rooms, "genres": genres,
                             "subgenres": subgenres, "ticketStatuses": ticket_statuses,
                             "ageRestrictions": age_restrictions})

    genre_ix = {g: i for i, g in enumerate(genres)}
    room_ix = {r: i for i, r in enumerate(rooms)}
    sub_ix = {s: i for i, s in enumerate(subgenres)}
    ts_ix = {t: i for i, t in enumerate(ticket_statuses)}
    age_ix = {a: i for i, a in enumerate(age_restrictions)}

    # Compact planner payload (packed against the lookups just written), and the
    # two things it deliberately leaves behind: the availability that the
    # ticket refresh rewrites, and the descriptions too bulky to block on.
    write_json(master_min_path, minify_master(master, genre_ix, room_ix, sub_ix,
                                              age_ix, venues))
    write_json(availability_path, build_availability(master))
    write_json(descriptions_path, build_descriptions(master))

    # Per-day August files + index.
    days = build_day_files(master, genre_ix, room_ix, sub_ix, ts_ix, perf_prices)
    for date, items in days.items():
        write_json(days_dir / f"{date}.json", items)
    write_json(days_dir / "index.json", {
        "dates": sorted(days.keys()),
        "counts": {d: len(days[d]) for d in sorted(days)},
        "shows": len(master),
        "venues": len(venues),
    })
    return len(days)


def regen_from_master(args) -> int:
    """Rebuild venues.json + the compact shows.min.json from the committed master,
    without a raw scrape. Used to (re)generate the planner payload after a manual
    master edit, to backfill it the first time, or to fold in a fresh run of
    `fetch_prices.py` — the price cache is the one input that changes without a
    re-scrape, so this is the command that publishes new prices. The venue map
    (with its cached coordinates) is carried over from the existing venues.json
    verbatim; only the lookup lists and the derived files are rebuilt from the
    master, which is itself rewritten with the prices folded in."""
    master_path = Path(args.master)
    master = json.loads(master_path.read_text())
    venues_path = Path(args.venues)
    prior = json.loads(venues_path.read_text()) if venues_path.exists() else {}
    venues = prior.get("venues", prior)
    n_days = write_derived_outputs(master, venues, venues_path,
                                   Path(args.days_dir), Path(args.master_min),
                                   Path(args.descriptions), Path(args.prices),
                                   Path(args.availability))
    write_json(master_path, master)
    print(f"Regenerated from {master_path} ({len(master)} shows): "
          f"{args.master_min}, {args.availability}, {args.descriptions}, {venues_path} "
          f"({len(venues)} venues), {n_days} day files in {args.days_dir}")
    return 0


def run(args) -> int:
    raw_dir = Path(args.raw_dir)
    events = load_events(raw_dir)
    print(f"Loaded {len(events)} raw events from {raw_dir}")

    normalized = []
    skipped = 0
    for e in events:
        if not e:
            continue
        try:
            normalized.append(normalize_event(e))
        except Exception as exc:  # noqa: BLE001 - resilience over one bad record
            skipped += 1
            print(f"  WARNING: skipped event {e.get('id')}: {exc}", file=sys.stderr)
    if skipped:
        print(f"  skipped {skipped} unparseable events")

    # Master: merge (upsert by id) or replace.
    master_path = Path(args.master)
    if args.merge and master_path.exists():
        by_id = {s["id"]: s for s in json.loads(master_path.read_text())}
        for s in normalized:
            by_id[s["id"]] = s
        master = list(by_id.values())
        print(f"Merged {len(normalized)} into master -> {len(master)} shows")
    else:
        master = normalized
        print(f"Master rebuilt with {len(master)} shows")
    master.sort(key=lambda s: (s["title"] or "").lower())
    unify_subgenre_casing(master)  # one display casing per subgenre across all shows

    # Global lookup file: the venue map plus the shared rooms/genres lists that
    # the day files index into. Sent to the browser once. Venues are always
    # rebuilt from the full venue list, coordinates cached. Accepts either the
    # bare venue map (old format) or the {venues, ...} container as prior state.
    venues_path = Path(args.venues)
    prior = json.loads(venues_path.read_text()) if venues_path.exists() else {}
    existing_venues = prior.get("venues", prior)
    venues_raw_path = raw_dir / "venues_raw.json"
    venues_raw = json.loads(venues_raw_path.read_text()) if venues_raw_path.exists() else {}
    venues = build_venues(venues_raw, existing_venues, geocode=not args.no_geocode)
    n_days = write_derived_outputs(master, venues, venues_path,
                                   Path(args.days_dir), Path(args.master_min),
                                   Path(args.descriptions), Path(args.prices),
                                   Path(args.availability))
    # After the derived outputs, because that is where prices are folded in and
    # the master is the record of what they were.
    write_json(master_path, master)

    print(f"\nWrote: {master_path} ({len(master)} shows), {args.master_min}, "
          f"{args.availability}, {args.descriptions}, {venues_path} ({len(venues)} venues), "
          f"{n_days} day files in {args.days_dir}")
    return 0


# --------------------------------------------------------------------------- #
# Self-test: exercises the transform on a tiny fixture, no network or raw data.
# --------------------------------------------------------------------------- #
FIXTURE_EVENT = {
    "id": 103540, "title": "10 Things They Hate About Me", "genre": "COMEDY",
    "subGenre": "Stand-up,Character Comedy", "subgenres": ["STAND_UP", "CHARACTER_COMEDY"],
    "duration": "60", "boxOfficeRef": "202610THING_CLZ", "cmsRef": "202610THING",
    "slug": "10-things-they-hate-about-me", "presentedBy": "Some Company",
    "priceType": "PAID", "freeTicketed": False, "ageRestriction": "14+",
    "description": "A **razor-sharp** hour of comedy.\n\nReally funny.",
    # Small listed before Large, as the live API actually returns them, so the
    # transform must not rely on order to pick the large image.
    "images": [
        {"url": "http://registration.edfringe.com/resource/image/small-guid",
         "imageType": "Small"},
        {"url": "http://registration.edfringe.com/resource/image/large-guid",
         "imageType": "Large"},
    ],
    "venues": [{"title": "Pleasance Courtyard", "slug": "pleasance-courtyard"}],
    "spaces": [{"id": 5, "title": "Beneath", "venueName": "Pleasance Courtyard",
                "venueCode": "33"}],
    "performances": [
        {"id": 1, "dateTime": "2026-08-06T11:45:00.000Z", "soldOut": False,
         "cancelled": False, "ticketStatus": "AVAILABLE"},
        {"id": 2, "dateTime": "2026-08-07T11:45:00.000Z", "soldOut": True,
         "cancelled": False, "ticketStatus": "SOLD_OUT"},
        {"id": 3, "dateTime": "2026-08-08T11:45:00.000Z", "cancelled": True},
    ],
}


def selftest() -> int:
    rec = normalize_event(FIXTURE_EVENT)
    assert rec["id"] == "202610THING", rec["id"]
    assert rec["genre"] == "Comedy", rec["genre"]
    assert rec["subgenres"] == ["Stand-up", "Character Comedy"], rec["subgenres"]
    assert rec["venue"] == "33" and rec["room"] == "Beneath", rec
    assert rec["free"] is False
    assert rec["duration"] == 60
    assert rec["blurb"] == "A razor-sharp hour of comedy. Really funny.", rec["blurb"]
    # The master keeps the untruncated text too; the blurb is the same string
    # cut down. (This fixture is short enough that they coincide — the cut
    # itself is asserted below.)
    assert rec["description"] == "A razor-sharp hour of comedy. Really funny.", rec["description"]
    long_desc = "word " * 60
    assert len(clean_description(long_desc)) == 299, "clean_description must not truncate"
    assert short_blurb(long_desc).endswith("…"), "short_blurb must truncate"
    # `image` prefers the "Large" variant and smallImage the "Small" one,
    # regardless of the order the API lists them in, and both are stored as the
    # bare GUID (the edfringe host prefix is stripped, re-attached client-side).
    assert rec["smallImage"] == "small-guid", rec["smallImage"]
    assert rec["image"] == "large-guid", rec["image"]
    # A non-edfringe host is kept whole so it still renders.
    assert image_ref("https://other.example/x.jpg") == "https://other.example/x.jpg"
    assert image_ref(None) is None
    assert len(rec["performances"]) == 2, "cancelled performance must be dropped"
    # 11:45Z in August is 12:45 in Edinburgh. The fixture's stamps are UTC
    # because the API's are, and every time this file writes is local.
    assert rec["performances"][0] == {
        "date": "2026-08-06", "start": "12:45", "soldOut": False, "status": "AVAILABLE"}

    # local_date_start is the pipeline's only time-zone crossing, so pin the
    # cases that would silently file a show on the wrong hour or the wrong day.
    assert local_date_start("2026-08-06T11:45:00.000Z") == ("2026-08-06", "12:45")
    # A late show crosses midnight into the next date, as it does on the door.
    assert local_date_start("2026-08-09T23:30:00.000Z") == ("2026-08-10", "00:30")
    # Outside BST the offset is zero and the digits pass through unchanged.
    assert local_date_start("2026-01-15T19:00:00.000Z") == ("2026-01-15", "19:00")
    # An explicit offset is honoured rather than re-read as UTC.
    assert local_date_start("2026-08-06T13:45:00+02:00") == ("2026-08-06", "12:45")
    # A zone-less stamp is read as UTC; junk yields nothing to file.
    assert local_date_start("2026-08-06T11:45:00") == ("2026-08-06", "12:45")
    assert local_date_start(None) is None and local_date_start("") is None
    assert local_date_start("not a date") is None
    # A well-formed stamp whose conversion leaves the representable range is
    # skipped like any other junk, not raised through the caller (#544).
    assert local_date_start("0001-01-01T00:00:00.000Z") is None

    # Prices arrive from the separate fetch-once cache, keyed by the same show
    # id. A cache miss on a paid show leaves the price *unknown* (None) — the
    # site must not read that as free — while a free show is a known £0.
    priced = dict(rec)
    apply_prices([priced], {"shows": {"202610THING": {"min": 22.5, "max": 29.5}}})
    assert priced["priceMin"] == 22.5 and priced["priceMax"] == 29.5, priced
    unknown = dict(rec)
    assert apply_prices([unknown], {"shows": {}}) == 0
    assert unknown["priceMin"] is None and unknown["priceMax"] is None, unknown
    free_show = dict(rec, free=True)
    apply_prices([free_show], {})
    assert free_show["priceMin"] == 0.0 and free_show["priceMax"] == 0.0, free_show
    # A single-band show reports the same min and max.
    one_band = dict(rec)
    apply_prices([one_band], {"shows": {"202610THING": {"min": 12.0}}})
    assert one_band["priceMax"] == 12.0, one_band

    # ---- per-performance prices -------------------------------------------
    # The cache the current fetch_prices.py writes: distinct price points once,
    # each performance mapped to the one it sells. This show previews at £8.50
    # on the 6th and runs at £15 on the 7th — the case that shipped as a single
    # £8.50 for the whole run and is the reason this shape exists.
    PER_PERF = {"shows": {"202610THING": {
        "slug": "10-things-they-hate-about-me",
        "min": 8.5, "max": 15.0,
        "sets": [{"min": 8.5, "max": 8.5, "bands": [{"type": "Standard", "value": 8.5}]},
                 {"min": 15.0, "max": 15.0, "bands": [{"type": "Standard", "value": 15.0}]}],
        "perfs": {"2026-08-06|12:45": 0, "2026-08-07|12:45": 1}}}}

    # The master carries the RUN-WIDE range: cheapest night to dearest, not one
    # night's figure standing in for the run.
    per_perf_show = dict(rec)
    assert apply_prices([per_perf_show], PER_PERF) == 1
    assert per_perf_show["priceMin"] == 8.5, per_perf_show
    assert per_perf_show["priceMax"] == 15.0, per_perf_show
    assert show_price_range(PER_PERF["shows"]["202610THING"]) == (8.5, 15.0)
    # A legacy whole-show entry still reads, as one set covering everything —
    # the site keeps its prices while the cache migrates show by show.
    assert show_price_range({"min": 12.0, "max": 18.0}) == (12.0, 18.0)
    assert show_price_range({"min": 12.0}) == (12.0, 12.0)
    assert show_price_range({}) == (None, None)
    assert show_price_range(None) == (None, None)
    assert price_sets({"sets": [], "min": 9.0}) == [{"min": 9.0, "max": 9.0}], \
        "an empty sets list must fall back to the whole-show price, not vanish"

    # The join index: performance key -> that night's cheapest band. Built only
    # from entries that actually carry per-performance data.
    index = performance_prices(PER_PERF)
    assert index == {"202610THING": {"2026-08-06|12:45": 8.5,
                                     "2026-08-07|12:45": 15.0}}, index
    assert performance_prices({"shows": {"X": {"min": 9.0}}}) == {}, \
        "a legacy entry contributes no per-performance prices"
    assert performance_prices({}) == {}
    # A `perfs` pointing outside `sets` is dropped rather than crashing or
    # defaulting to something wrong — a truncated cache must not invent money.
    assert performance_prices({"shows": {"X": {"sets": [], "perfs": {"a": 0}}}}) == {}
    assert performance_prices({"shows": {"X": {"sets": [{"min": 5.0}],
                                               "perfs": {"a": 7}}}}) == {}

    genres, rooms, subgenres, ticket_statuses, age_restrictions = build_lookups([rec])
    assert genres == ["Comedy"] and rooms == ["Beneath"], (genres, rooms)
    assert subgenres == ["Character Comedy", "Stand-up"], subgenres
    assert ticket_statuses == ["AVAILABLE", "SOLD_OUT"], ticket_statuses
    assert age_restrictions == ["14+"], age_restrictions
    genre_ix = {g: i for i, g in enumerate(genres)}
    room_ix = {r: i for i, r in enumerate(rooms)}
    sub_ix = {s: i for i, s in enumerate(subgenres)}
    ts_ix = {t: i for i, t in enumerate(ticket_statuses)}
    age_ix = {a: i for i, a in enumerate(age_restrictions)}

    # Compact planner form (shows.min.json): enums become indices into the shared
    # lookups, dates MMDD ints, flags 1/0, smallImage kept only when it differs
    # from image, venueName dropped when it rebuilds from "<room> at <venue name>".
    venues = {"33": {"name": "Pleasance Courtyard"}}
    packed = minify_master([rec], genre_ix, room_ix, sub_ix, age_ix, venues)[0]
    assert genres[packed["g"]] == "Comedy", packed
    assert [subgenres[i] for i in packed["sg"]] == ["Stand-up", "Character Comedy"], packed
    assert age_restrictions[packed["ar"]] == "14+" and rooms[packed["rm"]] == "Beneath", packed
    assert packed["f"] == 0 and packed["im"] == "large-guid", packed
    # This fixture's large/small images differ, so smallImage is carried; in real
    # data they are identical and `si` is dropped entirely.
    assert packed["si"] == "small-guid", packed
    # A performance carries only what NAMES it. Status and soldOut are the two
    # fields that move through the day and they live in the sidecar instead, so
    # this file can be cached for days without freezing availability.
    assert packed["p"][0] == {"d": 806, "s": "12:45"}, packed
    assert packed["p"][1] == {"d": 807, "s": "12:45"}, packed
    # venueName here isn't "<room> at <venue name>", so it is kept verbatim (`vn`).
    assert packed["vn"] == "Pleasance Courtyard", packed
    # An unpriced show carries no price keys at all, so the client can tell
    # "unknown" from "£0" — `f` (free) is the only thing that means free.
    assert "pm" not in packed and "px" not in packed, packed

    # A priced show carries `pm`, and `px` only when the range is wider than one
    # band, in both the catalogue and (pm alone) the day files.
    packed_priced = minify_master([priced], genre_ix, room_ix, sub_ix,
                                  age_ix, venues)[0]
    assert packed_priced["pm"] == 22.5 and packed_priced["px"] == 29.5, packed_priced
    packed_one = minify_master([one_band], genre_ix, room_ix, sub_ix,
                               age_ix, venues)[0]
    assert packed_one["pm"] == 12.0 and "px" not in packed_one, packed_one
    # A venueName that IS "<room> at <name>" rebuilds from the code + room, so it
    # is dropped from the wire form.
    rebuildable = dict(rec, venue="33", room="Beneath",
                       venueName="Beneath at Pleasance Courtyard")
    packed2 = minify_master([rebuildable], genre_ix, room_ix, sub_ix, age_ix, venues)[0]
    assert "vn" not in packed2, "rebuildable venueName must be dropped from the wire form"

    # Availability sidecar: its own status list (indexing into nothing external),
    # performances named by "MMDD|HH:MM" so a stale catalogue can still be joined
    # against a fresh sidecar, and soldOut kept as a separate sparse map.
    avail = build_availability([rec])
    assert avail["v"] == 1 and avail["ts"] == ["AVAILABLE", "SOLD_OUT"], avail
    a_ix = {s: i for i, s in enumerate(avail["ts"])}
    assert avail["a"]["202610THING"] == {"806|12:45": a_ix["AVAILABLE"],
                                         "807|12:45": a_ix["SOLD_OUT"]}, avail
    assert avail["o"] == {"202610THING": ["807|12:45"]}, avail
    # The sidecar names the catalogue generation it belongs to, and that name
    # tracks the join keys and nothing else: correcting a start time (#274) must
    # move it, repricing a show must not. plan/lib/hydrate.js recomputes the same
    # value client-side; hydrate.test.mjs pins the two implementations together
    # against the committed files.
    assert avail["k"] == join_fingerprint([rec]), avail
    shifted = json.loads(json.dumps(rec))
    shifted["performances"][0]["start"] = "11:45"
    assert join_fingerprint([shifted]) != avail["k"], "a moved start time must change the fingerprint"
    repriced = json.loads(json.dumps(rec))
    repriced["priceMin"] = (repriced.get("priceMin") or 0) + 5
    assert join_fingerprint([repriced]) == avail["k"], "a price change must not change the fingerprint"
    # Every performance in the catalogue must be findable in the sidecar under
    # the same key — this is the join the client depends on.
    for perf in packed["p"]:
        key = f"{perf['d']}|{perf['s']}"
        assert key in avail["a"]["202610THING"], (key, avail)
    # A show with no statuses at all is omitted rather than carried as -1s: a
    # missing entry IS "unknown", and saying so twice costs bytes.
    blank = dict(rec, id="NOSTATUS", performances=[{"date": "2026-08-06", "start": "12:45",
                                                    "soldOut": False, "status": None}])
    assert build_availability([blank])["a"] == {}, build_availability([blank])

    # Lookup lists are append-only: a prior list keeps its order and its indices,
    # and anything new lands after it. A four-day-old catalogue is decoded
    # against a venues.json fetched today, so a moved index would relabel shows.
    assert extend_lookup(["Zebra", "Apple"], {"Apple", "Mango", "Zebra"}) == \
        ["Zebra", "Apple", "Mango"], "published entries must keep their index"
    assert extend_lookup(["Gone"], {"New"}) == ["Gone", "New"], \
        "an entry the master no longer uses must still not be dropped"
    assert extend_lookup(None, {"B", "A"}) == ["A", "B"], "a fresh list is sorted"
    prior = {"genres": ["Theatre", "Comedy"], "rooms": [], "subgenres": [],
             "ticketStatuses": [], "ageRestrictions": []}
    assert build_lookups([rec], prior)[0] == ["Theatre", "Comedy"], \
        "build_lookups must extend the published order, not re-sort it"

    days = build_day_files([rec], genre_ix, room_ix, sub_ix, ts_ix)
    assert set(days) == {"2026-08-06", "2026-08-07"}, days
    d6 = days["2026-08-06"][0]
    # genre, room, subgenres and ticket status are pointers into the lookup lists.
    assert genres[d6["genre"]] == "Comedy", d6
    assert d6["venue"] == "33" and rooms[d6["room"]] == "Beneath", d6
    assert [subgenres[i] for i in d6["subs"]] == ["Stand-up", "Character Comedy"], d6
    assert ticket_statuses[d6["ts"]] == "AVAILABLE", d6
    for dropped in ("venueName", "performances", "blurb", "subgenres", "smallImage",
                    "description"):
        assert dropped not in d6, f"day record must be minimal: {dropped}"
    assert d6["start"] == "12:45"
    # No price known -> no `pm` key; a priced show carries the cheapest band.
    assert "pm" not in d6, d6
    d6_priced = build_day_files([priced], genre_ix, room_ix, sub_ix,
                                ts_ix)["2026-08-06"][0]
    assert d6_priced["pm"] == 22.5, d6_priced

    # Each day file quotes the price of ITS OWN night. Same show, two dates,
    # two figures — the preview at £8.50 and the main run at £15. Publishing
    # £8.50 on both is the bug this replaced.
    per_perf_days = build_day_files([per_perf_show], genre_ix, room_ix, sub_ix,
                                    ts_ix, index)
    assert per_perf_days["2026-08-06"][0]["pm"] == 8.5, per_perf_days["2026-08-06"]
    assert per_perf_days["2026-08-07"][0]["pm"] == 15.0, per_perf_days["2026-08-07"]
    # ...while the catalogue keeps the run-wide range, so the planner still
    # says "£8.50–£15" for the show as a whole.
    packed_run = minify_master([per_perf_show], genre_ix, room_ix, sub_ix,
                               age_ix, venues)[0]
    assert packed_run["pm"] == 8.5 and packed_run["px"] == 15.0, packed_run

    # A show with no per-performance data at all keeps the old behaviour: the
    # show-level price on every night. This is what holds the site's prices up
    # while the cache migrates one show per re-run of the price pass.
    legacy_days = build_day_files([priced], genre_ix, room_ix, sub_ix, ts_ix, {})
    assert legacy_days["2026-08-06"][0]["pm"] == 22.5, legacy_days
    assert legacy_days["2026-08-07"][0]["pm"] == 22.5, legacy_days

    # But a show that HAS per-performance prices and simply lacks this one — a
    # date added after the last price pass — says nothing rather than borrowing
    # the other night's figure. "Price TBC" is true; £8.50 would not be.
    partial = build_day_files([per_perf_show], genre_ix, room_ix, sub_ix, ts_ix,
                              {"202610THING": {"2026-08-06|12:45": 8.5}})
    assert partial["2026-08-06"][0]["pm"] == 8.5, partial
    assert "pm" not in partial["2026-08-07"][0], partial["2026-08-07"]

    # A free show is priced from the listing flag, not the cache, so it still
    # reads £0 on every night even with per-performance data in play.
    free_priced = dict(rec, id="FREEBIE", free=True)
    apply_prices([free_priced], PER_PERF)
    free_days = build_day_files([free_priced], genre_ix, room_ix, sub_ix, ts_ix, index)
    assert free_days["2026-08-06"][0]["pm"] == 0.0, free_days
    # Binary flags are 1/0, not booleans.
    assert d6["soldOut"] == 0 and d6["free"] == 0, d6
    d7 = days["2026-08-07"][0]
    assert d7["soldOut"] == 1 and ticket_statuses[d7["ts"]] == "SOLD_OUT", d7

    # The fringe day runs 06:00 → 06:00, so a show after midnight belongs to the
    # night before and is written with an extended start. 06:00 itself does not
    # fold — a breakfast show is part of the morning it happens in.
    assert fringe_day("2026-08-15", "00:30") == ("2026-08-14", "24:30")
    assert fringe_day("2026-08-15", "05:59") == ("2026-08-14", "29:59")
    assert fringe_day("2026-08-15", "06:00") == ("2026-08-15", "06:00")
    assert fringe_day("2026-08-15", "23:45") == ("2026-08-15", "23:45")
    assert fringe_day("2026-09-01", "00:30") == ("2026-08-31", "24:30")

    late = dict(rec, id="LATE", performances=[
        {"date": "2026-08-07", "start": "22:00", "soldOut": False, "status": "AVAILABLE"},
        {"date": "2026-08-08", "start": "00:30", "soldOut": False, "status": "AVAILABLE"},
    ])
    late_days = build_day_files([late], genre_ix, room_ix, sub_ix, ts_ix)
    # Both performances are the same night out, so they share one day file...
    assert set(late_days) == {"2026-08-07"}, late_days
    # ...sorted by the extended start, which keeps the after-midnight one last.
    assert [r["start"] for r in late_days["2026-08-07"]] == ["22:00", "24:30"], late_days
    # A show whose only performance is on the first morning of the run folds onto
    # a July night the festival never had, so it is dropped rather than mis-dated.
    july = dict(rec, id="JULY", performances=[
        {"date": "2026-08-01", "start": "00:30", "soldOut": False, "status": "AVAILABLE"}])
    assert build_day_files([july], genre_ix, room_ix, sub_ix, ts_ix) == {}

    # priceType can be a list (of strings or objects) in real data.
    assert is_free({"priceType": ["PAID"], "freeTicketed": False}) is False
    assert is_free({"priceType": ["FREE_NON_TICKETED"]}) is True
    assert is_free({"priceType": [{"value": "FREE"}], "freeTicketed": False}) is True
    assert is_free({"priceType": ["FREE", "PAID"]}) is False
    assert is_free({"priceType": "PAID"}) is False
    assert is_free({"freeTicketed": True}) is True

    # Subgenres: prefer the human string; fall back to humanising the enum;
    # de-dupe case-insensitively; empty when neither is present.
    assert subgenre_labels({"subGenre": "Stand-up,Improv"}) == ["Stand-up", "Improv"]
    assert subgenre_labels({"subgenres": ["NEW_WRITING", "DARK_COMEDY"]}) == ["New Writing", "Dark Comedy"]
    assert subgenre_labels({"subGenre": "Comedy,comedy"}) == ["Comedy"]
    assert subgenre_labels({"subGenre": ""}) == []
    assert subgenre_labels({}) == []

    # Case-variant subgenres across shows collapse to one display casing (most
    # capitals wins, keeping the nicer form), de-duped within each show.
    fixture = [
        {"subgenres": ["Alternative comedy", "LGBTQ+"]},
        {"subgenres": ["Alternative Comedy", "Lgbtq+", "alternative COMEDY"]},
    ]
    unify_subgenre_casing(fixture)
    assert fixture[0]["subgenres"] == ["Alternative Comedy", "LGBTQ+"], fixture[0]
    assert fixture[1]["subgenres"] == ["Alternative Comedy", "LGBTQ+"], fixture[1]

    assert map_genre("DANCE_PHYSICAL_THEATRE_AND_CIRCUS", None) == "Dance, Physical Theatre & Circus"
    assert map_genre("MUSICALS_AND_OPERA", "Musicals and Opera") == "Musicals and Opera"
    assert map_genre("CHILDRENS_SHOWS", "Children's Shows") == "Children's Shows"

    # The descriptions sidecar: keyed by slug, full text, and never carrying an
    # entry it has nothing to say for. A master with only the older truncated
    # blurb still yields a usable sidecar.
    side = build_descriptions([rec])
    assert side["v"] == 1, side
    assert side["d"]["10-things-they-hate-about-me"] == rec["description"], side
    legacy = {"slug": "old-show", "blurb": "Only a blurb survived."}
    assert build_descriptions([legacy])["d"] == {"old-show": "Only a blurb survived."}
    assert build_descriptions([{"slug": "empty", "blurb": ""}])["d"] == {}
    # The packed catalogue must NOT carry the description — that separation is
    # the entire reason the sidecar exists.
    assert "description" not in packed, packed
    assert "de" not in packed, packed

    print("selftest OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR))
    parser.add_argument("--master", default=str(DEFAULT_MASTER))
    parser.add_argument("--master-min", default=str(DEFAULT_MASTER_MIN))
    parser.add_argument("--descriptions", default=str(DEFAULT_DESCRIPTIONS))
    parser.add_argument("--availability", default=str(DEFAULT_AVAILABILITY))
    parser.add_argument("--venues", default=str(DEFAULT_VENUES))
    parser.add_argument("--days-dir", default=str(DEFAULT_DAYS_DIR))
    parser.add_argument("--prices", default=str(DEFAULT_PRICES),
                        help="ticket-price cache from fetch_prices.py "
                             f"(default {DEFAULT_PRICES})")
    parser.add_argument("--merge", action="store_true",
                        help="upsert into the existing master instead of replacing")
    parser.add_argument("--no-geocode", action="store_true",
                        help="skip postcode geocoding (leave lat/lng null)")
    parser.add_argument("--minify-from-master", action="store_true",
                        help="rebuild venues.json + shows.min.json from the existing "
                             "master (no raw scrape) and exit")
    parser.add_argument("--selftest", action="store_true",
                        help="run the built-in fixture test and exit")
    args = parser.parse_args()

    # Line-buffer output so progress shows up live in CI logs (stdout is a pipe
    # there, which Python would otherwise fully buffer). Geocoding in particular
    # can run for a while.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(line_buffering=True)
        except (AttributeError, ValueError):
            pass

    if args.selftest:
        return selftest()
    if args.minify_from_master:
        return regen_from_master(args)
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
