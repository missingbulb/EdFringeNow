---
name: requirements-harness
description: How EdFringeNow runs product/requirements.md as tests under a real headless Chromium - writing leaves and goldens, the harness's determinism traps, the frozen fixtures and golden approval. Use before editing product/requirements.md or anything under product/requirements/.
metadata:
  body: guidelines
  force-load-on-file-edits-paths:
    - "product/requirements.md"
    - "product/requirements/**"
---

# The requirements harness

The framework conventions are the `executable-requirements` pack and the judgment layer is
`spec-driven-product` plus the `writing-tests` skill; layout, lanes and commands are
`product/requirements/README.md`. This carries what those don't: a Playwright golden harness,
and the local approval and fixture policy.

## Writing the spec

- **Laying out `product/requirements.md`** — under each visual leaf its golden is visible and
  uncollapsed; every textual expansion (acceptance notes, proof pointers) is collapsed in a
  `<details>` block. The document is read by sight.

- **Writing a visual leaf's statement** — one line saying what is asserted; the golden carries
  the copy, counts, colours and placement. Anything not visible (a threshold, the rule behind
  the state) goes in a collapsed **Notes** block. (visual-leafs-statement)

- **Choosing a golden's capture** — the smallest surface that proves the leaf: an element crop,
  a clipped region, or a stitched composite, never the whole page or control. The recipe lives on
  the case (`capture: "<selector>"` or `capture(page, tools)`, see `shared/capture-tools.js`);
  whole-page capture is a deliberate exception. (golden-smallest-surface)

- **Proving what an action changes** — capture the same region before and after (and after a
  reload where persistence is the point) and play them as one animated golden (`tools.animate`);
  keep `stitchV`/`stitchH` for things genuinely side by side. (change-time-animation)

- **Encoding an animated golden** — APNG, never GIF (`shared/png.js`'s `encodeAnimated`); the
  comparator compares an animated golden's bytes only. (animated-golden-apng)

- **Placing a leaf both pages follow** — the spec is organised by what the product does, never by
  code layout: a cross-page rule is one feature whose picture shows both the Now page and the
  planner, in the cross-page part after the two page-by-page segments. A case may navigate
  between pages, or open a second page when something fixed at context creation must differ.

- **About to route a leaf to `behavior` or `logic`** — first ask whether it decomposes into
  observable states; a statement joined by "and" usually does, and each part becomes its own
  numbered sub-leaf with its own picture, the parent a heading. When a leaf lands in a coded kind
  because the product makes it invisible, say so in its Notes and name the product change that
  would make it visual.

- **Using `behavior`** — for a gesture's outgoing consequence (a URL built, bytes downloaded,
  storage written) or what the OS paints rather than the page (a native `title` tooltip, a
  cursor). (behavior-rule)

- **Using `logic`** — for a pure rule with no rendered surface; when it is about how values are
  written, declare `table: { columns, rows }` so the gallery renders the table and `verify()`
  proves every row. (logic-rule)

## The browser is part of the expected

- **Bumping the pinned Playwright** — it re-renders every golden, so it is a re-baselining,
  approved like one: the harness refuses any other version (`shared/harness/browser.js`).

- **A comparison that flaps** — add determinism, never a tolerance; the comparator stays at zero
  diff, and the levers (fixed clock, geolocation, seeded `Math.random`, route-fulfilled network,
  frozen animations, render flags) all live in the harness.

## Traps the harness already paid for

- **Serving the fake origin** — keep it `https://`: geolocation exists only on secure origins,
  and on plain http the app keeps its simulated clock and renders the wrong day.
  (geolocation-exists-only)

- **Moving or denying the fixed geolocation** — the app adopts the device clock only on an
  in-UK fix, so anywhere else renders its pre-set simulated moment, a different day file.
  (app-adopts-device)

- **Captures racing the planner's board animation** — a CSS freeze doesn't stop
  `element.animate`; the harness stubs it to land on end states. (css-freeze-does)

- **Text shifting by a pixel everywhere** — the vendored `fonts.css` resolves against
  `fonts.googleapis.com`, so the vendor route matches on path, host-agnostic. (fonts-arrive-google)

- **Adding an emoji, symbol or script to the product or fixtures** — rebuild the
  `harness/vendor/systemfonts/` subset (its README): Chromium runs under a `FONTCONFIG_FILE`
  that sees only that directory, and a missing glyph renders as tofu. (vendoring-web-fonts)

- **Reproducing a golden flake locally** — compare with the harness's `compare.js`, never a byte
  hash: PNG bytes differ across identical renders, and CI enforces pixels.
  (reproducing-golden-flake)

- **A red `ui-requirements` lane** — its artifact downloads from a host the proxy denies, so read
  which case failed from `get_job_logs` (large `tail_lines`) and re-run it locally;
  `npm run test:ui` writes `.actual.png` / `.diff.png` into `shared/.artifacts/`. (red-ci-lanes)

- **Capturing a floating popup** — set `viewportOnly: true`: a full-page capture scrolls, and
  scrolling dismisses tips, legends and pops. (floating-popup-dies)

- **Waiting for a page to be ready** — wait on the observable state the pages settle into (the
  footer version popup's text, the search placeholder's show count; `case-helpers.js`) plus
  `document.fonts.ready`, never `networkidle`. (ready-networkidle)

- **Capturing hover-driven UI** — open it inside `capture()`, not `drive()`: the runner settles
  the scroll between them, and the scroll fires `mouseleave`. (hover-driven-ui)

## The fixture freeze

- **Needing data for a case** — use `shared/fixtures/data/`, a frozen snapshot of the real
  committed data cast by the committed builder for state variety; never reach for `site/data/`.
  Every deviation from the source bytes is an `ADJUST` in the builder.

- **Re-running the builder** — it re-casts every golden, so run it only with the owner's
  approval and land builder, fixtures, goldens and gallery in one reviewed change.

- **Having invoked `build-fixtures.js` at all**, even against a scratch edit — it writes into
  `fixtures/data/` as it goes, so `git diff --stat` the whole fixtures dir before deciding there
  is nothing to revert. (build-fixtures-partial-drift)

## Golden approval

- **A golden that no longer matches** — show the owner the committed golden beside
  `shared/.artifacts/<case>.actual.png` and `.diff.png` through an `AskUserQuestion` popup, one
  per item, and say so in the PR body.

- **Landing an intended UI change** — spec edit (doc-first, red), then the implementation, then
  `npm run refresh:ui`, with the refreshed PNGs in the same diff.
