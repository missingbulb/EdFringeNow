# Festival data: fetcher → raw → converter → serving

How every festival other than the Edinburgh Fringe gets from its website into the
site. (Edinburgh keeps its own pipeline, `scraper/normalize.py`, and its wire
format.) Three roles, three kinds of code, and each knows only its own half:

| role | lives in | knows | writes |
|---|---|---|---|
| **fetcher** | `scraper/festivals/<dir>/sources/<source>/fetch.py` (+ `parse.py`) | one website's structure and its yearly quirks | only `data/festivals/<festival>/<edition>/<source>/` |
| **raw** | `data/festivals/<festival>/<edition>/<source>/` | the site's own vocabulary, untranslated | — (committed) |
| **curated** | `scraper/festivals/<dir>/curated/*.json` | hand research (rooms, seats, layout), a URL per figure | — (edited by a person) |
| **converter** | `scraper/convert/` | our information requirements, and nothing about any site | only `site/data/festivals/` |

Fetchers run **by hand only**, on a machine that can reach the site. There is no
task, workflow or cron for them, by the owner's decision.

## `festival.toml` — the festival's identity

One per festival, at `scraper/festivals/<dir>/festival.toml`, validated by
`registry.py` (every key below is required unless marked optional):

```toml
id = "jerusalem-comedy"          # lowercase-hyphen slug; the id everywhere else
name = "…"                        # English
name_local = "…"                  # optional; the festival's own-language name
city = "…"  country = "IL"        # ISO 3166 alpha-2
lat = 31.7683  lng = 35.2137      # the city, for the timeline and travel maths
timezone = "Asia/Jerusalem"       # performance times are this wall clock
lang = "he"  dir = "rtl"
kind = "comedy"                   # film | fringe | comedy | theatre | music | multi
default_genre = "comedy"          # an event's genre when its adapter assigns none
site = "https://…"

[ticketing]                       # optional, served as festival.ticketing
notes = "…"

[[edition]]
id = "2026"                       # the year; never read off a page
ordinal = 42                      # optional; omit when nobody publishes it
first = "2026-10-18"  last = "2026-10-22"
legacy = { path = "…", writer = "<festival>/<module>.py" }   # optional tolerance file

[[source]]
id = "comedy-festival-site"       # lowercase-hyphen; the raw folder's name
kind = "fetched"                  # fetched | curated
roles = ["events", "performances", "venues"]   # ⊂ festival, venues, events, performances, availability, prices
required = true                   # explicit: may an edition be served without it?
fetcher = "sources/comedy-festival-site/fetch.py"   # fetched only
path = "curated/venues.json"                        # curated only
adapter = "jerusalem_comedy/comedy_festival_site.py"   # under scraper/convert/adapters/

[merge]                           # per section: field precedence, first source wins
venues = ["venues-research", "nominatim", "comedy-festival-site"]
events = ["comedy-festival-site"]         # also governs the festival's categories
performances = ["comedy-festival-site"]
```

## The fetcher's contract

- CLI: `fetch.py --edition <id>` (`common.parse_args`). The edition must be declared
  in `festival.toml`; the fetcher reads the site's own edition marker and **refuses
  to write** when it disagrees, and `common.guard_dates` refuses any programme
  dated outside the declared edition ±1 day. A site that has rolled over to next
  year therefore cannot overwrite this year's folder.
- Output goes through `common.write_raw` only: files are written to a temp folder
  beside the target and swapped in whole, with a `manifest.json`
  (`festival, edition, source, fetchedAt, fetcher, fetcherVersion, urls, files, notes`).
  A failed fetch leaves the previous raw untouched; other sources and editions are
  never opened for writing.
- Raw keeps the site's vocabulary (its slugs, its category names, its IDs). Parse
  what you must to get structured records, rename nothing.
- Page caches go under `data/festivals/.cache/` (git-ignored), never in raw.
- Parsing lives in `parse.py`, pure (no network, no files), with a `--selftest`
  on committed or inline samples; `scripts/verify.sh` runs every
  `sources/*/parse.py --selftest` it finds.
- Bump `FETCHER_VERSION` when the shape of the raw files changes.

## The converter's contract

`python3 scraper/convert/to_serving.py <festival> <edition>`:

1. **Required sources present**, each with a manifest naming this festival,
   edition and source (a copied folder is refused).
