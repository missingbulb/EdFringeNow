# Executable requirements — how this folder works

[`../requirements.md`](../requirements.md) is the numbered UI/UX spec; this
folder makes it executable. Every leaf id in the spec is claimed by exactly one
case here, and the committed expecteds (golden PNGs, coded assertions) are the
owner's approval record of the product. The framework follows the
`executable-requirements` pack standard; the judgment layer (doc-first,
owner-owned expecteds, re-baselining approval) is the `spec-driven-product`
playbook plus the `writing-tests` skill.

## Layout

```
product/
  requirements.md              the numbered spec (config.spec of the pack)
  requirements/
    coverage.test.js           the leaf ⇄ case bijection gate   (default lane)
    gallery.test.js            spec ↔ gallery-lines drift gate  (default lane)
    logic/                     kind: pure product rules          (default lane)
      logic.test.js  cases/<slug>.<id>.case.js
    screen/                    kind: pixel-exact page states     (test:ui lane)
      screen.test.js cases/<slug>.<id>.case.js + <slug>.<id>.png (the goldens)
    behavior/                  kind: driven gestures, coded      (test:ui lane)
      behavior.test.js cases/<slug>.<id>.case.js
    shared/
      requirements-doc.js kinds.js cases.js     spec parsing + registries
      reference-now.js                          THE pinned instant + fakes
      png.js compare.js artifacts-dir.js        the pixel comparator
      render-case.js refresh.js gallery.js      render/refresh/gallery lanes
      case-helpers.js                           storage seeds, waits, drives
      harness/browser.js                        the hermetic Playwright page
      harness/vendor/                           Leaflet + fonts, committed
      fixtures/                                 the frozen dataset + builder
```

- **The folder is the kind.** A case's kind is the directory it lives in; a
  kind is added by dropping `<kind>/kind.js` + a runner — the loader, coverage
  gate and gallery all iterate the registry.
- **Goldens live beside their case**; failure artifacts (actual/diff) go to the
  gitignored `shared/.artifacts/`, never beside the goldens.

## Lanes

| lane | command | runs | where |
|---|---|---|---|
| default | `npm test` / `bash scripts/verify.sh` | coverage gate, gallery gate, logic cases | everywhere (no browser) |
| UI | `npm run test:ui` | screen (pixel-exact) + behavior cases | pinned Playwright Chromium; CI's `ui-requirements` job |
| refresh | `npm run refresh:ui [filter]` | regenerates goldens + the gallery together | after an INTENDED UI change only |

The harness pins Playwright **1.56.1** (`shared/harness/browser.js`) — the
version whose Chromium rendered the committed goldens. The Claude sandbox
ships it globally; CI installs it per run; any other version refuses to
compare. Everything nondeterministic is faked once, in the harness: the clock
(Sat 15 Aug 2026 19:30 Edinburgh), geolocation (central Edinburgh),
`Math.random`, fonts/Leaflet/tiles/geocoder/data (committed vendor + fixture
bytes), CSS + WAAPI animations (frozen).

## The owner-approval contract

- A **golden** is owner-owned: an agent may *propose* one for a brand-new leaf
  (via the refresh lane), but never regenerates a committed one to make a red
  case pass. On a mismatch: surface `shared/.artifacts/<case>.actual.png` /
  `.diff.png` against the committed golden and **ask the owner** — refresh only
  on approval.
- A **coded assertion** (behavior/logic) is the expected itself — it is never
  weakened to pass.
- Refreshed goldens ride the PR diff, so approving the PR is approving the
  pixels.

## Adding a requirement

1. Add the leaf to `../requirements.md` (new number, one-line statement, a
   `<details>` block carrying its acceptance notes and a
   `<!-- req-gallery:<id> -->` line). The coverage gate is now **red**.
2. Add its one case: `<kind>/cases/<slug>.<id>.case.js` — slug = the section's
   stable feature name.
3. For a screen leaf run `npm run refresh:ui <slug>.<id>` and get the golden
   owner-approved; for behavior/logic, write the `verify()` and watch it fail
   before making it pass.

## The fixture dataset

`shared/fixtures/data/` is a **frozen, curated snapshot** of the repo's real
committed data (provenance + the two documented adjustments:
[`build-fixtures.js`](shared/fixtures/build-fixtures.js)). It never tracks the
nightly data refresh. Re-running the builder re-casts every golden — that is a
deliberate re-baselining and follows the approval procedure above.
