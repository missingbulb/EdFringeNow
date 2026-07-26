# EdFringeNow — the data pipeline (scraper/ and data/)

The domain of this pack: getting show data out of edfringe.com and into the
committed files the site serves. Read it before touching `scraper/` or anything
under `data/`. The API's own field reference lives in
[scraper/SCRAPING.md](../../../../scraper/SCRAPING.md) and the file layout in
[scraper/README.md](../../../../scraper/README.md) — this is the working
judgment those two don't carry.

## The live API is unreachable from a session — don't try, and don't fake it

`edfringe-tikketr-web-api.equhost.com` is blocked by the sandbox egress proxy and
`edfringe.com` returns 403 to `WebFetch`. So: no session — this one included —
can verify a scraper change against live data. Anything that must touch the API
runs on a GitHub-hosted runner: the `Scrape edfringe shows (full)` workflow
(`.github/workflows/scrape.yml`), the `refresh-shows` / `refresh-tickets`
scheduled tasks, or the throwaway probe procedure in the `probe-edfringe-api`
skill. Never "verify" a scraper change by reasoning about what the API probably
returns — either run it on a runner, or say plainly that it is unverified.

`python3 scraper/normalize.py --selftest` is the one transform check that runs
offline (it is a step in `scripts/verify.sh`); it exercises
raw→master→day-file→`shows.min.json` on a fixture, so a normalizer change is
verifiable here even though a fetch change is not.

## `ticketStatus`, never the `soldOut` boolean

"Can I get a ticket" comes from the per-performance `ticketStatus`, not the
`soldOut` flag: a performance can be `soldOut: false` and still have nothing to
sell online (`NO_ALLOCATION_CONTACT_VENUE`). The site treats `SOLD_OUT` and
`NO_ALLOCATION_CONTACT_VENUE` as unavailable and everything else as available
(`NO_TICKETS_STATUSES` in `js/app.js`), and unknown means available. Any new
availability logic — client or scraper — keys off `ticketStatus`; `soldOut` is
carried through for display only.

## The committed data is generated output — regenerate it, never hand-edit it

`data/raw_pages/` is a git-ignored regenerable cache. `data/normalized/`,
`data/venues.json` and `data/days/` **are** committed, because the browser
fetches them — but they are still generator output. Fix the data by fixing
`scraper/normalize.py` and re-running it (`--merge` for a top-up, no flag for a
full rebuild from the raw cache); a hand-edit is silently overwritten by the next
`refresh-shows` run and leaves the bug in the generator.

## Changing the wire format is a four-file change

The day files and `shows.min.json` reference `data/venues.json`'s global lists
**by position** (`genre`, `room`, `subs`, `ts`; `g`, `rm`, `sg`, `ar`, `p[].t`).
That encoding has one producer and two decoders, and they must move together:

- producer — `scraper/normalize.py` (`build_lookups` / `build_day_files` /
  `minify_master`)
- decoder 1 — `js/app.js` `adaptShow`, for the day files
- decoder 2 — `plan/lib/hydrate.js` `rehydrateShows`, the exact inverse of
  `minify_master`, round-tripped against the real committed files by
  `plan/lib/__tests__/hydrate.test.mjs`

Add or drop an indexed field and all three change in the same commit. That the
indices still *resolve* is enforced by the `edfringe-lookup-indices` check — it
catches a lookup list regenerated without its day files, but nothing can catch a
decoder left reading the old key, so check both decoders by hand.
