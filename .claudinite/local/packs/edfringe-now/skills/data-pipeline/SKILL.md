---
name: data-pipeline
description: EdFringeNow's data pipeline - getting show data out of edfringe.com into the committed files the site serves, and the wire format the pages decode. Use before touching scraper/, data/, site/data/, the scrape and price tasks, or the site code that decodes, prices or times performances.
metadata:
  body: guidelines
  force-load-on-file-edits-paths:
    - "scraper/**"
    - "data/**"
    - "site/data/**"
    - ".claudinite/local/packs/edfringe-now/tasks/full-scrape/**"
    - ".claudinite/local/packs/edfringe-now/tasks/fetch-prices/**"
    - ".claudinite/local/packs/edfringe-now/tasks/worker-lib.sh"
    - "site/js/app.js"
    - "site/js/clock.js"
    - "site/plan/plan.js"
    - "site/plan/lib/hydrate.js"
    - "site/plan/lib/availability.js"
    - "site/shared/price.js"
    - "site/shared/data-cache.js"
---

# The data pipeline

The API's field reference is `scraper/SCRAPING.md` and the file layout `scraper/README.md`; this
is the judgment those two don't carry.

## Verifying a change

- **Verifying a scraper change against the live API** — only a sanctioned task drives the
  API: `full-scrape`, `fetch-prices`, `price-probe`, `refresh-shows` or `refresh-tickets`. Never
  "verify" by reasoning about what the API probably returns; have a task run it, or say plainly
  it is unverified.

- **Answering a one-off API question** (a field's shape, an enum's values, whether an operation
  exists) — `scraper/SCRAPING.md` first; past it, `www.edfringe.com`'s Next.js bundles carry
  the client's full GraphQL operation set (recipe in SCRAPING.md), where the probe shows the host
  reachable. That shows what a query looks like, never what it returns, so a change checked only
  that way is still unverified. Past that, ask the owner.

- **Changing the normalizer** — `python3 scraper/normalize.py --selftest` is the one transform
  check that runs offline (raw → master → day file → `shows.min.json` on a fixture). Run it.

## Tickets and prices

- **Writing availability logic, client or scraper** — key off the per-performance
  `ticketStatus`, never the `soldOut` flag: a performance can be `soldOut: false` with nothing to
  sell online (`NO_ALLOCATION_CONTACT_VENUE`). `SOLD_OUT` and `NO_ALLOCATION_CONTACT_VENUE` are
  unavailable, everything else available, unknown available (`NO_TICKETS_STATUSES` in
  `site/js/app.js`). `soldOut` is carried for display only.

- **Pricing a show** — price every performance, not one per show: previews sell cheaper and
  weekends dearer, and pricing one performance published 28% of shows at their cheapest night.
  No "skip previews" heuristic fixes that; GraphQL aliases carry a whole run per request
  (`fetch_prices.prices_query`), and there is no call budget to economise against.

- **Choosing which price a payload carries** — `shows.min.json` (planner) answers "what does
  this show cost?" with the run-wide `priceMin`..`priceMax`; `site/data/days/*.json` (Now page)
  answers "what does it cost tonight?" with that performance's own `pm`. A performance the cache
  has no entry for gets no `pm` at all ("Price TBC"), never a neighbouring night's figure or the
  show's minimum.

- **Handling a show with no price** — it is a normal, permanent state: `data/prices.json` is a
  fetch-once cache off the nightly path, and `refresh-shows` carries its amounts through without
  re-fetching. Keep both cache entry shapes readable (current `sets` + `perfs`, legacy bare
  `min`/`max`; `price_sets` reads both); dropping the legacy shape or emptying the cache blanks
  prices until a full pass finishes.

- **Encoding a price at any stage** — keep three states, never two:

  | state | master | wire |
  |---|---|---|
  | costs nothing | `priceMin: 0` | `pm: 0` |
  | priced | `priceMin: 22.5` | `pm: 22.5` |
  | unknown | `priceMin: null` | no `pm` key at all |

  Never encode unknown as `0` or let a decoder default it to one. `priceMin: 0` and `free: true`
  are separate claims (the flag is the listing's, the £0 can be the price API's); the price path
  keys off `priceMin` and `free` stays what the listing said. What the site shows for an unknown
  price is a product decision in `site/shared/price.js`.

