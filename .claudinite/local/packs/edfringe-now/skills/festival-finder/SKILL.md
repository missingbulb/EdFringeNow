---
name: festival-finder
description: A festival finder run - searching for festivals with a per-session programme and growing the lists of candidates and search sources. Use when asked to find more festivals or conferences.
metadata:
  body: workflow
  force-load-on-file-edits-paths:
    - "scraper/finder/**"
---

# A festival finder run

The finder's files and their fields are `scraper/finder/README.md`; this is how a run works
them. A festival qualifies only when it publishes a detailed per-session schedule: every
show, screening, talk or race with its date, start time and venue.

## Before searching

1. Read the yield of every source, the watched candidates whose recheck date has passed,
   and the candidates ready to adopt:

   ```
   python3 scraper/finder/finder.py --report
   ```

2. Read `candidates.toml` end to end before searching, so a hit is recognised as known
   rather than found twice. Read the last few `runs/` logs for what was tried and came up
   empty.

## The run

3. **Recheck what is due.** Every watched candidate past its `recheck`: fetch its programme
   URL, and move it to `candidate` (programme out), keep it watched with a new `recheck`, or
   reject it with the reason.
4. **Work the sources, best yield first**, favouring the scope the request names (a kind, a
   country, a window). `platform` sources come first: a festival found on Indico, Pretalx,
   Eventact, Eventive, Clashfinder or Eventer publishes a per-session schedule by
   construction. Then `organiser`, `aggregator`, `seed-list`, and last the `search-query`
   templates, filled in with the kind, country and year.
5. **Check every hit against the qualifying rule** with an exact fetch (`curl` into the
   scratchpad), not a summary: find one concrete session with its date, time and room, and
   write it as `schedule_evidence`. A programme not out yet is `schedule = "expected"`,
   watched, with a `recheck` a month before last year's publication date.
6. **Record every festival considered**, qualifying or not, as a `[[candidate]]`:
   `found_via` names the sources that surfaced it. A rejected candidate keeps its entry,
   so the next run does not check it again.

## Growing the method

7. **Every new route that surfaced a candidate becomes a `[[source]]`**: an aggregator, a
   platform and the URL pattern that enumerates its festivals, an organiser's events page,
   or the exact search query that worked. Put what the next run needs to use it in `how`.
8. **Correct the sources you used**: a new `checked` date, a `how` that says what you
   learned (a better query, a filter, a trap), and `blocked` or `dead` with a `note` for one
   that no longer answers. Never delete an entry from either list; `finder.py --growth`
   fails a run that does.
9. **Write the run's log**, `scraper/finder/runs/<YYYY-MM-DD>.md`: the scope, what each
   source yielded, the queries that found nothing, and what the next run should try first.

## Finishing

10. Check the lists, then open a pull request whose body lists the new candidates with a
    published programme first:

    ```
    python3 scraper/finder/finder.py --check --growth origin/main
    ```

    Adopting a candidate is separate work (stage 2 in `docs/data-lifecycle.md`); when a
    festival is registered under `scraper/festivals/`, its candidate turns `adopted` with
    its `festival_id` in the same change.
