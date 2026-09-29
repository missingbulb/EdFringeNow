"""The festival finder's two lists, checked: where to look (`sources.toml`) and
what was found (`candidates.toml`).

Both lists only grow. A source that stops working and a candidate that turns
out useless stay in their file with a status saying so, because the next run
needs to know it was tried as much as it needs to know what worked. `--growth`
holds that line against a base revision.

    python3 scraper/finder/finder.py --check              the lists are well formed
    python3 scraper/finder/finder.py --growth origin/main nothing was dropped since the branch left it
    python3 scraper/finder/finder.py --report             yield per source, and what is due
    python3 scraper/finder/finder.py --selftest

Standard library only (tomllib is 3.11+).
"""

import argparse
import os
import subprocess
import sys
import tomllib
from datetime import date

FINDER_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(FINDER_DIR))
sys.path.insert(0, os.path.join(os.path.dirname(FINDER_DIR), "festivals"))
import registry

SOURCES = os.path.join(FINDER_DIR, "sources.toml")
CANDIDATES = os.path.join(FINDER_DIR, "candidates.toml")

SOURCE_CATEGORIES = ("aggregator", "platform", "organiser", "seed-list", "search-query", "technique")
SOURCE_STATUSES = ("active", "blocked", "dead")
PER_SESSION = ("yes", "partial", "no")
SCHEDULES = ("published", "partial", "expected", "none", "unknown")
CANDIDATE_STATUSES = ("candidate", "watch", "adopted", "rejected")
KIND_ANY = "any"

_SOURCE_REQUIRED = ("id", "name", "category", "kinds", "regions", "per_session", "how", "status", "added", "checked")
_CANDIDATE_REQUIRED = ("id", "name", "kind", "country", "city", "site", "schedule", "status", "found_via", "checked")


def _date(value):
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError:
            return None
    return None


def check_sources(sources):
    problems = []
    seen = set()
    for index, src in enumerate(sources):
        where = "source %s" % src.get("id", "#%d" % index)
        problems += ["%s: missing %s" % (where, key) for key in _SOURCE_REQUIRED if key not in src]
        sid = src.get("id", "")
        if not registry.ID_RE.match(sid):
            problems.append("%s: id is not a lowercase-hyphen slug" % where)
        if sid in seen:
            problems.append("%s: declared twice" % where)
        seen.add(sid)
        if src.get("category") not in SOURCE_CATEGORIES:
            problems.append("%s: category %r not in %s" % (where, src.get("category"), SOURCE_CATEGORIES))
        if src.get("status") not in SOURCE_STATUSES:
            problems.append("%s: status %r not in %s" % (where, src.get("status"), SOURCE_STATUSES))
        if src.get("status") in ("blocked", "dead") and not src.get("note"):
            problems.append("%s: a %s source says why in note" % (where, src.get("status")))
        if src.get("per_session") not in PER_SESSION:
            problems.append("%s: per_session %r not in %s" % (where, src.get("per_session"), PER_SESSION))
        kinds = src.get("kinds", [])
        if not kinds or any(k != KIND_ANY and k not in registry.KINDS for k in kinds):
            problems.append("%s: kinds %r must be %r or from %s" % (where, kinds, KIND_ANY, registry.KINDS))
        if src.get("category") != "search-query" and src.get("category") != "technique" and not src.get("url"):
            problems.append("%s: a %s names its url" % (where, src.get("category")))
        for key in ("added", "checked"):
            if key in src and _date(src[key]) is None:
                problems.append("%s: %s %r is not an ISO date" % (where, key, src[key]))
    return problems


