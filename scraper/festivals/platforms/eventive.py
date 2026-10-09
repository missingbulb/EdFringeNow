#!/usr/bin/env python3
"""Eventive: the film-festival ticketing platform many North American and UK festivals sell through.

A festival's box office, `https://<tenant>.eventive.org/schedule`, is a script
shell. Its tenant script, `/<tenant>.<hash>.js`, opens with one object literal,
`TENANT = {...}`, carrying the public `api_key` and the `event_bucket` (one
bucket per edition) the page loads its programme with:

    https://api.eventive.org/event_buckets/<bucket>/events?api_key=<key>

`events[]` there is every event in the bucket, one per screening or happening:

  * `name`, `description` (HTML), `tags[]`, `images.cover`;
  * `start_time` / `end_time` — real UTC instants (the `Z` is not decoration);
  * `venue` — `{id, name, address, default_capacity}`, empty for an online-only
    event, whose screening is nowhere a visitor can go;
  * `films[]` — what is screened: `name`, `short_description`, `details.runtime`
    (minutes, a string), `still_image` / `cover_image` / `poster_image`;
  * `ticket_buckets[]` — ticket types with `price` in cents and `public`;
  * `tickets_available` — whether the order button sells (false once sold out,
    but also for an event sold nowhere online, which has no ticket types).

A bucket also carries stray events from other dates (last year's, tests), so
only in-person screenings dated inside the edition are kept, and the rest are
named in `outOfEdition`. This module writes one raw programme per edition in
Eventive's own vocabulary; `build` is pure over the `fetch` it is handed, and
`run` is the hand-run fetcher's entry point.
"""

import json
import re
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

FETCHER_VERSION = 1
SITE = "https://%s.eventive.org"
API = "https://api.eventive.org/event_buckets/%s/events?api_key=%s"
TENANT_SCRIPT_RE = r'src="/(%s\.[0-9a-f]+\.js)"'
FILM_FIELDS = ("id", "name", "short_description", "description", "still_image", "cover_image", "poster_image")


def tenant_of(script):
    """The `TENANT = {...}` object a tenant script opens with."""
    head = script.split("\n", 1)[0].strip()
    if not head.startswith("TENANT = "):
        raise ValueError("the tenant script does not open with TENANT = {...}")
    return json.loads(head[len("TENANT = "):].rstrip(";"))


PHONE_RE = re.compile(r"^[\d\s()+.-]{7,}$")


def address_line(address):
    """A printed multi-line address as the one line it is served and geocoded as;
    a line that is only a phone number is not part of the address."""
    if not address:
        return None
    lines = [line.strip().rstrip(",") for line in address.splitlines()]
    return ", ".join(line for line in lines if line and not PHONE_RE.match(line)) or None


