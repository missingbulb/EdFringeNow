#!/usr/bin/env python3
"""In-festival refresh of per-performance ticket status, for the whole remaining run.

Availability (`ticketStatus`) is the one piece of show data that changes through
the day, and it comes **free** in the bulk events search — no per-show or
per-performance queries. This re-fetches the listing once and writes the fresh
statuses into the master (data/normalized/shows.json), then regenerates every
derived artifact from it, so the site can show live-ish SOLD OUT stamps.

Two things this deliberately does NOT do, both of which it used to (see #249):

  * It no longer stops at today. The planner draws availability across the whole
    festival, so a refresh that touched only today's date left every future date
    frozen at whatever the last full scrape captured. The window is now today
    through the end of the run — one listing pass covers it, because the pass
    returns every performance of every show regardless.

  * It no longer writes only the day files. The planner never loads those; it
    loads data/normalized/availability.min.json. Writing through the master and
    regenerating means every consumer — day files, availability sidecar,
    catalogue — is updated from one source of truth, and none of them can drift
    out of step with the others again.

Light by design: a single paged pass over the listing, no `performancePrices`
calls. Runs as the `refresh-tickets` scheduled task; a no-op on any date outside
the festival. Run it by hand (see Usage below) when a date needs fresher status
than the scheduled pass gives it.

Because the regeneration is a pure function of the master, the files that carry
no ticket status — the catalogue above all — come back byte-for-byte identical
and never appear in the commit. That is what lets the browser cache the bulky
catalogue for days while still picking up refreshed availability.

Usage:
    python3 scraper/refresh_ticket_status.py                 # today onward (Europe/London)
    python3 scraper/refresh_ticket_status.py --date 2026-08-10
    python3 scraper/refresh_ticket_status.py --today-only    # the old, narrow window
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
from normalize import (
    DEFAULT_AVAILABILITY,
    DEFAULT_DAYS_DIR,
    DEFAULT_DESCRIPTIONS,
    DEFAULT_MASTER,
    DEFAULT_MASTER_MIN,
    DEFAULT_PRICES,
    DEFAULT_VENUES,
    local_date_start,
    write_derived_outputs,
    write_json,
)

def london_today() -> str:
    """Today's date in Edinburgh. The festival runs in August (always BST), so
    UTC+1 is a safe fallback if the tz database isn't available."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/London")).date().isoformat()
    except Exception:  # noqa: BLE001 — no tz database on this host; fall back to the docstring's BST assumption
        return (datetime.now(timezone.utc) + timedelta(hours=1)).date().isoformat()


def event_id(ev: dict) -> str:
    """Show id, matching normalize.normalize_event so records line up."""
    return ev.get("cmsRef") or str(ev.get("id"))


def collect_statuses(events: dict, since: str,
                     into: dict[tuple[str, str, str], str]) -> None:
    """Fold one page of listing results into (show id, date, start) -> status.

    Only performances on or after `since` are kept: a status in the past can no
    longer be acted on, and rewriting it would churn the day files for dates
    nobody can book.
    """
    for ev in events.get("results") or []:
        eid = event_id(ev)
        for p in ev.get("performances") or []:
            if p.get("cancelled"):
                continue
            # Edinburgh wall-clock, exactly as the master keys performances —
            # the API's UTC stamp would miss by an hour and match nothing.
            when = local_date_start(p.get("dateTime"))
            if not when or when[0] < since:
                continue
            status = p.get("ticketStatus") or p.get("status")
            if status:
                into[(eid, when[0], when[1])] = status


def apply_statuses(master: list[dict], statuses: dict[tuple[str, str, str], str],
                   since: str) -> int:
    """Write fresh statuses into the master in place. Returns the number of
    performances whose status actually moved.

    A performance the listing didn't mention keeps what it had: the pass can miss
    a show (paging, a transient upstream gap), and blanking a status on that
    basis would turn a refresh into data loss.
    """
    changed = 0
    for show in master:
        for p in show.get("performances") or []:
            if p.get("date", "") < since:
                continue
            status = statuses.get((show["id"], p["date"], p["start"]))
            if status and p.get("status") != status:
                p["status"] = status
                changed += 1
    return changed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", help="override today (YYYY-MM-DD), for testing")
    ap.add_argument("--today-only", action="store_true",
                    help="refresh only the given date, not the rest of the run")
    ap.add_argument("--per", type=int, default=100)
    ap.add_argument("--seed", default="123")
    ap.add_argument("--min-delay", type=float, default=2.0)
    ap.add_argument("--max-delay", type=float, default=5.0)
    ap.add_argument("--master", default=str(DEFAULT_MASTER))
    ap.add_argument("--master-min", default=str(DEFAULT_MASTER_MIN))
    ap.add_argument("--availability", default=str(DEFAULT_AVAILABILITY))
    ap.add_argument("--descriptions", default=str(DEFAULT_DESCRIPTIONS))
    ap.add_argument("--venues", default=str(DEFAULT_VENUES))
    ap.add_argument("--days-dir", default=str(DEFAULT_DAYS_DIR))
    ap.add_argument("--prices", default=str(DEFAULT_PRICES))
    args = ap.parse_args()

    today = args.date or london_today()
    master_path = Path(args.master)
    if not master_path.exists():
        print(f"No master at {master_path} — run scraper/normalize.py first.",
              file=sys.stderr)
        return 1
    master = json.loads(master_path.read_text())

    days_dir = Path(args.days_dir)
    if not (days_dir / f"{today}.json").exists():
        print(f"No day file for {today} — nothing to refresh (outside the festival?).")
        return 0

    token = get_token(DEFAULT_USERNAME, DEFAULT_PASSWORD)

    # One paged pass over the whole listing. Every page carries every performance
    # of the shows on it, so covering the rest of the festival costs exactly what
    # covering today used to.
    statuses: dict[tuple[str, str, str], str] = {}
    first = fetch_events_page(token, 1, args.per, args.seed, "ANY")
    total_pages = max(1, math.ceil(first["total"] / args.per))
    collect_statuses(first, today, statuses)
    for page in range(2, total_pages + 1):
        time.sleep(random.uniform(args.min_delay, args.max_delay))
        collect_statuses(fetch_events_page(token, page, args.per, args.seed, "ANY"),
                         today, statuses)

    if args.today_only:
        statuses = {k: v for k, v in statuses.items() if k[1] == today}
    window = "today" if args.today_only else f"{today} onward"
    print(f"Collected statuses for {len(statuses)} performances ({window}) "
          f"across {total_pages} pages")

    changed = apply_statuses(master, statuses, today)
    if not changed:
        print("No ticket-status changes.")
        return 0

    write_json(master_path, master)
    prior = json.loads(Path(args.venues).read_text()) if Path(args.venues).exists() else {}
    venues = prior.get("venues", prior)
    n_days = write_derived_outputs(master, venues, Path(args.venues), days_dir,
                                   Path(args.master_min), Path(args.descriptions),
                                   Path(args.prices), Path(args.availability))
    print(f"Updated {changed} performance status(es); regenerated "
          f"{args.availability}, {args.master_min}, {n_days} day files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
