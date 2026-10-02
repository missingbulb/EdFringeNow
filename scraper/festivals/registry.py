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

import json
import os
import re
import sys
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
# What a festival is, as the year strip's type filter offers it. "multi" is a
# festival of several arts with no one of them leading.
KINDS = ("film", "fringe", "comedy", "theatre", "music", "dance", "art", "literature", "sports", "academic", "multi")
GENRES = ("film", "comedy", "theatre", "dance", "music", "family", "talk", "other")
# How a festival sells its tickets, `[ticketing] model`. The festival planner's
# checkout decides what to open from it (site/planNG/lib/checkout.js), and reads
# a model it does not know as "other", so one is added here first.
#   central-box-office  one box office sells every show, each on its own page
#   per-event-seller    each show sold by its own seller, off the festival's site
#   festival-pass       one pass covers the programme; `url` is where it is sold
#   all-free            nothing to buy
#   other               anything else; `notes` says what
TICKETING_MODELS = ("central-box-office", "per-event-seller", "festival-pass", "all-free", "other")

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
EDITION_RE = re.compile(r"^\d{4}$")
# How an edition reaches the browser. "block": this layer's converter writes its
# serving block under site/data/festivals/. "edfringe-wire": the Edinburgh
# Fringe's own pipeline (scraper/normalize.py) writes the files named in the
# festival's [wire] table, and the browser adapts those (site/shared/festival-catalogue.js).
FORMATS = ("block", "edfringe-wire")
WIRE_KEYS = ("catalogue", "lookups", "availability", "converter")

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
    subtypes = festival.get("subtypes", [])
    if not isinstance(subtypes, list) or not all(isinstance(s, str) and ID_RE.match(s) for s in subtypes):
        raise RegistryError("%s: subtypes must be a list of lowercase-hyphen slugs" % where)
    if "region" in festival and not (isinstance(festival["region"], str) and festival["region"]):
        raise RegistryError("%s: region must be a state or region's name" % where)
    if festival["default_genre"] not in GENRES:
        raise RegistryError("%s: default_genre %r not in %s" % (where, festival["default_genre"], GENRES))
    if festival["dir"] not in ("ltr", "rtl"):
        raise RegistryError("%s: dir must be ltr or rtl" % where)
    ticketing = festival.get("ticketing") or {}
    if "model" in ticketing and ticketing["model"] not in TICKETING_MODELS:
        raise RegistryError("%s: [ticketing] model %r not in %s" % (where, ticketing["model"], TICKETING_MODELS))
    if ticketing.get("model") == "festival-pass" and not ticketing.get("url"):
        raise RegistryError("%s: a festival-pass [ticketing] names the url the pass is sold at" % where)

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
        if ed.get("format") not in FORMATS:
            # Explicit, never defaulted: which pipeline serves an edition is a
            # decision, not something absence should imply.
            raise RegistryError("%s: edition %s format must be one of %s" % (where, ed["id"], FORMATS))

    wire = any(ed["format"] == "edfringe-wire" for ed in editions)
    if wire:
        table = festival.get("wire") or {}
        missing = [k for k in WIRE_KEYS if not table.get(k)]
        if missing:
            raise RegistryError("%s: an edfringe-wire edition needs [wire] %s" % (where, ", ".join(missing)))
        for key in ("catalogue", "lookups", "availability"):
            if not table[key].startswith("site/"):
                raise RegistryError("%s: [wire] %s must be a file under site/, the web root" % (where, key))
    block = any(ed["format"] == "block" for ed in editions)

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
        if block and not src.get("adapter"):
            # A wire-format festival's sources are converted by its [wire]
            # converter, not by an adapter of this layer.
            raise RegistryError("%s: source %s names no adapter" % (where, sid))
        if src["kind"] == "fetched" and not src.get("fetcher"):
            raise RegistryError("%s: fetched source %s names no fetcher" % (where, sid))
        if src["kind"] == "curated" and not src.get("path"):
            raise RegistryError("%s: curated source %s names no path" % (where, sid))

    _check_tool_sets(festival, editions, sources, where)

    for section, order in (festival.get("merge") or {}).items():
        if section not in SECTIONS:
            raise RegistryError("%s: [merge] names unknown section %r" % (where, section))
        unknown = [s for s in order if s not in ids]
        if unknown:
            raise RegistryError("%s: [merge] %s names unknown sources %s" % (where, section, unknown))


