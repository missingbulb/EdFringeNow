## 2026-08-07 · born · Claudinite growth: extract lessons (#269)
- **Source:** sessions on #251, #258 and #264, all on 2026-08-07.
- **Reason:** each took the detour: a fresh install pulls a newer Playwright than the image, which
  then demands a browser build the sandbox cannot download.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a RULES.md rule in the "Verifying UI changes visually" section.
- **Rejected:** a check - it constrains sandbox tooling behaviour, not a static signature in the
  tree.
- **Landed:** #269, Refs #268

## 2026-08-18 · reworded · the repo-root install is the same footgun (#402)
- **Source:** the 17 conversation logs captured 2026-08-07, in their final hindsight pass.
- **Reason:** `npm i -D playwright` in the repo root was paid twice in one session (#267): no
  version failure, but a dirty `package.json`, lockfile and `node_modules`.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Landed:** #402, Refs #400

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612
