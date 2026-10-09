#!/usr/bin/env python3
"""Spektrix: the ticketing system whose public API several Edinburgh festivals expose.

The Edinburgh International Festival (client `edinburghinternationalfestival`)
and the Edinburgh International Book Festival (`edinburghinternationalbookfestival`)
sell through Spektrix, and Spektrix serves every client's catalogue from an
open, unauthenticated API at `https://system.spektrix.com/<client>/api/v3/`:

  * `events` — every event the client has ever listed, with its own
    `attribute_*` fields (the client's vocabulary: genre, venue name, page URL);
  * `instances?startFrom=&startTo=` — performances in a window, each naming its
    event, its seating plan and its price list;
  * `plans/<id>` — which venue a plan belongs to; `venues` — venue names and
    street addresses (no coordinates);
  * `instances/<id>/status` — seats available against capacity, the only
    per-performance availability any festival in our census publishes openly;
  * `instances/<id>/price-list` — the prices on sale, by ticket type and band.

This module turns those into one raw programme per edition, in Spektrix's own
vocabulary. Parsing is pure; `build` fetches only through the `fetch_json` and
`fetch_many` callables it is handed, and `run` is the hand-run fetcher's entry point.
"""

import sys

FETCHER_VERSION = 1
API = "https://system.spektrix.com/%s/api/v3/"


def in_edition(instance, edition):
    return edition["first"] <= instance["start"][:10] <= edition["last"]


def build(client, edition, fetch_json, fetch_many=None):
    """The edition's programme: events that play in it, their instances with status and prices.

    `fetch_json` answers None for a record the API does not have (a 404): a
    retired seating plan or price list leaves that field unknown rather than
    failing the edition. `fetch_many(paths)` is the same for a batch, in
    order — the per-plan, per-price-list and per-instance calls, which are most
    of the run, go through it so the caller can make them concurrently.
    """
    fetch_many = fetch_many or (lambda paths: [fetch_json(p) for p in paths])
    events = {e["id"]: e for e in fetch_json("events")}
    # The window is re-checked here rather than trusted: an instance outside the
    # edition would otherwise trip the fetcher's date guard.
    instances = sorted(
        (i for i in fetch_json("instances?startFrom=%sT00:00:00&startTo=%sT23:59:59" % (edition["first"], edition["last"]))
         if in_edition(i, edition) and i["event"]["id"] in events),
        key=lambda i: (i["start"], i["id"]),
    )
    venues = {v["id"]: v for v in fetch_json("venues")}
    plan_ids = sorted({i["planId"] for i in instances if i.get("planId")})
    plan_venue = {
        plan_id: ((plan or {}).get("venue") or {}).get("id")
        for plan_id, plan in zip(plan_ids, fetch_many(["plans/%s" % p for p in plan_ids]))
    }

    # A price list is shared by many instances; ask for it once, through the
    # first instance that uses it.
    first_use = {}
    for instance in instances:
        list_id = (instance.get("priceList") or {}).get("id")
        if list_id and list_id not in first_use:
            first_use[list_id] = instance["id"]
    answers = fetch_many(["instances/%s/price-list" % iid for iid in first_use.values()])
    price_lists = {
        list_id: [
            {"ticketType": p["ticketType"]["name"], "band": (p.get("priceBand") or {}).get("name"), "amount": p["amount"]}
            for p in (answer or {}).get("prices", [])
        ]
        for list_id, answer in zip(first_use, answers)
    }

    records = []
    statuses = fetch_many(["instances/%s/status" % i["id"] for i in instances])
    for instance, status in zip(instances, statuses):
        status = status or {}
        records.append({
            "id": instance["id"],
            "event": instance["event"]["id"],
            "start": instance["start"],
            "venue": plan_venue.get(instance.get("planId")),
            "cancelled": instance.get("cancelled", False),
            "isOnSale": instance.get("isOnSale"),
            "priceList": (instance.get("priceList") or {}).get("id"),
            "attributes": {k: v for k, v in instance.items() if k.startswith("attribute_") and v not in ("", False, None)},
            "available": status.get("available"),
            "capacity": status.get("capacity"),
        })

    played = {r["event"] for r in records}
    used_venues = {r["venue"] for r in records if r["venue"]}
    return {
        "client": client,
        "edition": edition["id"],
        "events": [
            {k: v for k, v in events[eid].items() if not k.startswith("attribute_") or v not in ("", False, None)}
            for eid in sorted(played)
        ],
        "instances": records,
        "venues": [venues[vid] for vid in sorted(used_venues) if vid in venues],
        "priceLists": dict(sorted(price_lists.items())),
    }