def check_candidates(candidates, source_ids, festival_ids):
    problems = []
    seen = set()
    for index, cand in enumerate(candidates):
        where = "candidate %s" % cand.get("id", "#%d" % index)
        problems += ["%s: missing %s" % (where, key) for key in _CANDIDATE_REQUIRED if key not in cand]
        cid = cand.get("id", "")
        if not registry.ID_RE.match(cid):
            problems.append("%s: id is not a lowercase-hyphen slug" % where)
        if cid in seen:
            problems.append("%s: declared twice" % where)
        seen.add(cid)
        if cand.get("kind") not in registry.KINDS:
            problems.append("%s: kind %r not in %s" % (where, cand.get("kind"), registry.KINDS))
        subtypes = cand.get("subtypes", [])
        if not all(isinstance(s, str) and registry.ID_RE.match(s) for s in subtypes):
            problems.append("%s: subtypes must be lowercase-hyphen slugs" % where)
        if cand.get("schedule") not in SCHEDULES:
            problems.append("%s: schedule %r not in %s" % (where, cand.get("schedule"), SCHEDULES))
        status = cand.get("status")
        if status not in CANDIDATE_STATUSES:
            problems.append("%s: status %r not in %s" % (where, status, CANDIDATE_STATUSES))
        if status == "adopted" and cand.get("festival_id") not in festival_ids:
            problems.append("%s: adopted, but festival_id %r is no registered festival" % (where, cand.get("festival_id")))
        if status in ("watch", "rejected") and not cand.get("reason"):
            problems.append("%s: a %s candidate says why in reason" % (where, status))
        if status == "watch" and _date(cand.get("recheck")) is None:
            problems.append("%s: a watched candidate names its recheck date" % where)
        unknown = [s for s in cand.get("found_via", []) if s not in source_ids]
        if unknown or not cand.get("found_via"):
            problems.append("%s: found_via names unknown sources %s" % (where, unknown or "(none)"))
        for key in ("checked", "recheck", "next_first", "next_last"):
            if key in cand and _date(cand[key]) is None:
                problems.append("%s: %s %r is not an ISO date" % (where, key, cand[key]))
        first, last = _date(cand.get("next_first")), _date(cand.get("next_last"))
        if first and last and first > last:
            problems.append("%s: next edition ends before it starts" % where)
    adopted = {c.get("festival_id") for c in candidates if c.get("status") == "adopted"}
    for fid in sorted(set(festival_ids) - adopted):
        problems.append("festival %s is registered but no candidate is adopted as it" % fid)
    return problems


def check_growth(base_sources, base_candidates, sources, candidates):
    problems = []
    for label, base, now in (("source", base_sources, sources), ("candidate", base_candidates, candidates)):
        kept = {entry.get("id") for entry in now}
        for entry in base:
            if entry.get("id") not in kept:
                problems.append("%s %s was dropped; retire it with a status instead" % (label, entry.get("id")))
    return problems


def _load(path):
    with open(path, "rb") as handle:
        return tomllib.load(handle)


