## 2026-09-15 · born · Claudinite growth: extract lessons (#717)
- **Source:** the conversation logs captured 2026-09-06 and 2026-09-13/14.
- **Reason:** `perPage: 50` against about 29 open issues still overflowed on 2026-09-06, since each
  issue's full body counts.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Mechanism:** a RULES.md rule under "GitHub MCP call shapes that cost round-trips here".
- **Rejected:** a check - an external MCP tool's runtime behaviour, not a repo-tree signature.
- **Landed:** #717, Refs #713

## 2026-09-24 · retired · a basics check now enforces it
- **Reason:** basics' github-list-without-fields check fires on every mcp__github__list_* and
  search_* call with no fields, so the prose duplicates it; and on 2026-09-24 list_issues at perPage
  50 with no fields no longer overflowed on this repo's 10 open issues.
- **Actor:** @missingbulb (owner), asking for stale web facts to be deleted.
