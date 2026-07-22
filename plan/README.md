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
> shows are actually catchable**. Those catchable shows are **instantly** slotted
> into a clash-free, day-by-day itinerary (one performance each, travel time
> between them) — no "Plan" button; it re-plans live as you drag the window or
> tune the controls (day hours, meal breaks, travel mode, per-day limits, or
> right-click a favourite to force it in). Export as a **CSV itinerary** or an
> **ICS calendar feed**.

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
    travel.js           distanceKm / travelMinutes — haversine + per-mode speeds
    engine.js           buildIndex / matchFavourites / summarize + scheduling
                        (eligibleSlots / withinDayWindow / compatible /
                         requiredGapMinutes / normalizeMealBreaks / buildSchedule)
    itinerary.js        toCsv(slots) / toIcs(slots) — the CSV + ICS exporters
    __tests__/engine.test.mjs      node --test suite for the engine
    __tests__/planning.test.mjs    day-hours / meal breaks / travel gaps / forcing
    __tests__/itinerary.test.mjs   node --test suite for the exporters
      (run all: `node --test plan/lib/__tests__/*.test.mjs`)
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

The plan is **instant** — there is no "Plan" button. The itinerary recomputes
live whenever the date window or any control changes. Screen 3 reads into
`options`:

- *day starts / day ends* — a day-hours window; a performance must start no
  earlier and end no later (drag the lines on the schedule, or use the time
  pickers);
- *meal breaks* — lunch/dinner bands no show may overlap (toggle + drag on the
  schedule);
- *most / fewest shows per day*, *minimum gap*;
- *getting around* — walk / bike / car. Different-venue gaps are the greater of
  the minimum gap and the **estimated travel time** between the two venues
  (`lib/travel.js`, haversine + per-mode speed, venue coordinates from
  `data/venues.json`), so far-apart shows need more slack and a bike/car needs
  less;
- *forced (must-see) shows* — right-click a favourite in the grid to pin it into
  the plan even if the greedy pass would drop it (it ignores the per-day cap and
  survives the min-per-day drop).

The grid mirrors the plan: each row reads **In plan** / **In window** / *out*,
and the hero count is *scheduled / in-window / total*. Between two scheduled
shows less than an hour apart, the schedule draws a **travel leg** (distance +
time by the chosen mode).

`lib/itinerary.js` renders the result to a CSV (spreadsheet/print) or ICS feed
(import into Google/Apple/Outlook), both built in the browser from a Blob —
nothing is uploaded. ICS events use **floating local time** (Edinburgh wall
clock), right for an on-the-ground festival plan.

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
- **Intake "More settings"** (genre filter, trip dates on the upload screen) is a
  placeholder — not wired yet. The plan screen's own controls (gap, day hours,
  meal breaks, travel mode, per-day min/max) are live.
- **Data loading** fetches the full normalized file; a slimmer planner-only index
  (~0.4 MB gzip) is a possible optimization if payload becomes a concern.
- Mobile layout is out of scope for this milestone (desktop-first by design).
