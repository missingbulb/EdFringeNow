## 2026-08-17 · born · Claudinite growth: extract lessons (#391)
- **Source:** #372 and #237.
- **Reason:** it read PR #385 as `merged: false` while that PR's squash was already `origin/main`'s
  head.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a RULES.md rule under "GitHub MCP call shapes that cost round-trips here".
- **Rejected:** a check - it constrains runtime tool behaviour, with no static signature in the
  tree.
- **Landed:** #391, Refs #389

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-13 · reworded · merged_at is populated (#694)
- **Source:** live re-probes on 2026-09-13.
- **Reason:** retested on three merged PRs (#682, #676, #670): `merged` still decodes `false`, but
  `merged_at` is populated every time.
- **Actor:** the rule-revalidation run, merged by @missingbulb (owner).
- **Landed:** #694, Refs #687
