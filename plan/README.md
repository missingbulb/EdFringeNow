# Fringe Planner (`/plan`)

A **desktop-oriented** planning surface for EdFringeNow, served at
`edfringenow.com/plan/`. It is deliberately separate from the mobile-first home
site ("Fringe Discover") and does **not** touch it — the home site stays as-is
until this matures.

> **Status:** Milestone 2 — *favourites → availability calendar → allocated
> itinerary*. You upload your edfringe.com favourites CSV export — or search the
> programme and star shows one at a time — and the board's body swaps the drop
> stage for the availability grid, showing each favourite as a lane across
> August. The swap is **only** that body: one card, one count line
> (*"4 shows planned out of 6 selected!"*) and one search bar, all in the same
> place in both states, so the first show you add never shunts the page.
> Scrub a date window — or let *"Pick my best dates"* place it for
> a given stay length or the best Sat–Sun weekend — to see **how many of your
> shows are actually catchable**. Those catchable shows are **instantly** slotted
> into a clash-free, day-by-day itinerary (one performance each, travel time
> between them) — no "Plan" button; it re-plans live as you drag the window or
> tune the controls (day hours, meal breaks, travel mode, per-day limits, or
> click a show name to pin it into the plan — or a day mark to pin that exact
> performance). Export as a **CSV itinerary** or an
> **ICS calendar feed**.

## 100% client-side

There is **no server and no build step**. Everything runs in the browser:

1. On load, `plan.js` fetches three files already shipped in this repo and joins
   them into the catalogue the engine consumes (`lib/hydrate.js`): the compact
   catalogue `../data/normalized/shows.min.json` (4,114 shows, each with a
   `performances[]` of `{date, start}`), the shared lookups `../data/venues.json`
   it indexes into, and `../data/normalized/availability.min.json`, which supplies
   each performance's `{soldOut, status}`.

   They are three files rather than one so each can be cached for as long as its
   contents last — 4 days for the catalogue (948 KB gzipped), 1 day for
   availability (149 KB), which is the only one of them that moves through the
   day. See
   [`shared/data-cache.js`](../shared/data-cache.js) and the caching table in
   [`scraper/README.md`](../scraper/README.md). Availability is the one fetch
   allowed to fail: without it every performance is status-unknown, which the
   grid already draws.
