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
- **A visual leaf's statement is a line, not a paragraph.** The golden already
  carries the exact copy, counts, colours and placement — restating them in
  prose only competes with the picture. Say what is being asserted; let the
  image say how it looks. Anything genuinely not visible (a threshold, a rule
  behind the state, a condition that produced it) goes in a collapsed
  **Notes** block, never in the statement.
- **A golden is the smallest surface that proves its leaf** — an element crop,
  a clipped region, or a stitched composite (e.g. one grid lane narrowed to a
  few days, recomposed with its label and verdict columns, no header) — never
  the whole page or even the whole control. The capture recipe lives on the
  case (`capture: "<selector>"` or `capture(page, tools)`; see
  `shared/capture-tools.js`); whole-page capture is a deliberate exception,
  not a default. Scoping is judgment: crop to what the leaf asserts, keep just
  enough surroundings to orient.
- **A change over time is an animation, not a coded assertion.** When a
  requirement is about what an action *changes* — a dismissal that sticks, a
  pick that swaps one card for another — capture the same region before and
  after (and after a reload, where persistence is the point) and play the
  frames as one animated golden (`tools.animate`). A flow is shown as a flow.
  Reserve `stitchV`/`stitchH` for things that are genuinely side by side rather
  than sequential.
- **An animated golden is an APNG, never a GIF** — the choice
  ShoutsAndWhispers made for its sagas, for two reasons that both matter here:
  APNG is lossless, so the golden stays a faithful pixel record of the UI
  instead of a 256-colour approximation of it, and every byte is ours, so the
  comparison stays exact byte-identity. It animates in GitHub markdown exactly
  like a GIF. The encoder is `shared/png.js`'s `encodeAnimated`; the comparator
  detects an animated golden and compares bytes only, since a pixel differ
  reads one still frame and would describe the wrong thing.

## A requirement is a feature, not a module

The spec is organised by what the product *does*, never by how the code is
arranged. "Shared code" is not a requirement category: a rule both front-ends
follow is one feature, and its picture shows **both** the Now page and the
planner — a rule only half the site follows is not the feature. Those
cross-page features sit in their own part **after** the two page-by-page
segments, so each page reads as a whole first.

Cross-page proof is ordinary: a case may navigate between the pages (or open a
second page, when something fixed at context creation — a device timezone —
has to differ) and stitch or animate the surfaces into one golden.

## Prefer several pictures over one coded leaf

Before routing a leaf to `behavior` or `logic`, ask whether it **decomposes
into observable states**. A statement joined by "and" usually does, and each
part is then its own numbered sub-leaf with its own picture — the parent
becomes a heading. The time wheel went this way: "5-minute steps, opens at
now + 2 h, ends at 29:55" was one coded leaf and is now `3.7.1`–`3.7.3`, three
crops anyone can check by eye. Sub-leaves are cheap; a coded assertion the
owner has to read code to trust is not.

Reserve the coded kinds for what genuinely has no picture:

- **`behavior`** — a gesture's outgoing consequence (a URL built, bytes
  downloaded, storage written), or a fact the OS paints rather than the page
  (a native `title` tooltip, a cursor — neither can appear in a screenshot).
- **`logic`** — a pure rule with no rendered surface at all. When the rule is
  about *how values are written*, prefer a **table** over prose: a case may
  declare `table: { columns, rows }`, the gallery renders it into the spec, and
  its `verify()` proves every row against the shipped code — so the table a
  reader sees is generated evidence, not a hand-typed claim.

When a leaf lands in a coded kind *because* the product makes it invisible,
say so in its Notes and name what product change would make it visual — that
is a real finding about the UI, not just a testing limitation.

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
- **Vendoring the web fonts is only half the font problem.** Every character
  they don't carry — an emoji, `▾`, `≤`, a Cyrillic show title — is drawn from
  the fonts *installed on the machine*, so the goldens quietly become a record
  of the renderer's font set. It cost a red CI lane: the walk-time line
  (`🚶 5 min · £16`) measured wider on the GitHub runner, wrapped, and every
  show card came out 21px taller. The harness now launches Chromium under a
  generated `FONTCONFIG_FILE` whose only font directory is
  `harness/vendor/systemfonts/` — the host's fonts cannot reach the page. A new
  emoji or script in the product or the fixtures needs that subset rebuilt
  (see the folder's README), or it renders as tofu.
- **A floating popup dies under a full-page screenshot** (the capture scrolls,
  and scroll dismisses tips/legends/optimizer pops). A popup-state case sets
  `viewportOnly: true` and captures the viewport crop.
- **"Ready" is not `networkidle`.** The pages settle their async work into
  observable state — the footer version popup's text, the search placeholder's
  show count. Wait on those (`case-helpers.js`), plus `document.fonts.ready`.
- **Hover-driven UI must be opened inside `capture()`, not `drive()`.** The
  runner settles the scroll between the two, and scrolling moves an element out
  from under the pointer — which fires `mouseleave` and closes anything the
  hover opened. That is correct product behaviour; the capture just has to
  happen on the right side of it.

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
