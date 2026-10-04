## 2026-09-24 · born · given a file of its own from an unmarked section
- **Source:** the unmarked RULES.md section "Watching a workflow or scheduler run", whose history is
  in git before this date.
- **Reason:** the owner deleted the local polling section ("Delete the local section"); the
  gh-not-installed fact outlived it, re-verified on 2026-09-24 (which gh: none).
- **Actor:** @missingbulb (owner).
- **Mechanism:** a rule in the local pack's RULES.md; nothing a file edit predicts brings a session
  to it, so it stays prose.

## 2026-09-27 · converted · the gh-invocation half, into a check (item #925)
- **Reason:** invoking `gh` is a Bash tool call's input, judged before it runs — guardToolCalls
  covers it. Deletion test: the bullet also carries "never suppress a poll condition's stderr", a
  second rule the check cannot see — kept whole rather than trimmed.
- **Actor:** the prose-to-checks-sweep run, item #925.
- **Model:** Claude Sonnet 5
- **Mechanism:** edfringe-no-gh-cli, a declared action-scope check on the Bash tool.

## 2026-10-04 · reworded · gh is installed; claim narrowed to its auth (item #1016)
- **Reason:** revalidation (item #1016) found `gh` 2.89.0 at /usr/local/bin/gh, so "not installed"
  was stale; `gh auth status` reports the GH_TOKEN invalid, though a read-only `gh api` call
  returned. The rule and check now claim only that gh is not wired to the session's GitHub access,
  and the check still blocks.
- **Actor:** the rule-revalidation run, item #1016.
- **Model:** Claude Sonnet 5
