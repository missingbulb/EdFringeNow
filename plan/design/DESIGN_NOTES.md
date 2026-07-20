# Fringe Planner — design notes (milestone 1 mock)

Mock: `mock.html` (single self-contained file; opens standalone). Screens are stacked with
"MOCK · SCREEN …" annotation labels — those labels are meta, not product UI.

## Layout & flow

- **Same family, calmer register.** Header, tokens (violet `#6c4cf1`, ink/muted/hairline, 16px
  radius, soft shadow, Plus Jakarta Sans display + Inter body), and the 1120px container all match
  the home site — but there is no map, no animation noise: this is a considered desk task.
- **Screen 1 is a narrow centred card (~660px)** — a single decision, so a single focused column:
  drop zone → sample fallback → post-upload summary → continue. The "where do I get the CSV"
  helper is inline in the subtitle as a breadcrumb (`edfringe.com → your favourites → Export CSV`)
  rather than a separate help block. "More settings" is a real collapsed `<details>` with
  placeholder genre chips / minimum-gap / trip-dates inside (visible if clicked, not wired up).
- **Screen 2 uses the full 1120px width** — 31 day-columns need the room; the wide canvas is the
  point of designing desktop-first here.

## The stacked-lanes calendar (the encoding)

- **Rows = shows, columns = days (Aug 1–31).** Each performance day is a small rounded violet
  tick; consecutive days visually fuse into runs, so a show's availability *shape* (daily run,
  weekends-only, first-half-only, day-off gaps) is readable at a glance.
- **Three states per day:** filled violet = tickets available; **hollow outline = sold out**
  (the show performs but you can't get in — deliberately still visible, because "sold out through
  my week" is information); absent = no performance. Aug 26–31 is a faintly shaded "after the
  Fringe" zone so the month doesn't imply a longer festival.
- **Each lane carries its own verdict** in a right-hand column: `✓ 4 dates` in success green, or
  a muted *reason* when uncatchable ("sold out in this window", "not running in this window",
  "starts 11:00 — outside your times"). Uncatchable lanes dim as a whole (label + marks go grey),
  so the hero count is always visually auditable — you can see *which* shows the 5 are, and why
  the 3 aren't.
- Lanes are **sorted by start time** (morning → night), which gives the stack a "shape of your
  day" reading and clusters the time-slider's effect at the edges.

## Window mechanics — how the three controls relate

- **Date window:** two flags labelled `Start · 17 Aug` / `End · 21 Aug` on full-height violet
  lines (straight from the owner's sketch). The band between them gets a faint violet wash; the
  outside is scrimmed down. Flags anchor *outward* from their lines so they never collide when
  the window is dragged narrow. Drag a flag to resize; drag the band itself to slide the whole
  window; arrow keys nudge a focused flag one day. Ends are inclusive (the End flag sits on the
  right edge of its day).
- **Time-of-day:** a dual-handle range slider (10:00–24:00, 30-min snap, 1h minimum span) in the
  toolbar above the calendar. It filters on **start time** of each show. It sits beside the
  legend, deliberately out of the calendar canvas, since it's a whole-stack filter, not a
  per-day one.
- **The live count** (`5 / 8`, top-right, 50px, violet numerator) is the payoff: shows with ≥1
  available performance inside the date window whose start time is inside the time range. It
  bumps (scale pulse) on every change, and its sub-line restates the current window
  ("17–21 Aug · starting 13:00–22:00") so a screenshot of just the corner is self-explanatory.
  The three signals form one loop: drag anything → lanes re-dim, per-lane counts update, hero
  count bumps.
- The inline JS is demo-scale only (real drag + live recompute over hardcoded data) so the
  physicality of the interaction can be felt, but it is not app logic.

## Visual language

- Violet is reserved for **data and the window instrument**; green only for per-lane success and
  the upload confirmation; text stays in ink/muted tokens. Marks are thin (12px, 4px radius) with
  a hairline row separator; the grid chrome (weekday letters, day numbers) is deliberately
  recessive, weekends slightly bolder.
- Day cells carry `title` tooltips ("Mo 17 Aug · 19:30 · sold out") as a cheap hover layer.

## Decisions the owner may want to revisit

1. **Numbers don't line up across screens** by design: Screen 1 shows the spec's "42 loaded /
   40 matched" example, Screen 2 mocks 8 lanes. Real data (~40 favourites) needs a strategy —
   vertical scroll with sticky header + count, "catchable first" sorting, or collapse-the-dimmed.
2. **Time filter uses start time only.** It ignores end time / show duration; "end time" here
   means "latest acceptable start". If the owner meant "must *finish* by 22:00", the predicate
   (not the UI) changes.
3. **Lane sort order** — by start time now; by "most constrained first" (fewest available dates)
   is a strong alternative that surfaces the shows you must plan around.
4. **Sold-out days are shown** (hollow) rather than hidden. Rows never disappear when
   uncatchable — they dim with a reason. Both are anti-frustration choices worth confirming.
5. **Aug 26–31 is drawn** (shaded, no data) to keep the month honest; cropping to Aug 1–25 would
   buy ~20% more per-day width.
6. **Privacy line** ("nothing is uploaded to a server") on Screen 1 is an assumption about the
   architecture — remove if parsing happens server-side.

## Next refinements

- Hover popover on a day cell listing the exact performance (time, venue, buy link).
- A "widen to catch all 8" one-click suggestion when the count < total (compute the smallest
  window change that adds shows).
- Count-up/count-down microinteraction differentiating gains (green flash) from losses.
- Keyboard/AT pass beyond the basics already in the mock (handles expose `role="slider"` +
  `aria-value*`, arrow-key nudging works); add a table view of the same data for screen readers.
- Mobile adaptation is explicitly out of scope for this milestone (vertical time axis is the
  likely answer there).
