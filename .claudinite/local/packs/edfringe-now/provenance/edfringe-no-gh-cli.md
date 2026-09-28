## 2026-09-27 · born · the gh-invocation half of no-gh-cli, converted (item #925)
- **Source:** no-gh-cli.md.
- **Reason:** the gh CLI is not installed in this environment (re-verified 2026-09-24, `which gh`:
  none), so a command invoking it always fails a round-trip later than a check could have caught it.
- **Actor:** the prose-to-checks-sweep run, item #925.
- **Model:** Claude Sonnet 5
- **Mechanism:** a declared action-scope check (guardToolCalls) in declared-checks.json, blocking
  any Bash command invoking `gh`.
- **Retire when:** the environment ships a gh binary.

## 2026-09-28 · severity-changed · canon on-fail-rename migration
- **Reason:** the canon's on-fail-rename migration respelled every check's `severity:
  "blocking"|"advisory"` as `on_fail: "block"|"advise"`; this declared check's field moved with it.
- **Mechanism:** `.claudinite/shared/engine/migrations/2026-09-25-on-fail-rename/migration.mjs`'s
  codemod, applied by the scheduled `claudinite-lifecycle/update` task.
- **Actor:** claudinite-lifecycle/update (work item #943).
