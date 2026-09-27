"""venues-research (curated/venues.json) -> name, address, coordinates, layout, notes, refs.

A figure is `{"value", "source"}` or null; the value is served and its URL
joins the venue's `refs`. Coordinates carry a `basis` instead of a URL, and an
approximate one is said so in the served notes. Rooms (the stages) are left to
the timetable source, which is the only one that names them.
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
        record = {
            "name": venue["name"],
            "address": _figure(venue["address"], refs),
            "capacity": _figure(venue["capacity"], refs),
            "layout": _figure(venue["layout"], refs),
            "accessibility": _figure(venue["accessibility"], refs),
        }
        notes = [venue["notes"]] if venue["notes"] else []
        coords = venue["coordinates"]
        basis = coords.get("basis") or ""
        if not basis:
            raise ValueError("%s: coordinates must say their basis" % code)
        record["lat"], record["lng"] = coords["lat"], coords["lng"]
        if basis.startswith("approximate"):
            detail = basis[len("approximate"):].lstrip(": ")
            notes.append("Coordinates are approximate, not geocoded%s." % ("; " + detail if detail else ""))
        record["notes"] = " ".join(notes) or None
        record["refs"] = sorted(set(refs))
        venues[code] = record
    return {"venues": venues}
