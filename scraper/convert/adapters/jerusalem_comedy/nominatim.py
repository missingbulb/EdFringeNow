"""nominatim raw (`geocode.json`) -> venue coordinates.

The geocoder answered per street address; the site's venues say which address
is theirs, so this resolves against the comedy-festival-site partial.
"""

ADDRESSES_FROM = "comedy-festival-site"


def adapt(source):
    by_query = {r["query"]: r for r in source.read("geocode.json")["results"]}
    venues = {}
    for code, venue in source.partials[ADDRESSES_FROM]["venues"].items():
        hit = by_query.get(venue.get("address"))
        if hit is not None:
            venues[code] = {"lat": hit["lat"], "lng": hit["lng"]}
    return {"venues": venues}
