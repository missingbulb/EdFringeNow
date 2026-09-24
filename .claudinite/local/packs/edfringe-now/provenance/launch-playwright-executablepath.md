## 2026-07-27 · born · Claudinite growth: conversation extract (#124)
- **Source:** the nine captured conversation logs, sessions #71, #82, #89, #90 and #98.
- **Reason:** about 220s of browser-path discovery and sed fix-up across five sessions, each
  re-deriving that `PLAYWRIGHT_BROWSERS_PATH` is already exported and that a named import from the
  CJS `index.js` yields `undefined`; verified live in the extracting session.
- **Actor:** the conversation-extract run, merged by @missingbulb (owner).
- **Mechanism:** a RULES.md rule in the "Verifying UI changes visually" section.
- **Landed:** #124, Refs #117

## 2026-08-07 · reworded · the chromium path is a symlink, not a directory (#269)
- **Source:** the 19 conversation logs captured 2026-08-05 to 2026-08-07.
- **Reason:** the rule called `/opt/pw-browsers/chromium` a directory; re-probed, it is a symlink
  onto the pinned chrome binary.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Landed:** #269, Refs #268

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-13 · reaffirmed · re-probed live (#694)
- **Source:** live re-probes on 2026-09-13.
- **Reason:** the env var, the symlink chain and a live `index.mjs` import launching Chromium all
  held.
- **Actor:** the rule-revalidation run, merged by @missingbulb (owner).
- **Landed:** #694, Refs #687

## 2026-09-24 · reworded · trimmed; import path re-verified
- **Reason:** the owner asked to trim rule prose to zero story ("Trim to zero, unless crucial to
  understand severity"); the incident history lives on this file.
- **Source:** /opt/node22/lib/node_modules/playwright/index.mjs present,
  PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers and /opt/pw-browsers/chromium resolving to
  chromium-1194, probed 2026-09-24.
- **Actor:** @missingbulb (owner).
