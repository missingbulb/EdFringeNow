## 2026-09-21 · born · reconciling withdrawn shows (#295)
- **Reason:** edfringe stopped listing 9 shows the master still served with future dates and no way
  to buy a ticket; `--merge` never deleted anything, so a withdrawal was invisible forever. The
  completeness-signal design is the whole risk: a partial pass (a recently-added top-up, a capped or
  partly-failed walk) read as complete would delete real shows, so reconciliation refuses without an
  explicit "this pass walked the whole listing" signal from the walker itself.
- **Actor:** missingbulb (owner decision, 2026-09-21 comment on #295) — implemented by the
  `implement-request` task.
- **Model:** claude-opus-5
- **Mechanism:** prose bullet in this pack's RULES.md, distilled from `scraper/fetch_shows.py`
  (`fetch_completeness`, `fetch_manifest.json`) and `scraper/normalize.py` (`reconcile_withdrawn`,
  `active_shows`, `load_fetch_manifest`) — no check owns it; the behaviour is proved by
  `normalize.py --selftest` and `hydrate.test.mjs`, not a repo-scanning rule.
- **Landed:** #295
