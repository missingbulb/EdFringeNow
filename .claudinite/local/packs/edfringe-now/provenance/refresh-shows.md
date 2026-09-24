## 2026-07-26 · born · Phase 3: cut over to the Claudinite per-repo task scheduler (#101)
- **Reason:** the repo schedules itself through the vendored scheduler, so the "Refresh edfringe
  shows (daily)" workflow and its cron became this task.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a daily scheduler task in the `edfringe` pack, `agent_model: 'none'`: the work is
  deterministic, so it runs as a bounded subprocess with no agent, a failure converging to one
  needs-human issue.
- **Landed:** #101, Refs missingbulb/Claudinite#394

## 2026-08-06 · policy-changed · push to origin HEAD:main explicitly (#235)
- **Reason:** diagnosed as `actions/checkout` leaving the branch with no upstream, failing the bare
  push (#141).
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
- **Mechanism:** the declarative `none`: upstream show edits leave no trace in this repo, so the
  task stays ungated.
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
- **Mechanism:** `trigger: request` in place of `frequency: manual` and its `none` precondition;
  `expected_outcome: no_code_changes`.
- **Landed:** #670

## 2026-09-16 · policy-changed · the worker stages both data roots (#731)
- **Reason:** the regeneration now writes both sides of the publish boundary.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** `worker.sh` stages `data/normalized` and `site/data`.
- **Landed:** #731, Closes #730
