#!/usr/bin/env python3
"""Hourly in-festival refresh of *today's* per-performance ticket status.

Availability (`ticketStatus`) is the one piece of show data that changes through
the day, and it comes **free** in the bulk events search — no per-show or
per-performance queries. This re-fetches the listing once and updates the `ts`
(ticket-status index) of each record in today's day file, so the site can show
live-ish SOLD OUT stamps. Everything else in the data is left untouched.

Light by design: a single paged pass over the listing, no `performancePrices`
calls. Runs hourly during August as the `refresh-tickets` scheduled task; a no-op
on any date without a day file (i.e. outside the festival).

Usage:
    python3 scraper/refresh_ticket_status.py                 # today (Europe/London)
    python3 scraper/refresh_ticket_status.py --date 2026-08-10
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fetch_shows import (
    DEFAULT_PASSWORD,
    DEFAULT_USERNAME,
    fetch_events_page,
    get_token,
)

ROOT = Path(__file__).resolve().parent.parent
DAYS_DIR = ROOT / "data" / "days"
VENUES_PATH = ROOT / "data" / "venues.json"


def london_today() -> str:
    """Today's date in Edinburgh. The festival runs in August (always BST), so
    UTC+1 is a safe fallback if the tz database isn't available."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/London")).date().isoformat()
    except Exception:  # noqa: BLE001 — no tz database on this host; fall back to the docstring's BST assumption
        return (datetime.now(timezone.utc) + timedelta(hours=1)).date().isoformat()


def event_id(ev: dict) -> str:
    """Show id, matching normalize.normalize_event so day records line up."""
    return ev.get("cmsRef") or str(ev.get("id"))


def write_json(path: Path, obj) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", help="override today (YYYY-MM-DD), for testing")
    ap.add_argument("--per", type=int, default=100)
    ap.add_argument("--seed", default="123")
    ap.add_argument("--min-delay", type=float, default=2.0)
    ap.add_argument("--max-delay", type=float, default=5.0)
    args = ap.parse_args()

    today = args.date or london_today()
    day_path = DAYS_DIR / f"{today}.json"
    if not day_path.exists():
        print(f"No day file for {today} — nothing to refresh (outside the festival?).")
        return 0
    records = json.loads(day_path.read_text())

    token = get_token(DEFAULT_USERNAME, DEFAULT_PASSWORD)

    # One paged pass; collect today's (show id, start) -> ticketStatus.
    status_by_key: dict[tuple[str, str], str] = {}

    def collect(events: dict) -> None:
        for ev in events.get("results") or []:
            eid = event_id(ev)
            for p in ev.get("performances") or []:
                dt = p.get("dateTime")
                if not dt or p.get("cancelled") or dt[:10] != today:
                    continue
                status = p.get("ticketStatus") or p.get("status")
                if status:
                    status_by_key[(eid, dt[11:16])] = status

    first = fetch_events_page(token, 1, args.per, args.seed, "ANY")
    total_pages = max(1, math.ceil(first["total"] / args.per))
    collect(first)
    for page in range(2, total_pages + 1):
        time.sleep(random.uniform(args.min_delay, args.max_delay))
        collect(fetch_events_page(token, page, args.per, args.seed, "ANY"))
    print(f"Collected statuses for {len(status_by_key)} of today's performances "
          f"across {total_pages} pages")

    # Update the day file's `ts` indices, extending the global lookup (append-only,
    # so existing indices in every other day file stay valid).
    lookups = json.loads(VENUES_PATH.read_text())
    statuses = list(lookups.get("ticketStatuses") or [])
    ix = {s: i for i, s in enumerate(statuses)}

    changed = 0
    for rec in records:
        status = status_by_key.get((rec["id"], rec["start"]))
        if not status:
            continue
        if status not in ix:
            ix[status] = len(statuses)
            statuses.append(status)
        if rec.get("ts") != ix[status]:
            rec["ts"] = ix[status]
            changed += 1

    new_statuses = statuses != (lookups.get("ticketStatuses") or [])
    if changed or new_statuses:
        if new_statuses:
            lookups["ticketStatuses"] = statuses
            write_json(VENUES_PATH, lookups)
        write_json(day_path, records)
        print(f"Updated {changed} record(s) in {day_path.name}"
              + (" (+new statuses)" if new_statuses else ""))
    else:
        print("No ticket-status changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
