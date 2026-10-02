# Festival data: fetcher → raw → converter → serving

How every festival other than the Edinburgh Fringe gets from its website into the
site. (Edinburgh keeps its own pipeline, `scraper/normalize.py`, and its wire
format; it is registered here as an `edfringe-wire` edition, below, so the
festival planner finds it beside the others.) Three roles, three kinds of code,
and each knows only its own half:

| role | lives in | knows | writes |
|---|---|---|---|
| **fetcher** | `scraper/festivals/<dir>/sources/<source>/fetch.py` (+ `parse.py`) | one website's structure and its yearly quirks | only `data/festivals/<festival>/<edition>/<source>/` |
| **raw** | `data/festivals/<festival>/<edition>/<source>/` | the site's own vocabulary, untranslated | — (committed) |
| **curated** | `scraper/festivals/<dir>/curated/*.json` | hand research (rooms, seats, layout), a URL per figure | — (edited by a person) |
| **converter** | `scraper/convert/` | our information requirements, and nothing about any site | only `site/data/festivals/` |

Fetchers run from `update.py` — by the `festival-update` task for every edition
upcoming or live, and the `festival-refresh` task for the availability tools of an
edition near or in its run — or by hand, through `collect.py`, on any machine that
can reach the site. See "Updating and refreshing", below.

## `festival.toml` — the festival's identity

One per festival, at `scraper/festivals/<dir>/festival.toml`, validated by
`registry.py` (every key below is required unless marked optional;
`python3 scraper/festivals/registry.py --check` validates them all):

```toml
id = "jerusalem-comedy"          # lowercase-hyphen slug; the id everywhere else
name = "…"                        # English
name_local = "…"                  # optional; the festival's own-language name
city = "…"  country = "IL"        # ISO 3166 alpha-2
region = "Victoria"               # optional; the state, only in a country as large as the US or Australia
lat = 31.7683  lng = 35.2137      # the city, for the timeline and travel maths
timezone = "Asia/Jerusalem"       # performance times are this wall clock
lang = "he"  dir = "rtl"
kind = "comedy"                   # film | fringe | comedy | theatre | music | dance | art | literature | sports | academic | multi
subtypes = ["comedy-standup"]     # optional; what sets this festival apart within its kind, `<kind>-<what>`
default_genre = "comedy"          # an event's genre when its adapter assigns none
site = "https://…"
wikidata = "Q…"                   # optional; the festival's Wikidata item, where it has one

[ticketing]                       # optional, served as festival.ticketing
model = "central-box-office"      # how tickets are sold: registry.TICKETING_MODELS
url = "https://…"                 # where; required for festival-pass
notes = "…"

[[edition]]
id = "2026"                       # the year; never read off a page
ordinal = 42                      # optional; omit when nobody publishes it
first = "2026-10-18"  last = "2026-10-22"
format = "block"                  # block | edfringe-wire — required, never defaulted
legacy = { path = "…", writer = "<festival>/<module>.py" }   # optional tolerance file
sources = ["comedy-festival-site", "nominatim", "venues-research"]   # the edition's tool set

[[source]]
id = "comedy-festival-site"       # lowercase-hyphen; the raw folder's name
kind = "fetched"                  # fetched | curated
roles = ["events", "performances", "venues"]   # ⊂ festival, venues, events, performances, availability, prices
required = true                   # explicit: may an edition be served without it?
fetcher = "sources/comedy-festival-site/fetch.py"   # fetched only
path = "curated/venues.json"                        # curated only
adapter = "jerusalem_comedy/comedy_festival_site.py"   # under scraper/convert/adapters/

[merge]                           # per section: field precedence, first source wins; may name
                                  # sources only some editions use
venues = ["venues-research", "nominatim", "comedy-festival-site"]
events = ["comedy-festival-site"]         # also governs the festival's categories
performances = ["comedy-festival-site"]
```

### An edition's tool set

