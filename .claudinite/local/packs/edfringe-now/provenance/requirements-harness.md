## 2026-09-24 · born · the requirements-harness section of RULES.md, moved into a skill
- **Reason:** the owner chose to move the data-pipeline and harness sections out of RULES.md into
  skills ("Move data/harness to skills"), so they load only when their paths are edited; trimmed to
  trigger and action in the same move.
- **Actor:** @missingbulb (owner).
- **Mechanism:** a guidelines skill in the local pack, force-loaded on edits to
  product/requirements.md and product/requirements/; every rule it carries is needed while writing a
  leaf, a case, a fixture or a golden.
- **Rejected:** keeping it in RULES.md, paid for by every session including data-only ones.

## 2026-10-09 · trigger-changed · description cut to the 30-word limit
- **Reason:** `basics/skill-description-length` flagged the description as running past 30 words,
  which every session pays for whether the skill loads or not.
- **Actor:** @missingbulb (owner), asking for the open issues and findings to be cleaned up.
- **Mechanism:** the description keeps only what decides whether to reach for the skill; the
  force-load paths are unchanged.
