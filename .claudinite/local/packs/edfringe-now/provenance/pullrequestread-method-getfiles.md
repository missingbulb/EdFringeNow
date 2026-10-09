## 2026-08-20 · born · Claudinite growth: extract lessons (#420)
- **Source:** #303.
- **Reason:** PR #207 (46 files) blew the token limit on `get_files` at `perPage: 100`.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a RULES.md rule under "GitHub MCP call shapes that cost round-trips here".
- **Rejected:** a check - runtime, tool or process behaviour with no static signature.
- **Landed:** #420, Closes #419

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-13 · reworded · retry at a smaller perPage (#694)
- **Source:** live re-probes on 2026-09-13.
- **Reason:** PR #207 still overflows at `perPage: 100`, but `perPage: 10` returned.
- **Actor:** the rule-revalidation run, merged by @missingbulb (owner).
- **Landed:** #694, Refs #687

## 2026-09-24 · reaffirmed · still overflows at perPage 100
- **Source:** 2026-09-24: get_files on #207 at perPage 100 returned 174,207 characters and
  overflowed.
- **Actor:** @missingbulb (owner).
