#!/usr/bin/env python3
"""Collect one festival edition end to end: its tools, then the conversion.

    python3 scraper/festivals/collect.py <festival-id> <edition>
    python3 scraper/festivals/collect.py --all              # every declared block edition

Runs each fetched source of the edition's tool set — `fetch.py --edition <edition>`,
in festival.toml order (a later source may read an earlier one's raw, as a
geocoder reads the addresses the site published) — then
`scraper/convert/to_serving.py <festival> <edition>`, and prints how long each
step took. This is the one command a person types instead of four; `update.py`
runs the same steps for every festival whose edition is upcoming or live.

A fetcher with nothing to fetch yet (`common.EXIT_NOT_READY`: the programme is
not out, or the fetcher is not built) is reported as not ready rather than
broken. Either way, when that source is required the edition cannot be
converted, so the run stops there; an optional one is reported and skipped.
"""

import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import common
import registry

CONVERTER = os.path.join(registry.SCRAPER_DIR, "convert", "to_serving.py")

# What one edition's run came to.
UPDATED = "updated"          # every tool it ran fetched, and the edition converted
NOT_READY = "not-ready"      # a required tool has nothing to fetch yet
BROKEN = "broken"            # a tool or the conversion failed: stage 2's tool needs repair


def step(label, argv):
    started = time.monotonic()
    result = subprocess.run([sys.executable] + argv, cwd=registry.REPO_ROOT, capture_output=True, text=True)
    elapsed = time.monotonic() - started
    last = (result.stdout.strip().splitlines() or result.stderr.strip().splitlines() or [""])[-1]
    print("  %-34s %6.1fs  %s" % (label, elapsed, last))
    return result, last


def run_edition(festival, edition_id, sources=None):
    """Fetch `sources` (default: every fetched tool of the edition) and convert.

    Returns {festival, edition, status, problems[]} — status one of UPDATED,
    NOT_READY, BROKEN; each problem names the step and its last output line.
    """
    print("%s %s" % (festival["id"], edition_id))
    if sources is None:
        sources = [s for s in registry.edition_sources(festival, edition_id) if s["kind"] == "fetched"]
    outcome = {"festival": festival["id"], "edition": edition_id, "status": UPDATED, "problems": []}
    for src in sources:
        fetcher = os.path.join(festival["_dir"], src["fetcher"])
        result, last = step(src["id"], [fetcher, "--edition", edition_id])
        if result.returncode == 0:
            continue
        ready = result.returncode != common.EXIT_NOT_READY
        outcome["problems"].append({"step": src["id"], "notReady": not ready, "detail": last})
        if src["required"]:
            outcome["status"] = BROKEN if ready else NOT_READY
            if ready:
                print("  stopped: required source %s did not fetch\n%s" % (src["id"], result.stderr.strip()[-2000:]))
            return outcome
        if ready:
            outcome["status"] = BROKEN
        print("  (optional; the edition converts without it)")
    result, last = step("convert", [CONVERTER, festival["id"], edition_id])
    if result.returncode != 0:
        print(result.stderr.strip()[-2000:])
        outcome["status"] = BROKEN
        outcome["problems"].append({"step": "convert", "notReady": False, "detail": last})
    return outcome


def collect(festival, edition_id):
    return run_edition(festival, edition_id)["status"] == UPDATED


def main(argv):
    festivals = registry.load_all()
    if argv == ["--all"]:
        jobs = [(f, ed["id"]) for f in festivals.values() for ed in f["edition"] if ed["format"] == "block"]
    elif len(argv) == 2 and argv[0] in festivals:
        jobs = [(festivals[argv[0]], registry.edition(festivals[argv[0]], argv[1])["id"])]
    else:
        print(__doc__, file=sys.stderr)
        return 2
    failed = [("%s %s" % (f["id"], e)) for f, e in jobs if not collect(f, e)]
    if failed:
        print("not collected: %s" % ", ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
