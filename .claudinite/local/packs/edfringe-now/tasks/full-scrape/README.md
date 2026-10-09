# full-scrape

The full rebuild of the show data, run from a hand-created item: every show is
downloaded from the ticketing API, and the master and every derived site file are
rebuilt from those raw pages and committed. The periodic top-up is `refresh-shows`;
this is the heavier pass for when the master itself is suspect.

- **Switched off** with the other fetching tasks: `scraping-switched-on` declines
  every item until `../scraping-switch.mjs` says otherwise.
- **Parameters** ride the item's Context as `key: value` bullets: `per` (shows per
  page, default 50), `min_delay` / `max_delay` (seconds between requests, default
  4 / 9), and `commit: false` to rebuild without committing.
- **The push retries by re-deriving**, never by merging — `../worker-lib.sh` says
  why.
- **The raw pages are not kept.** They are a regenerable cache, gitignored, and
  leave with the runner.
