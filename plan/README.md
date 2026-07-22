# Fringe Planner (`/plan`)

A **desktop-oriented** planning surface for EdFringeNow, served at
`edfringenow.com/plan/`. It is deliberately separate from the mobile-first home
site ("Fringe Discover") and does **not** touch it — the home site stays as-is
until this matures.

> **Status:** Milestone 2 — *favourites → availability calendar → allocated
> itinerary*. You upload your edfringe.com favourites CSV export; the calendar
> then replaces the upload panel (one page, one state switch — replace/clear
> live as quiet actions on the calendar), showing each favourited show as a lane
> across August. Scrub a date window — or let *"Pick my best dates"* place it for
> a given stay length or the best Sat–Sun weekend — to see **how many of your
> shows are actually catchable**. Then **"Plan my Fringe"** slots those catchable
> shows into a clash-free, day-by-day itinerary (one performance each, travel
> time between them), rendered as a calendar-style schedule graphic you can tune
> live and export as a **CSV itinerary** or an **ICS calendar feed**.

## 100% client-side

There is **no server and no build step**. Everything runs in the browser:

1. On load, `plan.js` `fetch()`es the show catalogue already shipped in this repo
   — `../data/normalized/shows.json` (4,078 shows, each with a `performances[]`
   of `{date, start, soldOut, status}`). GitHub Pages serves it gzipped (~1.1 MB).
2. You upload your **favourites CSV** (the edfringe export). It is parsed in the
   browser with the `FileReader` API — nothing is uploaded anywhere. The CSV's
   `URL to Event Details` column yields a slug that matches `show.slug`, so
   favourites → available performances is computed entirely locally.
3. The availability calendar and the draggable date window recompute live via
   the pure engine in [`lib/`](lib/); the *"Pick my best dates"* control scores
   every candidate window in the browser the same way.
4. Your uploaded favourites (the parsed slug list — never the show data) are
   remembered in `localStorage` for **3 days**, so a return visit re-hydrates
   the calendar without another export/upload. Availability is always
   re-derived against the freshest catalogue on restore. The calendar's
   favourites line shows where the current set came from (*"N favourites from
   &lt;when&gt;"*) with quiet **Replace file** / **Clear** actions.

Because the page fetches a data file, open it over HTTP (not `file://`):
`python3 -m http.server` from the repo root, then visit `/plan/`.

## Files

```
plan/
  index.html          the page (intake → calendar → plan, one section per step)
  plan.css            styles (adapted from the design mock)
  plan.js             page logic — wires lib/ to the UI, no globals shared with js/app.js
  lib/                pure, DOM-free computation engine (ported from EdFringeAllocator's
                      Python `edfringe/` package; unit-tested — see below)
    favourites.js       parseFavourites(text) -> slugs (CSV / URL-list)
    availability.js     isAvailable(perf) denylist + time helpers
    engine.js           buildIndex / matchFavourites / summarize + scheduling
                        (eligibleSlots / compatible / requiredGapMinutes / buildSchedule)
    itinerary.js        toCsv(slots) / toIcs(slots) — the CSV + ICS exporters
    __tests__/engine.test.mjs      node --test suite for the engine
    __tests__/itinerary.test.mjs   node --test suite for the exporters
      (run both: `node plan/lib/__tests__/engine.test.mjs && node plan/lib/__tests__/itinerary.test.mjs`)
  sample-favourites.csv   a one-show example export (the "try the sample" link)
  design/                 Fable design mock + notes (reference, not shipped logic)
```

## The itinerary allocator (milestone 2)

`buildSchedule(shows, options)` (in `lib/engine.js`) turns the catchable shows
into a conflict-free plan. It is a deterministic **earliest-finish-first greedy**
— the classic optimum for "fit the most non-overlapping intervals on one
machine" — extended for this domain: at most one performance per show, at most
`maxPerDay` shows a day, and every same-day pair kept `compatible` (no overlap +
the travel buffer from `requiredGapMinutes`). `minPerDay` is a post-pass that
drops any day below the threshold (no trek into town for a single show). Ties
break on slug/date so the same inputs always yield the same plan.

The UI (screen 3) reads its pacing controls — *time between shows*, *most/fewest
shows per day* — plus the current date window into `options`, and re-plans live
as any of them change. `lib/itinerary.js` then renders the result to a CSV
(spreadsheet/print) or ICS feed (import into Google/Apple/Outlook), both built in
the browser from a Blob — nothing is uploaded. ICS events use **floating local
time** (Edinburgh wall clock), right for an on-the-ground festival plan.

*Not yet built:* blocking out **meal-break windows** (lunch/dinner slots that
shouldn't hold a show) — surfaced in the UI as a "Soon" affordance, no behaviour
faked.

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
