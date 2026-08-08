# EdFringeNow — the data pipeline (scraper/ and data/)

The domain of this pack: getting show data out of edfringe.com and into the
committed files the site serves. Read it before touching `scraper/` or anything
under `data/`. The API's own field reference lives in
[scraper/SCRAPING.md](../../../../scraper/SCRAPING.md) and the file layout in
[scraper/README.md](../../../../scraper/README.md) — this is the working
judgment those two don't carry.

## The live API is unreachable from a session — don't try, and don't fake it

`edfringe-tikketr-web-api.equhost.com` is blocked by the sandbox egress proxy
(403 at the CONNECT). So: no session — this one included —
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
runner: that is CI as a side channel around the session's network rules.

For one-off API questions (a field's shape, an enum's value set, whether an
operation exists at all), `scraper/SCRAPING.md` is the reference. When it falls
short there is one legitimate source short of asking the owner:
**`www.edfringe.com` itself is reachable**, and its Next.js bundles carry the
client's complete GraphQL operation set — every query, mutation and fragment,
with full field selections. Recipe in SCRAPING.md ("Reaching it from a Claude
Code web session"). That is reading a public asset from an allowed host, and it
is how the "no bulk price endpoint" claim was finally settled. It tells you what
a query would look like, never what it returns — so a change checked only that
way is still unverified against live data and must be reported as such. If that
doesn't answer it either, ask the repo owner rather than building a bypass.

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

## A price belongs to a performance, not to a show

The same run sells at several prices: previews cheaper than the main run,
weekends dearer than weekdays. The first price pass didn't know that — it
called `performancePrices` for **one** performance per show and filed the answer
under the show. Pre-festival the performance it picked was almost always the
earliest, i.e. a preview, so **1,016 of 3,664 priced shows (28%) published their
cheapest night as their price**: Alfie Brown's £15/£16 run shipped as £8.50.

The fix is not a rule about previews, and adding a "skip previews" or
"price after date X" heuristic re-creates the same class of bug from a different
angle — it still picks one performance and hopes it represents the rest.
**Price every performance.** There is no bulk price *field*, but GraphQL aliases
make one request carry a whole show's run (`fetch_prices.prices_query`), so full
per-night pricing costs roughly the same ~3,700 requests as the old pass. There
is no call budget to economise against here, so don't design as if there were.

Which payload gets which number is the load-bearing distinction:

| payload | question it answers | price |
|---|---|---|
| master, `shows.min.json` (planner) | what does this *show* cost? | run-wide `priceMin`..`priceMax` |
| `data/days/*.json` (Now page) | what does it cost *tonight*? | that performance's own `pm` |

A performance the cache has no entry for gets **no `pm` at all** — "Price TBC" —
rather than the show's minimum. Borrowing a neighbouring night's figure is
exactly the bug above, and a lower bound presented as the price is a lie about
money even when every number in it is real.

## Prices are fetched once, and "unknown" is a third state the encoding must keep

`data/prices.json` is a fetch-once cache (`scraper/fetch_prices.py`), off the
nightly path: a show's price bands are set when it goes on sale, unlike its
ticket status. `refresh-shows` reads the cache and carries the amounts through
untouched — it never re-fetches them. So the festival keeps adding shows the
cache has never seen, and **a show with no price is a normal, permanent state of
the data**, not a gap the pipeline should close.

The cache carries two entry shapes and both must stay readable: current entries
have `sets` + `perfs` (per performance), and entries from the old pass have a
bare whole-show `min`/`max`. The migration completes one show per re-run, so
dropping the legacy shape — or emptying the cache to "start clean" — would blank
every price on the site until a full pass finished. `price_sets` reads both.

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

## The API stamps performances in UTC — cross the zone once, at the edge

The listing API's `dateTime` is a real UTC instant (`"2026-08-06T11:45:00.000Z"`),
**not** Edinburgh wall-clock with a decorative `Z`. Slicing the digits out of that
string is the trap: it looks like it works — every date and time in it is
plausible — and in August it is silently an hour wrong for the whole catalogue.
That is exactly what shipped, and what #275 cost to undo: 60,115 performances
listed an hour early, with the tell being shows that name their own time (a 10am
"Shakespeare for Breakfast" sitting at 09:00).

The pipeline has **one** time-zone crossing, and it is `normalize.local_date_start`.
`refresh_ticket_status.py` and `fetch_prices.py` share it so a performance is keyed
by the same local date and start everywhere. Everything written after it — the
master, `data/days/*.json`, `availability.min.json`, `shows.min.json` — is already
Edinburgh wall-clock, so **no stage downstream parses, converts, or re-offsets a
time**. Treating a stored value as UTC a second time is the same bug from the other
end.

Two consequences to hold on to when touching this:

- **A "now" compared against these times is read in Edinburgh too** — `js/clock.js`
  (`festivalNow` / `festivalDate`), never the device clock. A UK visitor cannot see
  the difference, which is why a device clock survives review; a visitor planning
  from another zone reintroduces the whole drift.
- **A conversion change is a full-snapshot change.** The committed data is generator
  output, so the fix is not complete until the master is rebuilt through the new
  conversion and every derived artifact regenerated from it. Shifting the boundary
  moves performances between day files (two late 31 Aug performances now fall into
  1 Sep, outside the August day files, and live only in the master and the planner's
  catalogue) — expect that and check it, rather than reading it as data loss.

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
**by position** (`genre`, `room`, `subs`, `ts`; `g`, `rm`, `sg`, `ar`). That
encoding has one producer and two decoders, and they must move together:

- producer — `scraper/normalize.py` (`build_lookups` / `build_day_files` /
  `minify_master` / `build_availability`)
- decoder 1 — `js/app.js` `adaptShow`, for the day files
- decoder 2 — `plan/lib/hydrate.js` `rehydrateShows`, the exact inverse of
  `minify_master`, round-tripped against the real committed files by
  `plan/lib/__tests__/hydrate.test.mjs`

Add or drop an indexed field and all three change in the same commit. That the
indices still *resolve* is enforced by the `edfringe-lookup-indices` check — it
catches a lookup list regenerated without its day files, but nothing can catch a
decoder left reading the old key, so check both decoders by hand.

Two properties of that encoding are load-bearing for caching, and both fail
silently:

- **The lookup lists are append-only** (`extend_lookup`). The browser holds
  `shows.min.json` for four days and `venues.json` for one, so a stale catalogue
  is routinely decoded against a newer lookup file. An entry that changed index
  would relabel shows' genres and rooms with no error anywhere. Entries are never
  dropped, even once the master stops using them.
- **`shows.min.json` carries nothing that changes through the day.** Ticket
  status lives in `availability.min.json` (its own status list, indexing into
  nothing, so the hourly refresh can rewrite it alone). Putting a status back in
  the catalogue would restart its hourly churn *and* freeze availability for
  anyone holding a cached copy — the bug in #249, re-created from the other end.
  `hydrate.test.mjs` asserts each wire performance carries only `d` and `s`.

The same three-way move applies to plain (non-indexed) wire keys such as the
price fields `pm` / `px`, with one extra hazard: the round-trip test compares the
rehydrated record to the master **as JSON**, so a new master key has to appear in
the *same position* in `normalize_event`'s dict and in `rehydrateShows`'s object
literal. Adding it in one place and appending it in the other fails the
round-trip on key order alone, which reads as a data bug and isn't one.
