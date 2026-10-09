"""venues-research (curated/venues.json) -> names, addresses, coordinates, halls, layout.

Every figure in the curated file is `{"value", "source"}` or null; the value is
served and its URL joins the venue's `refs`, so a served number always has a
citation behind it. Coordinates are a figure too, and must also say the
`basis` they rest on (which pin of the cited page).
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
        coords = venue["coordinates"]
        if coords is not None and not coords.get("basis"):
            raise ValueError("%s: coordinates must say their basis" % code)
        point = _figure(coords, refs)
        venues[code] = {
            "name": venue["name"],
            "address": venue["address"],
            "lat": point["lat"] if point else None,
            "lng": point["lng"] if point else None,
            "capacity": _figure(venue["capacity"], refs),
            "layout": _figure(venue["layout"], refs),
            "rooms": [
                {
                    "id": room["id"],
                    "name": room["name"],
                    "capacity": _figure(room["capacity"], refs),
                    "layout": _figure(room["layout"], refs),
                }
                for room in venue["rooms"]
            ],
            "accessibility": _figure(venue["accessibility"], refs),
            "notes": venue["notes"],
        }
        venues[code]["refs"] = sorted(set(refs))
    return {"venues": venues}
