## 2026-08-10 · born · Executable UI/UX requirements (#316)
- **Source:** the owner's review passes on the executable spec and its harness, #313.
- **Reason:** found while making the version popup a real hover popup: the runner settles the scroll
  between `drive()` and `capture()`, and scrolling fires `mouseleave`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Fable 5
- **Mechanism:** a harness trap in `edfringe-requirements`' RULES.md.
- **Landed:** #316, Closes #313

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612
