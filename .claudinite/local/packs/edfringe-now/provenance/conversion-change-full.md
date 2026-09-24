## 2026-08-08 · born · Claudinite growth: extract lessons (d2026-08-08) (#278)
- **Source:** #275 and PR #274: `dateTime` is a real UTC instant, and slicing its digits shifted all
  60,115 performances an hour.
- **Reason:** a conversion fix moves performances between day files, which reads as data loss unless
  it is expected.
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
