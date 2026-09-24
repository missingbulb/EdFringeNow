## 2026-08-08 · born · Claudinite growth: extract lessons (d2026-08-08) (#278)
- **Source:** #275 and PR #274: `dateTime` is a real UTC instant, and slicing its digits shifted all
  60,115 performances an hour.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a rule in `edfringe-data`'s RULES.md, under the one-time-zone-crossing section.
- **Rejected:** a check - neither constrains a static, observable signature.
- **Landed:** #278, Refs #277

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-16 · reworded · path under site/ (#731)
- **Reason:** the published site moved into `site/`, so the paths it names moved with it.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Landed:** #731, Closes #730