def run(festival_dir, client, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live API, guard, write raw."""
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch Spektrix client %s's programme into its raw folder." % client)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    base = API % client
    fetch = lambda path: common.get_or_none(base + path)
    programme = build(client, edition, fetch, lambda paths: common.fetch_all(fetch, paths))
    common.guard_dates(edition, [i["start"][:10] for i in programme["instances"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[base + p for p in ("events", "instances", "venues", "plans/<id>",
                                 "instances/<id>/status", "instances/<id>/price-list")],
        notes="Spektrix public API v3, unauthenticated. Availability is seats available against "
              "capacity at fetch time (scraper/festivals/platforms/spektrix.py).",
    )
    print("%d events, %d instances, %d venues, %d price lists" % (
        len(programme["events"]), len(programme["instances"]), len(programme["venues"]), len(programme["priceLists"])))


def selftest():
    # Shapes copied from the live API, 2026-09-25, trimmed.
    api = {
        "events": [
            {"id": "E1", "name": "[seagull]", "duration": 150, "attribute_Venue": "Studio Theatre",
             "attribute_EventType": "Theatre", "attribute_Sponsor1": "", "firstInstanceDateTime": "2026-08-07T16:00:00"},
            {"id": "E2", "name": "Last year", "duration": 60},
        ],
        "instances?startFrom=2026-08-07T00:00:00&startTo=2026-08-31T23:59:59": [
            {"id": "I2", "event": {"id": "E1"}, "start": "2026-08-08T19:30:00", "planId": "P1",
             "priceList": {"id": "L1"}, "cancelled": False, "isOnSale": True, "attribute_Relaxed": True,
             "attribute_Captioned": False},
            {"id": "I1", "event": {"id": "E1"}, "start": "2026-08-07T16:00:00", "planId": "P1",
             "priceList": {"id": "L1"}, "cancelled": False, "isOnSale": True},
            {"id": "I9", "event": {"id": "E1"}, "start": "2026-09-01T10:00:00", "planId": "P1",
             "priceList": {"id": "L1"}},
            {"id": "I8", "event": {"id": "UNLISTED"}, "start": "2026-08-07T10:00:00", "planId": "P1",
             "priceList": {"id": "L1"}},
        ],
        "venues": [{"id": "V1", "name": "The Studio", "address": "22 Potterrow, Edinburgh EH8 9BL"},
                   {"id": "V2", "name": "Elsewhere", "address": ""}],
        "plans/P1": {"type": "Unreserved", "venue": {"id": "V1"}, "id": "P1"},
        "instances/I1/price-list": {"prices": [
            {"amount": 35.0, "ticketType": {"name": "Standard"}, "priceBand": {"name": "Price A"}},
            {"amount": 2.0, "ticketType": {"name": "Ticket Protection"}, "priceBand": {"name": "Price A"}}]},
        "instances/I1/status": {"available": 0, "capacity": 120},
        "instances/I2/status": None,
    }
    calls = []

    def fetch(path):
        calls.append(path)
        return api[path]

    programme = build("demo", {"id": "2026", "first": "2026-08-07", "last": "2026-08-31"}, fetch)
    assert [i["id"] for i in programme["instances"]] == ["I1", "I2"], programme["instances"]
    assert programme["instances"][0]["venue"] == "V1"
    assert programme["instances"][0]["available"] == 0 and programme["instances"][1]["available"] is None
    assert programme["instances"][1]["attributes"] == {"attribute_Relaxed": True}
    assert [e["id"] for e in programme["events"]] == ["E1"]
    assert "attribute_Sponsor1" not in programme["events"][0]
    assert [v["id"] for v in programme["venues"]] == ["V1"]
    assert programme["priceLists"]["L1"][0] == {"ticketType": "Standard", "band": "Price A", "amount": 35.0}
    assert calls.count("instances/I1/price-list") == 1 and "instances/I2/price-list" not in calls
    print("spektrix platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: spektrix.py --selftest")
    selftest()