2. **Adapters** (`scraper/convert/adapters/<festival_id>/<source>.py`, one per
   source, run in `festival.toml` order) each define `adapt(source)` and return a
   *partial* — `{categories, venues, events, performances: {id: {field: value}}, skipped}`
   holding only fields that source knows. `source.read(name)` reads a raw file
   (`source.read()` the curated file); `source.partials` holds earlier sources'
   partials, for resolving against (never editing). An adapter is where a
   festival's vocabulary meets ours, e.g. mapping its sections to our `genre`.
3. **Merge** (`merge.py`): per field, the first source in `[merge]` that supplies
   it wins, recorded in `provenance.fields`. A source may only supply the sections
   its `roles` name; `status` needs `availability`, `priceMin/priceMax` need
   `prices`. Venues no performance uses are dropped (curated venues outlive
   editions).
4. **Validate** (`schema.py`) the whole block; any problem and **nothing is written**.
5. **Write**, each file atomically: the edition's block, the registry, and the
   edition's `legacy` file if declared. Nothing else.

`to_serving.py --check` (in `verify.sh`) re-derives every committed serving file
from committed raw and exits 1 on any difference or on a file no edition produces.
So a hand edit to serving data, or raw committed without converting, fails the gate.

## The serving block — `site/data/festivals/<festival>/<edition>.json` (v 1)

Festival-oblivious: the same keys for every festival, every record reachable from
`festival.id`. Unknown is `null` (or `"unknown"` for `status`), never a zero or a
default.

- `festival`: `id, edition, ordinal, name, nameLocal, city, country, lat, lng,
  timezone, lang, dir, kind, defaultGenre, site, firstDate, lastDate, ticketing`
- `categories[]`: `{id, name}` — the festival's own sections, untranslated
- `venues[]`: `{id, name, address, lat, lng, capacity, layout, rooms[{id, name,
  capacity, layout}], accessibility, notes, refs[]}`; `layout` ∈ raked, flat,
  cabaret, cinema, outdoor, standing; `refs` are the URLs behind curated figures
- `events[]`: `{id, title, titleLocal, url, genre, categories[], blurb, durationMin, imageUrl}`;
  `titleLocal` is the title in the festival's own language when `title` is not (else null);
  `genre` ∈ film, comedy, theatre, dance, music, family, talk, other
- `performances[]`: `{id, eventId, venueId, roomId, date, start, ticketUrl, free,
  status, priceMin, priceMax}`; `date`/`start` are festival wall clock, within the
  edition ±1 day; `status` ∈ on-sale, free, sold-out, unknown
- `sources`: `{festival, venues, events, performances, availability, prices}` →
  source ids that supplied each (an empty list: no source speaks for it)
- `provenance`: `{sources{id: kind, path, fetchedAt, fetcher, fetcherVersion},
  absent[], fields{"section.field": [source]}, skipped{source: [...]}}`

The registry `site/data/festivals/index.json` is `{v, festivals[]}`, each with the
festival identity above and `editions[{id, ordinal, firstDate, lastDate, dataUrl}]`
(`dataUrl` null until the edition's required raw exists). The browser loads both
through `site/shared/festival-catalogue.js`.

## Adding an edition

1. Add its `[[edition]]` to `festival.toml` (year id, dates from the festival).
2. Run each fetched source's `fetch.py --edition <year>` by hand; commit the new
   `data/festivals/<festival>/<year>/` folders.
3. `python3 scraper/convert/to_serving.py <festival> <year>`; commit the serving file
   and `index.json`.
4. Name every new raw and serving file, with its writer, in the
   `edfringe-data-dir-is-generator-output` allowlist.

Earlier editions stay as they are and remain convertible from their own raw.

## Adding a source

1. `[[source]]` in `festival.toml` with its roles, `required`, and adapter; add it
   to each `[merge]` list it contributes to, at its precedence.
2. The fetcher under `sources/<source>/` (fetched) or the file under `curated/`.
3. The adapter under `scraper/convert/adapters/<festival_id>/`.
4. Fetch, convert, allowlist as for an edition.

## Adding a festival

A new `scraper/festivals/<dir>/` with `festival.toml`, its sources and adapters,
then as for an edition. Nothing in `scraper/convert/` outside `adapters/` should
need to change; if it does, the serving schema is changing, which is
`schema.VERSION` and the JS loader together.
