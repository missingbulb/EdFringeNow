# Scraper

Tools for scraping show data from [edfringe.com](https://www.edfringe.com).

> For the API itself — endpoints, auth, the full `EventDetail` field surface, and
> the non-obvious bits (pricing lives behind a separate per-performance query;
> `ticketStatus` vs the `soldOut` flag) — see **[SCRAPING.md](SCRAPING.md)**.

Three scripts, on three different clocks:

| script | what it gets | how often |
|---|---|---|
| `fetch_shows.py` | the listing: shows, venues, genres | daily top-up, full rebuild on demand |
| `fetch_prices.py` | real ticket amounts, per performance | **once** — prices don't move; see below |
| `normalize.py` | turns both into the committed site data | after either of the above |

## How edfringe.com serves listings

The "What's On" listing (`/tickets/whats-on?page=N`) is a **Next.js single-page
app**. The server returns the same ~20 KB JavaScript shell for every page and
the shows are loaded **client-side from a GraphQL API**. So fetching the HTML
yields empty pages — there is no show data in the markup to extract.

The shows come from:

```
POST https://edfringe-tikketr-web-api.equhost.com/graphql
```

authenticated with a bearer token from `POST .../token` using the site's public
anonymous credentials. The `EventsSearch` operation returns structured JSON
(title, genre, dates, venues, spaces, performances, prices, images, …), 50
shows per page, ~3,800 shows over ~77 pages.

## fetch_shows.py — download all shows from the API

```
python3 scraper/fetch_shows.py
```

- Authenticates, then pages through every show via the GraphQL API.
- Output (default `data/raw_pages/`):
  - `page_NN.json` — the raw `events` payload per page (kept for re-processing).
  - `shows.json` — all show results flattened into a single array.
- A random 4–9 s delay is inserted between requests.
- **Resumable**: existing `page_NN.json` files are skipped; use `--force` to
  re-fetch. A fixed `--seed` keeps the server ordering stable across pages so
  paging never skips or duplicates shows.

Options:

```
python3 scraper/fetch_shows.py \
    --per 50 --seed 123 --min-delay 4 --max-delay 9 \
    --out-dir data/raw_pages [--max-pages N] [--force]
```

The raw output is **git-ignored** (see `.gitignore`) — it is a regenerable
cache, not source.

## fetch_prices.py — real ticket prices, fetched once

```bash
python3 scraper/fetch_prices.py --slug daniel-sloss-bitter   # one show
python3 scraper/fetch_prices.py --all                        # every paid show
python3 scraper/fetch_prices.py --all --batch-size 10        # smaller requests
python3 scraper/fetch_prices.py --selftest                   # offline transform test
```

The listing API carries **no amounts** — `priceType` is a set of flags, which is
why the site knew only "free vs paid" for so long. Money comes from a separate
`performancePrices(performanceRef)` query, one performance at a time.

**Every performance is priced, because a price belongs to a performance.** The
same run sells at several prices — previews cheaper, weekends dearer — so the
old pass, which priced one performance per show and filed the answer under the
show, published a quarter of the catalogue at its preview price. There is no
bulk price *field*, but GraphQL aliases let one request carry every performance
of a show, so full per-night pricing costs the same ~3,700 requests the old pass
did. `--batch-size` caps the aliases per request; a rejected batch is halved and
retried, so it is a throughput knob, never an accuracy one.

Output is `data/prices.json` — **committed, and fetched once**. Performances
sharing a price point share a set, so a show priced the same all run stores one:

```json
{"v": 2, "fetchedAt": "2026-07-30",
 "shows": {"2026ALFIEBR": {
    "slug": "alfie-brown-the-entertainer",
    "min": 8.5, "max": 16.0,
    "sets": [{"min": 8.5, "max": 8.5, "bands": [{"type": "Standard", "value": 8.5}]},
             {"min": 16.0, "max": 16.0, "bands": [{"type": "Standard", "value": 16.0}]}],
    "perfs": {"2026-08-05|17:50": 0, "2026-08-08|17:50": 1, …}}}}
```

`perfs` names a performance by local date and start time — the same identity the
master and the day files use, so `normalize.py` joins on it exactly. Entries
left by the old pass (no `perfs`) still read as whole-show prices and are
re-priced when the pass next reaches them, so a part-finished migration never
blanks the site's prices.

Why once, and why it is *not* on the nightly path:

- **A show's price doesn't move.** Ticket *status* changes through the festival
  (hence `refresh-tickets`) and the listing keeps gaining shows (hence
  `refresh-shows`), but the bands a show sells at are set when it goes on sale.
  Re-fetching them
  nightly would be ~3,500 API calls a day to re-learn the same numbers. (A
  performance costing *different* money from its neighbour is not the price
  moving — that is the schedule, and it is fetched once like everything else.)
- **The pass is resumable.** Shows already priced per performance are skipped, so `--limit
  N` takes the festival in bites and `--force` re-prices deliberately. The cache
  is rewritten every 25 shows, so a mid-run crash loses at most that many —
  but note what "resumable" is measured against: **the cache file on disk**. On
  a runner that file is only durable once the workflow's commit step pushes it,
  which it does at the end of the job (including when the fetch step failed).
  Against a *script* failure that is enough; against the runner itself dying,
  nothing in the job runs and the whole run is lost. If that matters, chunk the
  festival with `limit` — each run commits what it got.
- **Free shows are skipped**, not called: there is nothing to price, and
  `normalize.py` already reads £0 off the listing's `free` flag.
- **A missing show means the price is unknown, not free.** The festival keeps
  adding shows after the price run, so gaps are normal and permanent. Every
  consumer treats unknown as its own state (`shared/price.js`).

Run it on a runner via the **`Fetch ticket prices (one-off)`** workflow
(`.github/workflows/prices.yml`), which fetches, regenerates and commits.

## normalize.py — turn the raw scrape into website data

```
python3 scraper/normalize.py
```

Reads the raw scrape and emits the site's data layers (these **are** committed,
since the site serves them):

