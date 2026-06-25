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

## Running it

`equhost.com` must be reachable from wherever you run this. Claude Code web
sessions sit behind an egress proxy that may block it; in that case run the
script locally, or use the **`Scrape edfringe listing pages`** GitHub Action
(`.github/workflows/scrape.yml`), which runs on a GitHub-hosted runner with open
network access and uploads the result as an artifact.