- **Reading the raw price payload** — amounts arrive as strings, and nearly every show carries a
  £0.00 "Personal Assistant" concession that is never the cheapest price (SCRAPING.md's pricing
  section).

## Time

- **Reading a performance's `dateTime` from the listing API** — it is a real UTC instant, not
  Edinburgh wall-clock with a decorative `Z`; slicing its digits is an hour wrong all August. The
  pipeline crosses the zone once, in `normalize.local_date_start`, shared by
  `refresh_ticket_status.py` and `fetch_prices.py`. Everything written after it is Edinburgh
  wall-clock, so no stage downstream parses, converts or re-offsets a time.

- **Comparing "now" against performance times** — read now in Edinburgh too,
  `site/js/clock.js`'s `festivalNow` / `festivalDate`, never the device clock: a UK visitor can't
  see the difference, a visitor from another zone gets the whole drift. (now-compared-against)

- **Changing the time-zone conversion** — it is a full-snapshot change: rebuild the master
  through the new conversion and regenerate every derived artifact. Expect performances to move
  between day files (late 31 Aug ones fall into 1 Sep, outside the August day files) rather than
  reading that as data loss. (conversion-change-full)

## Committed data and caching

- **Fixing wrong data under `data/normalized/` or `site/data/`** — fix `scraper/normalize.py`
  and re-run it (`--merge` to top up, no flag for a full rebuild from the raw cache); a hand-edit
  is overwritten by the next `refresh-shows` and leaves the bug in the generator.
  `data/prices.json` is committed input written by `scraper/fetch_prices.py`, and nothing
  overwrites a hand-edit there, which is why re-running the fetch is the only fix.

- **Adding a festival, an edition or a source** — `site/data/festivals/` is
  `scraper/convert/to_serving.py`'s output and `data/festivals/` its hand-fetched input; name each
  new file and its writer in `edfringe-data-dir-is-generator-output`'s allowlist, never the
  directory.

- **Writing a job that commits generated data and can run over an hour** — its push is
  guaranteed to be rejected by the hourly ticket refresh, so on rejection re-derive rather than
  merge: fetch `origin/main`, take its generated files, regenerate from that master plus the
  job's own input, retry. Call `commit_regenerated` in the task workers' `worker-lib.sh`, which
  does exactly that.

- **Changing anything that moves a performance's join key** (venue + date + time) — the
  browser caches `shows.min.json` and `availability.min.json` separately and joins them by that
  key, so a generation split breaks the join while both files are fresh by TTL.
  `join_fingerprint(master)` in `normalize.py`, mirrored as `joinFingerprint()` in
  `site/plan/lib/hydrate.js` and carried as the sidecar's `k`, is how `plan.js` detects the split
  and evicts both. Keep the two implementations agreeing (the self-test asserts it); a TTL bump
  doesn't cover this.

## The wire format

- **Adding or dropping an indexed wire field** — the day files and `shows.min.json` reference
  `site/data/venues.json`'s lists by position (`genre`, `room`, `subs`, `ts`; `g`, `rm`, `sg`,
  `ar`), with one producer and two decoders that change in the same commit: `scraper/normalize.py`
  (`build_lookups` / `build_day_files` / `minify_master` / `build_availability`),
  `site/js/app.js` `adaptShow`, and `site/plan/lib/hydrate.js` `rehydrateShows`.
  `edfringe-lookup-indices` catches an unresolved index but not a decoder reading the old key, so
  check both decoders by hand.

- **Changing a lookup list** — append only (`extend_lookup`), never reorder or drop: the browser
  decodes a days-old catalogue against a newer `venues.json`, and a moved entry relabels shows
  with no error anywhere. (lookup-lists-append)

- **Putting anything that changes through the day into `shows.min.json`** — don't: ticket status
  lives in `availability.min.json` so `refresh-tickets` rewrites it alone; in the catalogue it
  would tie that bulky download to the refresh and freeze availability in cached copies.
  `hydrate.test.mjs` asserts each wire performance carries only `d` and `s`. (shows-min-json)

- **Adding a plain wire key** (such as `pm` / `px`) — the same three files move, and the new key
  sits at the same position in `normalize_event`'s dict and `rehydrateShows`'s object literal:
  the round-trip test compares as JSON, so a key-order mismatch fails it and reads like a data
  bug.
