# fetch-prices

Real ticket amounts for every performance of every paid show, into the fetch-once
cache `data/prices.json`, then folded into the site data — run from a hand-created
item, off the periodic path, because a show's price bands are set when it goes on
sale. Run it once; re-run it only if the festival re-prices. `scraper/README.md`
covers the cache and why every performance is priced.

- **Switched off** with the other fetching tasks: `scraping-switched-on` declines
  every item until `../scraping-switch.mjs` says otherwise.
- **One item carries the whole pass.** A full pass takes hours and one run gets
  under one, so the worker prices for a time budget, commits what it got, and
  requeues its own item while shows remain. A `limit` bullet takes one bite of that
  size and stops there.
- **Parameters** ride the item's Context as `key: value` bullets: `slug`, `limit`,
  `batch_size` (default 25), `min_delay` / `max_delay` (default 1 / 2.5), and
  `commit: false`.
- **The push retries by re-deriving**, never by merging — `../worker-lib.sh` says
  why. `data/prices.json` itself cannot conflict: this task is its only writer.
