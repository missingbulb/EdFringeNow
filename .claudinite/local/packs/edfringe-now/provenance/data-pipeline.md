## 2026-09-24 · born · the data-pipeline section of RULES.md, moved into a skill
- **Reason:** the owner chose to move the data-pipeline and harness sections out of RULES.md into
  skills ("Move data/harness to skills"), so they load only when their paths are edited; trimmed to
  trigger and action in the same move.
- **Actor:** @missingbulb (owner).
- **Mechanism:** a guidelines skill in the local pack, force-loaded on edits under scraper/, data/,
  site/data/, scrape.yml, prices.yml and the site files that decode, price or time performances
  (app.js, clock.js, plan.js, hydrate.js, availability.js, price.js, data-cache.js); every rule it
  carries is needed while editing one of those.
- **Rejected:** keeping it in RULES.md, paid for by every session including UI-only ones.
