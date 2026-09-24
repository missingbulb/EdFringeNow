"""Every festival's `festival.toml`, read and checked, and the paths derived from it.

`festival.toml` is the one place a festival's identity lives: its id, its city,
its editions and the sources an edition is assembled from. Fetchers read it to
refuse an edition that is not declared; the converter reads it to know which
sources to merge and in what precedence. Neither ever infers an edition from a
page — a site that serves "the current one" is exactly the site that would
otherwise file next year's programme under this year's folder.

Every raw path is built here from validated ids only, so a fetcher cannot write
into another festival's or another edition's folder by construction.

Standard library only (tomllib is 3.11+).
"""

import os
import re
import tomllib
from datetime import date

SCRAPER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(SCRAPER_DIR)
FESTIVALS_DIR = os.path.join(SCRAPER_DIR, "festivals")
RAW_ROOT = os.path.join(REPO_ROOT, "data", "festivals")
# Pages a fetcher caches so a re-run needs no network. Git-ignored: it is the
# fetcher's working copy, never raw data anything reads.
CACHE_ROOT = os.path.join(RAW_ROOT, ".cache")

# The sections of the festival information block a source can contribute to.
SECTIONS = ("festival", "venues", "events", "performances", "availability", "prices")
SOURCE_KINDS = ("fetched", "curated")
KINDS = ("film", "fringe", "comedy", "theatre", "music", "multi")
GENRES = ("film", "comedy", "theatre", "dance", "music", "family", "talk", "other")

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
EDITION_RE = re.compile(r"^\d{4}$")

_REQUIRED_FESTIVAL_KEYS = (
    "id", "name", "city", "country", "lat", "lng", "timezone",
    "lang", "dir", "kind", "default_genre", "site",
)


class RegistryError(Exception):
    """A festival.toml that does not describe a festival we can fetch or convert."""


def _iso(value, where):
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, str):
        try:
            return date.fromisoformat(value).isoformat()
        except ValueError:
            pass
    raise RegistryError("%s: %r is not an ISO date" % (where, value))


def _check(festival, path):
    where = os.path.relpath(path, REPO_ROOT)
    missing = [k for k in _REQUIRED_FESTIVAL_KEYS if k not in festival]
    if missing:
        raise RegistryError("%s: missing %s" % (where, ", ".join(missing)))
    if not ID_RE.match(festival["id"]):
        raise RegistryError("%s: id %r is not a lowercase-hyphen slug" % (where, festival["id"]))
    if festival["kind"] not in KINDS:
        raise RegistryError("%s: kind %r not in %s" % (where, festival["kind"], KINDS))
    if festival["default_genre"] not in GENRES:
        raise RegistryError("%s: default_genre %r not in %s" % (where, festival["default_genre"], GENRES))
    if festival["dir"] not in ("ltr", "rtl"):
        raise RegistryError("%s: dir must be ltr or rtl" % where)

    editions = festival.get("edition") or []
    if not editions:
        raise RegistryError("%s: declares no [[edition]]" % where)
    seen = set()
    for ed in editions:
        if not EDITION_RE.match(str(ed.get("id", ""))):
            raise RegistryError("%s: edition id %r is not a year" % (where, ed.get("id")))
        if ed["id"] in seen:
            raise RegistryError("%s: edition %s declared twice" % (where, ed["id"]))
        seen.add(ed["id"])
        ed["first"] = _iso(ed.get("first"), "%s edition %s first" % (where, ed["id"]))
        ed["last"] = _iso(ed.get("last"), "%s edition %s last" % (where, ed["id"]))
        if ed["first"] > ed["last"]:
            raise RegistryError("%s: edition %s ends before it starts" % (where, ed["id"]))
        ed.setdefault("ordinal", None)

    sources = festival.get("source") or []
    if not sources:
        raise RegistryError("%s: declares no [[source]]" % where)
    ids = set()
    for src in sources:
        sid = src.get("id", "")
        if not ID_RE.match(sid) or sid in ids:
            raise RegistryError("%s: source id %r is malformed or repeated" % (where, sid))
        ids.add(sid)
        if src.get("kind") not in SOURCE_KINDS:
            raise RegistryError("%s: source %s kind must be one of %s" % (where, sid, SOURCE_KINDS))
        if not isinstance(src.get("required"), bool):
            # Explicit, never defaulted: whether an edition may be served without
            # this source is a decision, not something absence should imply.
            raise RegistryError("%s: source %s must say required = true|false" % (where, sid))
        roles = src.get("roles") or []
        if not roles or any(r not in SECTIONS for r in roles):
            raise RegistryError("%s: source %s roles %r must be a non-empty subset of %s" % (where, sid, roles, SECTIONS))
        if not src.get("adapter"):
            raise RegistryError("%s: source %s names no adapter" % (where, sid))
        if src["kind"] == "fetched" and not src.get("fetcher"):
            raise RegistryError("%s: fetched source %s names no fetcher" % (where, sid))
        if src["kind"] == "curated" and not src.get("path"):
            raise RegistryError("%s: curated source %s names no path" % (where, sid))

    for section, order in (festival.get("merge") or {}).items():
        if section not in SECTIONS:
            raise RegistryError("%s: [merge] names unknown section %r" % (where, section))
        unknown = [s for s in order if s not in ids]
        if unknown:
            raise RegistryError("%s: [merge] %s names unknown sources %s" % (where, section, unknown))


def load(festival_dir):
    path = os.path.join(festival_dir, "festival.toml")
    with open(path, "rb") as handle:
        festival = tomllib.load(handle)
    _check(festival, path)
    festival["_dir"] = festival_dir
    return festival


def load_all():
    """{festival id: festival}, for every scraper/festivals/*/festival.toml."""
    festivals = {}
    for name in sorted(os.listdir(FESTIVALS_DIR)):
        folder = os.path.join(FESTIVALS_DIR, name)
        if os.path.isfile(os.path.join(folder, "festival.toml")):
            festival = load(folder)
            if festival["id"] in festivals:
                raise RegistryError("festival id %s declared twice" % festival["id"])
            festivals[festival["id"]] = festival
    return festivals


def get(festival_id):
    festivals = load_all()
    if festival_id not in festivals:
        raise RegistryError("unknown festival %r (have %s)" % (festival_id, sorted(festivals)))
    return festivals[festival_id]


def edition(festival, edition_id):
    for ed in festival["edition"]:
        if ed["id"] == str(edition_id):
            return ed
    raise RegistryError(
        "%s has no edition %r in festival.toml (have %s) — declare it there first"
        % (festival["id"], edition_id, [e["id"] for e in festival["edition"]])
    )


def source(festival, source_id):
    for src in festival["source"]:
        if src["id"] == source_id:
            return src
    raise RegistryError("%s has no source %r" % (festival["id"], source_id))


def raw_dir(festival, edition_id, source_id):
    """data/festivals/<festival>/<edition>/<source>/ — built only from declared ids."""
    ed = edition(festival, edition_id)
    src = source(festival, source_id)
    if src["kind"] != "fetched":
        raise RegistryError("%s is curated; it has no per-edition raw folder" % source_id)
    return os.path.join(RAW_ROOT, festival["id"], ed["id"], src["id"])


def cache_dir(festival, edition_id, source_id):
    ed = edition(festival, edition_id)
    src = source(festival, source_id)
    return os.path.join(CACHE_ROOT, festival["id"], ed["id"], src["id"])


def curated_path(festival, source_id):
    src = source(festival, source_id)
    if src["kind"] != "curated":
        raise RegistryError("%s is fetched; it has no curated file" % source_id)
    return os.path.join(festival["_dir"], src["path"])
