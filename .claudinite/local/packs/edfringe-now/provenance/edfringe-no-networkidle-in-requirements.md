## 2026-10-11 · born · ready-networkidle converted (item #1099)
- **Source:** ready-networkidle, converted by the prose-to-checks sweep (item #1099).
- **Reason:** waiting on `networkidle` in the requirements harness is an always-visible token in the
  harness sources; the tree carries none today, so the check lands silent. Seen to fire on a copy of
  the tree with the token added to case-helpers.js.
- **Actor:** the prose-to-checks-sweep run, item #1099.
- **Model:** Claude Sonnet 5
- **Mechanism:** a declared world check in declared-checks.json, blocking from 2026-10-25 after the
  grace window.
