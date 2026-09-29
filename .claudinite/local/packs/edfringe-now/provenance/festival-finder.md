## 2026-09-29 · born · the festival finder's run procedure and its monthly task
- **Source:** the owner's ask for a self-growing festival finder whose search method only grows
  (project thread "Self-growing festival finder").
- **Reason:** a run must read what earlier runs learned and write back new sources as well as new
  candidates, interactively and on a schedule alike.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5.5
- **Mechanism:** a workflow skill, force-loaded on edits under scraper/finder/, and a scheduled
  agentic task (monthly, opus, automerge under scraper/finder/) whose task.md loads it; the lists'
  shape and append-only growth are held by finder.py --check --growth in verify.sh.
- **Rejected:** a RULES.md bullet, paid for by every session; a code-only task, since searching and
  judging a programme needs an agent.
