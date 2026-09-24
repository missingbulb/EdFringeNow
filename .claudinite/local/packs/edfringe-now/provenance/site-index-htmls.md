## 2026-08-18 · born · Claudinite growth: extract lessons from 2026-08-07 conversation logs (#402)
- **Source:** the 17 conversation logs captured 2026-08-07, in their final hindsight pass.
- **Reason:** two sessions (#256, #267) hit the blocked `unpkg.com` load independently while driving
  the same fix, and the page threw `L is not defined`.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a RULES.md rule in the "Verifying UI changes visually" section.
- **Rejected:** a check - session runtime behaviour, not a static repo signature.
- **Landed:** #402, Refs #400

## 2026-08-20 · reworded · a real curl'd Leaflet, not only a no-op stub (#420)
- **Source:** #318.
- **Reason:** `curl` reaches `unpkg.com` through the agent proxy where Chromium cannot, so a case
  that needs the map itself can be served the real files from disk.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Rejected:** a check - runtime, tool or process behaviour with no static signature.
- **Landed:** #420, Closes #419

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-16 · reworded · paths under site/ (#731)
- **Reason:** the published site moved into `site/`, so the paths it names moved with it.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Landed:** #731, Closes #730
