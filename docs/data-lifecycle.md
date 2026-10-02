# The data lifecycle

Every piece of data the site serves passes through the same four stages, each with its own
cadence and its own place in the repository. A lighter fifth cycle covers the cities that
host the festivals. This page is the map: each stage links to where it is built, and says
plainly where it is not built yet.

| # | Stage | Question it answers | Cadence | Where it lives | State |
|---|---|---|---|---|---|
| 1 | **Festival finder** | Which festivals exist that we could serve? | on request; the method itself grows | [`scraper/finder/`](../scraper/finder/README.md) | built |
| 2 | **Festival tools** | For one festival's edition, which sites and APIs give us its data, and how? | once per edition, mostly reused year to year | `scraper/festivals/<dir>/festival.toml`: its `[[source]]` tool library and each edition's `sources`, plus `sources/` and `platforms/` ([contract](../scraper/festivals/README.md)) | built per edition |
| 3 | **Festival update** | What is the programme now? | daily from two weeks out, weekly from two months, monthly before; repaired when a tool breaks | `scraper/festivals/update.py` and the `festival-update` task | built, scheduled |
| 4 | **Events rapid refresh** | What is still on sale, and what changed? | every scheduler tick, from three weeks before an edition until it closes | `update.py --refresh` and the `festival-refresh` task; for the Fringe, its `refresh-tickets`, `refresh-shows` and `fetch-prices` tasks | built, scheduled; Fringe tasks off |
| C | **City cycle** | What else can a visitor do there: stay, eat, see, go on a trip? | slow; a city changes by the season | `scraper/cities/` | built (stay, eat, see, day trips), run by hand |

## 1. Festival finder

The list of pointers to festivals, and the method for finding more. Two append-only lists:
where to look (`sources.toml`: aggregators, platforms, organisers, search queries) and what
was found (`candidates.toml`: every festival considered, with whether it publishes a
per-session programme and why it was adopted, watched or rejected). A run reads both, works
the sources, and writes back new candidates *and* new sources, so each run starts from
everything earlier runs learned. A run happens on request, in a session with open web access;
the `festival-finder` skill is its procedure.

Output: a candidate with `schedule = "published"` is ready for stage 2. A festival only
qualifies when a detailed per-session schedule exists.

## 2. Festival tools

The near one-time research that learns how to get one festival's data: its programme site,
its ticketing platform, its venues, where the prices and availability live. It ends in a
`festival.toml` with its `[[source]]` entries, a fetcher and a pure parser per source with a
self-test on committed samples, and curated venue research. A tool a platform shares across
festivals (Eventer, Eventotron, Spektrix) lives once in `scraper/festivals/platforms/`.

Each edition names its whole tool set (`sources` on its `[[edition]]`), chosen from the
festival's `[[source]]` library: a festival whose site or ticketing platform changes between
years adds the new tool as a source only the new edition lists. `registry.py --check` refuses
an edition that names none; `migrate_edition_tools.py` gives a `festival.toml` written before
tool sets existed its current set.

## 3. Festival update

Running the stage 2 tools to extract the festival's information: `update.py` picks every
edition that is upcoming or live and due, fetches its tool set into `data/festivals/` and
converts the raw into the serving block under `site/data/festivals/` (`collect.py` is the
same for one edition, by hand). The `festival-update` task runs it daily in GitHub Actions
and delivers the result on a pull request; each edition comes out `updated`, `not-ready` (its
programme is not out) or `broken`, and a broken one fails the run with the festival named.
The fix is made in stage 2's tool and the update re-run.

## 4. Events rapid refresh

Ticket availability and show changes, refreshed often during the festival and in the weeks
before it. For every festival whose edition has a tool carrying availability (a source with
the `availability` role: Eventer, Spektrix, Eventotron, a festival's own ticketing API), the
`festival-refresh` task re-runs those tools at every scheduler tick from three weeks before
the edition opens until it closes. A festival with no such tool keeps the availability its
last stage 3 run saw. The Edinburgh Fringe keeps its own tasks (ticket status, show updates,
prices), currently switched off.

## C. The city cycle

For each city that hosts a festival: where to stay, where to eat, what to see, which
excursions to take. All four are built (`scraper/cities/`, whose README is the contract) for
every city the festival registry places a festival in, and run by hand:

- **stay** and **eat**: hotels, guest houses, hostels, motels and restaurants from
  OpenStreetMap (ODbL), a short list of each ranked by how many of the city's festival venues
  are a walk away;
- **see**: museums, galleries, gardens, markets, viewpoints and landmarks from OpenStreetMap,
  ranked by Wikidata (CC0), with curated opening hours where OpenStreetMap has none;
- **day trips**: the destinations of the city's Wikivoyage guide (CC BY-SA), nearest first.

The festival planner shows them under its calendar for the trip's city, and credits the sources
in its footer. Not built: booking or availability for any of them (the product wiki holds which
booking partners could supply it), day trips from a guide whose "Go next" is prose rather than a
list, and a refresh cadence: a city's lists are as fresh as their last hand run.
