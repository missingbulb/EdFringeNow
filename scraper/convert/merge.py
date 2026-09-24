"""Assemble one festival edition's information block from all of its sources.

Each source's adapter (`adapters/<festival>/<source>.py`, named in
festival.toml) turns that source's raw into a *partial*: records keyed by id,
holding only the fields that source actually knows —

    {"categories": {id: {...}}, "venues": {id: {...}}, "events": {id: {...}},
     "performances": {id: {...}}, "skipped": [...]}

This module is the declared, deterministic combination of those partials: per
section, per field, the first source in festival.toml's `[merge]` precedence
that supplies the field wins, and which source won is recorded. It never reads a
source's raw itself and knows no festival's vocabulary.

Pure apart from reading raw/curated files and loading adapters; writing is
to_serving.py's job.
"""

import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "festivals"))
import registry

ADAPTERS_DIR = os.path.join(HERE, "adapters")
RECORD_SECTIONS = ("venues", "events", "performances")
# The performance fields only a source with that role may supply, so a
# schedule source cannot quietly start asserting availability or prices.
ROLE_FIELDS = {"availability": ("status",), "prices": ("priceMin", "priceMax")}


class MergeError(Exception):
    """The edition cannot be assembled; nothing is written."""


class SourceInput:
    """What an adapter is handed: its source's declaration and a way to read its bytes."""

    def __init__(self, festival, edition, source, partials):
        self.festival = festival
        self.edition = edition
        self.source = source
        # Partials of the sources declared before this one, read-only by
        # convention: an adapter may resolve its records against them (the
        # geocoder maps addresses to the site's venue ids) but never edits them.
        self.partials = partials
        if source["kind"] == "fetched":
            self.path = registry.raw_dir(festival, edition["id"], source["id"])
        else:
            self.path = registry.curated_path(festival, source["id"])

    def present(self):
        if self.source["kind"] == "fetched":
            return os.path.isfile(os.path.join(self.path, "manifest.json"))
        return os.path.isfile(self.path)

    def read(self, name=None):
        """A raw file of this source (fetched), or the curated file itself (name=None)."""
        path = os.path.join(self.path, name) if name else self.path
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)

    def manifest(self):
        if self.source["kind"] != "fetched":
            return None
        manifest = self.read("manifest.json")
        expected = (self.festival["id"], self.edition["id"], self.source["id"])
        found = (manifest.get("festival"), manifest.get("edition"), manifest.get("source"))
        if found != expected:
            # A folder copied from another edition or source would otherwise be
            # converted as if it were this one.
            raise MergeError("%s/manifest.json says %s, expected %s" % (rel(self.path), found, expected))
        missing = [f for f in manifest.get("files", []) if not os.path.isfile(os.path.join(self.path, f))]
        if missing:
            raise MergeError("%s: manifest lists missing files %s" % (rel(self.path), missing))
        return manifest


def rel(path):
    return os.path.relpath(path, registry.REPO_ROOT)


def load_module(relpath, entry):
    """An adapter-tree module by its path under adapters/, which must define `entry`."""
    path = os.path.join(ADAPTERS_DIR, relpath)
    if not os.path.isfile(path):
        raise MergeError("%s does not exist" % rel(path))
    name = "adapter_" + relpath[:-3].replace("/", "_").replace("-", "_")
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, entry):
        raise MergeError("%s defines no %s()" % (rel(path), entry))
    return module


def edition_ready(festival, edition_id):
    """True when every required source is on disk for this edition."""
    edition = registry.edition(festival, edition_id)
    return all(
        SourceInput(festival, edition, src, {}).present()
        for src in festival["source"]
        if src["required"]
    )


def collect(festival, edition_id):
    """Run every present source's adapter, in festival.toml order."""
    edition = registry.edition(festival, edition_id)
    partials, provenance, absent = {}, {}, []
    for src in festival["source"]:
        inp = SourceInput(festival, edition, src, partials)
        if not inp.present():
            if src["required"]:
                raise MergeError(
                    "required source %s is missing for %s %s (%s)"
                    % (src["id"], festival["id"], edition["id"], rel(inp.path))
                )
            absent.append(src["id"])
            continue
        manifest = inp.manifest()
        partial = load_module(src["adapter"], "adapt").adapt(inp)
        _check_roles(src, partial)
        partials[src["id"]] = partial
        entry = {"kind": src["kind"], "path": rel(inp.path)}
        if manifest is not None:
            entry.update(
                fetchedAt=manifest.get("fetchedAt"),
                fetcher=manifest.get("fetcher"),
                fetcherVersion=manifest.get("fetcherVersion"),
            )
        provenance[src["id"]] = entry
    return edition, partials, provenance, absent


def _check_roles(src, partial):
    roles = set(src["roles"])
    for section in ("venues", "events", "performances"):
        if partial.get(section) and section not in roles:
            raise MergeError("source %s supplied %s without that role" % (src["id"], section))
    if partial.get("categories") and "events" not in roles:
        raise MergeError("source %s supplied categories without the events role" % src["id"])
    for role, fields in ROLE_FIELDS.items():
        if role in roles:
            continue
        for record in (partial.get("performances") or {}).values():
            leaked = [f for f in fields if f in record]
            if leaked:
                raise MergeError("source %s supplied %s without the %s role" % (src["id"], leaked, role))


