## 2026-07-26 · born · Phase 3: cut over to the Claudinite per-repo task scheduler (#101)
- **Reason:** replaced "Refresh today's ticket status (hourly)" and its sixteen hand-spelled August
  cron lines.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** an hourly scheduler task in the `edfringe` pack, `agent_model: 'none'`, whose
  precondition acts only in August, 08:00-23:59 Edinburgh.
- **Landed:** #101, Refs missingbulb/Claudinite#394

## 2026-08-06 · policy-changed · push to origin HEAD:main explicitly (#235)
- **Reason:** diagnosed as `actions/checkout` leaving the branch with no upstream, failing the bare
  push and filing a needs-human issue (#231).
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** `worker.sh`.
- **Landed:** #235

## 2026-08-06 · policy-changed · return the checkout to main instead of forcing a refspec (#236)
- **Reason:** the run logs disproved #235's diagnosis: the real cause was an earlier task in the
  same scheduler run leaving the checkout on its own branch, and `HEAD:main` would have pushed that
  unreviewed commit straight to main.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** `worker.sh` returns to main before the scraper writes anything, then pushes bare.
- **Rejected:** the explicit `HEAD:main` refspec of #235.
- **Landed:** #236

## 2026-08-07 · policy-changed · the worker writes through the master, today to the end of the run (#252)
- **Source:** #249: the catalogue could only earn a long cache TTL by giving up the ticket status
  that changed in it hourly, so status moved to its own sidecar.
- **Reason:** it wrote only the day files, which the planner never loads, and stopped at today,
  leaving every later date frozen at the last full scrape.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** `worker.sh` writes statuses through the master and regenerates every derived file.
- **Landed:** #252, Fixes #249

## 2026-08-12 · policy-changed · once a day instead of hourly (#340)
- **Reason:** hourly through August put up to sixteen commits a day into main and expired every
  browser's day file as often, for a status that is a snapshot however often it is taken.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** cadence `daily+1h`, after refresh-shows' `daily` anchor; the 08:00-23:59 hours
  window dropped, since it would have gated the one daily evaluation out, and the August gate kept.
- **Landed:** #340

## 2026-08-23 · policy-changed · daily+1h retired for schedule_after (#472)
- **Reason:** the canon's task-declaration check retired `daily+1h`; the offset existed only to
  order this task after refresh-shows on a shared checkout.
- **Actor:** the Claudinite update run.
- **Mechanism:** `frequency: daily` with `schedule_after: edfringe/refresh-shows`.
- **Landed:** #472, Refs #471

## 2026-08-30 · policy-changed · turned off (#545)
- **Source:** the owner's request on #544 to turn off all the scraping tasks.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** `frequency: 'manual'`, the contract's off switch; the declaration test pins it so
  turning the task back on is a deliberate edit.
- **Landed:** #545, Closes #544

## 2026-09-02 · policy-changed · declare preconditions, not a precondition function (#586)
- **Source:** missingbulb/Claudinite#1617.
- **Reason:** the `precondition()` function form was retired fleet-wide so one mechanism decides
  every task.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** `in-festival`, this task's own term in `preconditions.mjs`: the gate reads the
  Edinburgh clock, which no shared term can express.
- **Landed:** #586

## 2026-09-03 · moved · task.mjs becomes task.json (#601)
- **Actor:** the Claudinite update run.
- **Mechanism:** a `task.json` declaration with a README beside it, written by the update.
- **Landed:** #601

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-11 · policy-changed · trigger and expected_outcome from the update (#670)
- **Actor:** the Claudinite update run.
- **Mechanism:** `trigger: schedule` in place of `frequency: manual`; `expected_outcome:
  no_code_changes`.
- **Landed:** #670

## 2026-09-16 · policy-changed · the worker stages both data roots (#731)
- **Reason:** the regeneration now writes both sides of the publish boundary.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** `worker.sh` stages `data/normalized` and `site/data`.
- **Landed:** #731, Closes #730
