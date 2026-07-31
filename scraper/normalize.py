#!/usr/bin/env python3
"""Normalize scraped edfringe show data into website-ready JSON.

Reads the raw scrape (events + venues + genres produced by fetch_shows.py) and
emits three layers of data:

  data/normalized/shows.json   master, normalized, one record per show with all
                               its performances. The source of truth for later
                               processing / regenerating the day files. NOT sent
                               to the browser.

  data/normalized/shows.min.json
                               the compact wire form of the master, and the file
                               the planner actually downloads. Losslessly packed
                               against the venues.json lookups: every enum (genre,
                               room, subgenre, ticket status, age restriction) is
                               an index into a shared list; venueName is rebuilt
                               from the venue code + room; smallImage is dropped
                               when it equals image; booleans are 1/0; dates are an
                               MMDD int; field names are 1-3 chars. The planner
                               rehydrates it with venues.json (see plan/plan.js).

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

  data/days/2026-08-DD.json    one file per August day, holding only the shows
                               performing that day with the minimum a card needs.
                               Normalized: venue is referenced by code and
                               genre/room by index into the global rooms/genres
                               lists (all in venues.json). This is what the site
                               loads on open.
  data/days/index.json         list of available days + per-day counts.

Locations are normalized to a venue code plus the specific room (space) of the
show. Venue coordinates are geocoded from UK postcodes via postcodes.io and
cached in venues.json so a refresh only geocodes new venues.

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
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_RAW_DIR = ROOT / "data" / "raw_pages"
DEFAULT_MASTER = ROOT / "data" / "normalized" / "shows.json"
DEFAULT_MASTER_MIN = ROOT / "data" / "normalized" / "shows.min.json"
DEFAULT_DESCRIPTIONS = ROOT / "data" / "normalized" / "descriptions.min.json"
DEFAULT_VENUES = ROOT / "data" / "venues.json"
DEFAULT_DAYS_DIR = ROOT / "data" / "days"
DEFAULT_PRICES = ROOT / "data" / "prices.json"

AUGUST_PREFIX = "2026-08"
BLURB_MAX = 160

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
        dt = p.get("dateTime")
        if not dt or p.get("cancelled"):
            continue
        # The API stores Edinburgh wall-clock time; take date/time literally.
        performances.append({
            "date": dt[:10],
            "start": dt[11:16],
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


def apply_prices(master: list[dict], prices: dict) -> int:
    """Attach real ticket amounts from the price cache to the master, in place.

    `prices` is `data/prices.json` as written by `fetch_prices.py` — a
    fetch-once cache keyed by the same show id the master uses. A show with no
    entry keeps `priceMin`/`priceMax` of None, which the site reads as "price
    unknown" and is *not* the same as free: only the `free` flag says free.

    Free shows are given £0 rather than left unknown. They are skipped by the
    price pass (there is nothing to call `performancePrices` for), but their
    price is known perfectly well from the listing flag, and a filter asking
    "what can I see for under £10" must include them.

    Returns how many shows came out with a known price.
    """
    by_id = (prices or {}).get("shows") or {}
    known = 0
    for show in master:
        entry = by_id.get(show["id"])
        if entry and entry.get("min") is not None:
            show["priceMin"] = entry["min"]
            show["priceMax"] = entry.get("max", entry["min"])
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


def build_lookups(master: list[dict]) -> tuple[list[str], list[str], list[str], list[str], list[str]]:
    """The global (genres, rooms, subgenres, ticketStatuses, ageRestrictions)
    lookup lists: every distinct genre, room, subgenre, per-performance ticket
    status and age restriction across all shows, sorted. A show references them by
    index in the day files and in shows.min.json; the lists ship once, alongside
    the venues (run())."""
    genres = sorted({s["genre"] for s in master if s.get("genre")})
    rooms = sorted({s["room"] for s in master if s.get("room")})
    subgenres = sorted({sg for s in master for sg in s.get("subgenres") or []})
    ticket_statuses = sorted({p.get("status") for s in master
                              for p in s.get("performances") or [] if p.get("status")})
    age_restrictions = sorted({s["ageRestriction"] for s in master if s.get("ageRestriction")})
    return genres, rooms, subgenres, ticket_statuses, age_restrictions


def build_day_files(master: list[dict], genre_ix: dict[str, int],
                    room_ix: dict[str, int], sub_ix: dict[str, int],
                    ts_ix: dict[str, int]) -> dict[str, list]:
    """Bucket shows by August performance date into minimal per-day records.

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
      * `blurb` — omitted. It is kept in the master (the scraped data) but the
        site never renders it, so it is left out of the per-day payload.
    """
    days: dict[str, list] = {}
    seen: set[tuple] = set()   # (id, date, start) — drop duplicate performances
    for show in master:
        for p in show.get("performances", []):
            date = p["date"]
            if not date.startswith(AUGUST_PREFIX):
                continue
            key = (show["id"], date, p["start"])
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
                "start": p["start"],
                "duration": show["duration"],
                "free": 1 if show["free"] else 0,
                "soldOut": 1 if p["soldOut"] else 0,
                "ts": ts_ix.get(p.get("status"), -1),
                "slug": show["slug"],
            }
            # Cheapest band only: the Now page's price filter asks "what can I
            # see for up to £X", which the lowest band answers. The full range
            # lives in the planner's catalogue, which isn't size-constrained the
            # way a day file is. Omitted when the price is unknown.
            if show.get("priceMin") is not None:
                rec["pm"] = show["priceMin"]
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
                  sub_ix: dict[str, int], ts_ix: dict[str, int], age_ix: dict[str, int],
                  venues: dict) -> list[dict]:
    """Pack the full master into the compact records the planner downloads.

    Each field is either shortened, indexed into a shared venues.json lookup, or
    dropped when it can be reconstructed:

      * `g`/`rm`/`ar` — genre, room and age restriction as indices into the
        global genres/rooms/ageRestrictions lists (-1 when absent).
      * `sg` — subgenres as indices into the global subgenres list.
      * `p[].t` — the performance ticket status as an index into ticketStatuses
        (-1 when absent).
      * `vn` — venueName, kept ONLY when it can't be rebuilt from `v` + `rm`
        (venue_name_rebuildable); present-but-null for the no-venue shows.
      * `si` — smallImage, kept ONLY when it differs from `im` (image); otherwise
        the client mirrors image.
      * `f`/`p[].o` — free / soldOut as 1/0.
      * `p[].d` — the performance date as an MMDD int.
      * `im` — the bare image GUID; the client re-attaches the host prefix.
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
            "o": 1 if p["soldOut"] else 0,
            "t": ts_ix.get(p.get("status"), -1),
        } for p in s.get("performances") or []]
        out.append(rec)
    return out


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
                          descriptions_path: Path, prices_path: Path) -> int:
    """Write everything derived from the master + venue map: the shared lookup
    file (venues.json), the per-day now-page files, the compact planner file
    (shows.min.json) and its descriptions sidecar. Returns the number of day
    files written.

    The lookup lists are built once here and indexed into by both the day files
    and shows.min.json, so the two stay in lockstep with a single source of truth.
    """
    # Real ticket amounts, folded in before anything is packed so the master and
    # both wire forms agree on what a show costs.
    known = apply_prices(master, load_prices(prices_path))
    print(f"  priced {known}/{len(master)} shows from {prices_path.name}")

    genres, rooms, subgenres, ticket_statuses, age_restrictions = build_lookups(master)
    write_json(venues_path, {"venues": venues, "rooms": rooms, "genres": genres,
                             "subgenres": subgenres, "ticketStatuses": ticket_statuses,
                             "ageRestrictions": age_restrictions})

    genre_ix = {g: i for i, g in enumerate(genres)}
    room_ix = {r: i for i, r in enumerate(rooms)}
    sub_ix = {s: i for i, s in enumerate(subgenres)}
    ts_ix = {t: i for i, t in enumerate(ticket_statuses)}
    age_ix = {a: i for i, a in enumerate(age_restrictions)}

    # Compact planner payload (packed against the lookups just written), and the
    # descriptions it deliberately leaves behind.
    write_json(master_min_path, minify_master(master, genre_ix, room_ix, sub_ix,
                                              ts_ix, age_ix, venues))
    write_json(descriptions_path, build_descriptions(master))

    # Per-day August files + index.
    days = build_day_files(master, genre_ix, room_ix, sub_ix, ts_ix)
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
                                   Path(args.descriptions), Path(args.prices))
    write_json(master_path, master)
    print(f"Regenerated from {master_path} ({len(master)} shows): "
          f"{args.master_min}, {args.descriptions}, {venues_path} "
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
                                   Path(args.descriptions), Path(args.prices))
    # After the derived outputs, because that is where prices are folded in and
    # the master is the record of what they were.
    write_json(master_path, master)

    print(f"\nWrote: {master_path} ({len(master)} shows), {args.master_min}, "
          f"{args.descriptions}, {venues_path} ({len(venues)} venues), "
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
    assert rec["performances"][0] == {
        "date": "2026-08-06", "start": "11:45", "soldOut": False, "status": "AVAILABLE"}

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
    packed = minify_master([rec], genre_ix, room_ix, sub_ix, ts_ix, age_ix, venues)[0]
    assert genres[packed["g"]] == "Comedy", packed
    assert [subgenres[i] for i in packed["sg"]] == ["Stand-up", "Character Comedy"], packed
    assert age_restrictions[packed["ar"]] == "14+" and rooms[packed["rm"]] == "Beneath", packed
    assert packed["f"] == 0 and packed["im"] == "large-guid", packed
    # This fixture's large/small images differ, so smallImage is carried; in real
    # data they are identical and `si` is dropped entirely.
    assert packed["si"] == "small-guid", packed
    assert packed["p"][0] == {"d": 806, "s": "11:45", "o": 0, "t": ts_ix["AVAILABLE"]}, packed
    assert packed["p"][1]["o"] == 1 and ticket_statuses[packed["p"][1]["t"]] == "SOLD_OUT", packed
    # venueName here isn't "<room> at <venue name>", so it is kept verbatim (`vn`).
    assert packed["vn"] == "Pleasance Courtyard", packed
    # An unpriced show carries no price keys at all, so the client can tell
    # "unknown" from "£0" — `f` (free) is the only thing that means free.
    assert "pm" not in packed and "px" not in packed, packed

    # A priced show carries `pm`, and `px` only when the range is wider than one
    # band, in both the catalogue and (pm alone) the day files.
    packed_priced = minify_master([priced], genre_ix, room_ix, sub_ix, ts_ix,
                                  age_ix, venues)[0]
    assert packed_priced["pm"] == 22.5 and packed_priced["px"] == 29.5, packed_priced
    packed_one = minify_master([one_band], genre_ix, room_ix, sub_ix, ts_ix,
                               age_ix, venues)[0]
    assert packed_one["pm"] == 12.0 and "px" not in packed_one, packed_one
    # A venueName that IS "<room> at <name>" rebuilds from the code + room, so it
    # is dropped from the wire form.
    rebuildable = dict(rec, venue="33", room="Beneath",
                       venueName="Beneath at Pleasance Courtyard")
    packed2 = minify_master([rebuildable], genre_ix, room_ix, sub_ix, ts_ix, age_ix, venues)[0]
    assert "vn" not in packed2, "rebuildable venueName must be dropped from the wire form"

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
    assert d6["start"] == "11:45"
    # No price known -> no `pm` key; a priced show carries the cheapest band.
    assert "pm" not in d6, d6
    d6_priced = build_day_files([priced], genre_ix, room_ix, sub_ix,
                                ts_ix)["2026-08-06"][0]
    assert d6_priced["pm"] == 22.5, d6_priced
    # Binary flags are 1/0, not booleans.
    assert d6["soldOut"] == 0 and d6["free"] == 0, d6
    d7 = days["2026-08-07"][0]
    assert d7["soldOut"] == 1 and ticket_statuses[d7["ts"]] == "SOLD_OUT", d7

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
