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
runs through a sanctioned workflow: the `Scrape edfringe shows (full)` workflow
(`.github/workflows/scrape.yml`), `Fetch ticket prices (one-off)`
(`prices.yml`), or the `refresh-shows` / `refresh-tickets` scheduled tasks.
Never "verify" a scraper change by reasoning about what the API probably
returns — either have a sanctioned workflow run it, or say plainly that it is
unverified.

The egress block is a **policy boundary, not an obstacle to route around**. Do
not create ad-hoc GitHub Actions workflows — push-triggered "probes" or
anything else — to reach the API (or any blocked host) from an open-network
runner. This repo once had a `probe-edfringe-api` skill codifying exactly that;
it was retired: it used CI as a side channel around the session's network rules
and littered the Actions tab with orphaned workflow registrations. Everything
past probes learned is recorded in `scraper/SCRAPING.md`; if the answer to an
API question isn't there, ask the repo owner rather than building a bypass. The
`edfringe-workflows-allowlisted` check enforces this: every file under
`.github/workflows/` must be on its named allowlist.

`python3 scraper/normalize.py --selftest` is the one transform check that runs
offline; it exercises raw→master→day-file→`shows.min.json` on a fixture, so a
normalizer change is verifiable here even though a fetch change is not. Because
it is the only offline verification a scraper change can get, it must stay wired
into `scripts/verify.sh` — the `edfringe-normalizer-selftest-in-verify` check
enforces that (a step *label* naming the self-test does not count; only a command
line does).

## `ticketStatus`, never the `soldOut` boolean

"Can I get a ticket" comes from the per-performance `ticketStatus`, not the
`soldOut` flag: a performance can be `soldOut: false` and still have nothing to
sell online (`NO_ALLOCATION_CONTACT_VENUE`). The site treats `SOLD_OUT` and
`NO_ALLOCATION_CONTACT_VENUE` as unavailable and everything else as available
(`NO_TICKETS_STATUSES` in `js/app.js`), and unknown means available. Any new
availability logic — client or scraper — keys off `ticketStatus`; `soldOut` is
carried through for display only.

## Prices are fetched once, and "unknown" is a third state the encoding must keep

`data/prices.json` is a fetch-once cache (`scraper/fetch_prices.py`), off the
nightly path: a show's price bands are set when it goes on sale, unlike its
ticket status. `refresh-shows` reads the cache and carries the amounts through
untouched — it never re-fetches them. So the festival keeps adding shows the
cache has never seen, and **a show with no price is a normal, permanent state of
the data**, not a gap the pipeline should close.

Which means the encoding carries three states, not two, and every stage has to
preserve the distinction:

| state | master | wire |
|---|---|---|
| costs nothing | `priceMin: 0` | `pm: 0` |
| priced | `priceMin: 22.5` | `pm: 22.5` |
| unknown | `priceMin: null` | no `pm` key at all |

`priceMin: 0` and `free: true` are **not** the same claim and don't always agree.
The flag comes from the listing; the £0 can also come from the price API, which
returns a single `Price band 1` at £0.00 for a handful of shows the listing
doesn't flag free — pay-what-you-want, or a box office that never set a price
(10 of 3,664 in the first full run). Both readings are honest about what a ticket
costs, so the price path keys off `priceMin`, and `free` stays what the *listing*
said. Don't "fix" one to match the other.

Never encode unknown as `0`, and never let a decoder default it to one: a stage
that collapses three states into two is lying about money, and nothing
downstream can recover the difference. What the site then *does* with an unknown
price is a product decision, not a pipeline one — it lives in `shared/price.js`.

Two traps in the raw price payload, both already handled and both worth not
re-introducing: amounts arrive as **strings**, and nearly every show carries a
£0.00 "Personal Assistant" concession (a carer's companion ticket) that must not
be read as the cheapest price. See the pricing section of
[scraper/SCRAPING.md](../../../../scraper/SCRAPING.md).

## The committed data is generated output — regenerate it, never hand-edit it

`data/raw_pages/` is a git-ignored regenerable cache. `data/normalized/`,
`data/venues.json` and `data/days/` **are** committed, because the browser
fetches them — but they are still generator output. Fix the data by fixing
`scraper/normalize.py` and re-running it (`--merge` for a top-up, no flag for a
full rebuild from the raw cache); a hand-edit is silently overwritten by the next
`refresh-shows` run and leaves the bug in the generator.

`data/prices.json` is the one exception, and it is an exception to the *direction*
rather than the rule: it is committed, but it is normalize.py's **input**, written
by `scraper/fetch_prices.py`. Nothing regenerates it on a schedule, so nothing
overwrites a hand-edit either — which is precisely why editing it by hand is still
wrong: the edit survives, silently disagreeing with the box office forever. Re-run
the fetch. The `edfringe-data-dir-is-generator-output` check allows it **by name**,
so a second file can't ride in on its shape.

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

The same three-way move applies to plain (non-indexed) wire keys such as the
price fields `pm` / `px`, with one extra hazard: the round-trip test compares the
rehydrated record to the master **as JSON**, so a new master key has to appear in
the *same position* in `normalize_event`'s dict and in `rehydrateShows`'s object
literal. Adding it in one place and appending it in the other fails the
round-trip on key order alone, which reads as a data bug and isn't one.