def _check_tool_sets(festival, editions, sources, where):
    """Every edition names its whole tool set: the [[source]] ids it is assembled from.

    The [[source]] tables are the festival's tool library, written once and reused
    from year to year; an edition picks from it, so a site or platform that changes
    between years is a new source that only the new edition names.
    """
    ids = [src["id"] for src in sources]
    used = set()
    for ed in editions:
        tools = ed.get("sources")
        if not isinstance(tools, list) or not tools:
            raise RegistryError(
                "%s: edition %s names no tool set (sources = [...]) — "
                "python3 scraper/festivals/migrate_edition_tools.py adds the festival's current one"
                % (where, ed["id"])
            )
        if len(set(tools)) != len(tools):
            raise RegistryError("%s: edition %s names a source twice in its tool set" % (where, ed["id"]))
        unknown = [t for t in tools if t not in ids]
        if unknown:
            raise RegistryError("%s: edition %s names undeclared sources %s" % (where, ed["id"], unknown))
        used.update(tools)
    unused = [i for i in ids if i not in used]
    if unused:
        raise RegistryError("%s: sources %s are in no edition's tool set" % (where, unused))


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


def edition_sources(festival, edition_id):
    """The edition's tool set, as [[source]] tables in festival.toml order."""
    tools = edition(festival, edition_id)["sources"]
    return [src for src in festival["source"] if src["id"] in tools]


def refresh_sources(festival, edition_id):
    """The edition's fetched tools that carry ticket availability: what a rapid refresh re-runs."""
    return [
        src for src in edition_sources(festival, edition_id)
        if src["kind"] == "fetched" and "availability" in src["roles"]
    ]


def _edition_source(festival, edition_id, source_id):
    ed = edition(festival, edition_id)
    src = source(festival, source_id)
    if src["id"] not in ed["sources"]:
        raise RegistryError(
            "%s %s does not use source %s (its tool set is %s)" % (festival["id"], ed["id"], source_id, ed["sources"])
        )
    return ed, src


def raw_dir(festival, edition_id, source_id):
    """data/festivals/<festival>/<edition>/<source>/ — built only from declared ids."""
    ed, src = _edition_source(festival, edition_id, source_id)
    if src["kind"] != "fetched":
        raise RegistryError("%s is curated; it has no per-edition raw folder" % source_id)
    return os.path.join(RAW_ROOT, festival["id"], ed["id"], src["id"])


def cache_dir(festival, edition_id, source_id):
    ed, src = _edition_source(festival, edition_id, source_id)
    return os.path.join(CACHE_ROOT, festival["id"], ed["id"], src["id"])


def curated_path(festival, source_id):
    src = source(festival, source_id)
    if src["kind"] != "curated":
        raise RegistryError("%s is fetched; it has no curated file" % source_id)
    return os.path.join(festival["_dir"], src["path"])


# The editions plan: every edition's dates and tool set, which the unattended
# update and refresh tasks read to decide whether any festival is in its window.
# Derived from the festival.toml files, so it is written, never edited.
PLAN = os.path.join(FESTIVALS_DIR, "editions.GENERATED.json")


def plan(festivals):
    editions = []
    for festival in festivals.values():
        for ed in festival["edition"]:
            editions.append({
                "festival": festival["id"],
                "edition": ed["id"],
                "format": ed["format"],
                "first": ed["first"],
                "last": ed["last"],
                "tools": [src["id"] for src in edition_sources(festival, ed["id"])],
                "refreshTools": [src["id"] for src in refresh_sources(festival, ed["id"])],
            })
    editions.sort(key=lambda e: (e["festival"], e["edition"]))
    return {"v": 1, "writer": "scraper/festivals/registry.py --write", "editions": editions}


def render_plan(festivals):
    return json.dumps(plan(festivals), indent=1, ensure_ascii=False) + "\n"


def main(argv):
    try:
        text = render_plan(load_all())
    except RegistryError as error:
        print("registry: %s" % error, file=sys.stderr)
        return 1
    if argv == ["--write"]:
        with open(PLAN, "w", encoding="utf-8") as handle:
            handle.write(text)
        print("wrote %s" % os.path.relpath(PLAN, REPO_ROOT))
        return 0
    if argv == ["--check"]:
        current = None
        if os.path.isfile(PLAN):
            with open(PLAN, encoding="utf-8") as handle:
                current = handle.read()
        if current != text:
            print("%s is stale — regenerate with: python3 scraper/festivals/registry.py --write"
                  % os.path.relpath(PLAN, REPO_ROOT), file=sys.stderr)
            return 1
        print("every festival.toml is valid and every edition names its tool set")
        return 0
    print("usage: registry.py --check | --write", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
