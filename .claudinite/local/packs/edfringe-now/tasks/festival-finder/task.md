# festival-finder worker

One run of the festival finder over every kind of festival and every country the
product serves, unless the Context narrows it.

1. Load the `festival-finder` skill (Skill tool) and follow it end to end.
2. Write only under `scraper/finder/`: `candidates.toml`, `sources.toml` and the run's log
   under `runs/`. Adopting a candidate as a festival is not this run's work.
3. A run that finds no new candidate still writes its log and its source corrections: the
   queries that found nothing are what keep the next run from repeating them.
4. Open a pull request with the change, following
   [deliver-pr.md](../../../../../shared/packs/claudinite-tasks/src/deliver/deliver-pr.md);
   its body lists the new candidates with a published per-session programme first. Never
   merge it.
