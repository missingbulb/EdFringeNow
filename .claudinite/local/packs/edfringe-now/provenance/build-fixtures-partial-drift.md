## 2026-09-21 · born · a reverted script edit still drifted a committed fixture (#314)
- **Source:** the #314 implement-request session (2026-09-21T21:xx, cache-manifest work): to check
  whether `build-fixtures.js` needed a matching change, the session edited and ran it once, planning
  to discard the edit; the run wrote a partial update into
  `product/requirements/shared/fixtures/data/` before an unrelated crash, then the script edit
  itself was reverted. Caught only by a final `git status`/`git diff --stat` pass before committing,
  which was already the session's own habit rather than anything the rule set required.
- **Reason:** the standing fixture-freeze rule already says a deliberate re-baselining run needs
  owner approval, but nothing said an exploratory or aborted invocation still writes to the same
  tree and can leave it silently inconsistent — a gap this session's own discipline happened to
  cover, not a guarantee the rule gave it.
- **Actor:** growth-extract (missingbulb/EdFringeNow#826).
- **Model:** claude-opus-5
- **Mechanism:** prose in the local pack's RULES.md, beside the existing fixture-freeze bullets —
  the moment it must be read (about to invoke the script) is a judgment call no check can catch,
  since the tree looking clean depends on whether anyone thought to check the right directory.
- **Retire when:** `build-fixtures.js` is changed to write atomically (e.g. to a temp location,
  swapped in only on a clean exit) so a crash mid-run can no longer leave partial drift.
- **Landed:** #826
