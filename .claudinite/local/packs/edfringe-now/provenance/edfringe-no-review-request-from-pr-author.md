## 2026-09-26 · born · a review request naming the repo's own author always fails on GitHub's side (#906)
- **Source:** conversation-logs captures for PR #874, #875, #896, #897, #902, #904 (growth-extract
  window, item #906): the identical `update_pull_request`/`create_pull_request` call with
  `reviewers: ["missingbulb"]` recurred across six independent sessions, each hitting GitHub's own
  "Review cannot be requested from pull request author" rejection — every PR here is opened under
  that one account.
- **Reason:** a 100%-predictable, zero-value call a future session can skip entirely; deterministic
  enough for an action guard rather than prose.
- **Mechanism:** a declared action-scope check (`declared-checks.json`, `scope: "action"`,
  `guardToolCalls` on `create_pull_request`/`update_pull_request` matching `reviewers` for
  "missingbulb") — blocks the call at PreToolUse and names the fix (assign instead, or leave
  reviewers empty).
- **Actor:** the growth-extract run, item #906.

## 2026-09-28 · severity-changed · canon on-fail-rename migration
- **Reason:** the canon's on-fail-rename migration respelled every check's `severity:
  "blocking"|"advisory"` as `on_fail: "block"|"advise"`; this declared check's field moved with it.
- **Mechanism:** `.claudinite/shared/engine/migrations/2026-09-25-on-fail-rename/migration.mjs`'s
  codemod, applied by the scheduled `claudinite-lifecycle/update` task.
- **Actor:** claudinite-lifecycle/update (work item #943).
