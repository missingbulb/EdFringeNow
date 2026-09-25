#!/usr/bin/env python3
"""Collect one festival edition end to end: every fetched source, then the conversion.

    python3 scraper/festivals/collect.py <festival-id> <edition>
    python3 scraper/festivals/collect.py --all              # every declared block edition

Runs each fetched source's `fetch.py --edition <edition>` in festival.toml order
(a later source may read an earlier one's raw, as a geocoder reads the addresses
the site published), then `scraper/convert/to_serving.py <festival> <edition>`,
and prints how long each step took. Still by hand only, like every fetcher: this
is the one command a person types instead of four, not a schedule.

A source whose fetcher is not built yet exits non-zero with its reason. When
that source is required the edition cannot be converted, so the run stops
there; an optional one is reported and skipped.
"""

import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import registry

CONVERTER = os.path.join(registry.SCRAPER_DIR, "convert", "to_serving.py")


def step(label, argv):
    started = time.monotonic()
    result = subprocess.run([sys.executable] + argv, cwd=registry.REPO_ROOT, capture_output=True, text=True)
    elapsed = time.monotonic() - started
    last = (result.stdout.strip().splitlines() or result.stderr.strip().splitlines() or [""])[-1]
    print("  %-34s %6.1fs  %s" % (label, elapsed, last))
    return result.returncode == 0, result


def collect(festival, edition_id):
    print("%s %s" % (festival["id"], edition_id))
    for src in festival["source"]:
        if src["kind"] != "fetched":
            continue
        fetcher = os.path.join(festival["_dir"], src["fetcher"])
        ok, result = step(src["id"], [fetcher, "--edition", edition_id])
        if not ok:
            if src["required"]:
                print("  stopped: required source %s did not fetch\n%s" % (src["id"], result.stderr.strip()[-2000:]))
                return False
            print("  (optional; the edition converts without it)")
    ok, result = step("convert", [CONVERTER, festival["id"], edition_id])
    if not ok:
        print(result.stderr.strip()[-2000:])
    return ok


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
