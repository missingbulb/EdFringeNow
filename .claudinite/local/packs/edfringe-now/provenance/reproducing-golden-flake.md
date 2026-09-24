## 2026-08-20 · born · Claudinite growth: extract lessons (#420)
- **Source:** #335.
- **Reason:** a byte-hash repro found a difference that `compare.js` passed at 0 pixels: it is
  stricter than what CI enforces, so it manufactures false positives.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a harness trap in `edfringe-requirements`' RULES.md.
- **Rejected:** a check - runtime, tool or process behaviour with no static signature.
- **Landed:** #420, Closes #419

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-24 · moved · into the requirements-harness skill
- **Reason:** the owner chose to move the data-pipeline and harness sections out of RULES.md into
  skills ("Move data/harness to skills"), so they load only when their paths are edited; trimmed to
  trigger and action in the same move.
- **Actor:** @missingbulb (owner).
- **Mechanism:** a guideline of the requirements-harness skill, force-loaded on edits to
  product/requirements.md and product/requirements/.