| file | purpose | sent to browser |
|---|---|---|
| `data/normalized/shows.json` | master: one record per show with all performances (including each show's full `description`); source for regenerating everything below | no |
| `data/normalized/shows.min.json` | the compact catalogue the planner downloads (3.0 MB, 948 KB gzipped): the master packed losslessly against the `venues.json` lookups. Carries **no ticket status** — see the sidecar below — so an unchanged festival regenerates it byte-for-byte and the browser can hold it for 4 days | yes (planner) |
| `data/normalized/availability.min.json` | `{v, ts, a: {show id → {"MMDD\|HH:MM" → status index}}, o}` — per-performance ticket status, split out of the catalogue because it is the one thing that moves during the festival. Self-contained (its own status list, indexes into nothing), 149 KB gzipped, cached for 1 day | yes (planner) |
| `data/normalized/descriptions.min.json` | `{v, d: {slug → full description}}`, kept out of the catalogue above so that file stays small enough to block on. Fetched lazily by the planner and cached for a week; the hover card and search fall back to the catalogue's 160-char `blurb` until it lands | yes (planner, lazily) |
| `data/venues.json` | shared lookup sent once: `{ venues, rooms, genres, subgenres, ticketStatuses }` — venue map (code → name, address, postcode, lat, lng) plus the global lookup lists | yes (once) |
| `data/days/2026-08-DD.json` | per-day shows with the minimum a card needs (venue, genre, room, subgenres and ticket status referenced by index) | yes (today's) |
| `data/days/index.json` | available days + per-day counts | yes |

`normalize.py` has a **second input** besides the raw scrape: `data/prices.json`
(above), which it folds into the master and both wire forms. It is an input, not
an output — `normalize.py` never writes it, and runs happily without it (every
show simply has an unknown price, and it says so).

Normalization rules:
- **Location** = venue code (the "venue number") + the show's room (space); venue
  name/address/coords live only in `venues.json`.
- **Shared lookups live once, in `venues.json`.** It is a
  `{ "venues": {...}, "rooms": [...], "genres": [...] }` container: `rooms` and
  `genres` are the global de-duplicated string lists (~420 rooms, 10 genres).
  The browser already fetches this file once, so the lists cost one small
  download rather than being repeated in every day file.
- **Day files are compact.** Each `2026-08-DD.json` is a plain array of shows; a
  show's `genre`, `room`, `subs` (subgenres) and `ts` (ticket status) are indices
  into the matching global lists (`room`/`ts` are -1 when unknown). Binary flags
  (`free`, `soldOut`) are 1/0, and the `blurb` — kept in the master but never
  rendered by the site — is dropped. This more than halves the day payload.
- **Ticket status** (`ts` → `ticketStatuses`) is the reliable "can I get a
  ticket" signal, not the `soldOut` flag (a show can be `soldOut:false` yet have
  no online allocation). Because it changes through the festival, the
  `refresh-tickets` task (`refresh_ticket_status.py`) refreshes the
  `ts` values for today and every remaining festival date — a light paged pass,
  no per-show queries.
- **Images**: the master keeps both `image` (the API's "Large" variant) and
  `smallImage` (the "Small" variant), each selected by `imageType` rather than
  list order. Every listing image lives under
  `http://registration.edfringe.com/resource/image/<guid>`, so the master stores
  only the bare `<guid>` and the client re-attaches the host (over https); this
  trims ~50 bytes off each image field in `shows.json`. Not in the day files yet.
- **Price** = `priceMin` / `priceMax` in pounds, folded in from
  `data/prices.json` (see `fetch_prices.py` above), plus the listing's `free`
  flag. A free show is a known £0; a show the price cache hasn't reached is
  `null` — **unknown, which is not the same as free**. The wire forms carry
  `pm` (cheapest band) and, in the catalogue only, `px` (dearest), both omitted
  when unknown so the client can tell the two apart.

  The two payloads answer **different questions**, which is why they carry
  different numbers for the same show. The master and the catalogue quote the
  **run-wide** range (`priceMin`..`priceMax`) — "this show costs £8.50–£16",
  true of the run as a whole. A day file holds *performances*, so its `pm` is
  **that night's** cheapest band: £8.50 in the preview file, £16 in the Saturday
  one. Only `pm` goes into a day file — the Now page's filter asks "what can I
  see for up to £X" tonight, which the cheapest band on the night answers, and a
  day file is the one payload where size bites. A performance the price cache
  has no entry for carries no `pm` at all rather than borrowing another night's
  figure; the client renders that as "Price TBC".
- **Coordinates** are geocoded from each venue's UK postcode via
  [postcodes.io](https://postcodes.io) and cached in `venues.json`, so a refresh
  only geocodes new venues. Use `--no-geocode` to skip.
- **Genre** is mapped to the site's ten categories.
- **Subgenres** are the finer descriptors the festival tags each show with
  (e.g. Stand-up, Improv, New writing, Drama) — carried through from the API's
  `subGenre`/`subgenres` fields as a list of display labels, for display only
  (not a filter). About 2% of shows carry none.

`python3 scraper/normalize.py --selftest` runs a built-in transform test (no
network or scraped data needed).

## Refreshing data (daily)

A full re-scrape isn't needed to stay current. The **daily** path fetches only
shows added/updated in the last seven days and merges them in:

```
python3 scraper/fetch_shows.py --recently-added LAST_SEVEN_DAYS
python3 scraper/normalize.py --merge
```

`--merge` upserts the new shows into the existing master (by id) and regenerates
the venue and per-day files. It is the **`refresh-shows`** task's work (see *How
the data refreshes run* below); the full rebuild stays a manual workflow,
**`Scrape edfringe shows (full)`** (`.github/workflows/scrape.yml`). Both commit
the updated data back to the repo.

## How the data refreshes run

**Nothing scrapes on its own right now.** The two refreshes are declared as tasks
under this repo's local pack, each with the shell it runs beside it, and both are
declared `manual` — a manual task has no occurrence, so the Claudinite scheduler
(`.github/workflows/claudinite-scheduler.yml`, the repo's only cron) never
instantiates one and it runs only from a work item created by hand. Turning a
refresh back on is a one-token edit to its declaration.

| Task | What it does |
|---|---|
| `refresh-shows` | the `--recently-added LAST_SEVEN_DAYS` top-up above |
| `refresh-tickets` | `refresh_ticket_status.py` for today **and every remaining festival date** |

Ticket **prices** are absent from that table for a different reason: they are
fetched once by hand (`fetch_prices.py`, above) even when the refreshes are
running. `refresh-shows` reads the price cache and carries the amounts through
untouched, so a top-up keeps prices without re-fetching them — and shows added
after the price run simply have an unknown price until it is run again.

Each task's precondition decides whether a slot it is given acts (that is where
`refresh-tickets`' August gate lives); the task declarations themselves are the
source of truth for when they run. Both run as plain subprocesses (no agent); a
failure opens one tracking issue rather than passing silently. A date that needs fresher status than the
scheduled pass gives it can be refreshed by hand:
`python3 scraper/refresh_ticket_status.py --date 2026-08-10`, then commit
`data/normalized`, `data/days` and `data/venues.json` as the task's worker does.

`refresh-tickets` writes fresh statuses **into the master** and then regenerates
every derived file from it. That matters twice over. It is what makes the refresh
visible to the planner at all — the planner loads `availability.min.json` and has
never loaded the day files, so the old day-files-only refresh committed on every
firing and changed nothing it could see (#249). And because every output is a pure
function of the master, the files carrying no ticket status come back identical
and never enter the commit.

## How long the browser keeps each file

GitHub Pages sets its own `Cache-Control` and offers no way to vary it per file,
so the freshness policy lives on the client, in
[`shared/data-cache.js`](../shared/data-cache.js). Payloads go in the Cache
Storage API (the catalogue alone would breach localStorage's ~5 MB ceiling) with
a small localStorage map recording when each url was last fetched.

The shape of the data above exists to serve this table — availability is a
separate file precisely so the catalogue can sit in the top row:

| file | kept for | why |
|---|---|---|
| `shows.min.json` | 4 days | 948 KB gzipped, and nothing in it changes through the day |
| `availability.min.json` | 1 day | the one file that changes through the festival, and small enough that a daily re-fetch is cheap |
| `venues.json` | 1 day | small, and its lookup lists are indexed into by the cached catalogue |
| `days/2026-08-DD.json` | 1 hour | the now page's whole premise is fresh availability, and the file is small enough that re-fetching often costs little |
| `descriptions.min.json` | 7 days | a show's description doesn't change mid-festival |

Two invariants hold this up, and breaking either is silent:

1. **`shows.min.json` must carry nothing that changes through the day.** A ticket
   status leaking back into it would make the bulky catalogue churn with every
   ticket refresh *and* freeze availability for anyone holding a cached copy.
   `plan/lib/__tests__/hydrate.test.mjs` asserts each wire performance carries
   only its date and start.
2. **The `venues.json` lookup lists are append-only** (`extend_lookup`). A
   4-day-old catalogue is routinely decoded against a `venues.json` fetched
   today, so an entry that moved index would silently relabel shows' genres and
   rooms. Entries are never dropped, even when the master stops using them.

## Running it

`equhost.com` must be reachable from wherever you run this. Claude Code web
sessions sit behind an egress proxy that may block it; in that case run the
script locally, or use the **`Scrape edfringe listing pages`** GitHub Action
(`.github/workflows/scrape.yml`), which runs on a GitHub-hosted runner with open
network access and uploads the result as an artifact.
