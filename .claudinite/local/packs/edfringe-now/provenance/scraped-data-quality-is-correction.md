## 2026-09-26 · born · a scraped-data-quality report is a correction, not a feature (#906)
- **Source:** conversation-logs capture `pr-903` (growth-extract window, item #906): the owner
  opened with "The shows in the Acco festival aren't scraped properly... see where they provide
  better data" and the session classified it `feature`. It later self-caught the mislabel, but the
  basics rule that a classification "can't be taken back" left the Stop hook permanently red,
  costing a second `AskUserQuestion` round-trip (~3 minutes) to override.
- **Reason:** durable and cheap to fix at the source — the report shape ("X isn't scraped/priced
  properly, use Y instead") is a data-quality fix to the existing scrape, not new capability.
- **Mechanism:** one `RULES.md` bullet — the classification happens in the session's first reply,
  before any file-edit trigger could load a skill, so prose is the only carrier that fires there.
- **Retire when:** a scraped-data-quality report genuinely needs `feature`-path treatment (a new
  requirements leaf), which would mean this classification guidance was wrong, not just narrow.
- **Actor:** the growth-extract run, item #906.