The `[[source]]` tables are the festival's tool library: each written once, kept
from year to year, and calling a shared platform module where one exists. Every
edition names its whole tool set in `sources`, chosen from that library — required,
never defaulted, so a festival that moved to another ticketing platform in 2027
says so as a new `[[source]]` that only the 2027 edition lists, while 2026 keeps
converting from its own raw with its own tools. The fetchers, the converter, the
update and the refresh read only the edition's set; a source's raw folder exists
only for an edition whose set names it. Every `[[source]]` must be in some
edition's set.

`registry.py --write` writes `editions.GENERATED.json`: every edition's dates, its
tools, and the ones that carry availability (`refreshTools`), which the tasks read
to decide whether any festival is in its window. `--check` (in `verify.sh`) fails
when it is stale.

A `festival.toml` written before tool sets existed is migrated with
`python3 scraper/festivals/migrate_edition_tools.py [<festival dir>...]`: it gives
each edition without `sources` every source its festival declares, keeps comments
and layout, is safe to re-run, and rewrites the plan. Edit an edition's set by hand
afterwards only where its tools really differ.

### An `edfringe-wire` edition

`format = "edfringe-wire"` says the edition is not assembled here: the Edinburgh
Fringe's own pipeline writes the files named in the festival's `[wire]` table
(`catalogue`, `lookups`, `availability`, each under `site/`, and the `converter`
that writes them). `to_serving.py` writes nothing for it and refuses to convert
it; the registry lists it with `dataUrl` pointing at the catalogue and `wire`
naming the other two, and `site/shared/festival-catalogue.js` adapts those
files to the same shape a serving block adapts to. Its `[[source]]` entries map
the Fringe's scripts onto the same roles (their `fetcher` paths are relative to
the festival's folder, and they name no adapter).

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
- Nothing to fetch yet (the programme is not out) exits through
  `common.not_ready(reason)` (status `common.EXIT_NOT_READY`, 75), which the update
  reports as not ready. Any other non-zero exit is a broken tool.
- Many requests go through `common.fetch_all` (`WORKERS` at a time, results in
  order, any failure fails the run) and pages through `common.cached_page`, which
  refetches a cached page older than `CACHE_MAX_AGE_SECONDS`; busy answers (429,
  502–504) are retried with backoff, honouring `Retry-After`.

### Shared platforms

A ticketing or listings platform several festivals use is fetched by one module
under `scraper/festivals/platforms/`, and each festival's `fetch.py` is a thin
call into it; the matching generic adapter is under
`scraper/convert/adapters/platforms/`, and the festival's own adapter adds only
its vocabulary (genre names, what counts as public). Where a festival adds no
vocabulary, its `adapter` names the generic one directly, as a curated
`venues-research` source in the plain shape names `platforms/curated_venues.py`.

| platform | module | festivals | carries |
|---|---|---|---|
| Eventotron (WordPress) | `eventotron.py` | Brighton Fringe, Leicester Comedy | events, performances, venues with coordinates, price bands, sold-out marks |
| Spektrix public API v3 | `spektrix.py` | EIF, Book Festival | events, instances, venues, price lists, seats available of capacity |
| Eventer producer page (`/user/<user>/getData`) | `eventer.py` | Acco | one event per performance: title line (hall, runtime), ticket types and prices, tickets left, description, picture |
| EventAct agenda widget (`api.eventact.com/o/v2/agenda`) | `eventact.py` | ISRA, AIS conference | every session by day and hall, its lectures, presenting speakers and portraits |
| Tel Aviv Cinematheque programme page (+ its load-more call) | `cinematheque.py` | TLVFest | one card per screening: film page, still, length, director, language, blurb, hall, order link |
| Smarticket box office (listing + performance pages) | `smarticket.py` | Kol HaMusica | one record per performance from its JSON-LD Event: start, place, running time, price, availability, picture, description |
| A programme PDF ruled into a grid | `pdf_grid.py` | ICISA, SEEEI Electricity & Energy | the grid's cells by their ruling lines, each cell's lines with bold and wrap marks, right-to-left text in reading order; installs pdfminer.six into the git-ignored cache when missing |
| Forms Wizard conference site (`<event>.forms-wizard.biz`) | `forms_wizard.py` | IAEM assembly | every agenda item by day: icon, title, time, people, place, description tables as rows of cells |
| Nominatim (OSM) | `nominatim.py` | any source with street addresses | coordinates for them, one request a second |

