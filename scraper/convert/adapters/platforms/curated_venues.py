"""A festival's curated venue research (curated/venues.json) -> names, addresses, coordinates, rooms, notes, refs.

Shared by every festival whose `venues-research` source is the plain curated
shape, named directly as that source's adapter in festival.toml. A figure is
`{"value", "source"}` or null: the value is served and its URL joins the
venue's `refs`, so every served number has a citation behind it. Coordinates
carry the `basis` they rest on and the `source` page they were read from; an
approximate basis is said in the served notes rather than passed off as a pin.
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
        coords = venue["coordinates"]
        if coords is not None:
            if not coords.get("basis") or not str(coords.get("source", "")).startswith("http"):
                raise ValueError("%s: coordinates must say their basis and source" % code)
            refs.append(coords["source"])
            record["lat"], record["lng"] = coords["lat"], coords["lng"]
            if coords["basis"].startswith("approximate"):
                notes.append("Coordinates are approximate, not a published pin.")
        record["notes"] = " ".join(notes) or None
        record["refs"] = sorted(set(refs))
        venues[code] = record
    return {"venues": venues}
