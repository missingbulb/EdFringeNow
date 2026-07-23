# Scraper

Tools for scraping show data from [edfringe.com](https://www.edfringe.com).

> For the API itself — endpoints, auth, the full `EventDetail` field surface, and
> the non-obvious bits (pricing lives behind a separate per-performance query;
> `ticketStatus` vs the `soldOut` flag) — see **[SCRAPING.md](SCRAPING.md)**.

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

## normalize.py — turn the raw scrape into website data

```
python3 scraper/normalize.py
```

Reads the raw scrape and emits three layers (these **are** committed, since the
site serves them):

| file | purpose | sent to browser |
|---|---|---|
| `data/normalized/shows.json` | master: one record per show with all performances; source for regenerating the day files | no |
| `data/venues.json` | shared lookup sent once: `{ venues, rooms, genres, subgenres, ticketStatuses }` — venue map (code → name, address, postcode, lat, lng) plus the global lookup lists | yes (once) |
| `data/days/2026-08-DD.json` | per-day shows with the minimum a card needs (venue, genre, room, subgenres and ticket status referenced by index) | yes (today's) |
| `data/days/index.json` | available days + per-day counts | yes |

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
  `Refresh today's ticket status (hourly)` workflow (`refresh_ticket_status.py`)
  updates just today's `ts` values each hour during the festival — a light paged
  pass, no per-show queries.
- **Images**: the master keeps both `image` (the API's "Large" variant) and
  `smallImage` (the "Small" variant), each selected by `imageType` rather than
  list order. Not in the day files yet.
- **Price** = a `free` flag (the listing API exposes no amount).
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
the venue and per-day files. This runs automatically via the
**`Refresh edfringe shows (daily)`** workflow (`.github/workflows/refresh.yml`,
scheduled daily); the full rebuild is **`Scrape edfringe shows (full)`**
(`.github/workflows/scrape.yml`). Both commit the updated data back to the repo.

## Running it

`equhost.com` must be reachable from wherever you run this. Claude Code web
sessions sit behind an egress proxy that may block it; in that case run the
script locally, or use the **`Scrape edfringe listing pages`** GitHub Action
(`.github/workflows/scrape.yml`), which runs on a GitHub-hosted runner with open
network access and uploads the result as an artifact.
