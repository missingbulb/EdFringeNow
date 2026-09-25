# City data: the sights between shows

What a festival city offers a visitor with a free afternoon — museums, galleries,
gardens, notable parks, markets, viewpoints, landmarks — with where they are and
when they open, so a planner can put one in a gap and know it will be open. The
same three roles as the festivals (`scraper/festivals/README.md`), without
editions: a city's sights are not annual.

| role | lives in | writes |
|---|---|---|
| **fetcher** | `scraper/cities/fetch.py osm \| wikidata --city <id>` | only `data/cities/<city>/<source>/` (+ `manifest.json`) |
| **curated** | `scraper/cities/curated/<city>.json` | — (edited by a person) |
| **converter** | `scraper/cities/to_serving.py <city>` | only `site/data/cities/<city>.json` and `index.json` |

Cities are declared in `cities.toml` (centre, `radius_m`, time zone). Fetch by
hand, `osm` first (`wikidata` reads the places it found), then convert:

```
python3 scraper/cities/fetch.py osm --city leicester
python3 scraper/cities/fetch.py wikidata --city leicester
python3 scraper/cities/to_serving.py leicester
```

and name each new raw and serving file in the
`edfringe-data-dir-is-generator-output` allowlist, as for a festival.

## Sources

- **`osm`** — one OpenStreetMap Overpass query per city, `SELECTORS` in
  `fetch.py`. The long-tail classes (parks, historic sites, plain attractions)
  need a Wikidata link to be kept; museums, galleries, markets and viewpoints
  need only a name.
- **`wikidata`** — for every Wikidata id the OSM record links: the count of
  Wikipedia editions (`notability`, which ranks a city's `HIGHLIGHTS`), an English
  description and an image. Wikidata rate-limits bursts; the fetcher waits out
  `Retry-After`.
- **curated hours** — where OSM maps no `opening_hours` for a sight worth
  suggesting, `curated/<city>.json` carries them by Wikidata id, each with the
  official page it was read from and the date it was checked. OSM wins where both
  exist.

## Opening hours

`opening_hours.py` parses the OSM syntax into dated rules a planner can evaluate
for any day (`spans_on`, `open_at`), seasonal hours included. A string outside
the parsed subset is served as `hours: null` beside the raw text: unknown, never
a guess. The serving format is documented in `to_serving.py`'s docstring.

`scripts/verify.sh` runs both self-tests and `to_serving.py --check`, which fails
when a committed serving file differs from what its raw converts to.
