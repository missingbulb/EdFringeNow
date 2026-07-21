# Fringe Planner (`/plan`)

A **desktop-oriented** planning surface for EdFringeNow, served at
`edfringenow.com/plan/`. It is deliberately separate from the mobile-first home
site ("Fringe Discover") and does **not** touch it — the home site stays as-is
until this matures.

> **Status:** Milestone 1 — *favourites → availability calendar*. You upload your
> edfringe.com favourites CSV export; the page shows each favourited show as a
> lane across August and lets you scrub a date window + start-time range to see
> **how many of your shows are actually catchable**. Scheduling a full itinerary
> is a later milestone (the engine primitives for it are already ported — see
> below).

## 100% client-side

There is **no server and no build step**. Everything runs in the browser:

1. On load, `plan.js` `fetch()`es the show catalogue already shipped in this repo
   — `../data/normalized/shows.json` (4,078 shows, each with a `performances[]`
   of `{date, start, soldOut, status}`). GitHub Pages serves it gzipped (~1.1 MB).
2. You upload your **favourites CSV** (the edfringe export). It is parsed in the
   browser with the `FileReader` API — nothing is uploaded anywhere. The CSV's
   `URL to Event Details` column yields a slug that matches `show.slug`, so
   favourites → available performances is computed entirely locally.
3. The availability calendar, the draggable date window, and the start-time
   slider all recompute live via the pure engine in [`lib/`](lib/).
4. Your uploaded favourites (the parsed slug list — never the show data) are
   remembered in `localStorage` for **3 days**, so a return visit re-hydrates
   the calendar without another export/upload. Availability is always
   re-derived against the freshest catalogue on restore. A **Clear favourites**
   button removes the set from both the page and storage, and a *"N favourites
   from &lt;when&gt;"* label shows where the current set came from.

Because the page fetches a data file, open it over HTTP (not `file://`):
`python3 -m http.server` from the repo root, then visit `/plan/`.

## Files

```
plan/
  index.html          the page (two screens: upload, then calendar)
  plan.css            styles (adapted from the design mock)
  plan.js             page logic — wires lib/ to the UI, no globals shared with js/app.js
  lib/                pure, DOM-free computation engine (ported from EdFringeAllocator's
                      Python `edfringe/` package; unit-tested — see below)
    favourites.js       parseFavourites(text) -> slugs (CSV / URL-list)
    availability.js     isAvailable(perf) denylist + time helpers
    engine.js           buildIndex / matchFavourites / summarize (+ scheduling
                        primitives: eligibleSlots / compatible / requiredGapMinutes)
    __tests__/engine.test.mjs   node --test suite (run: `node plan/lib/__tests__/engine.test.mjs`)
  sample-favourites.csv   a one-show example export (the "try the sample" link)
  design/                 Fable design mock + notes (reference, not shipped logic)
```

## The computation, ported from Python

The availability/scheduling logic mirrors the deterministic engine in the
**EdFringeAllocator** repo (`edfringe/favorites.py`, `extract.py`,
`scheduling.py`), re-implemented as browser ES modules. Two data-shape notes
where the site's `shows.json` differs from the Python model (documented inline):

- the field is `status` here (Python read `ticketStatus`);
- performances carry no explicit `end` — it's derived as `start + duration`.

Availability uses the same denylist as the Python (`SOLD_OUT`, `OFF_SALE`,
`NO_ALLOCATION_CONTACT_VENUE`, …); offer statuses like `TWO_FOR_ONE` /
`PREVIEW_SHOW` / `FREE_*` count as available.

## Known limitations / next steps (milestone 1)

- **Calendar axis is Aug 1–31.** The data spans Jul 24–Aug 31; a handful of
  July preview performances fall off the axis.
- **The date window is the only filter.** A start-time selector was tried and
  dropped — as a whole-stack filter it wasn't useful (per-show start times
  matter mainly at the window's first/last day, which is a later refinement).
- **Day-cell colours follow edfringe.com.** Each performance mark uses the same
  status palette as edfringe.com's ticket day-picker (tickets available, 2-for-1,
  preview, free, event-specific, no-allocation, sold out); a day with two shows
  renders as two side-by-side segments.
- **"More settings"** (genre filter, min-gap, trip dates) is a placeholder — not
  wired yet.
- **Data loading** fetches the full normalized file; a slimmer planner-only index
  (~0.4 MB gzip) is a possible optimization if payload becomes a concern.
- Mobile layout is out of scope for this milestone (desktop-first by design).