### A placeholder festival

A festival whose programme is not out yet, or whose source is not built, gets its
`festival.toml` edition and a `fetch.py` that calls `common.not_ready` with the
reason, its docstring saying what was probed (MICF, NZICF). Its edition converts to nothing and its registry
`dataUrl` stays null until real raw exists.

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
- `venues[]`: `{id, name, address, lat, lng, online, capacity, layout, rooms[{id, name,
  capacity, layout}], accessibility, notes, refs[]}`; `online` is true for a
  stream rather than a place, and an online venue has no `lat`/`lng`; `layout` ∈ raked, flat,
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
festival identity above, `ticketing: {model, url}` (each null where the
festival's `[ticketing]` does not say), `popularity` where measured (below) and
`editions[{id, ordinal, firstDate, lastDate, format, dataUrl}]` (`dataUrl` null
until the edition's required raw exists; an `edfringe-wire` edition also carries
`wire: {lookups, availability}`). The browser loads both
through `site/shared/festival-catalogue.js`.

## Updating and refreshing

`python3 scraper/festivals/update.py` is stage 3 of the data lifecycle
(`docs/data-lifecycle.md`): for every block edition not yet over, due by how close it
is (daily from two weeks before it opens, weekly from two months out, monthly
before that, counted from its required tools' manifests), it runs the edition's
fetched tools and converts it, and reports each edition as `updated`, `not-ready`
or `broken`. `--refresh` is stage 4: from three weeks before an edition opens until
it closes, it re-runs only the tools whose roles include `availability`, and
converts. `--plan` shows what would run; `--festival <id>` runs one festival whatever
its cadence. The Edinburgh Fringe's `edfringe-wire` edition is never run here.

The `festival-update` and `festival-refresh` tasks run it in GitHub Actions and
deliver the changed `data/festivals/` and `site/data/festivals/` on a pull request;
each task's README, in the local pack's `tasks/`, says how.

## Popularity

`popularity` is the festival's Wikipedia user pageviews over the last 12 full
months, summed over every language edition's article on its Wikidata item.
`python3 scraper/festivals/popularity.py` measures every festival with a
`wikidata` QID into `<dir>/popularity.json` (committed input, by hand like the
fetchers); `python3 scraper/convert/to_serving.py --index` then carries it into
the registry. A festival with no QID, or whose item has no Wikipedia article, has
no `popularity` key: unknown, never zero. `popularity.py --find` lists Wikidata
candidates for festivals with no QID; a person picks one into `festival.toml`.

## Adding an edition

1. Add its `[[edition]]` to `festival.toml` (year id, dates from the festival, its
   `sources`), then `python3 scraper/festivals/registry.py --write`.
2. Run each fetched source's `fetch.py --edition <year>` by hand, then
   `python3 scraper/convert/to_serving.py <festival> <year>` — or both in one go
   with `python3 scraper/festivals/collect.py <festival> <year>` (`--all` for every
   edition). Commit the new `data/festivals/<festival>/<year>/` folders, the
   serving file and `index.json`.
3. Name every new raw and serving file, with its writer, in the
   `edfringe-data-dir-is-generator-output` allowlist.

Earlier editions stay as they are and remain convertible from their own raw.

## Adding a source

1. `[[source]]` in `festival.toml` with its roles, `required`, and adapter; add it
   to each `[merge]` list it contributes to, at its precedence, and to the `sources`
   of each edition that uses it; then `registry.py --write`.
2. The fetcher under `sources/<source>/` (fetched) or the file under `curated/`.
3. The adapter under `scraper/convert/adapters/<festival_id>/`.
4. Fetch, convert, allowlist as for an edition.

## Adding a festival

A new `scraper/festivals/<dir>/` with `festival.toml`, its sources and adapters,
then as for an edition. Nothing in `scraper/convert/` outside `adapters/` should
need to change; if it does, the serving schema is changing, which is
`schema.VERSION` and the JS loader together.
