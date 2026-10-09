# City data: stay, eat, see, go for a day

What a festival city offers a visitor beyond the shows: where to stay and where
to eat near the festival's venues, the sights worth a free afternoon (museums,
galleries, gardens, notable parks, markets, viewpoints, landmarks) with when
they open, and the day trips the city's travel guide suggests. The same three
roles as the festivals (`scraper/festivals/README.md`), without editions: a
city is not annual.

| role | lives in | writes |
|---|---|---|
| **fetcher** | `scraper/cities/fetch.py osm \| wikidata \| amenities \| wikivoyage --city <id>` | only `data/cities/<city>/<source>/` (+ `manifest.json`) |
| **curated** | `scraper/cities/curated/<city>.json` | — (edited by a person) |
| **converter** | `scraper/cities/to_serving.py <city>` | only `site/data/cities/<city>.json` and `index.json` |

Cities are declared in `cities.toml` (centre, `radius_m`, `near_m`, time zone,
Wikivoyage guide), one per city the festival registry names. Fetch by hand,
`osm` before `wikidata` (which reads the places it found), then convert:

```
python3 scraper/cities/fetch.py osm --city leicester
python3 scraper/cities/fetch.py wikidata --city leicester
python3 scraper/cities/fetch.py amenities --city leicester
python3 scraper/cities/fetch.py wikivoyage --city leicester
python3 scraper/cities/to_serving.py leicester
```

and name each new raw and serving file in the
`edfringe-data-dir-is-generator-output` allowlist, as for a festival. A
festival in a city not declared here gets no lists on the planner.

## Sources and their licences

The serving file carries each source's licence (`licences`), and the planner's
footer credits them wherever their data is shown.

- **`osm`** (OpenStreetMap, **ODbL**) — one Overpass query per city,
  `SELECTORS` in `fetch.py`. The long-tail classes (parks, historic sites,
  plain attractions) need a Wikidata link to be kept; museums, galleries,
  markets and viewpoints need only a name.
- **`wikidata`** (**CC0**) — for every Wikidata id the OSM record links: the
  count of Wikipedia editions (`notability`, which ranks a city's
  `HIGHLIGHTS`), an English description, an image, and what the item is an
  instance of, so a grave tagged with its person is not ranked by that
  person's fame. Wikidata rate-limits bursts; the fetcher waits out
  `Retry-After`.
- **`amenities`** (OpenStreetMap, **ODbL**) — hotels, guest houses, hostels,
  motels and restaurants within `near_m` of a festival venue in the city (the
  venues of every festival the registry places there, read from the served
  programmes when the fetch runs and recorded in the raw as `anchors`; the
  centre where none is served yet). The converter keeps a short list of each,
  ranked by `rank_amenities`.
- **`wikivoyage`** (Wikivoyage, **CC BY-SA 4.0**) — the bulleted destinations
  of the guide's "Go next" section, each with the coordinates its own page
  gives. A guide whose Go next is prose rather than a list (Wellington, Beer
  Sheva, New Orleans, Wichita, San Jose) yields no day trips. A place with no guide of its own names the
  nearest town's in `cities.toml`.
- **curated hours** — where OSM maps no `opening_hours` for a sight worth
  suggesting, `curated/<city>.json` carries them by Wikidata id, each with the
  official page it was read from and the date it was checked. OSM wins where
  both exist.

Overpass is asked at `overpass-api.de` first and at a public mirror of the
same database when that refuses; the manifest's `urls` names the instance that
answered.

## Opening hours

`opening_hours.py` parses the OSM syntax into dated rules a planner can evaluate
for any day (`spans_on`, `open_at`), seasonal hours included. A string outside
the parsed subset is served as `hours: null` beside the raw text: unknown, never
a guess. The serving format is documented in `to_serving.py`'s docstring.

`scripts/verify.sh` runs both self-tests and `to_serving.py --check`, which fails
when a committed serving file differs from what its raw converts to.
