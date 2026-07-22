# Competitor landscape

How people discover Edinburgh Fringe shows today, and how each existing tool
handles — or ignores — the reachability question Fringe Discover is built around
("what can I actually make _right now_?"). Compiled once, refined in place.

## The incumbents

### Official Edinburgh Fringe app

The Fringe Society's own app browses and books the full programme and, closest to
our concept, carries a **"Nearby now"** finder for shows near the user's location
that are starting soon, a **"shake to search"** random-show suggestion, a "My
planner" for favourites, e-tickets, and show-starting notifications. It is
_proximity + starting-soon_, not full reachability: it does not model travel
mode, travel time, or the user's **next commitment** (the slack calculation).
The 2026 edition is due to download in July 2026.

### Plan My Fringe

A schedule **optimiser**: the user enters shows they'd like to see and rates
each; the app packs as many as it can into the visit, honouring budget and
**walking speed**, and offers a **"Fringe Trail"** that chains shows to minimise
walking and waiting between them, viewable as a route on Google Maps. It also
surfaces nearby shows. This is the closest tool to reachability-aware planning,
but it optimises a _multi-day plan the user curates in advance_, not the
in-the-moment "I have a free hour right now" decision.

### edfringe.com programme & filters

The official website lists every show with filters (date/time, genre, free) and a
personal favourites calendar — the canonical catalogue, strong for planning
ahead, weak for the spontaneous "near me, right now, still reachable" question.

### Half Price Hut

Same-day and next-morning **half-price** tickets, browsable online but
purchasable only in person at the Fringe Box Office. A price/spontaneity channel
rather than a discovery-by-reachability tool.

### Reviews & word of mouth

Outlets such as **ThreeWeeks**, plus star ratings on posters, drive a large share
of in-festival choice; discovery is heavily social and serendipitous.

## Where the gap is

No incumbent centres **full reachability** — location _plus_ travel mode/time
_plus_ the next-commitment slack ("can I see this and still make my 7pm?"). The
official app's "Nearby now" is the nearest neighbour but stops at proximity +
starting-soon; Plan My Fringe models walking time but for a pre-curated plan, not
the live "next hour" decision. That live reachability calculation is Fringe
Discover's distinct position — see the product brief (`docs/product-spec.md`).

## Sources

- [Fringe app — Edinburgh Festival Fringe](https://www.edfringe.com/experience/plan-your-visit/fringe-app/)
- [Edfringe on the App Store](https://apps.apple.com/gb/app/edfringe/id6450713971)
- [Plan My Fringe — Edinburgh Fringe Scheduler](https://www.planmyfringe.co.uk/)
- [Plan My Fringe on the App Store](https://apps.apple.com/gb/app/plan-my-fringe/id1264802429)
- [Edinburgh Festival Fringe (programme)](https://www.edfringe.com/)
- [Half Price Hut — Edinburgh Festival Fringe](https://www.edfringe.com/tickets/half-price-hut)
- [ThreeWeeks (Wikipedia)](https://en.wikipedia.org/wiki/ThreeWeeks)

## Open questions

- Does the 2026 official app's "Nearby now" add any travel-time or
  next-commitment logic, or is it still proximity + starting-soon? Re-check when
  the July 2026 app ships.
- Does Plan My Fringe (or any tool) expose real-time "started / sold-out" status
  the way Fringe Discover's live status does? Not yet confirmed.
- Are there newer entrants worth profiling (e.g. an app listed as "FRiNGE.Travel"
  surfaced in searches but was not yet examined)?
- What do users actually do in the "free hour" moment today — official app,
  posters, ask a friend? No cited behavioural source yet.

## Growth log

- **2026-07-22** — initial seed: profiled the official app (Nearby now / shake to
  search), Plan My Fringe (schedule optimiser + Fringe Trail), edfringe.com, the
  Half Price Hut, and reviews; framed the reachability gap. Sources cited.
