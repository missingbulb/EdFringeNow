# Competitor landscape

How people discover and schedule Edinburgh Fringe shows today, and how each
existing tool handles — or ignores — the two questions EdFringeNow is built
around: *"what can I actually make right now?"* (the home site, Fringe Discover)
and *"which of my favourites can I actually catch, on which dates?"* (the planner
at `/plan`). Compiled once, refined in place.

The field is not one field. The live/in-the-moment side has essentially one
incumbent; the planning side is crowded, and got noticeably more crowded for
2026.

## Key insights

- Nobody does live reachability. "Nearby now" stops at close and starting soon.
- The official app plans better than we assumed — calendar sync, offline, 200k downloads.
- Clash-free, travel-aware scheduling is table stakes. Plan My Fringe shipped it years ago.
- Three claims are unclaimed: import my favourites, pick my dates, and the other seven August festivals.
- Fringe Finder plans around what is still on sale. That is the axis we are behind on.
- Half Price Hut tickets are in person only — live supply no app can see.
- Nobody here has used any 2026 rival. All of it is compiled from their own marketing.

## The incumbents

### Official Edinburgh Fringe app

The Fringe Society's own app browses and books the full programme and serves
**both** of our questions — one weakly, one properly.

- Closest to Fringe Discover: **"Nearby now"**, which uses phone location to show
  shows near you that are starting soon, plus **"shake to search"** for a random
  suggestion. Every published description of the feature (the official page,
  press coverage, the app-store listing, the build agency's case study) still
  frames it as *proximity + starting soon*. None mentions travel mode, travel
  time, or the user's **next commitment** — the slack calculation. No description
  of the 2026 edition claims otherwise.
- On the planning side it is stronger than this page previously recorded: **My
  Planner** saves shows by date and **syncs them to the user's own calendar**,
  alongside e-ticket QR codes, an **offline mode** for saved performances and
  tickets, and notifications when the next show starts.
- Reach: the build agency's case study reports downloads **surpassing 200,000** —
  a distribution no independent tool in this field is likely to match.

The 2026 edition was again due to download in July 2026.

### Plan My Fringe

A schedule **optimiser**, and the closest existing thing to `/plan`. Its current
feature list overlaps ours almost item for item: a wishlist with per-show
ratings, then a schedule packing in as many shows as it can while honouring
**maximum budget**, **maximum shows per day**, **minimum gap between shows**,
**average walking speed**, and **minimum lunch, evening meal and sleep times**.
Its **"Fringe Trail"** chains shows to minimise walking and waiting and can be
viewed as an animated route on Google Maps; the website and app share one
wishlist, schedule and preferences; a **Recommendations** section (and a
"Fringey" chat) suggests shows using AI.

What it does *not* appear to do: start from the user's **edfringe.com favourites
export**, or answer **"which dates should I come?"** — it optimises within a visit
the user has already decided on. That, rather than clash-free scheduling, is
where `/plan`'s remaining distinctness sits.

### edfringe.com programme, filters and favourites

The canonical catalogue, with filters (date/time, genre, free) and a personal
favourites list — strong for planning ahead, weak for the spontaneous "near me,
right now, still reachable" question. Favourites are the input `/plan` consumes;
extracting them as CSV is served by a **third-party Chrome extension** ("EdFringe
Favourites to CSV", maintained per festival year), not by any documented native
export.

### Half Price Hut

Same-day and next-morning **half-price** tickets, browsable online but purchasable
**in person only** at the Fringe Box Office (opening 12 August in 2026). A
price/spontaneity channel rather than a discovery-by-reachability tool — and a
reminder that a slice of live supply never appears in any app's inventory.

### Reviews & word of mouth

Outlets such as **ThreeWeeks**, plus star ratings on posters and Royal Mile
flyering, drive a large share of in-festival choice; discovery is heavily social
and serendipitous. Around 4,300 professional reviews were uploaded to edfringe.com
in 2025.

## The 2026 planner-side field

Several independent tools aimed squarely at the trip-planning crowd surfaced for
2026. None was profiled in this wiki's first pass, and together they change the
read on where the gap is.

- **[Plan Your Fringe](https://planyourfringe.com/)** — "checks every single show
  against your dates, taste and budget and builds your day-by-day itinerary";
  free, independent, about two minutes end to end, itinerary downloadable as a
  PDF. Direct overlap with `/plan`'s output, without the favourites import.
- **[Fringe Finder](https://fringe-finder.netlify.app/)** — browse every 2026
  show, **track ticket availability**, and plan days with an **AI assistant** that
  builds a day-by-day plan from what is *still on sale*; describes itself as an
  official festival pilot (unverified). Availability-aware planning is the piece
  most tools skip — and the one axis where we are behind rather than ahead.
- **[Fringe Planner / edfringemap.com](https://edfringemap.com/)** — every show on
  one interactive map, filterable by day, genre, area, price and start time, then
  book. The closest thing to Fringe Discover's *map* surface, though as a
  browse-and-filter map rather than a reachability calculation.
- **[Ed Fringe Guide](https://edfringeguide.com/index.html)** and **[Another
  Fringe Guide](https://www.anotherfringeguide.com/)** — unofficial show finders /
  browsers, comedy-leaning.
- **[Edinburgh Fringe Planner](https://edfringeplanner.co.uk/)** — a further
  independent planner surfaced in the same sweep, not yet examined.

## The cross-festival field (almost empty)

Every tool above is a *Fringe* tool. The city runs eight overlapping festivals in
August, and only one profiled competitor spans them:

- **[Data Thistle](https://edinburghfestival.datathistle.com/)** — combined
  listings across the Fringe, International, Book, Jazz, Tattoo, Art, Film, Free
  Fringe, Free Festival and Fringe by the Sea, plus a commercial events API. A
  listings directory rather than a planner: no reachability, no itinerary, no
  favourites. The closest thing found to a multi-festival competitor.
- The **[Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/projects)**
  publishes a gallery of 13 apps built on it — Plan My Fringe, FringeFlow,
  TicketBadger, Frindr, myFestival, Festival Clock, Fringe Vibes and others.
  The data covers all 11 festivals; almost every app on it is named and framed
  around the **Fringe alone**. Nobody in the gallery claims cross-festival
  planning.

Two caveats on how strong that reads. The gallery blurbs are the only evidence —
nobody here has used these tools, and the gallery may simply be stale. And a
cross-festival tool would not necessarily be *listed* there, since the API is not
the only source. Treat "the cross-festival claim is unclaimed" as the current
best reading, not a settled finding.

## Where the gaps are

**Live reachability — still open.** No tool centres full reachability: location
_plus_ travel mode/time _plus_ next-commitment slack ("can I see this and still
make my 7pm?"). The official app's "Nearby now" remains the nearest neighbour and
stops at proximity + starting-soon; Plan My Fringe models walking time, but for a
pre-curated plan. That live calculation is still Fringe Discover's distinct
position — see the product brief (`docs/product-spec.md`).

**Planning — crowded, and the moat is narrower than it looks.** Clash-free,
travel-aware, meal-break-aware scheduling with per-day limits is **table stakes**
on this side of the field: Plan My Fringe has shipped all of it for years, and
2026 added at least two more itinerary builders. What no profiled competitor
does:

1. start from the user's **existing favourites list** rather than making them
   re-pick shows inside the tool; and
2. answer **"when should I come?"** — scoring date windows across the whole
   festival, the decision a visitor makes *before* any scheduling question
   exists.

Those two, not the scheduler, are what a planner-side requirement set would rest
on. They are also a different claim from the live surface's, which is why the two
surfaces should not be reasoned about as one product — see
[audience-divergence/](../audience-divergence/README.md).

## Sources

- [Fringe app — Edinburgh Festival Fringe](https://www.edfringe.com/experience/plan-your-visit/fringe-app/)
- [Edfringe on the App Store](https://apps.apple.com/gb/app/edfringe/id6450713971)
- [How the Edinburgh Fringe app works — including nearby event finder (The Scotsman)](https://www.scotsman.com/arts-and-culture/edinburgh-festivals/edinburgh-festival-fringe-app-4214702)
- [Edinburgh Fringe Festival app case study (equ)](https://equ.com.au/work/edinburgh-fringe-festival/)
- [Plan My Fringe — Edinburgh Fringe Scheduler](https://www.planmyfringe.co.uk/)
- [Plan My Fringe — Help](https://www.planmyfringe.co.uk/Help.aspx)
- [Plan My Fringe on the App Store](https://apps.apple.com/gb/app/plan-my-fringe/id1264802429)
- [Plan Your Fringe](https://planyourfringe.com/)
- [Fringe Finder — Edinburgh Fringe 2026 planner](https://fringe-finder.netlify.app/)
- [Fringe Planner 2026 — interactive map (edfringemap.com)](https://edfringemap.com/)
- [Ed Fringe Guide — unofficial Edinburgh Fringe show finder 2026](https://edfringeguide.com/index.html)
- [Another Edinburgh Fringe Show Finder](https://www.anotherfringeguide.com/)
- [Edinburgh Fringe Planner](https://edfringeplanner.co.uk/)
- [EdFringe Favourites to CSV (Chrome Web Store)](https://chromewebstore.google.com/detail/edfringe-favourites-to-cs/ebbiecdkhoclnlgfibfhhnpfhmmgdbcc)
- [Edinburgh Festival Fringe (programme)](https://www.edfringe.com/)
- [Half Price Hut — Edinburgh Festival Fringe](https://www.edfringe.com/tickets/half-price-hut)
- [Edinburgh Festival Fringe Box Office](https://www.edfringe.com/experience/plan-your-visit/fringe-box-office/)
- [We've published our review of the year 2025 (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/weve-published-our-review-of-the-year-2025/)
- [ThreeWeeks (Wikipedia)](https://en.wikipedia.org/wiki/ThreeWeeks)
- [Edinburgh Festival 2026 — combined listings (Data Thistle)](https://edinburghfestival.datathistle.com/)
- [Projects built on the Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/projects)

## Open questions

- **Hands-on verification is missing for every 2026 entrant.** All of the above
  was compiled from published descriptions and search results; no tool was driven
  end to end. Fringe Finder's "official festival pilot" claim in particular is
  unverified and matters — an official pilot on the planning side would change
  the competitive read.
- **Does the shipped 2026 official app add travel-time or next-commitment logic
  to "Nearby now"?** Published descriptions still say proximity + starting soon,
  but nobody here has used the 2026 build. (Narrowed 2026-07-28 from "unknown" to
  "no published evidence of it".)
- **Does any tool expose real-time started / sold-out status** the way Fringe
  Discover's live status does? Fringe Finder claims availability-aware planning
  ("what's actually still on sale"); how live that is, and where it comes from,
  is unconfirmed.
- **Does Plan My Fringe (or any planner) accept a favourites import?** If one
  does, `/plan`'s intake advantage disappears; nothing found so far says one
  does.
- **Does anything else score date windows** ("when should I come?"), or is that
  genuinely unoccupied?
- **Is anything actually planning across festivals?** The Listings API gallery
  says no, but the gallery is self-reported and possibly stale, and a
  cross-festival tool need not appear on it. Data Thistle lists everything and
  plans nothing — is that the whole field, or just the visible part of it?
- **Does Data Thistle's events API compete with us or supply us?** It is a paid
  feed over the same listings the free official API already gives away; what it
  adds is unexamined.
- "FRiNGE.Travel" surfaced in an earlier sweep and was never examined.
- What do users actually do in the "free hour" moment today — official app,
  posters, ask a friend? Still no cited behavioural source (the same gap is
  recorded on the market-and-audience page).

## Growth log

- **2026-07-22** — initial seed: profiled the official app (Nearby now / shake to
  search), Plan My Fringe (schedule optimiser + Fringe Trail), edfringe.com, the
  Half Price Hut, and reviews; framed the reachability gap. Sources cited.
- **2026-07-28** — reframed the page around both product surfaces after taking
  `/plan` into account, and split "where the gap is" into a live gap and a
  planning gap. Added the 2026 planner-side entrants (Plan Your Fringe, Fringe
  Finder, edfringemap.com, Ed Fringe Guide, Another Fringe Guide, Edinburgh
  Fringe Planner); expanded Plan My Fringe's current feature list (budget,
  walking speed, per-day max, minimum gap, minimum lunch/dinner/sleep, AI
  recommendations) and recorded that it neither imports favourites nor chooses
  dates; recorded the official app's My Planner / calendar sync / offline mode
  and its 200k+ downloads; noted the third-party favourites-CSV extension and the
  Half Price Hut's 2026 opening date. Narrowed the "2026 app Nearby now" open
  question rather than closing it. Requirements implication (planner-side
  requirements resting on favourites-intake and date-choice, not on scheduling)
  left for human review.
- **2026-07-29** — added the page's `## Key insights` header: seven terse lines
  distilled from what the page already says (the live-reachability gap, the
  official app's planning strength, scheduling as table stakes, the two
  unclaimed claims, the availability axis, in-person supply, the verification
  gap). Header only: no claim, citation or open question changed.
- **2026-07-31** — added the cross-festival field, found while researching the
  other Edinburgh festivals: Data Thistle (combined listings across ten
  festivals plus a paid events API — a directory, not a planner) and the
  official Listings API's gallery of 13 apps, almost all Fringe-only despite the
  data covering all 11 festivals. Recorded the evidence's weakness (self-reported
  blurbs, possibly stale, not exhaustive) rather than claiming the field empty.
  Key insight 4 rewritten from two unclaimed claims to three — the other seven
  August festivals joins favourites-import and date-choice. Two open questions
  added. Requirements implication left for human review — see the
  festival-season page and the multi-festival design proposal.
