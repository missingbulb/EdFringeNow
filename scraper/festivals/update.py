#!/usr/bin/env python3
"""Update every festival whose edition is upcoming or live, by running its tools.

    python3 scraper/festivals/update.py                 # stage 3: the festival update
    python3 scraper/festivals/update.py --refresh       # stage 4: the rapid refresh
      [--today YYYY-MM-DD] [--festival ID] [--plan] [--report PATH]

The update runs each due edition's whole tool set and converts it (collect.py's
steps). An edition is due by how close it is: daily from two weeks before it
opens until it closes, weekly from two months out, monthly before that, counted
from the oldest `fetchedAt` among its required tools' manifests.

The refresh re-runs only the edition's tools that carry ticket availability, and
converts, for every edition from three weeks before it opens until it closes.

`--festival` runs that festival's upcoming or live editions whatever their
cadence. `--plan` prints what would run and runs nothing. `--report` writes
the per-festival outcome as JSON. An edfringe-wire edition is the Fringe's own
pipeline and its own tasks, and is never run here.

Exits 1 when any tool broke (the report says which), 0 otherwise: a fetcher
with nothing to fetch yet is not a breakage.
"""

import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import collect
import registry

REFRESH_LEAD_DAYS = 21
# (days before the edition opens, at most, → days between updates), nearest first.
UPDATE_TIERS = ((14, 1), (60, 7))
UPDATE_INTERVAL_FAR = 30


def update_interval(today, first):
    """Days between updates for an edition opening on `first`, seen on `today`."""
    until = (first - today).days
    for within, interval in UPDATE_TIERS:
        if until <= within:
            return interval
    return UPDATE_INTERVAL_FAR


def update_due(today, first, last, fetched):
    """Is an edition due a full update? `fetched` is its oldest tool fetch date, or None."""
    if today > last:
        return False
    if fetched is None:
        return True
    return (today - fetched).days >= update_interval(today, first)


def in_refresh_window(today, first, last):
    return first - timedelta(days=REFRESH_LEAD_DAYS) <= today <= last


def last_fetched(festival, edition_id):
    """The oldest fetch date among the edition's required fetched tools (all fetched
    tools when none is required), or None when any of them has never fetched."""
    fetched = [s for s in registry.edition_sources(festival, edition_id) if s["kind"] == "fetched"]
    counted = [s for s in fetched if s["required"]] or fetched
    dates = []
    for src in counted:
        path = os.path.join(registry.raw_dir(festival, edition_id, src["id"]), "manifest.json")
        if not os.path.isfile(path):
            return None
        with open(path, encoding="utf-8") as handle:
            stamp = json.load(handle).get("fetchedAt")
        if not stamp:
            return None
        dates.append(datetime.fromisoformat(stamp.replace("Z", "+00:00")).date())
    return min(dates) if dates else None


def select(festivals, today, refresh, only=None):
    """[(festival, edition id, sources to run or None for all, why)] in registry order."""
    jobs = []
    for festival in festivals.values():
        if only and festival["id"] != only:
            continue
        for ed in festival["edition"]:
            if ed["format"] != "block":
                continue
            first, last = date.fromisoformat(ed["first"]), date.fromisoformat(ed["last"])
            if refresh:
                tools = registry.refresh_sources(festival, ed["id"])
                if tools and in_refresh_window(today, first, last):
                    jobs.append((festival, ed["id"], tools, "in its refresh window"))
                continue
            if only and today <= last:
                jobs.append((festival, ed["id"], None, "asked for"))
            elif update_due(today, first, last, last_fetched(festival, ed["id"])):
                jobs.append((festival, ed["id"], None, "due: every %d day(s)" % update_interval(today, first)))
    return jobs


def selftest():
    d = date.fromisoformat
    assert update_interval(d("2026-10-01"), d("2026-10-10")) == 1
    assert update_interval(d("2026-10-01"), d("2026-09-28")) == 1, "live"
    assert update_interval(d("2026-10-01"), d("2026-11-20")) == 7
    assert update_interval(d("2026-10-01"), d("2027-04-01")) == 30
    assert update_due(d("2026-10-02"), d("2026-09-28"), d("2026-10-03"), d("2026-10-01"))
    assert not update_due(d("2026-10-02"), d("2026-09-28"), d("2026-10-03"), d("2026-10-02"))
    assert not update_due(d("2026-10-04"), d("2026-09-28"), d("2026-10-03"), None), "over"
    assert update_due(d("2026-10-02"), d("2027-04-01"), d("2027-04-20"), None), "never fetched"
    assert not update_due(d("2026-10-02"), d("2027-04-01"), d("2027-04-20"), d("2026-09-20"))
    assert update_due(d("2026-10-20"), d("2027-04-01"), d("2027-04-20"), d("2026-09-20"))
    assert in_refresh_window(d("2026-09-10"), d("2026-10-01"), d("2026-10-05"))
    assert not in_refresh_window(d("2026-09-09"), d("2026-10-01"), d("2026-10-05"))
    assert in_refresh_window(d("2026-10-05"), d("2026-10-01"), d("2026-10-05"))
    assert not in_refresh_window(d("2026-10-06"), d("2026-10-01"), d("2026-10-05"))
    print("update selftest ok")


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--today", type=date.fromisoformat, default=None)
    parser.add_argument("--festival")
    parser.add_argument("--plan", action="store_true")
    parser.add_argument("--report")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args(argv)
    if args.selftest:
        selftest()
        return 0
    today = args.today or datetime.now(timezone.utc).date()
    festivals = registry.load_all()
    if args.festival and args.festival not in festivals:
        print("unknown festival %r" % args.festival, file=sys.stderr)
        return 2
    jobs = select(festivals, today, args.refresh, args.festival)
    print("%s on %s: %d edition(s)" % ("refresh" if args.refresh else "update", today, len(jobs)))
    outcomes = []
    for festival, edition_id, sources, why in jobs:
        if args.plan:
            print("  %s %s — %s" % (festival["id"], edition_id, why))
            continue
        outcomes.append(dict(collect.run_edition(festival, edition_id, sources), why=why))
    if args.report:
        with open(args.report, "w", encoding="utf-8") as handle:
            json.dump({"mode": "refresh" if args.refresh else "update", "today": today.isoformat(),
                       "editions": outcomes}, handle, indent=1, ensure_ascii=False)
    broken = [o for o in outcomes if o["status"] == collect.BROKEN]
    for o in outcomes:
        print("%-10s %s %s" % (o["status"], o["festival"], o["edition"]))
    return 1 if broken else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
