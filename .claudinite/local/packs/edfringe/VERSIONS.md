# Version history

Record of automated corrections to this pack's `RULES.md`, one row per change — added going
forward from the row this file was introduced beside; earlier changes are not backfilled.

| Date | Task | What changed |
|---|---|---|
| 2026-08-23 | rule-revalidation | The `list_pull_requests` GitHub MCP call section was corrected: `merged_at` now populates with a real timestamp for a genuinely merged PR (reconfirmed live on #480, #472, #469, #466, #464), where it previously never populated at all. `merged` itself is still always `false`, so the recommended landed-ness checks (`pull_request_read get`, or grepping `origin/main` commit subjects) are unchanged. |
