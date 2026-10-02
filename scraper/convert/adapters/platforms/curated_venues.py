"""A festival's curated venue research (`curated/venues.json`) -> name, address, coordinates, figures, notes, refs.

Shared by every festival whose `venues-research` source is the plain curated
shape, named directly as that source's adapter in festival.toml, including those
whose programme source names rooms but not the building (pretalx, Sched). A
figure is `{"value", "source"}` or null: its value is served and its URL joins
the venue's `refs`, so every served figure has a citation behind it. Coordinates
carry the `basis` they rest on, and the `source` page they were read from when
there is one; an approximate basis is said in the served notes rather than
passed off as a pin. A key the research leaves out (an address, a capacity, the
rooms) is not supplied at all, so the programme source's own value stands; a key
present as null says nobody could cite it.
"""


def _figure(figure, refs):
    if figure is None:
        return None
    if not isinstance(figure, dict) or not str(figure.get("source", "")).startswith("http"):
        raise ValueError("curated figure %r carries no source URL" % (figure,))
    refs.append(figure["source"])
    return figure["value"]


def adapt(source):
    venues = {}
    for code, venue in source.read()["venues"].items():
        refs = []
        record = {"name": venue["name"]}
        for key in ("address", "capacity", "layout", "accessibility"):
            if key in venue:
                record[key] = _figure(venue[key], refs)
        if "rooms" in venue:
            record["rooms"] = [
                {"id": room["id"], "name": room["name"], "capacity": _figure(room["capacity"], refs),
                 "layout": _figure(room["layout"], refs)}
                for room in venue["rooms"]
            ]
        notes = [venue["notes"]] if venue.get("notes") else []
        coords = venue.get("coordinates")
        if coords is not None:
            basis = coords.get("basis") or ""
            if not basis:
                raise ValueError("%s: coordinates must say their basis" % code)
            if "source" in coords:
                if not str(coords["source"]).startswith("http"):
                    raise ValueError("%s: a coordinates source must be a URL" % code)
                refs.append(coords["source"])
            record["lat"], record["lng"] = coords["lat"], coords["lng"]
            if basis.startswith("approximate"):
                notes.append("Coordinates are approximate, not a published pin.")
        record["notes"] = " ".join(notes) or None
        record["refs"] = sorted(set(refs))
        venues[code] = record
    return {"venues": venues}
