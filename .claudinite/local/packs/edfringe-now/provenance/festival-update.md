## 2026-10-02 · born · stage 3 of the data lifecycle, scheduled
- **Source:** the owner's ask to close the data lifecycle's gaps; stage 3 was built but run by hand.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5.5
- **Mechanism:** an agentless scheduled task, `schedule:at-most-daily` plus a local term over the
  generated editions plan, running `scraper/festivals/update.py`; which festivals are due is the
  worker's scope, tiered by proximity. Delivers on a superseding PR with automerge under the two
  festival data trees, so CI's allowlist and drift gates stand between a fetch and main.
- **Rejected:** pushing straight to main as the Fringe tasks do, since a first fetch of a new
  edition adds files the allowlist must name; an agentic task, since #970 showed the agent session's
  network denies festival hosts while code-work runs on the Actions runner.
