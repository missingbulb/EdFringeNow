## 2026-08-17 · born · Claudinite growth: extract lessons (#391)
- **Source:** #372 and #237.
- **Reason:** 28+ calls carrying `fields` or `minimal_output` across the corpus never overflowed.
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
