# festival-update

Stage 3 of the data lifecycle (`docs/data-lifecycle.md`) for every festival but the Edinburgh
Fringe, whose own tasks keep its own pipeline.

It runs `python3 scraper/festivals/update.py`, which picks the editions that are upcoming or
live and due by how close they are, runs each one's tool set (its `sources` in
`festival.toml`) and converts it. Every file the run changed under `data/festivals/` and
`site/data/festivals/` is delivered on one pull request whose body lists each edition's
outcome. A run where a tool broke still delivers what the others fetched, then fails with
the broken editions named: the repair is in that festival's fetcher or parser.

A fetcher with nothing to fetch yet (the programme is not out, or the fetcher is a
placeholder) is reported as `not-ready`, not as a breakage.

A first fetch of a new edition adds raw files the data-directory allowlist does not name
yet; the pull request lists them, and it cannot land until they are named there.

Operator parameter, in the item's Context: `festival: <id>` runs that festival's upcoming
or live editions whatever their cadence.
