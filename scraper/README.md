# Scraper

Tools for scraping show data from [edfringe.com](https://www.edfringe.com).

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
| `data/venues.json` | venue lookup keyed by venue code → name, address, postcode, lat, lng | yes (once) |
| `data/days/2026-08-DD.json` | per-day shows with the minimum a card needs (venue referenced by code) | yes (today's) |
| `data/days/index.json` | available days + per-day counts | yes |

Normalization rules:
- **Location** = venue code (the "venue number") + the show's room (space); venue
  name/address/coords live only in `venues.json`.
- **Price** = a `free` boolean (the listing API exposes no amount).
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
