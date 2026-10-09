"""A nominatim source's raw (`geocode.json`) -> venue coordinates.

The geocoder answered per street address; the partial of the source the
addresses came from says which venue each address is, so this resolves
against it.
"""


def adapt(source, addresses_from):
    by_query = {r["query"]: r for r in source.read("geocode.json")["results"]}
    venues = {}
    for vid, venue in source.partials[addresses_from]["venues"].items():
        hit = by_query.get(venue.get("address"))
        if hit is not None and hit["lat"] is not None:
            venues[vid] = {"lat": hit["lat"], "lng": hit["lng"]}
    return {"venues": venues}
