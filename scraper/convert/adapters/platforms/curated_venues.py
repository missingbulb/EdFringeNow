"""A festival's curated venue research (`curated/venues.json`) -> name, address, coordinates, figures, notes, refs.

Shared by festivals whose programme source names rooms but not the building
(pretalx, Sched): the research says where each building is. A figure is
`{"value", "source"}` or null; its value is served and its URL joins the venue's
`refs`, so every served figure has a citation behind it. Coordinates carry a
`basis` instead of a URL, and an approximate one says so in the served notes.
A key the research leaves out (an address, a capacity, the rooms) is not
supplied at all, so the programme source's own value stands; a key present as
null says nobody could cite it.
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
        coords = venue["coordinates"]
        basis = coords.get("basis") or ""
        if not basis:
            raise ValueError("%s: coordinates must say their basis" % code)
        record["lat"], record["lng"] = coords["lat"], coords["lng"]
        if basis.startswith("approximate"):
            notes.append("Coordinates are approximate, not a published pin.")
        record["notes"] = " ".join(notes) or None
        record["refs"] = sorted(set(refs))
        venues[code] = record
    return {"venues": venues}
