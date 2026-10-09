"""venues-research (curated/venues.json) -> capacity, layout, rooms, notes, refs.

Every figure in the curated file is `{"value", "source"}` or null; the value is
served and its URL joins the venue's `refs`, so a served number always has a
citation behind it.
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
        rooms = [
            {
                "id": room["id"],
                "name": room["name"],
                "capacity": _figure(room["capacity"], refs),
                "layout": _figure(room["layout"], refs),
            }
            for room in venue["rooms"]
        ]
        venues[code] = {
            "capacity": _figure(venue["capacity"], refs),
            "layout": _figure(venue["layout"], refs),
            "rooms": rooms,
            "accessibility": _figure(venue["accessibility"], refs),
            "notes": venue["notes"],
            "refs": sorted(set(refs)),
        }
    return {"venues": venues}
