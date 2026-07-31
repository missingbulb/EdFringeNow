# Scraper

Tools for scraping show data from [edfringe.com](https://www.edfringe.com).

> For the API itself — endpoints, auth, the full `EventDetail` field surface, and
> the non-obvious bits (pricing lives behind a separate per-performance query;
> `ticketStatus` vs the `soldOut` flag) — see **[SCRAPING.md](SCRAPING.md)**.

Three scripts, on three different clocks:

| script | what it gets | how often |
|---|---|---|
| `fetch_shows.py` | the listing: shows, venues, genres | daily top-up, full rebuild on demand |
| `fetch_prices.py` | real ticket amounts, per show | **once** — prices don't move; see below |
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
python3 scraper/fetch_prices.py --selftest                   # offline transform test
```

The listing API carries **no amounts** — `priceType` is a set of flags, which is
why the site knew only "free vs paid" for so long. Money comes from a separate
`performancePrices(performanceRef)` query, **one call per performance**, with no
bulk endpoint. Price *bands* are set per show and repeat across its
performances, so one call per show is enough; `--sample-performances N` prices N
of a show's performances and reports whether the bands actually agree.

Output is `data/prices.json` — **committed, and fetched once**:

```json
{"v": 1, "fetchedAt": "2026-07-30",
 "shows": {"2026DANIELS": {"min": 22.5, "max": 29.5, "fee": 1.5,
                           "bands": [{"type": "Price C", "value": 22.5}, …],
                           "slug": "daniel-sloss-bitter", "ref": "1:790001"}}}
```

Why once, and why it is *not* on the nightly path:

- **A show's price doesn't move.** Ticket *status* changes hourly (hence
  `refresh-tickets`) and the listing gains shows daily (hence `refresh-shows`),
  but the bands a show sells at are set when it goes on sale. Re-fetching them
  nightly would be ~3,500 API calls a day to re-learn the same numbers.
- **The pass is resumable.** Shows already in the cache are skipped, so `--limit
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

Reads the raw scrape and emits three layers (these **are** committed, since the
site serves them):

| file | purpose | sent to browser |
|---|---|---|
| `data/normalized/shows.json` | master: one record per show with all performances (including each show's full `description`); source for regenerating everything below | no |
| `data/normalized/shows.min.json` | the compact catalogue the planner downloads: the master packed losslessly against the `venues.json` lookups | yes (planner) |
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
  no online allocation). Because it changes through the day, the
  `refresh-tickets` scheduled task (`refresh_ticket_status.py`) updates just
  today's `ts` values each hour during the festival — a light paged pass, no
  per-show queries.
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
  when unknown so the client can tell the two apart. The day files carry `pm`
  alone: the Now page's filter asks "what can I see for up to £X", which the
  cheapest band answers, and a day file is the one payload where size bites.
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
the venue and per-day files. This runs automatically once a day as the
**`refresh-shows`** scheduled task (see *How the scheduled refreshes run* below);
the full rebuild stays a manual workflow, **`Scrape edfringe shows (full)`**
(`.github/workflows/scrape.yml`). Both commit the updated data back to the repo.

## How the scheduled refreshes run

Neither refresh has a workflow of its own. The repo's only cron is the Claudinite
scheduler (`.github/workflows/claudinite-scheduler.yml`), which runs hourly and
evaluates every declared task's precondition; the two data refreshes are declared
as tasks under this repo's local pack, each with the shell it runs beside it:

| Task | Runs | What it does |
|---|---|---|
| `refresh-shows` | daily | the `--recently-added LAST_SEVEN_DAYS` top-up above |
| `refresh-tickets` | hourly, but only in August between 08:00 and 23:59 Edinburgh time | `refresh_ticket_status.py` for today |

Ticket **prices** are deliberately absent from that table: they are fetched once
by hand (`fetch_prices.py`, above), not on any schedule. `refresh-shows` reads
the price cache and carries the amounts through untouched, so a daily top-up
keeps prices without re-fetching them — and shows added after the price run
simply have an unknown price until it is run again.

`refresh-tickets` is evaluated every hour year-round and its precondition decides
whether to act — that August/hours window is the whole of what sixteen
hand-written cron lines used to express. Both tasks run as plain subprocesses (no
agent); a failure opens one tracking issue rather than passing silently.

## Running it

`equhost.com` must be reachable from wherever you run this. Claude Code web
sessions sit behind an egress proxy that may block it; in that case run the
script locally, or use the **`Scrape edfringe listing pages`** GitHub Action
(`.github/workflows/scrape.yml`), which runs on a GitHub-hosted runner with open
network access and uploads the result as an artifact.
