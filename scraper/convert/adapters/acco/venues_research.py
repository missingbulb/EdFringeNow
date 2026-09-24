"""venues-research (curated/venues.json) -> names, addresses, coordinates, halls, layout.

Every figure in the curated file is `{"value", "source"}` or null; the value is
served and its URL joins the venue's `refs`, so a served number always has a
citation behind it. A key the file leaves out is a field this source does not
speak for (the street zones' names come from the street programme), which is
different from a null: a null is a claim that nobody could cite the figure.
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
        record = {}
        for key in ("name", "address", "notes"):
            if key in venue:
                record[key] = venue[key]
        if "coordinates" in venue:
            point = _figure(venue["coordinates"], refs)
            record["lat"] = point["lat"] if point else None
            record["lng"] = point["lng"] if point else None
        for key in ("capacity", "layout", "accessibility"):
            if key in venue:
                record[key] = _figure(venue[key], refs)
        if "rooms" in venue:
            record["rooms"] = [
                {
                    "id": room["id"],
                    "name": room["name"],
                    "capacity": _figure(room["capacity"], refs),
                    "layout": _figure(room["layout"], refs),
                }
                for room in venue["rooms"]
            ]
        record["refs"] = sorted(set(refs))
        venues[code] = record
    return {"venues": venues}