def local_date(start_time, zone):
    """A UTC `start_time` as the festival's wall-clock date ("YYYY-MM-DD")."""
    instant = datetime.strptime(start_time[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    return instant.astimezone(ZoneInfo(zone)).date().isoformat()


def record(event):
    venue = event["venue"]
    return {
        "id": event["id"],
        "name": event.get("name"),
        "description": event.get("description") or None,
        "short_description": event.get("short_description") or None,
        "start_time": event["start_time"],
        "end_time": event.get("end_time"),
        "venue": venue["id"],
        "tags": [{"id": t["id"], "name": t["name"]} for t in event.get("tags") or [] if t.get("visible", True)],
        "cover": (event.get("images") or {}).get("cover"),
        "tickets_available": event.get("tickets_available"),
        "hide_tickets_button": event.get("hide_tickets_button"),
        "tickets_button_label": event.get("tickets_button_label") or None,
        "ticket_buckets": [
            {"name": b.get("name"), "price": b.get("price"), "public": b.get("public"), "is_active": b.get("is_active")}
            for b in event.get("ticket_buckets") or []
        ],
        "films": [
            dict({k: f.get(k) or None for k in FILM_FIELDS}, runtime=(f.get("details") or {}).get("runtime") or None)
            for f in event.get("films") or []
        ],
    }


def build(tenant_slug, edition, zone, fetch_text):
    """The edition's in-person screenings in the tenant's bucket, oldest first.

    `fetch_text(url)` answers a page's text; `zone` is the festival's declared
    time zone, the wall clock an edition's dates are in.
    """
    site = SITE % tenant_slug
    page = fetch_text(site + "/schedule")
    found = re.search(TENANT_SCRIPT_RE % re.escape(tenant_slug), page)
    if not found:
        raise ValueError("%s/schedule names no tenant script" % site)
    tenant = tenant_of(fetch_text(site + "/" + found.group(1)))
    events = json.loads(fetch_text(API % (tenant["event_bucket"], tenant["api_key"])))["events"]
    kept, out, venues = [], [], {}
    for event in events:
        if not event.get("venue") or not event.get("is_dated") or event.get("visibility") != "visible" or event.get("is_virtual"):
            continue
        day = local_date(event["start_time"], zone)
        if not edition["first"] <= day <= edition["last"]:
            out.append("%s (%s)" % (event.get("name"), day))
            continue
        kept.append(record(event))
        v = event["venue"]
        venues[v["id"]] = {"id": v["id"], "name": v.get("name"), "short_name": v.get("short_name") or None,
                           "address": v.get("address") or None,
                           "addressLine": address_line(v.get("address")), "default_capacity": v.get("default_capacity") or None}
    kept.sort(key=lambda e: (e["start_time"], e["id"]))
    return {
        "tenant": tenant.get("tenant") or tenant_slug,
        "site": site,
        "displayName": tenant.get("display_name"),
        "displayTimezone": tenant.get("display_timezone"),
        "currency": tenant.get("currency"),
        "eventBucket": tenant["event_bucket"],
        "edition": edition["id"],
        "events": kept,
        "venues": sorted(venues.values(), key=lambda v: v["id"]),
        "outOfEdition": sorted(out),
    }


def run(festival_dir, tenant_slug, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live box office, guard, write raw."""
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch Eventive tenant %s's programme into its raw folder." % tenant_slug)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    programme = build(tenant_slug, edition, festival["timezone"], lambda url: common.get(url, as_json=False))
    # A bucket that has rolled over to the next edition keeps only last year's
    # stragglers in this one's dates; most of it falling outside says so.
    if len(programme["outOfEdition"]) > len(programme["events"]):
        raise common.FetchRefused("%d of the bucket's screenings fall outside edition %s, %d inside — nothing written"
                                  % (len(programme["outOfEdition"]), edition["id"], len(programme["events"])))
    common.guard_dates(edition, [local_date(e["start_time"], festival["timezone"]) for e in programme["events"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[SITE % tenant_slug + "/schedule", API % (programme["eventBucket"], "<the tenant's public api_key>")],
        notes="Eventive's public events API for the tenant's bucket, unauthenticated (the key is the one the "
              "box office ships). In-person screenings in the edition only; start_time is UTC; prices in "
              "cents (scraper/festivals/platforms/eventive.py).",
    )
    print("%d screenings at %d venues on %s.eventive.org (%d outside the edition)" % (
        len(programme["events"]), len(programme["venues"]), tenant_slug, len(programme["outOfEdition"])))


def selftest():
    # Shapes copied from the live API, 2026-10-02, trimmed.
    tenant = {"tenant": "nofs", "display_name": "2026 New Orleans Film Festival", "display_timezone": "America/Chicago",
              "currency": "usd", "event_bucket": "B1", "api_key": "K"}
    venue = {"id": "V1", "name": "The MBS Black Box Theater at the Contemporary Arts Center", "short_name": "Black Box",
             "address": "900 Camp Street\nNew Orleans, LA 70130", "default_capacity": 141}
    events = [
        {"id": "E2", "name": "Victory", "venue": venue, "is_dated": True, "visibility": "visible", "is_virtual": False,
         "start_time": "2026-10-23T00:30:00.000Z", "end_time": "2026-10-23T01:44:00.000Z",
         "tags": [{"id": "T", "name": "Documentary Feature", "visible": True}, {"id": "H", "name": "x", "visible": False}],
         "images": {}, "tickets_available": True,
         "ticket_buckets": [{"name": "Opening Night", "price": 4000, "public": True, "is_active": True, "quantity_remaining": 94}],
         "films": [{"id": "F1", "name": "Victory", "still_image": "https://static.test/s.jpg", "details": {"runtime": "74"}}]},
        {"id": "E1", "name": "Online only", "venue": {}, "is_dated": True, "visibility": "visible",
         "start_time": "2026-10-22T00:30:00.000Z"},
        {"id": "E3", "name": "Last year", "venue": venue, "is_dated": True, "visibility": "visible",
         "start_time": "2025-10-23T00:30:00.000Z"},
        {"id": "E4", "name": "Hidden", "venue": venue, "is_dated": True, "visibility": "hidden",
         "start_time": "2026-10-23T00:30:00.000Z"},
    ]
    pages = {
        "https://nofs.eventive.org/schedule": '<script src="/nofs.e285154875083b904253.js"></script>',
        "https://nofs.eventive.org/nofs.e285154875083b904253.js": "TENANT = " + json.dumps(tenant) + ";\nmore",
        API % ("B1", "K"): json.dumps({"events": events}),
    }
    edition = {"id": "2026", "first": "2026-10-22", "last": "2026-10-27"}
    programme = build("nofs", edition, "America/Chicago", pages.__getitem__)
    assert [e["id"] for e in programme["events"]] == ["E2"], programme["events"]
    e = programme["events"][0]
    # 00:30 UTC on the 23rd is the evening of the 22nd in New Orleans.
    assert local_date(e["start_time"], "America/Chicago") == "2026-10-22"
    assert e["tags"] == [{"id": "T", "name": "Documentary Feature"}]
    assert e["films"][0]["runtime"] == "74" and e["films"][0]["poster_image"] is None
    assert e["ticket_buckets"] == [{"name": "Opening Night", "price": 4000, "public": True, "is_active": True}]
    assert programme["venues"][0]["address"] == "900 Camp Street\nNew Orleans, LA 70130"
    assert programme["venues"][0]["addressLine"] == "900 Camp Street, New Orleans, LA 70130"
    assert address_line("353 N Mead St\nWichita, KS 67202\n(316) 844-2583") == "353 N Mead St, Wichita, KS 67202"
    assert address_line("Williams Research Center\n410 Chartres St,\nNew Orleans, LA 70130") == \
        "Williams Research Center, 410 Chartres St, New Orleans, LA 70130"
    assert address_line("") is None
    assert programme["outOfEdition"] == ["Last year (2025-10-22)"], programme["outOfEdition"]
    print("eventive platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: eventive.py --selftest")
    selftest()
