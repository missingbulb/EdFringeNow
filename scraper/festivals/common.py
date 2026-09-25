"""What every hand-run fetcher shares: the retrying GET, the edition guard, and
the atomic write of one source's raw folder.

A fetcher knows one website; this module knows the contract every fetcher keeps
(scraper/festivals/README.md): it writes only under its own
`data/festivals/<festival>/<edition>/<source>/`, all at once or not at all, with
a `manifest.json` saying where the bytes came from.
"""

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import registry

RETRY_STATUSES = (429, 502, 503, 504)
USER_AGENT = "EdFringeNow-festival-fetcher/1.0 (+https://www.edfringenow.com)"


class FetchRefused(Exception):
    """The site disagrees with the edition asked for; nothing is written."""


def get(url, as_json=True, attempts=4, headers=None):
    """One GET, retried on a dropped connection; an HTTP error is raised at once,
    because it will not fix itself and a half-fetched source is never written."""
    return _request(urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})}), as_json, attempts)


def post(url, body, as_json=True, attempts=4, headers=None):
    """`get`'s POST twin, for query APIs (Overpass) that take their query as a body."""
    request = urllib.request.Request(url, data=body, method="POST",
                                     headers={"User-Agent": USER_AGENT, **(headers or {})})
    return _request(request, as_json, attempts)


def _request(request, as_json, attempts):
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                body = response.read().decode("utf-8")
            return json.loads(body) if as_json else body
        except urllib.error.HTTPError as error:
            # A busy server (rate limit, gateway timeout) is worth waiting out;
            # any other HTTP error will not fix itself.
            if error.code not in RETRY_STATUSES or attempt == attempts - 1:
                raise
            wait = 10 * 2 ** attempt
            retry_after = error.headers.get("Retry-After", "")
            time.sleep(max(wait, int(retry_after)) if retry_after.isdigit() else wait)
        except (urllib.error.URLError, OSError):
            if attempt == attempts - 1:
                raise
            time.sleep(2 ** attempt)


def get_or_none(url, **kwargs):
    """`get`, answering None for a 404 — a record the site does not have, not a failed fetch."""
    try:
        return get(url, **kwargs)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


# How many requests a fetcher keeps in flight against one site. Enough to turn
# a thousand-page programme from a quarter of an hour into a couple of minutes;
# few enough that a festival's own small web server does not notice.
WORKERS = 6
# How long a cached page stands in for the live one. Long enough that a re-run
# after a crash or a parser fix costs no network; short enough that a re-fetch
# the next day sees the day's sold-out marks.
CACHE_MAX_AGE_SECONDS = 6 * 3600


def fetch_all(fetch, items, workers=WORKERS):
    """[fetch(item) for item in items], `workers` at a time, in the items' order.

    The first failure is raised once every request in flight has settled, so a
    half-fetched source is never written — the same all-or-nothing as `get`.
    """
    items = list(items)
    if len(items) <= 1 or workers <= 1:
        return [fetch(item) for item in items]
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(fetch, items))


def cached_page(cache_dir, url, max_age=CACHE_MAX_AGE_SECONDS):
    """A page's HTML, kept under the git-ignored cache so a re-run needs no network.

    A cached copy older than `max_age` seconds is fetched again. None for a
    page the site does not have (404), which is not cached.
    """
    os.makedirs(cache_dir, exist_ok=True)
    name = re.sub(r"[^A-Za-z0-9]+", "-", url.split("://", 1)[-1]).strip("-")[:180] + ".html"
    path = os.path.join(cache_dir, name)
    if os.path.exists(path) and os.path.getsize(path) > 0 and time.time() - os.path.getmtime(path) < max_age:
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    body = get_or_none(url, as_json=False)
    if body is None:
        return None
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
    return body


def parse_args(description):
    """The one CLI every fetcher takes: which declared edition to fetch into."""
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--edition", required=True, help="edition id declared in festival.toml, e.g. 2026")
    return parser.parse_args()


def guard_dates(edition, dates):
    """Refuse a programme whose dates fall outside the declared edition (±1 day).

    This is the check that catches a site that has rolled over to its next
    edition while the fetch was asked for this one.
    """
    lo = (date.fromisoformat(edition["first"]) - timedelta(days=1)).isoformat()
    hi = (date.fromisoformat(edition["last"]) + timedelta(days=1)).isoformat()
    outside = sorted(d for d in set(dates) if not lo <= d <= hi)
    if outside:
        raise FetchRefused(
            "the site's programme has dates %s outside edition %s (%s..%s); "
            "it may now serve another edition — nothing written"
            % (outside[:5], edition["id"], edition["first"], edition["last"])
        )
    if not dates:
        raise FetchRefused("the site returned no dated performances — nothing written")


