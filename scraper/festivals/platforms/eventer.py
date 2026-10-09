#!/usr/bin/env python3
"""Eventer: the Israeli ticketing platform whose producer pages several festivals sell through.

A producer's public page, `https://www.eventer.co.il/user/<user>`, is an Angular
shell that loads its whole listing from one open, unauthenticated JSON call:

    https://www.eventer.co.il/user/<user>/getData?hideExcludedEvents=true&lang=he_IL

`events[]` there is every event the producer has on sale, one per performance,
each with its own ticket page `https://www.eventer.co.il/<linkName>`:

  * `name` — the producer's own title line, which often packs in the hall and
    the running time ("... - האולם האדום (50 דק')");
  * `schedule.start` / `schedule.end` — "YYYY-MM-DD HH:MM" in `location.timezone`
    (the end is the producer's slot, not the running time);
  * `ticketTypes[]` — each ticket type's `name` and `price`, in shekels;
  * `totalRemaining` — tickets left to sell (the page shows "last tickets" from it);
  * `eventDesc` (HTML), `thumbnail` / `ticketPlatform.images`, `location`.

A performance that has sold out drops off the listing rather than showing zero,
so absence says nothing a festival's own programme does not already say.

This module turns that into one raw programme per edition, in Eventer's own
vocabulary. `build` is pure over the `fetch_json` it is handed, and `run` is the
hand-run fetcher's entry point.
"""

import sys

FETCHER_VERSION = 1
PAGE = "https://www.eventer.co.il/user/%s"
API = PAGE + "/getData?hideExcludedEvents=true&lang=he_IL"
TICKET_PAGE = "https://www.eventer.co.il/%s"


def image_of(event):
    images = (event.get("ticketPlatform") or {}).get("images") or {}
    return images.get("imageDefault") or event.get("thumbnail") or None


def build(user, edition, fetch_json):
    """The edition's performances on the producer's page, oldest first."""
    data = fetch_json(API % user)
    records = []
    for event in data.get("events") or []:
        schedule = event.get("schedule") or {}
        start = schedule.get("start") or ""
        # The page is a producer's whole catalogue; only this edition's dates are the festival's.
        if not edition["first"] <= start[:10] <= edition["last"]:
            continue
        location = event.get("location") or {}
        records.append({
            "id": event["_id"],
            "linkName": event.get("linkName"),
            "ticketUrl": TICKET_PAGE % event["linkName"] if event.get("linkName") else None,
            "name": event.get("name"),
            "start": start,
            "end": schedule.get("end"),
            "timezone": location.get("timezone"),
            "locationDescription": event.get("locationDescription"),
            "lat": location.get("latitude"),
            "lng": location.get("longitude"),
            "ticketTypes": [{"name": t.get("name"), "price": t.get("price")} for t in event.get("ticketTypes") or []],
            "totalRemaining": event.get("totalRemaining"),
            "imageUrl": image_of(event),
            "eventDesc": event.get("eventDesc"),
        })
    records.sort(key=lambda r: (r["start"], r["linkName"] or ""))
    return {"user": user, "production": data.get("production"), "edition": edition["id"], "events": records}


def run(festival_dir, user, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live page, guard, write raw."""
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch Eventer producer %s's listing into its raw folder." % user)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    programme = build(user, edition, common.get)
    common.guard_dates(edition, [e["start"][:10] for e in programme["events"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[API % user],
        notes="Eventer producer page's JSON, unauthenticated. One event per performance; "
              "totalRemaining is tickets left at fetch time, and a sold-out performance is "
              "absent (scraper/festivals/platforms/eventer.py).",
    )
    print("%d performances on eventer.co.il/user/%s" % (len(programme["events"]), user))


def selftest():
    # Shapes copied from the live page, 2026-09-25, trimmed.
    page = {
        "production": "פסטיבל תיאטרון עכו - חוה\"מ סוכות",
        "events": [
            {"_id": "B", "linkName": "accofestivalconversations",
             "name": "פסטיבל תיאטרון עכו - חוה\"מ סוכות -שיחות עם בטן - אולם הדיוואן (60דק')",
             "schedule": {"start": "2026-09-27 18:00", "end": "2026-09-27 19:00"},
             "location": {"latitude": 32.92, "longitude": 35.07, "timezone": "Asia/Jerusalem"},
             "locationDescription": "אולמות האבירים, עכו העתיקה",
             "ticketTypes": [{"name": "רגיל", "price": 80, "remaining": -1}, {"name": "תושב עכו", "price": 40}],
             "totalRemaining": 20, "eventDesc": "<p>x</p>", "thumbnail": "https://images.test/t.jpg",
             "ticketPlatform": {"images": {"imageDefault": "https://images.test/d.jpg"}}},
            {"_id": "A", "linkName": "accofestivalhaemet3", "name": "האמת השלישית",
             "schedule": {"start": "2026-09-27 17:00"}, "ticketTypes": [], "thumbnail": "https://images.test/a.jpg"},
            {"_id": "Z", "linkName": "nextyear", "name": "x", "schedule": {"start": "2027-09-27 17:00"}},
        ],
    }
    programme = build("accofestival", {"id": "2026", "first": "2026-09-27", "last": "2026-10-01"}, lambda url: page)
    assert [e["id"] for e in programme["events"]] == ["A", "B"], programme["events"]
    b = programme["events"][1]
    assert b["ticketUrl"] == "https://www.eventer.co.il/accofestivalconversations"
    assert b["ticketTypes"] == [{"name": "רגיל", "price": 80}, {"name": "תושב עכו", "price": 40}]
    assert b["imageUrl"] == "https://images.test/d.jpg" and programme["events"][0]["imageUrl"] == "https://images.test/a.jpg"
    assert b["totalRemaining"] == 20 and programme["events"][0]["totalRemaining"] is None
    print("eventer platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: eventer.py --selftest")
    selftest()
