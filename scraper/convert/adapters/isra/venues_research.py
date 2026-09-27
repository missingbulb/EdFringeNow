"""venues-research (curated/venues.json) -> name, address, coordinates, halls, capacity, layout, notes, refs.

A figure is `{"value", "source"}` or null. The value is served and its URL joins
the venue's `refs`, so every served number has a citation behind it.
Coordinates carry a `basis` instead of a URL, and an approximate one is stated
in the served notes rather than passed off as a pin.
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
            "rooms": [
                {
                    "id": room["id"],
                    "name": room["name"],
                    "capacity": _figure(room["capacity"], refs),
                    "layout": _figure(room["layout"], refs),
                }
                for room in venue["rooms"]
            ],
        }
        notes = [venue["notes"]] if venue["notes"] else []
        coords = venue.get("coordinates")
        if coords is not None:
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
