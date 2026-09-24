## 2026-08-07 · born · Cache each data file for as long as its contents last (#252)
- **Source:** #249: the catalogue could only earn a long cache TTL by giving up the ticket status
  that changed in it hourly, so status moved to its own sidecar.
- **Reason:** one of the two invariants the per-file caching rests on, silent if broken: a
  four-day-old catalogue is decoded against a `venues.json` fetched today.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** a rule in `edfringe-data`'s RULES.md, the invariant tested in the same change.
- **Landed:** #252, Fixes #249

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612
