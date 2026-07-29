# Audience divergence — the live crowd vs the trip planners

EdFringeNow now points at two decisions with two front ends: *Fringe Discover*
(the mobile-first home site, "what can I make right now") and the planner at
`/plan` (desktop-first, "which of my favourites can I catch, on which dates").
This page exists to hold the evidence that **the two do not reduce to one set of
requirements** — where they pull apart, where they actively conflict, and the
narrow spine they genuinely share.

It is research, not requirements: nothing here is a decision. The requirements
implication (two tracks rather than one) is for a human to promote into
`product-wiki/product-requirements/`.

## Key insights

- **The two surfaces do not reduce to one requirement set** — that is this page's
  finding. It is evidence, not a decision: promoting it into requirements is a
  human's call.
- **Their objectives conflict outright.** The planner's greedy allocator
  maximises shows placed; the audience evidence says a good day is two or three
  shows with room left — the very gaps the live surface serves.
- **One catalogue, two incompatible honesty obligations.** Sold-out is a live
  *fact* for the live surface and a decaying *forecast* for a plan made in June;
  the same field cannot be presented the same way on both.
- **Zero input versus high-effort input.** The live surface's core virtue is
  asking nothing; the planner's front door is a favourites CSV the user extracts
  on another site, via a third-party browser extension.
- **"When should I come?" has no live analogue** — and no profiled competitor
  answers it. It is the planner's most valuable question and its least shared
  one.
- **What the two genuinely share is small**: one catalogue and venue geometry,
  the travel model, honesty about missing data, and the same emotional promise of
  lifting the overwhelm.
- **The one place a shared requirement is justified is the handover** — plan →
  live, "your plan says you're free until 19:00" — and nothing today connects
  them.

## The two crowds in a line each

- **Live, in-festival.** On the ground in Edinburgh during 7–31 August, deciding
  for the next hour or two. A third of the Fringe audience lives in Edinburgh and
  has no trip to plan at all; most ticket buyers buy a single ticket.
- **Trip planners.** Two thirds of the audience come from outside Edinburgh,
  choose dates and beds, and assemble a favourites list months before August —
  the 2026 programme launched on 4 June, and audiences now engage with the
  festival long before it starts.

They may be the same person in different states — the Fringe CEO's "rule of
thirds" describes one visitor pre-planning about a third of their time and
leaving the rest open. That does not make it one requirement set; it makes the
handover between the two surfaces a design problem in its own right.

## Where they diverge

| Axis | Live surface | Planner |
|---|---|---|
| **Horizon** | the next 1–2 hours | a stay chosen weeks out, then re-tuned |
| **Origin** | device location, "here, now" | no useful location; an accommodation base at best |
| **Taste input** | zero-effort defaults, genre chips, free/paid | an explicit favourites list built elsewhere, at high effort |
| **Correctness** | is this *still* catchable — a live fact | will this *be* catchable — a forecast that decays |
| **Objective** | one good, reachable option now | a whole trip's worth, and which dates make it possible |
| **Cost of error** | a wasted walk, a late entrance | non-refundable tickets, travel and beds booked around a wrong plan |
| **Device & context** | phone, outdoors, one hand, sunlight, patchy signal | desktop, indoors, deliberate, wide canvas |
| **Time to value** | seconds; typing is failure | minutes of deliberate work is acceptable |
| **State** | stateless — the answer expires with the hour | persistent — favourites, window, itinerary, exports (CSV/ICS) |
| **Season** | only 7–31 August, and value shifts across the run | February–July, peaking after each programme drop |
| **Success** | "I chose something and I made it" | "N of my favourites got caught, and the days were liveable" |

## Requirements that actively conflict

These are the places where satisfying one crowd well makes the other worse.
Naming them is the point of this page.

