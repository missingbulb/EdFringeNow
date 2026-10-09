## 2026-09-29 · born · a sticky header ghosted into merged animated goldens, caught by the owner (#954)
- **Source:** conversation-logs capture `pr-961` (growth-extract window: substantive commits
  711a04f, 1c1094f, 77b2e7a, b50431f, 7cc74ce).
- **Reason:** in `pr-961` (draw each rival option as a capped bar) the owner reviewed the refreshed
  animated goldens and asked whether "many of the animated gifs show the page header" mid-frame —
  a bug already present in previously-merged goldens, not introduced by this PR.
  `capture-tools.js`'s full-page `clip()` shot a frame after an earlier step had scrolled the page,
  and the sticky `.site-header` painted wherever that scroll left it. The session pinned the header
  to `position: relative` for the duration of every `clip()`/`shootInFlow` shot (`PIN_HEADER_CSS`)
  and re-rendered every affected golden.
- **Mechanism:** a guideline in the requirements-harness skill's capture-time section, force-loaded
  on edits to `product/requirements/**` — the fix itself already lives in `capture-tools.js`, so
  this only flags the trap for a new capture path that shoots `page.screenshot` directly instead of
  going through the shared helper.
- **Retire when:** no captured session calls `page.screenshot` directly for a shot that follows a
  scroll, and no further sticky-header ghosting appears in a golden diff.
- **Actor:** the growth-extract run, item #954.
