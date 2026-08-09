# edfringe-requirements — the executable-requirements harness here

How this repo runs its spec (`product/requirements.md`) as tests. The framework
conventions are the `executable-requirements` pack; the judgment layer is
`spec-driven-product` + the `writing-tests` skill. This pack carries only what
those don't: the mechanics of a **real-headless-browser** golden harness (the
canon's worked examples render with satori/jsdom or Flutter — this repo is the
first Playwright port) and the local approval/fixture policy. Layout, lanes and
commands live in [product/requirements/README.md](../../../../product/requirements/README.md)
— don't restate them; this file is the judgment and the traps.

## The document reads as pictures

- `product/requirements.md` is scanned by sight: under each visual leaf its
  golden is **visible, uncollapsed**; every textual expansion (acceptance
  notes, proof pointers) is **collapsed** in a `<details>` block. An optimal
  requirements document has almost no words on the page.
- **A golden is the smallest surface that proves its leaf** — an element crop,
  a clipped region, or a stitched composite (e.g. one grid lane narrowed to a
  few days, recomposed with its label and verdict columns, no header) — never
  the whole page or even the whole control. The capture recipe lives on the
  case (`capture: "<selector>"` or `capture(page, tools)`; see
  `shared/capture-tools.js`); whole-page capture is a deliberate exception,
  not a default. Scoping is judgment: crop to what the leaf asserts, keep just
  enough surroundings to orient.

## The browser is part of the expected

- A golden is only comparable under the **exact Chromium that rendered it**.
  The harness pins the Playwright version and refuses any other
  (`shared/harness/browser.js`); CI installs that pin per run, the Claude
  sandbox ships it globally. **Bumping the pin re-renders every golden** — it
  is a re-baselining, done deliberately and approved like one, never a drive-by
  upgrade.
- When the comparison ever flaps, the fix is **more determinism, not a
  tolerance**: the comparator stays at zero diff. The determinism levers are
  all in one place (the harness): fixed clock via `page.clock`, fixed
  geolocation, seeded `Math.random`, route-fulfilled network, frozen
  animations, `--font-render-hinting=none --force-color-profile=srgb`.

## Traps this harness already paid for (don't re-derive)

- **Geolocation exists only on secure origins.** The fake origin is `https://`
  — route interception fulfils before any TLS, so no certificate is involved.
  On plain http the app silently keeps its built-in simulated clock and the
  whole render lands on the wrong day.
- **The app adopts the device clock only on an in-UK geolocation fix** — the
  harness's fixed location is central Edinburgh precisely so the pinned clock
  is what renders; deny geolocation (or move abroad) and you are rendering the
  app's own pre-set simulated moment instead, a different day file entirely.
- **A CSS freeze does not stop Web-Animations-API animations.** The planner's
  FLIP board diff runs through `element.animate` — the harness stubs it to
  land on end states; without the stub, captures race the animation.
- **Fonts arrive via the Google Fonts CSS URL**, so the vendored `fonts.css`'s
  `url(/__vendor/…)` references resolve against `fonts.googleapis.com` — the
  vendor route must match on path, host-agnostic, or every glyph silently
  falls back and all text shifts by a pixel.
- **A floating popup dies under a full-page screenshot** (the capture scrolls,
  and scroll dismisses tips/legends/optimizer pops). A popup-state case sets
  `viewportOnly: true` and captures the viewport crop.
- **"Ready" is not `networkidle`.** The pages settle their async work into
  observable state — the footer version tooltip, the search placeholder's
  show count. Wait on those (`case-helpers.js`), plus `document.fonts.ready`.

## The fixture freeze

- `shared/fixtures/data/` is a snapshot of the **real committed data**, cast by
  the committed builder for state variety (sold-out / free / price-unknown /
  tight / every planner verdict). It is **frozen**: the nightly data refresh
  never touches it, and no case may reach for `data/` live files.
- Every deviation from the source bytes is documented as an `ADJUST` in the
  builder — a fixture edit without one is hand-invented data.
- Re-running the builder re-casts every golden. That is a re-baselining: run it
  only with the owner's approval, and land builder + fixtures + goldens +
  gallery in one reviewed change.

## Golden approval, concretely

- A red screen case is **never** fixed by `refresh:ui`. Surface the committed
  golden, `shared/.artifacts/<case>.actual.png` and `.diff.png`, and ask the
  owner (AskUserQuestion popup, per-item, per the owner's preferences) before
  re-baselining anything.
- A brand-new leaf's golden is a **proposal** until the owner has seen the
  rendering: it lands in the PR diff, and merge approval is the pixel
  approval. Say so in the PR body — the goldens are the review surface.
- An intended UI change lands as: spec edit (doc-first, red) → implementation →
  `npm run refresh:ui` → the refreshed PNGs ride the same diff.
