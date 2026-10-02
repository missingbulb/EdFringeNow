#!/usr/bin/env python3
"""pretalx: the conference scheduling system hundreds of tech and academic conferences publish with.

An event on pretalx.com, or on a self-hosted instance, publishes its whole
schedule as one open export, the c3voc schedule format:

    <event page>/schedule/export/schedule.json

(pretalx.com answers a 302 for an event served from its own domain, which is
followed.) `schedule.conference` carries the event's `start`/`end`, its
`time_zone_name`, its `rooms[]` (name, capacity) and `tracks[]`; under
`days[].rooms{room: [talk]}` each talk has its `code`, `title`, `type`,
`track`, `abstract`, `description`, `persons[]`, its page `url`, a `logo`
picture when the speaker gave one, and `date` (local, with its UTC offset),
`start` ("HH:MM", local) and `duration` ("HH:MM").

This module turns that into one raw programme per edition, in pretalx's own
vocabulary: the conference header and one flat record per talk. `build` is pure
over the `fetch_json` it is handed, and `run` is the hand-run fetcher's entry point.
"""

import sys

FETCHER_VERSION = 1
EXPORT = "%s/schedule/export/schedule.json"
TALK_FIELDS = ("code", "title", "subtitle", "type", "track", "language", "abstract", "description",
               "url", "logo", "date", "start", "duration", "room", "do_not_record")


def build(event_url, fetch_json):
    """The event's schedule: its conference header and every scheduled talk, in time order."""
    schedule = fetch_json(EXPORT % event_url.rstrip("/"))["schedule"]
    conference = schedule["conference"]
    talks = []
    for day in conference["days"]:
        for room_talks in day["rooms"].values():
            for talk in room_talks:
                record = {k: talk.get(k) for k in TALK_FIELDS}
                record["persons"] = [p.get("public_name") or p.get("name") for p in talk.get("persons") or []]
                talks.append(record)
    talks.sort(key=lambda t: (t["date"], t["room"], t["code"]))
    return {
        "schedule": schedule.get("url"),
        "version": schedule.get("version"),
        "conference": {
            "acronym": conference.get("acronym"),
            "title": conference.get("title"),
            "start": conference.get("start"),
            "end": conference.get("end"),
            "time_zone_name": conference.get("time_zone_name"),
            "rooms": [{"name": r["name"], "capacity": r.get("capacity")} for r in conference.get("rooms") or []],
            "tracks": [{"name": t["name"], "slug": t.get("slug")} for t in conference.get("tracks") or []],
        },
        "talks": talks,
    }


def run(festival_dir, event_url, source_id, fetcher):
    """A festival's `fetch.py --edition <id>`: build from the live export, guard, write raw."""
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch the pretalx schedule at %s into its raw folder." % event_url)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    programme = build(event_url, common.get)
    year = (programme["conference"]["start"] or "")[:4]
    if year != edition["id"]:
        raise common.FetchRefused("the schedule is for %s, not edition %s — nothing written" % (year, edition["id"]))
    common.guard_dates(edition, [t["date"][:10] for t in programme["talks"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[EXPORT % event_url.rstrip("/")],
        notes="pretalx's public schedule export, unauthenticated. One record per scheduled talk; date and "
              "start are the conference's wall clock (scraper/festivals/platforms/pretalx.py).",
    )
    print("%d talks in %d rooms (%s)" % (
        len(programme["talks"]), len({t["room"] for t in programme["talks"]}), programme["conference"]["title"]))


def selftest():
    # Shape copied from pretalx.com/hack-lu-2026's export, 2026-10-02, trimmed.
    export = {"schedule": {"url": "https://pretalx.com/hack-lu-2026/schedule/", "version": "0.35", "conference": {
        "acronym": "hack-lu-2026", "title": "Hack.lu 2026", "start": "2026-10-20", "end": "2026-10-23",
        "time_zone_name": "Europe/Luxembourg",
        "rooms": [{"name": "Europe", "slug": "5467-europe", "capacity": 750}, {"name": "Hollenfels", "capacity": None}],
        "tracks": [{"name": "topic: hack.lu", "slug": "6926-topic-hacklu", "color": "#D52E2E"}],
        "days": [{"index": 1, "date": "2026-10-20", "rooms": {
            "Hollenfels": [{"code": "B", "title": "Workshop", "type": "Workshop", "track": None,
                            "date": "2026-10-20T14:00:00+02:00", "start": "14:00", "duration": "02:00",
                            "room": "Hollenfels", "url": "https://pretalx.com/hack-lu-2026/talk/B/",
                            "persons": [{"name": "A", "public_name": "Ada", "biography": "long"}]}],
            "Europe": [{"code": "7EVXHD", "title": "The Panopticon Paradox", "type": "Keynote",
                        "track": "topic: hack.lu", "abstract": "AI has industrialized...", "logo": "https://x.test/l.webp",
                        "date": "2026-10-20T09:00:00+02:00", "start": "09:00", "duration": "01:00", "room": "Europe",
                        "url": "https://pretalx.com/hack-lu-2026/talk/7EVXHD/", "persons": [{"name": "Thomas Drake"}]}],
        }}],
    }}}
    seen = []
    programme = build("https://pretalx.com/hack-lu-2026/", lambda url: seen.append(url) or export)
    assert seen == ["https://pretalx.com/hack-lu-2026/schedule/export/schedule.json"], seen
    assert [t["code"] for t in programme["talks"]] == ["7EVXHD", "B"], programme["talks"]
    keynote, workshop = programme["talks"]
    assert keynote["persons"] == ["Thomas Drake"] and workshop["persons"] == ["Ada"]
    assert keynote["logo"] == "https://x.test/l.webp" and workshop["logo"] is None
    assert programme["conference"]["rooms"] == [{"name": "Europe", "capacity": 750}, {"name": "Hollenfels", "capacity": None}]
    assert programme["conference"]["tracks"] == [{"name": "topic: hack.lu", "slug": "6926-topic-hacklu"}]
    print("pretalx platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: pretalx.py --selftest")
    selftest()