def _merge_section(festival, section, partials, field_winners, key=None):
    key = key or section
    contributors = [sid for sid, p in partials.items() if p.get(section)]
    if not contributors:
        return {}
    order = (festival.get("merge") or {}).get(key)
    if order is None:
        raise MergeError("%s: [merge] declares no precedence for %s" % (festival["id"], key))
    unlisted = [sid for sid in contributors if sid not in order]
    if unlisted:
        raise MergeError("%s: sources %s supply %s but are not in [merge].%s" % (festival["id"], unlisted, section, key))
    merged = {}
    for sid in order:
        for rid, record in (partials.get(sid, {}).get(section) or {}).items():
            target = merged.setdefault(rid, {})
            for field, value in record.items():
                if field not in target:
                    target[field] = value
                    field_winners.setdefault("%s.%s" % (section, field), set()).add(sid)
    return merged


def assemble(festival, edition_id):
    """The whole information block for one edition — unvalidated; see schema.validate."""
    edition, partials, provenance, absent = collect(festival, edition_id)
    winners = {}
    categories = _merge_section(festival, "categories", partials, winners, key="events")
    venues = _merge_section(festival, "venues", partials, winners)
    events = _merge_section(festival, "events", partials, winners)
    performances = _merge_section(festival, "performances", partials, winners)

    perf_list = []
    for pid, p in performances.items():
        perf_list.append({
            "id": pid,
            "eventId": p.get("eventId"),
            "venueId": p.get("venueId"),
            "roomId": p.get("roomId"),
            "date": p.get("date"),
            "start": p.get("start"),
            "ticketUrl": p.get("ticketUrl"),
            "free": p.get("free"),
            # No availability source speaks for this performance: unknown, not on sale.
            "status": p.get("status", "unknown"),
            "priceMin": p.get("priceMin"),
            "priceMax": p.get("priceMax"),
        })

    used_venues = {p["venueId"] for p in perf_list if p["venueId"] is not None}
    # A curated venue outlives editions; only the ones this edition plays are served.
    venue_list = [
        {
            "id": vid,
            "name": v.get("name"),
            "address": v.get("address"),
            "lat": v.get("lat"),
            "lng": v.get("lng"),
            "capacity": v.get("capacity"),
            "layout": v.get("layout"),
            "rooms": v.get("rooms", []),
            "accessibility": v.get("accessibility"),
            "notes": v.get("notes"),
            "refs": v.get("refs", []),
        }
        for vid, v in sorted(venues.items())
        if vid in used_venues
    ]

    event_list = [
        {
            "id": eid,
            "title": e.get("title"),
            "url": e.get("url"),
            "genre": e.get("genre", festival["default_genre"]),
            "categories": e.get("categories", []),
            "blurb": e.get("blurb"),
            "durationMin": e.get("durationMin"),
            "imageUrl": e.get("imageUrl"),
        }
        for eid, e in events.items()
    ]
    used_categories = {c for e in event_list for c in e["categories"]}
    category_list = [
        {"id": cid, "name": c.get("name")} for cid, c in sorted(categories.items()) if cid in used_categories
    ]

    sections = {"festival": ["festival.toml"]}
    for section in ("venues", "events", "performances"):
        sections[section] = sorted({s for k, v in winners.items() if k.startswith(section + ".") for s in v})
    sections["availability"] = sorted(winners.get("performances.status", set()))
    sections["prices"] = sorted(winners.get("performances.priceMin", set()) | winners.get("performances.priceMax", set()))

    skipped = {sid: p["skipped"] for sid, p in partials.items() if p.get("skipped")}
    return {
        "v": 1,
        "festival": {
            "id": festival["id"],
            "edition": edition["id"],
            "ordinal": edition["ordinal"],
            "name": festival["name"],
            "nameLocal": festival.get("name_local"),
            "city": festival["city"],
            "country": festival["country"],
            "lat": festival["lat"],
            "lng": festival["lng"],
            "timezone": festival["timezone"],
            "lang": festival["lang"],
            "dir": festival["dir"],
            "kind": festival["kind"],
            "defaultGenre": festival["default_genre"],
            "site": festival["site"],
            "firstDate": edition["first"],
            "lastDate": edition["last"],
            "ticketing": festival.get("ticketing", {}),
        },
        "categories": category_list,
        "venues": venue_list,
        "events": event_list,
        "performances": perf_list,
        "sources": sections,
        "provenance": {
            "sources": provenance,
            "absent": absent,
            "fields": {k: sorted(v) for k, v in sorted(winners.items())},
            "skipped": skipped,
        },
    }, partials


def selftest():
    """Precedence, provenance and role enforcement on in-memory partials."""
    festival = {"id": "t", "merge": {"venues": ["curated", "site"]}, "default_genre": "comedy"}
    winners = {}
    merged = _merge_section(
        festival,
        "venues",
        {
            "site": {"venues": {"v1": {"name": "Site name", "capacity": None}}},
            "curated": {"venues": {"v1": {"capacity": 120}, "v9": {"capacity": 5}}},
        },
        winners,
    )
    assert merged["v1"] == {"capacity": 120, "name": "Site name"}, merged
    assert winners == {"venues.capacity": {"curated"}, "venues.name": {"site"}}, winners
    try:
        _merge_section({"id": "t", "merge": {"venues": ["site"]}}, "venues",
                       {"site": {"venues": {"a": {}}}, "curated": {"venues": {"a": {}}}}, {})
        raise AssertionError("an unlisted contributor must fail")
    except MergeError:
        pass
    try:
        _check_roles({"id": "s", "roles": ["performances"]}, {"performances": {"p": {"status": "sold-out"}}})
        raise AssertionError("status without the availability role must fail")
    except MergeError:
        pass
    _check_roles({"id": "s", "roles": ["performances", "availability"]}, {"performances": {"p": {"status": "sold-out"}}})
    print("convert merge selftest: ok")