def write_raw(festival, edition_id, source_id, files, *, fetcher, fetcher_version, urls, notes):
    """Replace this source's raw folder for this edition, atomically.

    Everything is written into a sibling temp folder first; only once every file
    is on disk does it swap in. A failure before the swap leaves the previous
    raw exactly as it was; other sources and other editions are never touched.
    """
    target = registry.raw_dir(festival, edition_id, source_id)
    parent = os.path.dirname(target)
    os.makedirs(parent, exist_ok=True)
    staging = os.path.join(parent, ".%s.tmp-%d" % (source_id, os.getpid()))
    retired = os.path.join(parent, ".%s.old-%d" % (source_id, os.getpid()))
    shutil.rmtree(staging, ignore_errors=True)
    os.makedirs(staging)
    try:
        for name, payload in sorted(files.items()):
            _dump(os.path.join(staging, name), payload)
        _dump(
            os.path.join(staging, "manifest.json"),
            {
                "festival": festival["id"],
                "edition": edition_id,
                "source": source_id,
                "fetchedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "fetcher": fetcher,
                "fetcherVersion": fetcher_version,
                "urls": urls,
                "files": sorted(files),
                "notes": notes,
            },
        )
        if os.path.exists(target):
            os.rename(target, retired)
        os.rename(staging, target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        if os.path.exists(retired) and not os.path.exists(target):
            os.rename(retired, target)
        raise
    shutil.rmtree(retired, ignore_errors=True)
    print("wrote %s (%s)" % (os.path.relpath(target, registry.REPO_ROOT), ", ".join(sorted(files))))
    return target


def read_raw(festival, edition_id, source_id, name):
    with open(os.path.join(registry.raw_dir(festival, edition_id, source_id), name), encoding="utf-8") as handle:
        return json.load(handle)


def _dump(path, payload):
    # Hebrew and Arabic are written through as themselves: an escaped file is
    # valid JSON but unreviewable in a diff, which is where raw is read.
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=1)
        handle.write("\n")


def selftest():
    """The write and the guard, offline, against a throwaway data root."""
    import tempfile

    festival = {
        "id": "acme-fest",
        "edition": [{"id": "2026", "first": "2026-10-01", "last": "2026-10-03", "ordinal": None},
                    {"id": "2025", "first": "2025-10-01", "last": "2025-10-03", "ordinal": None}],
        "source": [{"id": "acme-site", "kind": "fetched"}, {"id": "acme-geo", "kind": "fetched"}],
    }
    edition = festival["edition"][0]
    guard_dates(edition, ["2026-09-30", "2026-10-04"])  # ±1 day is inside
    for bad in (["2027-10-01"], ["2026-10-05"], []):
        try:
            guard_dates(edition, bad)
            raise AssertionError("guard_dates let %r through" % bad)
        except FetchRefused:
            pass

    # fetch_all keeps the items' order whatever order the answers arrive in,
    # and raises a failure rather than returning a partial list.
    def slow_echo(n):
        time.sleep(0.01 * (5 - n))
        return n * 10
    assert fetch_all(slow_echo, range(5), workers=4) == [0, 10, 20, 30, 40]

    def boom(n):
        if n == 3:
            raise ValueError("no")
        return n
    try:
        fetch_all(boom, range(6), workers=3)
        raise AssertionError("fetch_all swallowed a failure")
    except ValueError:
        pass

    real_root = registry.RAW_ROOT
    registry.RAW_ROOT = tempfile.mkdtemp()
    try:
        kw = dict(fetcher="t", fetcher_version=1, urls=[], notes="")
        write_raw(festival, "2026", "acme-site", {"a.json": {"n": 1}}, **kw)
        write_raw(festival, "2026", "acme-geo", {"g.json": {"n": 9}}, **kw)
        write_raw(festival, "2025", "acme-site", {"a.json": {"n": 0}}, **kw)
        try:
            write_raw(festival, "2026", "acme-site", {"a.json": {"n": object()}}, **kw)
            raise AssertionError("an unserialisable payload must fail")
        except TypeError:
            pass
        # The failed fetch left this source's previous raw whole, and touched
        # neither the other source nor the other edition.
        assert read_raw(festival, "2026", "acme-site", "a.json") == {"n": 1}
        assert read_raw(festival, "2026", "acme-geo", "g.json") == {"n": 9}
        assert read_raw(festival, "2025", "acme-site", "a.json") == {"n": 0}
        assert read_raw(festival, "2026", "acme-site", "manifest.json")["files"] == ["a.json"]
        leftovers = [n for n in os.listdir(os.path.join(registry.RAW_ROOT, "acme-fest", "2026")) if n.startswith(".")]
        assert leftovers == [], leftovers
        try:
            registry.raw_dir(festival, "2024", "acme-site")
            raise AssertionError("an undeclared edition must have no raw folder")
        except registry.RegistryError:
            pass
    finally:
        shutil.rmtree(registry.RAW_ROOT)
        registry.RAW_ROOT = real_root
    print("festival fetcher common selftest: ok")


if __name__ == "__main__":
    if sys.argv[1:] != ["--selftest"]:
        sys.exit("usage: common.py --selftest")
    selftest()
