# festival-refresh

Stage 4 of the data lifecycle (`docs/data-lifecycle.md`), the rapid refresh, for every
festival but the Edinburgh Fringe, whose `refresh-tickets` and `refresh-shows` keep their
own path.

It runs `python3 scraper/festivals/update.py --refresh`: for each edition whose tool set
holds a fetched source with the `availability` role (Eventer, Spektrix, Eventotron, a
festival's own ticketing API), from three weeks before it opens until it closes, it re-runs
those tools and converts the edition. It asks at every scheduler tick while any such edition
is in its window.

A run whose fetches found nothing new except their fetch times delivers nothing. Otherwise
every changed file is delivered on one pull request, and a broken tool fails the run with
the edition named, as `festival-update` does.

Operator parameter, in the item's Context: `festival: <id>` limits the run to that festival.
