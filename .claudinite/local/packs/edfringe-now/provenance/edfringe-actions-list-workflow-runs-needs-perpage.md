## 2026-09-27 · born · converted from actionslist-listworkflowruns-overflows (item #925)
- **Source:** actionslist-listworkflowruns-overflows.md.
- **Reason:** a list_workflow_runs call with no perPage has overflowed the tool-result limit every
  time it's been tried, down to perPage 1 (#391, reaffirmed #694, #877ish 2026-09-24).
- **Actor:** the prose-to-checks-sweep run, item #925.
- **Model:** Claude Sonnet 5
- **Mechanism:** a declared action-scope check (guardToolCalls) in declared-checks.json, requiring
  `perPage` whenever `method` is `list_workflow_runs`.
- **Retire when:** actions_list stops overflowing without perPage, or the tool enforces a page size
  itself.

## 2026-09-28 · severity-changed · canon on-fail-rename migration
- **Reason:** the canon's on-fail-rename migration respelled every check's `severity:
  "blocking"|"advisory"` as `on_fail: "block"|"advise"`; this declared check's field moved with it.
- **Mechanism:** `.claudinite/shared/engine/migrations/2026-09-25-on-fail-rename/migration.mjs`'s
  codemod, applied by the scheduled `claudinite-lifecycle/update` task.
- **Actor:** claudinite-lifecycle/update (work item #943).
