#!/usr/bin/env python3
"""Normalize scraped edfringe show data into website-ready JSON.

Reads the raw scrape (events + venues + genres produced by fetch_shows.py) and
emits three layers of data:

  data/normalized/shows.json   master, normalized, one record per show with all
                               its performances. The source of truth for later
                               processing / regenerating the day files. NOT sent
                               to the browser.

  data/venues.json             shared lookup, sent once:
                               {venues, rooms, genres, subgenres}. `venues` is
                               keyed by venue code ("venue number") -> name,
                               address, postcode, lat, lng; `rooms`, `genres` and
                               `subgenres` are the global de-duplicated string
                               lists the day files index into.

  data/days/2026-08-DD.json    one file per August day, holding only the shows
                               performing that day with the minimum a card needs.
                               Normalized: venue is referenced by code and
                               genre/room by index into the global rooms/genres
                               lists (all in venues.json). This is what the site
                               loads on open.
  data/days/index.json         list of available days + per-day counts.

Locations are normalized to a venue code plus the specific room (space) of the
show. Price is reduced to a free/paid flag (the listing API exposes no amount).
Venue coordinates are geocoded from UK postcodes via postcodes.io and cached in
venues.json so a refresh only geocodes new venues.

Usage:
    python3 scraper/normalize.py                 # full rebuild from raw scrape
    python3 scraper/normalize.py --merge         # upsert raw into existing master
    python3 scraper/normalize.py --no-geocode    # skip postcode lookups
    python3 scraper/normalize.py --selftest      # run the built-in fixture test
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
DEFAULT_VENUES = ROOT / "data" / "venues.json"
DEFAULT_DAYS_DIR = ROOT / "data" / "days"

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


def short_blurb(description: str | None) -> str:
    """A compact one-line blurb: strip markdown, collapse space, truncate."""
    if not description:
        return ""
    text = re.sub(r"[*_#>`]", "", description)        # drop markdown markers
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= BLURB_MAX:
        return text
    cut = text[:BLURB_MAX].rsplit(" ", 1)[0].rstrip(",.;:")
    return cut + "…"


def primary_image(images: list | None) -> str | None:
    for img in images or []:
        if img.get("url"):
            return img["url"]
    return None


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
        "image": primary_image(event.get("images")),
        "blurb": short_blurb(event.get("description")),
        "venue": venue_code,
        "venueName": venue_name,
        "room": room,
        "performances": performances,
    }


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


def build_lookups(master: list[dict]) -> tuple[list[str], list[str], list[str]]:
    """The global (genres, rooms, subgenres) lookup lists: every distinct genre,
    room and subgenre string across all shows, sorted. A show references them by
    index in the day files; the lists ship once, alongside the venues (run())."""
    genres = sorted({s["genre"] for s in master if s.get("genre")})
    rooms = sorted({s["room"] for s in master if s.get("room")})
    subgenres = sorted({sg for s in master for sg in s.get("subgenres") or []})
    return genres, rooms, subgenres


def build_day_files(master: list[dict], genre_ix: dict[str, int],
                    room_ix: dict[str, int],
                    sub_ix: dict[str, int]) -> dict[str, list]:
    """Bucket shows by August performance date into minimal per-day records.

    Each record is kept small:

      * `genre` / `room` — pointers into the global `genres` / `rooms` lookup
        lists (shipped once with the venues), not the strings themselves.
        `room` is -1 when the show has no specific room.
      * `subs` — the show's subgenres as pointers into the global `subgenres`
        lookup list; an empty list when the festival tagged none (~2%).
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
            days.setdefault(date, []).append({
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
                "slug": show["slug"],
            })
    for date in days:
        days[date].sort(key=lambda x: (x["start"], x["title"] or ""))
    return days


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
    write_json(master_path, master)

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
    genres, rooms, subgenres = build_lookups(master)
    write_json(venues_path, {"venues": venues, "rooms": rooms,
                             "genres": genres, "subgenres": subgenres})

    # Per-day August files + index.
    genre_ix = {g: i for i, g in enumerate(genres)}
    room_ix = {r: i for i, r in enumerate(rooms)}
    sub_ix = {s: i for i, s in enumerate(subgenres)}
    days_dir = Path(args.days_dir)
    days = build_day_files(master, genre_ix, room_ix, sub_ix)
    for date, items in days.items():
        write_json(days_dir / f"{date}.json", items)
    index = {
        "dates": sorted(days.keys()),
        "counts": {d: len(days[d]) for d in sorted(days)},
        "shows": len(master),
        "venues": len(venues),
    }
    write_json(days_dir / "index.json", index)

    print(f"\nWrote: {master_path} ({len(master)} shows), "
          f"{venues_path} ({len(venues)} venues), "
          f"{len(days)} day files in {days_dir}")
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
    "images": [{"url": "https://img/thumb.jpg", "imageType": "THUMBNAIL"}],
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
    assert len(rec["performances"]) == 2, "cancelled performance must be dropped"
    assert rec["performances"][0] == {
        "date": "2026-08-06", "start": "11:45", "soldOut": False, "status": "AVAILABLE"}

    genres, rooms, subgenres = build_lookups([rec])
    assert genres == ["Comedy"] and rooms == ["Beneath"], (genres, rooms)
    assert subgenres == ["Character Comedy", "Stand-up"], subgenres
    genre_ix = {g: i for i, g in enumerate(genres)}
    room_ix = {r: i for i, r in enumerate(rooms)}
    sub_ix = {s: i for i, s in enumerate(subgenres)}
    days = build_day_files([rec], genre_ix, room_ix, sub_ix)
    assert set(days) == {"2026-08-06", "2026-08-07"}, days
    d6 = days["2026-08-06"][0]
    # genre, room and subgenres are pointers into the global lookup lists.
    assert genres[d6["genre"]] == "Comedy", d6
    assert d6["venue"] == "33" and rooms[d6["room"]] == "Beneath", d6
    assert [subgenres[i] for i in d6["subs"]] == ["Stand-up", "Character Comedy"], d6
    for dropped in ("venueName", "performances", "blurb", "subgenres"):
        assert dropped not in d6, f"day record must be minimal: {dropped}"
    assert d6["start"] == "11:45"
    # Binary flags are 1/0, not booleans.
    assert d6["soldOut"] == 0 and d6["free"] == 0, d6
    assert days["2026-08-07"][0]["soldOut"] == 1, days["2026-08-07"]

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
    print("selftest OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", default=str(DEFAULT_RAW_DIR))
    parser.add_argument("--master", default=str(DEFAULT_MASTER))
    parser.add_argument("--venues", default=str(DEFAULT_VENUES))
    parser.add_argument("--days-dir", default=str(DEFAULT_DAYS_DIR))
    parser.add_argument("--merge", action="store_true",
                        help="upsert into the existing master instead of replacing")
    parser.add_argument("--no-geocode", action="store_true",
                        help="skip postcode geocoding (leave lat/lng null)")
    parser.add_argument("--selftest", action="store_true",
                        help="run the built-in fixture test and exit")
    args = parser.parse_args()

    if args.selftest:
        return selftest()
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
