## 2026-08-07 · born · Cache each data file for as long as its contents last (#252)
- **Source:** #249: the catalogue could only earn a long cache TTL by giving up the ticket status
  that changed in it hourly, so status moved to its own sidecar.
- **Reason:** the other invariant: the catalogue is held for days only because it now regenerates
  byte-identically over an unchanged festival.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** a rule in `edfringe-data`'s RULES.md, asserted per wire performance by
  `hydrate.test.mjs`.
- **Landed:** #252, Fixes #249

## 2026-08-12 · reworded · the ticket refresh is no longer hourly (#340)
- **Reason:** the rule named the hourly cadence of the refresh it points at.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Landed:** #340

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612
