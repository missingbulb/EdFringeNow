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

## 2026-09-24 · retired · a basics check now enforces it
- **Reason:** basics' github-list-without-fields check fires on every mcp__github__list_* and
  search_* call with no fields, so the prose duplicates it; and on 2026-09-24 list_issues at perPage
  50 with no fields no longer overflowed on this repo's 10 open issues.
- **Actor:** @missingbulb (owner), asking for stale web facts to be deleted.