1. **Pack the day vs leave the day open.** The planner's allocator is an
   earliest-finish-first greedy — it maximises the number of shows placed. The
   audience evidence points the other way: two to three shows a day is the pace
   commonly advised, visitors who combined structured planning with open time
   reported higher satisfaction than over-schedulers, and the rule of thirds asks
   for roughly a third of the time planned. A planner that fills the day
   optimally also destroys the gaps the live surface serves. The two surfaces can
   be jointly optimal only if the planner's objective is *not* "maximum shows".
2. **Live truth vs planning truth, from one catalogue.** Both surfaces read the
   same `data/normalized/shows.json`. For the live surface, sold-out /
   started-already is a *fact* and staleness is the core failure mode. For the
   planner, the same field is a *forecast* about a date weeks away, which decays
   in the opposite direction (shows sell out as August approaches; walk-ups are
   easy in week one and scarce in weeks two and three). Identical data, two
   incompatible honesty obligations — the planner arguably must show "may sell
   out before you book" where the live surface must show "gone".
3. **Zero input vs high-effort input.** The brief's live target is "a brand-new
   user with zero taps already sees useful results". The planner's front door is
   a CSV export the user produces on another site — and, as far as the research
   shows, via a third-party browser extension. One surface's core virtue is
   asking nothing; the other's is asking for something quite hard to obtain.
4. **Personalisation model.** Live personalisation is coarse taste (ten festival
   genres, free/paid) applied to whatever is reachable. Planner personalisation
   is an explicit, already-curated favourites set — a different data model, a
   different privacy posture (the planner keeps parsed favourites in
   `localStorage` for three days; the live surface keeps nothing), and different
   recommendation logic. Merging them into "one personalisation system" would
   serve neither.
5. **What "optimise" even means.** Live: maximise the chance the user goes and
   enjoys one show inside a slack budget. Planner: maximise favourites caught
   across a window — and, upstream of that, choose the window. The planner's
   *most valuable* question ("when should I come?") has no live analogue at all,
   and no profiled competitor answers it.
6. **Which constraints are even visible.** The live surface's binding constraint
   is travel time to the next commitment. The planner's real binding constraint
   may not be shows at all: over half of would-be attendees reportedly could not
   find affordable accommodation within a 90-minute commute, so dates are chosen
   against beds. `/plan`'s "pick my best dates" scores windows purely on show
   catchability — optimising a variable the user may not be free to move.
7. **Failure of the map.** Live, a map answers "where is that relative to me".
   In the planner, there is no "me" — the map's job becomes clustering and
   walkability across a day, which is a different visualisation with different
   requirements (and the reason the planner's schedule draws travel legs rather
   than a map).

## What the two genuinely share

Small, and worth keeping small deliberately:

- **One catalogue and one venue geometry** — the scraped `shows.json` /
  `venues.json`, already shared, plus the haversine + per-mode travel model in
  `plan/lib/travel.js` and the `UK_BOUNDS` helper both front ends import.
- **Honesty about data gaps** — no ticket prices beyond free/paid, no live seat
  counts beyond a sold-out flag. Neither surface may imply data we don't have.
- **The same emotional promise** — the overwhelm lifting. 37% of audiences
  reported struggling to pick a show; both surfaces exist to answer that, at
  different distances from the decision.
- **A handover, in one direction.** The planner's deliberate gaps are the live
  surface's demand. Nothing today connects them (no shared favourites, no "your
  plan says you're free until 19:00"), and that connection is the one place where
  a *shared* requirement would be justified.

## Sources

