## 2026-09-27 · born · the gh-invocation half of no-gh-cli, converted (item #925)
- **Source:** no-gh-cli.md.
- **Reason:** the gh CLI is not installed in this environment (re-verified 2026-09-24, `which gh`:
  none), so a command invoking it always fails a round-trip later than a check could have caught it.
- **Actor:** the prose-to-checks-sweep run, item #925.
- **Model:** Claude Sonnet 5
- **Mechanism:** a declared action-scope check (guardToolCalls) in declared-checks.json, blocking
  any Bash command invoking `gh`.
- **Retire when:** the environment ships a gh binary.
