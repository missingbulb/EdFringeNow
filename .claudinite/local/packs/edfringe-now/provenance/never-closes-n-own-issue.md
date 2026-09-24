## 2026-09-21 · born · widened from queue items alone after two same-day repeats (#695, #295)
- **Source:** the rule already stood in prose since 2026-09-06 (#633, a bot-filed
  `[claudinite-work]` PR's `Closes #633`), scoped to that one shape of item. On 2026-09-21 two
  independent sessions made the identical slip on a different shape — a person's own marked ad-hoc
  issue: `Closes #695` in PR #823, and `Closes #295` in PR #824. Both were self-caught and fixed
  before merge, but by the session's own diligence rather than by the rule, which named only the
  bot-filed case.
- **Reason:** the failure is one mechanism (GitHub's native auto-close racing `converge-item.mjs`)
  that applies to any work item's own issue, not only the queue-filed kind; a rule scoped to one
  shape leaves the other unguarded until a session happens to remember the general framework
  instruction on its own. Restructured into the pack's tracked bullet form in the same change so it
  gets a provenance file and stays reviewable.
- **Actor:** growth-extract (missingbulb/EdFringeNow#826).
- **Model:** claude-opus-5
- **Mechanism:** prose in the local pack's RULES.md — the discriminator (is this number the
  running session's own work-item issue, or a different issue this PR legitimately closes) needs the
  session's own context, which no static scan of the repo tree carries, so a check was considered
  and rejected as unreliably false-positive-prone against the many PRs that correctly close a
  different issue with `Closes #N`.
- **Rejected:** a `guardToolCalls` action check on `create_pull_request`/`update_pull_request`
  matching any `Closes #<n>` — it cannot tell the item's own issue number from any other issue
  number without session context, so it would fire on ordinary, correct PRs just as often as on the
  real mistake.
- **Retire when:** never — the two 2026-09-21 repeats show the underlying framework instruction
  alone isn't sufficient; retire only if the delivery tooling itself starts rejecting a `Closes #N`
  aimed at the running work item's own issue.
- **Landed:** #826

## 2026-09-24 · reworded · trimmed to trigger and action
- **Reason:** the owner asked to trim rule prose to zero story ("Trim to zero, unless crucial to
  understand severity"); the incident history lives on this file.
- **Actor:** @missingbulb (owner).