2. You upload your **favourites CSV** (the edfringe export). It is parsed in the
   browser with the `FileReader` API — nothing is uploaded anywhere. The CSV's
   `URL to Event Details` column yields a slug that matches `show.slug`, so
   favourites → available performances is computed entirely locally. **`.csv`
   only**, and a file that yields no shows for the grid is reported as the
   failure it is (the wrong kind of file, or last year's export) — never as
   "N favourites loaded". The board and the stored list are left untouched.
3. The availability calendar and the draggable date window recompute live via
   the pure engine in [`lib/`](lib/); the *"Pick my best dates"* control scores
   every candidate window in the browser the same way.
4. Your working favourites (the parsed slug list — never the show data) are
   remembered in `localStorage` for **3 days**, so a return visit re-hydrates
   the calendar without another export/upload. Every change funnels through
   `applyFavourites`, which is also what persists the set, so what's stored always
   mirrors what's on the grid. Availability is always re-derived against the
   freshest catalogue on restore; a stored list this year's catalogue no longer
   knows is quietly forgotten. **Clear** (in the board's head) is the way back to
   an empty board.

Because the page fetches a data file, open it over HTTP (not `file://`):
`python3 -m http.server` from the repo root, then visit `/plan/`.

## Files

```
plan/
  index.html          the page (one board — drop stage ↔ grid — then the plan panel)
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
    search.js           searchShows / filterShows facet filters, catalogueVenues,
                        matchFacets (the genre/subgenre/venue name suggestions)
    __tests__/engine.test.mjs      node --test suite for the engine
    __tests__/planning.test.mjs    day-hours / meal breaks / travel gaps / forcing
    __tests__/itinerary.test.mjs   node --test suite for the exporters
    __tests__/search.test.mjs      filter semantics, ranking, facet suggestions
      (run all: `node --test plan/lib/__tests__/*.test.mjs`)
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
  earlier and end no later (drag the lines on the schedule, or use the pickers).
  A Fringe evening runs past midnight, so the schedule axis is a fixed **09:00 →
  27:00** (03:00), the day end can be set as late as 27:00 (default **25:00 /
  01:00**), and an after-midnight late show is folded onto the **previous
  festival night** — same real time for exports, drawn at the top of that
  night's column;
- *meal breaks* — lunch/dinner bands no show may overlap (toggle + drag on the
  schedule);
- *most / fewest shows per day*, *minimum gap*;
- *getting around* — walk / bike / car. Different-venue gaps are the greater of
  the minimum gap and the **estimated travel time** between the two venues
  (`lib/travel.js`, haversine + per-mode speed, venue coordinates from
  `data/venues.json`), so far-apart shows need more slack and a bike/car needs
  less;
- *forced (must-see) shows* — click a show name in the grid to pin the whole
  show into the plan, or click a day mark to pin that one specific performance,
  even if the greedy pass would drop it (a pin ignores the per-day cap and
  survives the min-per-day drop; a specific-performance pin also overrides the
  day-hours window and meal breaks). Click again to lift the pin.

The grid mirrors the plan: each lane's Status names its own verdict —
**✓ Scheduled!**, **☀ Too early** / **🌙 Too late**, **🍽 Lunch conflict** /
**🍽 Dinner conflict**, **Can't fit**, **Sold out**, **📅 No dates** — and the
board's count line reads *N shows planned out of M selected*. Between two
scheduled shows less than an hour apart, the schedule draws a **travel leg**
(distance + time by the chosen mode).

The named verdicts come from `placementDiagnostics` (in `lib/engine.js`), which
attributes each catchable-but-unplaceable show to the control that would rescue
it. Where exactly one *kind* of control is culpable the lane names it (a meal
break by name, since that's a thing you can drag); a mix falls back to
**Can't fit**. The same diagnostics give the day-start, day-end and meal controls
their **"⚠ Prevents N shows"** chip (hover for the list, click to flash those
lanes on the grid) and mark the matching boundary line / band on the schedule.

The board re-plans live, and the change is **animated** so a switch stays
believable: a newly placed show eases in, the same show rescheduled flies to its
new slot, and a dropped show fades out where it sat — never a card silently
mutating into a different show at a different time. Scrubbing the date window
tracks the pointer without the transition; **"Pick my best dates"** and keyboard
nudges glide the window lines to their new spot. All of it is disabled under
`prefers-reduced-motion`.

`lib/itinerary.js` renders the result to a CSV (spreadsheet/print) or ICS feed
(import into Google/Apple/Outlook), both built in the browser from a Blob —
nothing is uploaded. ICS events use **floating local time** (Edinburgh wall
clock), right for an on-the-ground festival plan.

## Building the list by search

The board's other way in — and the only one that doesn't need an export — is the
search bar under the board body. It sits in the same place, at the same width, in
both states, so starting a grid from nothing and topping up a full one are the
same gesture. Everything it opens drops **downward**: the results overlay, and
the "Search tools" row of facet chips (genre, subgenre, venue, accessibility, age
limit, price — each a chip that drops a panel of checkable options with a grey
per-option show count, matching the Now page's filters).

Typing often names a *category* rather than a show ("cabaret", "pleasance"), so
`matchFacets` (`lib/search.js`) offers the genres, subgenres and venues whose
names match **above** the show hits, styled as filter rows rather than show rows.
Picking one ticks that value in its facet, drops the query (free text and a
filter on the same word would fight), opens the tools so the changed chip is
visible, and lists the whole slate. Venue is keyed on the venue *code*, so a pick
takes every room in that venue, and a score tie between two same-named venues
goes to the one with more shows (the hub, not its satellite).

Starring a row runs the show through the same `applyFavourites` path an upload
takes, so persistence, matching and the live re-plan all follow.

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
- **The empty board carries no placeholder controls.** The old intake "More
  settings" block (fake genre chips, min-gap and trip-date boxes wired to
  nothing) is gone: the search tools now offer a real genre/subgenre/venue
  filter, and gap / day hours / meal breaks / travel mode / per-day min-max are
  live controls on the plan panel.
- **Data loading** blocks on the catalogue + lookups + availability; the
  descriptions sidecar follows lazily and nothing waits for it.
- Mobile layout is out of scope for this milestone (desktop-first by design).
