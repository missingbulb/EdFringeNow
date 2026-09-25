## 2026-09-24 · born · replaces the `Fetch ticket prices (one-off)` workflow (#872)
- **Source:** the owner asked for every workflow to become a task.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5.5
- **Mechanism:** an agentless `trigger: request` task behind `scraping-switched-on`. The full pass
  (~2.6h) cannot fit the executor's one-hour leash, so the worker prices for a time budget
  (`fetch_prices.py --time-budget`), commits, and requeues its own item while shows remain.
- **Rejected:** keeping a dispatch-only workflow for the long pass - two edit sites for one job.