- [How to use your audience data with a purpose: the Edinburgh Festival Fringe (Thrive)](https://wewillthrive.co.uk/resources/case-studies/how-to-use-your-audience-data-with-a-purpose-the-edinburgh-festival-fringe/) — a third of the audience lives in Edinburgh; two thirds of ticket buyers bought one ticket; 37% struggled to pick a show.
- [Fringe 2026 — How the Audience Has Changed (The Edinburgh Reporter)](https://theedinburghreporter.co.uk/2026/05/fringe-2026-how-the-audience-has-changed/) — months-ahead engagement; the CEO's "rule of thirds".
- [Edinburgh Fringe 2026: First-Timer's Planning Guide (Discover Edinburgh Fringe)](https://discoveredinburghfringe.com/en/blog/edinburgh-fringe-2026-first-timers-planning-guide) — two-to-three shows a day; walk-ups easy in week one, scarce in weeks two and three.
- [Ten tips for Fringe first-timers in 2026 (Edinburgh Festival City)](https://www.edinburghfestivalcity.com/inspiration/128-five-tips-for-fringe-first-timers) — leave travel time between venues.
- [Late night transport and 'live dashboard' could solve Edinburgh's festival accommodation crisis (The Scotsman)](https://www.scotsman.com/arts-and-culture/late-night-transport-and-live-dashboard-could-solve-edinburghs-festival-accommodation-crisis-5239090) — over half unable to find affordable accommodation within a 90-minute commute.
- [The 2026 Edinburgh Festival Fringe programme is now live (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/mixitup-with-the-2026-edinburgh-festival-fringe-programme/) — 4 June 2026 launch; 7–31 August dates.
- [EdFringe Favourites to CSV (Chrome Web Store)](https://chromewebstore.google.com/detail/edfringe-favourites-to-cs/ebbiecdkhoclnlgfibfhhnpfhmmgdbcc) — the third-party export path the planner's intake depends on.
- [Plan My Fringe — Help](https://www.planmyfringe.co.uk/Help.aspx) — the competing planner's constraint set (budget, walking speed, per-day max, minimum gap, meal and sleep minimums).
- [EdFringeNow — Fringe Discover product & experience brief (`docs/product-spec.md`)](https://github.com/missingbulb/EdFringeNow/blob/main/docs/product-spec.md) — the live surface's stated inputs, outputs and zero-input target.
- [EdFringeNow — Fringe Planner README (`plan/README.md`)](https://github.com/missingbulb/EdFringeNow/blob/main/plan/README.md) — the planner's intake, engine, controls, exports and three-day `localStorage` retention.
- [EdFringeNow — planner scheduling engine (`plan/lib/engine.js`)](https://github.com/missingbulb/EdFringeNow/blob/main/plan/lib/engine.js) — the earliest-finish-first greedy that maximises placed shows.

## Open questions

- **Is the shared person real, or two populations?** No evidence found either way
  on how many planner users are also in Edinburgh mid-festival. If the overlap is
  large, the handover (plan → live) is the highest-value unbuilt feature; if it
  is small, the two products should probably diverge further, not converge.
- **What should the planner optimise for?** "Most shows placed" is contradicted
  by the satisfaction evidence, but "leave a third open" has no measured optimum
  either. What does a *good* Fringe day look like, quantitatively?
- **How does availability actually decay between planning and August?** Nothing
  cited yet on sell-out rates by week or by show popularity — which decides how
  honest the planner can be about a plan made in June.
- **Does the accommodation constraint dominate date choice?** If it does, date
  scoring needs a second input the product doesn't have.
- **Is there a third crowd?** Artists, reviewers and industry are all in the same
  data with different needs (own-show scheduling, review runs); nothing here has
  looked at them.
- **Does the divergence extend to the scraper?** The live surface wants frequent
  refresh of status for today; the planner wants a stable whole-festival
  snapshot. Whether one data pipeline serves both well is unexamined.

## Growth log

- **2026-07-28** — initial seed, created deliberately after the owner asked for
  research covering both the live in-festival crowd and the trip-planning crowd
  without assuming a single requirement set. Compiled the divergence axes, the
  seven concrete requirement conflicts, and the shared spine, from the audience
  evidence gathered on the market-and-audience page plus the repo's two surfaces.
  Sources cited.
- **2026-07-29** — added the page's `## Key insights` header, distilled from what
  is already on the page (the non-reducibility finding, the sharpest of the seven
  conflicts, the small shared spine, and the handover). Header only: no claim,
  citation or open question changed.