def _load_at(ref, path):
    """The file as it was at `ref`, or None when git has no such revision here."""
    rel = os.path.relpath(path, REPO_ROOT)
    try:
        blob = subprocess.run(["git", "show", "%s:%s" % (ref, rel)], cwd=REPO_ROOT,
                              capture_output=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None
    return tomllib.loads(blob.decode("utf-8"))


def check_all():
    sources = _load(SOURCES).get("source", [])
    candidates = _load(CANDIDATES).get("candidate", [])
    return (check_sources(sources)
            + check_candidates(candidates, {s["id"] for s in sources if "id" in s}, set(registry.load_all())))


def growth_against(ref):
    # Against where this branch left `ref`, not its tip: an entry the base gained since
    # was never this branch's to drop.
    fork = subprocess.run(["git", "merge-base", "HEAD", ref], cwd=REPO_ROOT, capture_output=True, text=True)
    if fork.returncode != 0:
        # A checkout without the base (a shallow clone) has nothing to compare against.
        print("finder growth: no common history with %s here, skipped" % ref)
        return []
    ref = fork.stdout.strip()
    base_sources = _load_at(ref, SOURCES)
    base_candidates = _load_at(ref, CANDIDATES)
    if base_sources is None or base_candidates is None:
        print("finder growth: the lists are new since %s, nothing to compare" % ref)
        return []
    return check_growth(base_sources.get("source", []), base_candidates.get("candidate", []),
                        _load(SOURCES).get("source", []), _load(CANDIDATES).get("candidate", []))


def report(today=None):
    today = today or date.today()
    sources = _load(SOURCES).get("source", [])
    candidates = _load(CANDIDATES).get("candidate", [])
    found = {s["id"]: [] for s in sources}
    for cand in candidates:
        for sid in cand.get("found_via", []):
            found.setdefault(sid, []).append(cand)
    print("Yield per source (candidates found / of them adopted or usable):")
    for src in sorted(sources, key=lambda s: -len(found[s["id"]])):
        hits = found[src["id"]]
        good = [c for c in hits if c.get("status") in ("adopted", "candidate")]
        print("  %-32s %-9s %3d / %3d" % (src["id"], src["status"], len(hits), len(good)))
    due = [c for c in candidates if c.get("status") == "watch" and _date(c.get("recheck")) <= today]
    print("\nWatched candidates due for a recheck (%d):" % len(due))
    for cand in sorted(due, key=lambda c: _date(c["recheck"])):
        print("  %s  %s  %s" % (_date(cand["recheck"]), cand["id"], cand.get("programme") or cand["site"]))
    ready = [c for c in candidates if c.get("status") == "candidate" and c.get("schedule") in ("published", "partial")]
    print("\nCandidates with a per-session programme, ready to adopt (%d):" % len(ready))
    for cand in sorted(ready, key=lambda c: str(c.get("next_first", ""))):
        print("  %s  %s  %s" % (cand.get("next_first", "?"), cand["id"], cand.get("programme") or cand["site"]))


def selftest():
    good_source = {"id": "wiki-list", "name": "W", "category": "seed-list", "url": "https://x", "kinds": ["any"],
                   "regions": ["IL"], "per_session": "no", "how": "read it", "status": "active",
                   "added": "2026-09-29", "checked": "2026-09-29"}
    good_candidate = {"id": "some-fest", "name": "S", "kind": "music", "country": "IL", "city": "Eilat",
                      "site": "https://y", "schedule": "expected", "status": "watch", "reason": "not out",
                      "recheck": "2026-11-01", "found_via": ["wiki-list"], "checked": "2026-09-29"}
    adopted = dict(good_candidate, id="real-fest", status="adopted", festival_id="real-fest")
    assert check_sources([good_source]) == [], check_sources([good_source])
    assert check_candidates([good_candidate, adopted], {"wiki-list"}, {"real-fest"}) == []

    def fails(problems, fragment):
        assert any(fragment in p for p in problems), (fragment, problems)

    fails(check_sources([good_source, good_source]), "declared twice")
    fails(check_sources([dict(good_source, category="blog")]), "category")
    fails(check_sources([dict(good_source, status="dead")]), "says why")
    fails(check_sources([dict(good_source, kinds=["opera"])]), "kinds")
    fails(check_candidates([dict(good_candidate, found_via=["nowhere"])], {"wiki-list"}, set()), "unknown sources")
    fails(check_candidates([dict(good_candidate, recheck=None)], {"wiki-list"}, set()), "recheck")
    fails(check_candidates([dict(good_candidate, status="rejected", reason="")], {"wiki-list"}, set()), "says why")
    fails(check_candidates([dict(adopted, festival_id="ghost")], {"wiki-list"}, {"real-fest"}), "no registered")
    fails(check_candidates([good_candidate], {"wiki-list"}, {"real-fest"}), "registered but no candidate")
    fails(check_candidates([dict(good_candidate, next_first="2026-12-02", next_last="2026-12-01")],
                           {"wiki-list"}, set()), "ends before")
    # Growth: a retired entry is fine, a deleted one is not, in either list.
    assert check_growth([good_source], [good_candidate], [dict(good_source, status="dead")],
                        [dict(good_candidate, status="rejected")]) == []
    fails(check_growth([good_source], [], [], []), "source wiki-list was dropped")
    fails(check_growth([], [good_candidate], [], []), "candidate some-fest was dropped")
    print("finder selftest: ok")


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--growth", metavar="REF")
    parser.add_argument("--report", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        selftest()
    problems = []
    if args.check:
        problems += check_all()
    if args.growth:
        problems += growth_against(args.growth)
    for problem in problems:
        print("finder: %s" % problem, file=sys.stderr)
    if args.report:
        report()
    if problems:
        sys.exit(1)
    if args.check or args.growth:
        print("finder: lists ok")


if __name__ == "__main__":
    main()
