## 2026-09-24 · born · replaces the `raw-probe` job of the prices workflow (#872)
- **Source:** the owner asked for every workflow to become a task.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5.5
- **Mechanism:** an agentless `trigger: request` task, deliberately outside the scraping switch as
  the job was; its output lands in the run log in place of the step summary and artifact.
