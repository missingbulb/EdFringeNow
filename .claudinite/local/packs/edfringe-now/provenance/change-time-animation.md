## 2026-08-10 · born · Executable UI/UX requirements (#316)
- **Source:** the owner's review passes on the executable spec and its harness, #313.
- **Reason:** the owner's third review pass turned leaves 2.2 and 3.4 from stitched strips into
  animated goldens: a flow is shown as a flow.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Fable 5
- **Mechanism:** a rule in `edfringe-requirements`' RULES.md.
- **Landed:** #316, Closes #313

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
