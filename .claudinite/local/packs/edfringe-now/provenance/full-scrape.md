## 2026-09-24 · born · replaces the `Scrape edfringe shows (full)` workflow (#872)
- **Source:** the owner asked for every workflow to become a task.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5.5
- **Mechanism:** an agentless `trigger: request` task with a bash worker; the workflow's `if: false`
  kill switch becomes the `scraping-switched-on` precondition, so a created item declines visibly
  rather than fetching.
- **Rejected:** `taskScheduler.disabledTasks` as the switch - it stops the scheduler asking, not a
  hand-created item.
