"""venues-research (curated/venues.json) -> address, coordinates, capacity, layout, accessibility, notes, refs.

A figure is `{"value", "source"}` or null. The value is served and its URL joins
the venue's `refs`, so every served number has a citation behind it.
Coordinates are the one kind of value without a URL. They carry a `basis`
instead, and an approximate one is stated in the served notes rather than
passed off as geocoded.
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
            "address": _figure(venue["address"], refs),
            "capacity": _figure(venue["capacity"], refs),
            "layout": _figure(venue["layout"], refs),
            "rooms": venue["rooms"],
            "accessibility": _figure(venue["accessibility"], refs),
        }
        notes = [venue["notes"]] if venue["notes"] else []
        coords = venue.get("coordinates")
        if coords is not None:
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
