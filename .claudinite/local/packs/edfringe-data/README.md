# edfringe-data

EdFringeNow's data-pipeline pack: the edfringe.com scrape (`scraper/`) and the
committed data layer it produces (`data/`). Split out of the general `edfringe`
local pack because it activates on a different trigger — touching the scraper or
the data files, not the UI — and carries this repo's external-API and wire-format
knowledge.

| Section | How enforced |
|---|---|
| Live API unreachable from a session | prose + `probe-edfringe-api` skill |
| `ticketStatus`, not `soldOut` | prose |
| Committed data is generated output | prose |
| Wire format is a four-file change | check `edfringe-lookup-indices` + prose |

## The check

`edfringe-lookup-indices` (`lookup-indices.mjs`) asserts that every positional
reference in the committed wire files resolves inside `data/venues.json`'s lookup
lists: the day files' `genre` / `room` / `subs` / `ts` and `shows.min.json`'s
`g` / `rm` / `sg` / `ar` / `p[].t` (`-1` is the producer's "unknown" and passes).
It is dependency-free — it returns plain finding objects rather than importing
the vendored engine's helpers, so it loads without the mount. Its red-first
fixture is `pack.test.mjs`, run by `npm test` / `scripts/verify.sh`; the last
fixture runs the rule over this repo's real committed data, so the check is a
live gate on every scrape commit and not just a unit test of itself.

Distilled from this repo: `scraper/normalize.py` (`build_lookups`,
`build_day_files`, `minify_master`), `scraper/refresh_ticket_status.py`,
`scraper/SCRAPING.md`, `scraper/README.md`, `js/app.js` (`adaptShow`,
`NO_TICKETS_STATUSES`), `plan/lib/hydrate.js`, `.github/workflows/scrape.yml`,
`.gitignore`.
