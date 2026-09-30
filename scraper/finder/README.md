# The festival finder

Stage 1 of the [data lifecycle](../../docs/data-lifecycle.md): the list of festivals we know
about, and the method for finding more. A festival qualifies for the site only when it
publishes a detailed per-session schedule (every show, screening, talk or race with its
date, start time and venue), so the finder records that for every festival it considers.

How a run works is the `festival-finder` skill. Runs happen on request, in a session with
open web access: the unattended task runner's network cannot reach the festival sites.

## The two lists, and why they only grow

| file | holds | grows by |
|---|---|---|
| `sources.toml` | where to look: aggregators, platforms, organisers, seed lists, search queries | every route that surfaced a candidate, and every lesson about using one |
| `candidates.toml` | every festival considered, qualifying or not | every festival a run checks |
| `runs/<date>.md` | one log per run: scope, yield per source, the searches that found nothing | one file per run |

Nothing is ever deleted from either list. A source that stops answering becomes `blocked`
or `dead` with a `note`; a festival that does not qualify becomes `rejected` with a
`reason`. Both stay, because the next run needs to know what was tried as much as what
worked. `finder.py --growth <ref>` fails a change that drops an entry.

## `sources.toml`

```toml
[[source]]
id = "indico"                  # lowercase-hyphen slug, what candidates' found_via names
name = "Indico"
category = "platform"          # aggregator | platform | organiser | seed-list | search-query | technique
url = "https://indico.cern.ch" # required except for search-query and technique
kinds = ["academic"]           # registry kinds, or ["any"]
regions = ["world", "IL"]      # ISO country codes, or "world"
per_session = "yes"            # does a hit imply a per-session schedule? yes | partial | no
machine_readable = "…"         # optional: the export endpoint pattern
how = "…"                      # what the next run needs to use it: queries, filters, traps
status = "active"              # active | blocked | dead (the last two say why in note)
note = "…"                     # optional
added = "2026-09-29"
checked = "2026-09-29"         # when a run last used it
```

## `candidates.toml`

```toml
[[candidate]]
id = "isfn-annual-meeting"     # the festival, not an edition
name = "…"
name_local = "…"               # optional: the festival's own-language name
kind = "academic"              # a registry kind
subtypes = ["academic-neuroscience"]   # optional, as festival.toml's
country = "IL"
city = "Eilat"                 # a watched candidate leaves it out until its venue is announced
site = "https://…"
programme = "https://…"        # optional: the per-session programme page
next_first = "2026-12-07"      # optional: the next edition, when known
next_last = "2026-12-09"
schedule = "published"         # published | partial | expected | none | unknown
schedule_evidence = "…"        # optional: one concrete session with date, time and room
platform = "eventact"          # optional: what hosts the programme
status = "candidate"           # candidate | watch | adopted | rejected
festival_id = "…"              # adopted only: the id under scraper/festivals/
reason = "…"                   # watch and rejected: why
recheck = "2026-11-01"         # watch only: when to look again
found_via = ["ortra-eventact"] # source ids
checked = "2026-09-29"
```

Every festival registered under `scraper/festivals/` has an `adopted` candidate, so this
list is the whole set of festival pointers. `finder.py --check` holds that and every field
above; `scripts/verify.sh` runs it.

```
python3 scraper/finder/finder.py --report
python3 scraper/finder/finder.py --check --growth origin/main
```
