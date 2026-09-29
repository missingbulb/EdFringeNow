# The data lifecycle

Every piece of data the site serves passes through the same four stages, each with its own
cadence and its own place in the repository. A lighter fifth cycle covers the cities that
host the festivals. This page is the map: each stage links to where it is built, and says
plainly where it is not built yet.

| # | Stage | Question it answers | Cadence | Where it lives | State |
|---|---|---|---|---|---|
| 1 | **Festival finder** | Which festivals exist that we could serve? | periodic runs; the method itself grows | [`scraper/finder/`](../scraper/finder/README.md) | built |
| 2 | **Festival tools** | For one festival's edition, which sites and APIs give us its data, and how? | once per edition, mostly reused year to year | `scraper/festivals/<dir>/festival.toml` and its `sources/` ([contract](../scraper/festivals/README.md)) | built per festival; per-edition tool sets not yet |
| 3 | **Festival update** | What is the programme now? | periodic until the programme settles; repaired when a tool breaks | `scraper/festivals/collect.py`, `scraper/convert/to_serving.py` | built, run by hand |
| 4 | **Events rapid refresh** | What is still on sale, and what changed? | frequent, during the festival and the weeks before it | Edinburgh Fringe only: the `refresh-tickets`, `refresh-shows` and `fetch-prices` tasks | Edinburgh only |
| C | **City cycle** | What else can a visitor do there: stay, eat, see, go on a trip? | slow; a city changes by the season | `scraper/cities/` | sights only |

## 1. Festival finder

The list of pointers to festivals, and the method for finding more. Two append-only lists:
where to look (`sources.toml`: aggregators, platforms, organisers, search queries) and what
was found (`candidates.toml`: every festival considered, with whether it publishes a
per-session programme and why it was adopted, watched or rejected). A run reads both, works
the sources, and writes back new candidates *and* new sources, so each run starts from
everything earlier runs learned. The `festival-finder` task runs it on a schedule; the
`festival-finder` skill is its procedure.

Output: a candidate with `schedule = "published"` is ready for stage 2. A festival only
qualifies when a detailed per-session schedule exists.

## 2. Festival tools

The near one-time research that learns how to get one festival's data: its programme site,
its ticketing platform, its venues, where the prices and availability live. It ends in a
`festival.toml` with its `[[source]]` entries, a fetcher and a pure parser per source with a
self-test on committed samples, and curated venue research. A tool a platform shares across
festivals (Eventer, Eventotron, Spektrix) lives once in `scraper/festivals/platforms/`.

Not built yet: sources are declared per festival, not per edition. A festival whose site or
ticketing platform changes between years has no way to say that 2026 used one tool set and
2027 another, beyond keeping the fetcher able to read both.

## 3. Festival update

Running the stage 2 tools to extract the festival's information: `collect.py` fetches every
source of an edition into `data/festivals/`, and `to_serving.py` converts the raw into the
serving block under `site/data/festivals/`. When a site changes and a tool breaks, the fix is
made in stage 2's tool and the update re-run. Fetchers run by hand, by the owner's decision.

## 4. Events rapid refresh

Ticket availability and show changes, refreshed often during the festival and in the weeks
before it. Built for the Edinburgh Fringe (hourly ticket status in season, show updates,
prices). For every other festival, availability is what the last stage 3 run saw.

## C. The city cycle

For each city that hosts a festival: where to stay, where to eat, what to see, which
excursions to take. Sights are built (`scraper/cities/`: OpenStreetMap and Wikidata, curated
opening hours). Hotels, restaurants and excursions are researched but not built: the product
wiki holds which listings and booking partners could supply them.
