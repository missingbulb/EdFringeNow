# Scraper

Tools for scraping show data from [edfringe.com](https://www.edfringe.com).

## Stage 1 — download listing pages

`fetch_pages.py` downloads the paginated "What's On" listing HTML and stores
it under `data/raw_pages/` so that later extraction can run offline without
hammering the live site.

```
python3 scraper/fetch_pages.py
```

- Source pages: `https://www.edfringe.com/tickets/whats-on?page=N` for N = 1..77.
- Output: `data/raw_pages/page_NN.html` (one file per page).
- A random delay of 4–9 seconds is inserted between requests to be polite.
- The run is **resumable**: existing pages are skipped, so you can re-run it
  after an interruption. Use `--force` to re-download everything.

Options:

```
python3 scraper/fetch_pages.py --start 1 --end 77 \
    --min-delay 4 --max-delay 9 --out-dir data/raw_pages
```

The raw HTML is intentionally **git-ignored** (see `.gitignore`) — it is a
regenerable cache, not source.

### Network access

The pages must be fetched from an environment where `www.edfringe.com` is
reachable. Claude Code web sessions run behind an egress proxy whose policy
may block that host (a `403 CONNECT` from the proxy); in that case run this
script locally or from an environment whose network policy allows the domain.
