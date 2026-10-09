#!/usr/bin/env python3
"""Sched: the event-schedule host conferences, literary and film festivals publish their programmes on.

An event's pages, `https://<event>.sched.com/`, answer 403 to scripts, but its
whole programme is open as one iCalendar export:

    https://<event>.sched.com/all.ics

One VEVENT per session: `SUMMARY` (the title), `DESCRIPTION` (plain text, with
the organiser's own notes such as "SOLD OUT" or "FREE" in it), `CATEGORIES` (the
event's own session types), `LOCATION` (the room or venue, often with its street
address after a comma), `URL` (the session's page), `UID`, and `DTSTART` /
`DTEND`, which are UTC instants (the calendar says X-WR-TIMEZONE:UTC; the
event's own clock is not in the export).

A calendar may also carry sessions outside the festival proper (a preview event
weeks before, next year's announcement), so only sessions dated inside the
edition, on the festival's declared wall clock, are kept and the rest are named
in `outOfEdition`. This module writes one raw programme per edition in Sched's
own vocabulary; `build` is pure over the `fetch_text` it is handed, and `run` is
the hand-run fetcher's entry point.
"""

import re
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

FETCHER_VERSION = 1
EXPORT = "https://%s.sched.com/all.ics"
FIELDS = {"UID": "uid", "SUMMARY": "summary", "DESCRIPTION": "description", "CATEGORIES": "categories",
          "LOCATION": "location", "URL": "url", "DTSTART": "dtstart", "DTEND": "dtend"}


def unescape(value):
    return re.sub(r"\\([\\,;nN])", lambda m: "\n" if m.group(1) in "nN" else m.group(1), value)


def parse_ics(text):
    """(calendar properties, [VEVENT properties]) from an iCalendar text, lines unfolded and values unescaped."""
    lines = []
    for line in text.replace("\r\n", "\n").split("\n"):
        if line[:1] in (" ", "\t") and lines:
            lines[-1] += line[1:]
        else:
            lines.append(line)
    calendar, events, current = {}, [], None
    for line in lines:
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            events.append(current)
            current = None
        elif ":" in line:
            name, value = line.split(":", 1)
            key = name.split(";", 1)[0]
            (current if current is not None else calendar)[key] = unescape(value)
    return calendar, events


def instant(value):
    """A DTSTART in UTC ("20261013T013000Z"), as a datetime; a floating or date-only value is refused."""
    if not re.fullmatch(r"\d{8}T\d{6}Z", value or ""):
        raise ValueError("DTSTART %r is not a UTC instant" % value)
    return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)


def local_date(dtstart, zone):
    return instant(dtstart).astimezone(ZoneInfo(zone)).date().isoformat()


def build(event_slug, edition, zone, fetch_text):
    """The edition's sessions in the event's calendar, oldest first, with the distinct locations."""
    calendar, vevents = parse_ics(fetch_text(EXPORT % event_slug))
    sessions, out = [], []
    for vevent in vevents:
        record = {field: vevent.get(key) or None for key, field in FIELDS.items()}
        day = local_date(record["dtstart"], zone)
        if not edition["first"] <= day <= edition["last"]:
            out.append("%s (%s)" % (record["summary"], day))
            continue
        sessions.append(record)
    sessions.sort(key=lambda s: (s["dtstart"], s["uid"]))
    return {
        "event": event_slug,
        "calendar": calendar.get("X-WR-CALNAME"),
        "prodid": calendar.get("PRODID"),
        "calendarTimezone": calendar.get("X-WR-TIMEZONE"),
        "edition": edition["id"],
        "sessions": sessions,
        "venues": [{"address": location} for location in sorted({s["location"] for s in sessions if s["location"]})],
        "outOfEdition": sorted(out),
    }


def run(festival_dir, event_slug, source_id, fetcher, keep_venues=True):
    """A festival's `fetch.py --edition <id>`: build from the live export, guard, write raw.

    `keep_venues` false leaves out the distinct-location list a geocoder reads,
    for an event held in one building whose locations are its rooms."""
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    import common
    import registry

    args = common.parse_args("Fetch Sched event %s's programme into its raw folder." % event_slug)
    festival = registry.load(festival_dir)
    edition = registry.edition(festival, args.edition)
    programme = build(event_slug, edition, festival["timezone"], lambda url: common.get(url, as_json=False))
    if not keep_venues:
        del programme["venues"]
    # A calendar that has rolled over to the next edition keeps only stragglers
    # in this one's dates; most of it falling outside says so.
    if len(programme["outOfEdition"]) > len(programme["sessions"]):
        raise common.FetchRefused("%d of the calendar's sessions fall outside edition %s, %d inside — nothing written"
                                  % (len(programme["outOfEdition"]), edition["id"], len(programme["sessions"])))
    common.guard_dates(edition, [local_date(s["dtstart"], festival["timezone"]) for s in programme["sessions"]])
    common.write_raw(
        festival, edition["id"], source_id, {"programme.json": programme},
        fetcher=fetcher, fetcher_version=FETCHER_VERSION,
        urls=[EXPORT % event_slug],
        notes="Sched's public iCalendar export, unauthenticated. One record per session in the edition; "
              "dtstart and dtend are UTC (scraper/festivals/platforms/sched.py).",
    )
    print("%d sessions at %d locations on %s.sched.com (%d outside the edition)" % (
        len(programme["sessions"]), len({s["location"] for s in programme["sessions"]}), event_slug,
        len(programme["outOfEdition"])))


def selftest():
    # Shape copied from litquake2026.sched.com/all.ics, 2026-10-02, trimmed.
    ics = "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "X-WR-CALNAME:litquake2026", "PRODID:-//Sched.com Litquake 2026//EN",
        "X-WR-TIMEZONE:UTC",
        "BEGIN:VEVENT", "DTSTART:20261013T013000Z", "DTEND:20261013T030000Z",
        "SUMMARY:Tilar J. Mazzeo: The Sea Captain's Wife",
        "DESCRIPTION:FREE\\n\\nIn conversation\\, with a long line that the export",
        "  folds onto the next.", "CATEGORIES:NONFICTION",
        "LOCATION:Mechanics' Institute\\, 57 Post St", "UID:abc", "URL:http://litquake2026.sched.com/event/abc",
        "END:VEVENT",
        "BEGIN:VEVENT", "DTSTART:20260911T020000Z", "SUMMARY:Pre-festival", "UID:pre", "END:VEVENT",
        "END:VCALENDAR", ""])
    edition = {"id": "2026", "first": "2026-10-01", "last": "2026-10-24"}
    programme = build("litquake2026", edition, "America/Los_Angeles", lambda url: ics)
    [session] = programme["sessions"]
    assert session["summary"] == "Tilar J. Mazzeo: The Sea Captain's Wife"
    assert session["description"] == "FREE\n\nIn conversation, with a long line that the export folds onto the next.", session
    assert session["location"] == "Mechanics' Institute, 57 Post St"
    assert session["dtend"] == "20261013T030000Z" and session["categories"] == "NONFICTION"
    # 01:30 UTC on the 13th is the evening of the 12th in San Francisco.
    assert local_date(session["dtstart"], "America/Los_Angeles") == "2026-10-12"
    assert programme["venues"] == [{"address": "Mechanics' Institute, 57 Post St"}]
    assert programme["outOfEdition"] == ["Pre-festival (2026-09-10)"], programme["outOfEdition"]
    assert programme["prodid"] == "-//Sched.com Litquake 2026//EN"
    print("sched platform selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: sched.py --selftest")
    selftest()
