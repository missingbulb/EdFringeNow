# Competitor landscape

How people discover and schedule Edinburgh Fringe shows today, and how each
existing tool handles — or ignores — the two questions EdFringeNow is built
around: *"what can I actually make right now?"* (the home site, Fringe Discover)
and *"which of my favourites can I actually catch, on which dates?"* (the planner
at `/plan`). Since 2026-09-01 the page also holds the planner field **beyond**
Edinburgh, because the product's direction is now festival planning generally —
see *The field beyond Edinburgh* below, and
[comedy-festival-circuit/](../comedy-festival-circuit/README.md) for the
festivals themselves. Compiled once, refined in place.

The field is not one field. The live/in-the-moment side has essentially one
incumbent; the planning side is crowded, and got noticeably more crowded for
2026.

## Key insights

- Nobody ships live reachability yet — but Plan Your Fringe now teases a live "near me now" as coming.
- The official app plans better than we assumed — calendar sync, offline, 200k downloads.
- Scheduling is table stakes: Plan My Fringe years ago, FringePlan now — plus iCal, sharing and edfringe basket handoff.
- Favourites import is taken, and cross-festival is now contested (planmyfestivals). Only date-choice is still clean.
- Fringe Finder plans around what is still on sale, walking times included. That is the axis we are behind on.
- Outside Edinburgh the planner category is empty — MICF (750+ shows) and Netflix Is A Joke (475+) have nobody.
- Every 2026 rival's own page is now read first-hand. None has been driven end to end.

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
  Read first-hand 2026-09-01 (the egress block that forced second-hand reading
  has lifted — see the correction under *Where the gaps are*), which added four
  things its marketing summary hid: it is **built by a performing comedian**
  (David William Bryan, who surfaces his own two shows beside the "impartial"
  itinerary), the plan is delivered by **email-gated PDF** (name + address
  before the itinerary), the site still checks against **"3,649 shows"** — the
  stale 4 June launch snapshot, ~15% short of the delivered festival, the exact
  trap [market-and-audience/](../market-and-audience/README.md) documents — and
  it now pushes a companion app, **FringePal** ("bigger and better than this
  site"), not previously in this wiki. Its early-access pitch names **live
  "near me now"** as a coming feature — the first competitor seen announcing
  intent on the live-reachability axis.
- **[Fringe Finder](https://fringe-finder.netlify.app/)** — browse every 2026
  show, **track ticket availability**, and plan days with an **AI assistant** that
  builds a day-by-day plan from what is *still on sale*. Its own page (fetched
  2026-09-01) asserts "an official pilot with the Edinburgh Festival Fringe" —
  the claim is on the page, though still unconfirmed from the Fringe Society's
  side — counts "4,128 shows", says listings are "refreshed several times a
  day and may lag the box office", sends all ticket sales to edfringe.com, and
  pitches concierge-built days "that actually work — **walking times
  included**". Availability-aware planning is the piece most tools skip — and
  the one axis where we are behind rather than ahead; walking-time-aware
  itineraries bring it a step closer to the travel-model territory this wiki
  previously recorded as ours alone.
- **[Fringe Planner / edfringemap.com](https://edfringemap.com/)** — every show on
  one interactive map, filterable by day, genre, area, price and start time, then
  book. The closest thing to Fringe Discover's *map* surface, though as a
  browse-and-filter map rather than a reachability calculation.
- **[Ed Fringe Guide](https://edfringeguide.com/index.html)** and **[Another
  Fringe Guide](https://www.anotherfringeguide.com/)** — unofficial show finders /
  browsers, comedy-leaning.
- **[Edinburgh Fringe Planner](https://edfringeplanner.co.uk/)** — examined
  2026-08-09, and it is the one that matters. Its own one-line pitch is that it
  **"takes your favourites from edfringe.com and helps you work out what to do
  when"** — i.e. exactly `/plan`'s intake, the thing this page previously
  recorded as unclaimed. See the correction under *Where the gaps are*.
  Verified first-hand 2026-09-01: the landing page carries exactly that pitch
  plus "express stronger or weaker preferences… work out how to schedule your
  days", behind a login — so the favourites *mechanism* stays invisible from
  outside an account.
- **[FringePlan](https://fringeplan.com/)** — surfaced 2026-08-09 and not
  previously in this wiki. Free ("free for everyone, forever… no subscriptions,
  no ticket markups, and no hidden fees"). It takes a show list by pasted link,
  by name search, or "a whole list at once", pulling titles, venues, dates and
  performance times automatically; shows are marked high/medium/low priority;
  the schedule respects **travel time, meals and priorities**, and the user sets
  arrival/departure once so days can start from their hotel. Outputs are the
  broadest of any tool profiled here — a read-only share link, a **live iCal
  feed**, and a **markdown export**. Two features nothing else on this page
  claims: a bookmark that **sends a whole day of shows to an edfringe.com basket
  in one go**, and plans that **flag a delisted show or a moved performance
  rather than going stale**. Read first-hand 2026-09-01: the homepage states
  that pasting shows pulls in "**ticket availability colours** …
  automatically" — so it does hold per-performance availability (answering
  this page's open question about its stale-plan flagging), and its stated
  origin is a solo side project born of the official app being "rebuilt from
  scratch" every year, arriving "far too late", and being "a listings browser,
  not a planner".
- **[planmyfestivals.com](https://www.planmyfestivals.com/)** — surfaced
  2026-08-02, self-titled "Edinburgh Festival Planner 2026". Fetched and
  examined 2026-09-01, and the scope question its plural name raised is now
  answered: it is an **Edinburgh cross-festival planner**, not a multi-city
  one. The site is a Vue single-page app with a Leaflet + OpenStreetMap map,
  and its [application bundle](https://www.planmyfestivals.com/assets/app-BRlWgudd.js)
  carries the other Edinburgh festivals as first-class strings — Tattoo, Book,
  International, Art, Jazz — alongside the Fringe. How much it *plans* across
  them (itineraries vs a combined map/listing) can't be read from the shell
  page alone, but the cluster scope is real — see *The cross-festival field*
  below, whose "almost empty" reading this weakens.

## The cross-festival field (thinner than it looked, no longer empty)

Every tool above except one is a *Fringe* tool. The city runs eight overlapping
festivals in August; two profiled competitors now span them:

- **[planmyfestivals.com](https://www.planmyfestivals.com/)** — the first
  actual cross-festival *planner-shaped* entrant found (2026-09-01): an
  Edinburgh cluster app whose bundle carries Fringe, Tattoo, Book,
  International, Art and Jazz together, on a map. Depth unexamined — it may be
  a combined map rather than an itinerary builder — but the claim this section
  previously rested on ("no tool plans across the festivals") can no longer be
  stated flatly.

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

## The field beyond Edinburgh (empty, and verified empty)

Researched 2026-09-01, festival by festival, for the widened product direction.
The finding is stark: **outside Edinburgh, the third-party festival-planner
category does not exist.** Searches for an Adelaide Fringe or Brighton Fringe
planner return *Edinburgh's* Plan My Fringe as the top hits; nothing third-party
was found for [Melbourne International Comedy Festival](https://www.comedyfestival.com.au/2026-program-guide/)
(750+ shows), [Just For Laughs Montreal](https://www.mtl.org/en/experience/just-for-laughs-festival),
[Netflix Is A Joke](https://www.hollywoodreporter.com/tv/tv-news/netflix-is-a-joke-festival-2026-lineup-schedule-los-angeles-1236478031/)
(475+ shows across 35 LA venues, per The Hollywood Reporter — and no official
app either), [SF Sketchfest](https://sfsketchfest2026.sched.com/), or SXSW's
official programme. Where planning tooling exists at all, it is official or
rented SaaS:

- **[Sched](https://sfsketchfest2026.sched.com/)** — SF Sketchfest outsources
  its schedule to a generic event-SaaS instance (personal schedules, calendar
  sync).
- **[SXSW GO](https://www.eventbase.com/sxsw-go)** — the official app, built on
  Eventbase; schedule building and networking, with a documented gap (no
  custom/unofficial events) that a third-party ecosystem fills only for
  *parties*, via [Do512](https://2025.do512.com/) and
  [RSVPATX](https://rsvpatx.com/rsvp-list) RSVP aggregators.
- **[Adelaide Fringe's official app](https://adelaidefringe.com.au/our-app)**
  (built by Katalyst) plus an on-site
  ["My plan" web planner](https://adelaidefringe.com.au/my-fringe/plan) —
  wishlist and sort-by-day, the closest official analogue to `/plan` found
  anywhere.
- **[Brighton Fringe's official app](https://www.dabapps.com/work/clients/brighton-fringe-app/)**
  (built by agency DabApps, buying tickets through the festival's own APIs).
- **MICF has no current official app found at all** — the only trace is a
  [2010-era iPhone app](https://itwire.com/software/laugh-it-up-on-the-iphone-melbourne-international-comedy-festival-app.html).

The structural analogue where the category *is* proven: **music festivals.**
[Clashfinder](https://clashfinder.com/) is the closest cousin to what a
generalized EdFringeNow would be — free, crowdsourced lineup-clash grids for
hundreds of festivals, personal act highlighting, and **JSON, XML and iCalendar
export**; it already hosts a few tiny UK comedy events
([Exeter Comedy Festival](https://clashfinder.com/s/ecf26/),
[Cambridge Fringe](https://clashfinder.com/m/cambridgefringe2025/)) but has
no Edinburgh Fringe grid — plausibly because a 3,000-show open-access festival
exceeds what a hand-edited grid can carry. Around it sit a dozen consumer
set-time apps ([Festival Dust](https://www.festivaldust.com/),
[Headliners](https://apps.apple.com/us/app/headliners-festival-planner/id6478820193),
[Frontstage](https://www.frontstagefestivals.com/app), …), the organizer-side
platform [Woov](https://woov.com/) (600+ partner festivals, B2B), and
[Songkick's festivals directory and public API](https://www.songkick.com/developer)
— the machine-readable festival dataset comedy entirely lacks. The read for the
product: the planning-demand shape is proven at scale in music, unserved in
comedy, and first-in-category open everywhere except Edinburgh.

## Where the gaps are

**Live reachability — still open, and no longer unnoticed.** No tool centres
full reachability: location _plus_ travel mode/time _plus_ next-commitment slack
("can I see this and still make my 7pm?"). The official app's "Nearby now"
remains the nearest neighbour and stops at proximity + starting-soon; Plan My
Fringe models walking time, but for a pre-curated plan. That live calculation is
still Fringe Discover's distinct position — see the product brief
(`docs/product-spec.md`). Two 2026-09-01 signals that the position is being
approached from the planning side: Fringe Finder's concierge pitches days
"that actually work — walking times included", and Plan Your Fringe's
early-access pitch names **live "near me now"** as a feature it is building.
Neither is shipped live reachability; both are competitors walking toward it.

**Planning — crowded, and the moat is narrower than it looks.** Clash-free,
travel-aware, meal-break-aware scheduling with per-day limits is **table stakes**
on this side of the field: Plan My Fringe has shipped all of it for years, and
2026 added at least three more itinerary builders.

**Correction (2026-08-09) — the favourites-intake claim is taken.** This page
previously asserted that *no* profiled competitor starts from the user's
existing favourites list, and rested half of `/plan`'s remaining distinctness on
it. That is no longer supportable:
[edfringeplanner.co.uk](https://edfringeplanner.co.uk/) advertises precisely
that as its whole premise ("takes your favourites from edfringe.com"), and
[FringePlan](https://fringeplan.com/) accepts a whole pasted list in one go and
pushes a finished day back into an edfringe.com basket. The claim is left here
rather than deleted so the change of position is visible. What *survives* of it
is narrower and worth stating precisely: nobody was found taking the specific
**CSV produced by the third-party favourites extension**, and no competitor
documents where its favourites come from — so whether these tools use a native
export, the same extension, or a logged-in scrape is unknown, and that is now the
open question rather than the differentiator.

What no profiled competitor still does:

1. answer **"when should I come?"** — scoring date windows across the whole
   festival, the decision a visitor makes *before* any scheduling question
   exists. Re-checked this pass across Plan Your Fringe, Fringe Finder,
   edfringeplanner, FringePlan and Plan My Fringe: every one of them takes the
   visit dates as an **input** and optimises inside them. Still unoccupied.
2. plan across the **other seven August festivals** — weakened 2026-09-01 from
   "unclaimed" to "contested": planmyfestivals.com demonstrably carries the
   cluster (see the section above), though whether it *plans* across it or
   only maps it is unexamined.

Those two, not the scheduler and no longer the favourites intake, are what a
planner-side requirement set would rest on. They are also a different claim from
the live surface's, which is why the two surfaces should not be reasoned about as
one product — see [audience-divergence/](../audience-divergence/README.md).

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
- [Edinburgh Fringe Planner](https://edfringeplanner.co.uk/) — "takes your favourites from edfringe.com and helps you work out what to do when."
- [Edinburgh Fringe Planner — sign up](https://edfringeplanner.co.uk/signup)
- [FringePlan — Edinburgh Fringe Planner](https://fringeplan.com/) — clash-free schedule with travel time, meals and priorities; read-only share link, live iCal feed, markdown export, one-go edfringe.com basket, and stale-plan flagging.
- [EdFringe Favourites to CSV (Chrome Web Store)](https://chromewebstore.google.com/detail/edfringe-favourites-to-cs/ebbiecdkhoclnlgfibfhhnpfhmmgdbcc)
- [Edinburgh Festival Fringe (programme)](https://www.edfringe.com/)
- [Half Price Hut — Edinburgh Festival Fringe](https://www.edfringe.com/tickets/half-price-hut)
- [Edinburgh Festival Fringe Box Office](https://www.edfringe.com/experience/plan-your-visit/fringe-box-office/)
- [We've published our review of the year 2025 (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/weve-published-our-review-of-the-year-2025/)
- [ThreeWeeks (Wikipedia)](https://en.wikipedia.org/wiki/ThreeWeeks)
- [Edinburgh Festival 2026 — combined listings (Data Thistle)](https://edinburghfestival.datathistle.com/)
- [Projects built on the Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/projects)
- [FringePlan](https://fringeplan.com/)
- [planmyfestivals.com — Edinburgh Festival Planner 2026](https://www.planmyfestivals.com/) — fetched first-hand 2026-09-01; a Vue SPA with a Leaflet/OpenStreetMap map.
- [planmyfestivals.com application bundle](https://www.planmyfestivals.com/assets/app-BRlWgudd.js) — the 2026-09-01 bundle inspection behind the cross-festival scope finding: Fringe, Tattoo, Book, International, Art and Jazz carried as first-class strings.
- [FringePal](https://fringepal.com/) — the companion app Plan Your Fringe promotes ("bigger and better than this site"); unexamined.
- [Netflix Is A Joke Fest 2026 lineup and schedule (The Hollywood Reporter)](https://www.hollywoodreporter.com/tv/tv-news/netflix-is-a-joke-festival-2026-lineup-schedule-los-angeles-1236478031/) — 475+ shows across 35 LA venues; no planner, no official app found.
- [MICF 2026 program guide (comedyfestival.com.au)](https://www.comedyfestival.com.au/2026-program-guide/) — the 750+ show count behind the beyond-Edinburgh comparison.
- [SF Sketchfest 2026 on Sched](https://sfsketchfest2026.sched.com/) — planning outsourced to generic event-SaaS.
- [SXSW GO, built on Eventbase](https://www.eventbase.com/sxsw-go) — the official-app planner model.
- [Adelaide Fringe official app](https://adelaidefringe.com.au/our-app) and [My plan web planner](https://adelaidefringe.com.au/my-fringe/plan) — the closest official analogue to `/plan` found anywhere.
- [Brighton Fringe app case study (DabApps)](https://www.dabapps.com/work/clients/brighton-fringe-app/)
- [Clashfinder](https://clashfinder.com/) — crowdsourced music-festival clash grids with JSON/XML/iCal export; hosts [Exeter Comedy Festival](https://clashfinder.com/s/ecf26/) and [Cambridge Fringe](https://clashfinder.com/m/cambridgefringe2025/) grids, but no Edinburgh Fringe.
- [Woov](https://woov.com/) — organizer-side festival-companion platform, 600+ partner festivals.
- [Songkick developer API](https://www.songkick.com/developer) — the machine-readable festivals dataset music has and comedy lacks.
- [Festival Dust](https://www.festivaldust.com/) — representative of the consumer set-time app field (with [Headliners](https://apps.apple.com/us/app/headliners-festival-planner/id6478820193), [Frontstage](https://www.frontstagefestivals.com/app) and others).
- [Do512's SXSW hub](https://2025.do512.com/) and [RSVPATX](https://rsvpatx.com/rsvp-list) — the unofficial-party aggregators around SXSW's official programme.

## Open questions

- **No 2026 entrant has been driven end to end.** Narrowed 2026-09-01, in the
  right direction at last: the egress proxy that blocked every rival's own site
  on the 2026-08-09 pass no longer does, and fringe-finder.netlify.app,
  edfringeplanner.co.uk, fringeplan.com, planyourfringe.com and
  planmyfestivals.com were all fetched **first-hand** this pass — so the
  profiles above now rest on the tools' own pages rather than a search engine's
  memory of them. What remains open is *use*: nobody here has pasted a list
  into FringePlan, generated a Plan Your Fringe itinerary, or logged into
  edfringeplanner, and the SPA tools (planmyfestivals, Fringe Finder's
  concierge) render client-side, so their actual behaviour is still unobserved.
- **Does the Fringe Society confirm Fringe Finder's "official pilot"?** Its own
  page asserts "an official pilot with the Edinburgh Festival Fringe"
  (verified on-page 2026-09-01) — no confirmation found from the Society's
  side, and an official pilot on the planning side would change the
  competitive read. Related: what feeds its availability tracking and walking
  times — the Listings API (availability-blind, so presumably not), a
  Tikketr scrape like ours, or something granted by the pilot?
- **Does the shipped 2026 official app add travel-time or next-commitment logic
  to "Nearby now"?** Published descriptions still say proximity + starting soon,
  but nobody here has used the 2026 build. (Narrowed 2026-07-28 from "unknown" to
  "no published evidence of it".)
- **Does any tool expose real-time started / sold-out status** the way Fringe
  Discover's live status does? Two now claim the ingredients: Fringe Finder
  plans around "what's actually still on sale" and says listings refresh
  "several times a day"; FringePlan pulls availability colours (confirmed
  2026-09-01, above). How live either is, and what each reads it from, is
  unconfirmed.
- ~~**Does Plan My Fringe (or any planner) accept a favourites import?**~~
  **Answered 2026-08-09: yes — not Plan My Fringe, but edfringeplanner.co.uk,
  whose entire premise is it.** `/plan`'s intake advantage is gone. See the
  correction under *Where the gaps are*.
- **Where do these tools get the favourites from?** The successor question, and
  the one that decides whether anything is left of the intake position. No
  competitor documents the mechanism — native edfringe.com export, the
  third-party CSV extension, or a logged-in scrape are all consistent with what
  they say. If there is a native export nobody here has found, the
  market-and-audience page's intake assumption is wrong too.
- ~~**Does FringePlan's "flag a delisted show or moved performance" mean it holds
  live availability?**~~ **Answered 2026-09-01: yes.** Its own homepage states
  that adding shows pulls in "ticket availability colours … automatically" —
  so Fringe Finder is not the only tool on the availability axis. How fresh
  those colours are, and where they come from, is the successor question.
- **FringePal is unexamined.** Plan Your Fringe now routes visitors to a
  companion app it calls "bigger and better than this site"; nothing else is
  known about it.
- **Is the beyond-Edinburgh planner vacuum demand-side or supply-side?** No
  third-party planner exists for MICF, Netflix Is A Joke, Adelaide or Brighton
  — but whether that is because official apps suffice, because those festivals'
  showcase shapes don't create the clash problem, or because nobody has built
  one yet is exactly the question the product direction turns on. Adelaide's
  official "My plan" (wishlist + sort-by-day) is the strongest evidence that at
  least the demand for *some* planning exists at open-access scale.
- **Why is there no Edinburgh Fringe Clashfinder?** The crowdsourced-grid model
  covers hundreds of music festivals and even two tiny UK comedy events, but
  stops short of the 3,000-show open-access scale. If the reason is editorial
  (hand-edited grids don't scale), that is evidence the Fringe-scale planning
  problem needs generated data, not crowdsourcing — our architecture.
- **Does anything else score date windows** ("when should I come?")? Re-checked
  2026-08-09 across five planners and found nothing — every one takes dates as an
  input. Narrowed from "or is that genuinely unoccupied?" to: still unoccupied on
  the evidence, but the evidence is five tools' marketing copy, not a survey.
- **Is anything actually planning across festivals?** Narrowed 2026-09-01 from
  "no confirmed candidate" to "one confirmed carrier, depth unknown":
  planmyfestivals.com demonstrably holds the Edinburgh cluster's festivals
  (bundle inspection, see above), but whether it builds itineraries across
  them or only maps them together is unobserved — the app renders client-side.
  The Listings API gallery still shows nothing cross-festival, Data Thistle
  still lists everything and plans nothing.
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
- **2026-08-09** — worked the page's top open question (hands-on verification of
  the 2026 entrants) and it cost the page a claim. Examined the two planners left
  unexamined: **edfringeplanner.co.uk**, whose stated premise is taking the
  user's edfringe.com favourites, and **FringePlan** (fringeplan.com), new to
  this wiki — travel-time-, meal- and priority-aware scheduling plus a live iCal
  feed, markdown export, share links, a one-go edfringe.com basket handoff, and
  plans that flag delisted or moved performances. Together they supersede this
  page's "no profiled competitor starts from the user's existing favourites list"
  claim, which is corrected in place with the reason kept rather than deleted;
  what survives of it is narrowed to the unknown *mechanism* of their import.
  Re-checked the date-choice claim across five planners and it held — every one
  takes dates as an input — so that question is narrowed, not closed. Key
  insights 3 and 4 rewritten; insight 4 goes from three unclaimed claims to two.
  Recorded honestly that all four target sites were blocked by the network
  egress proxy this pass and were read second-hand via search-engine indexing of
  their own pages, which makes the verification gap worse, not better. Two open
  questions added (favourites mechanism; whether FringePlan's stale-plan flagging
  implies live availability). Requirements implication — a planner-side
  requirement set can no longer rest on favourites intake, leaving date-choice
  and cross-festival — left for human review.
- **2026-08-02** — spot-checked the "is anything planning across festivals"
  open question with a fresh web sweep: found two 2026 entrants not previously
  profiled, FringePlan (a Fringe-only day planner, close to Plan My Fringe /
  Plan Your Fringe) and planmyfestivals.com, whose plural naming is the first
  candidate found whose own branding suggests cross-festival scope — added both
  to the 2026 planner-side field with the caveat that neither was fetched or
  examined hands-on, so planmyfestivals.com's actual scope stays an open
  question rather than a finding. Header unchanged: neither addition changes the
  page's top-line read (planning side crowded and Fringe-only; cross-festival
  field still effectively empty until verified otherwise).
- **2026-09-01** — the egress block that had forced every rival profile to be
  read second-hand lifted, and this pass fetched all five outstanding sites
  first-hand (fringe-finder.netlify.app, edfringeplanner.co.uk, fringeplan.com,
  planyourfringe.com, planmyfestivals.com). Yield: planmyfestivals.com's scope
  question **answered** — an Edinburgh cross-festival planner, its bundle
  carrying Tattoo/Book/International/Art/Jazz beside the Fringe — so the
  cross-festival section is retitled from "almost empty" and the "unclaimed"
  claim weakened to "contested"; FringePlan's availability question **answered**
  (it pulls ticket-availability colours automatically); Fringe Finder's
  official-pilot claim verified as asserted on its own page (Society-side
  confirmation still missing) along with walking-time-aware planning and a
  several-times-daily refresh cadence; Plan Your Fringe found to be
  performer-built, email-gated, still checking against the stale 3,649-show
  launch snapshot, promoting a previously unrecorded companion app
  (**FringePal**), and teasing live "near me now" — the first competitor seen
  moving toward the live-reachability axis. Key insights 1, 4, 5 and 7
  rewritten; three open questions answered or narrowed, two added (FringePal;
  what feeds Fringe Finder). Driving the tools end to end is now possible in
  principle and remains undone.
- **2026-09-01** *(second pass, same day)* — added *The field beyond Edinburgh*
  for the widened product direction, from a dedicated research pass: no
  third-party planner exists for any comedy festival outside Edinburgh
  (verified per-festival for MICF, Adelaide, Brighton, JFL Montreal, Netflix
  Is A Joke, SF Sketchfest and SXSW); where planning tooling exists it is
  official or rented SaaS (Sched, Eventbase/SXSW GO, Katalyst/Adelaide,
  DabApps/Brighton), and the crowded music-festival planner category
  (Clashfinder's exportable crowdsourced grids, Woov, the consumer set-time
  apps, Songkick's API) proves the demand shape comedy leaves unserved. Key
  insight 6 (Half Price Hut, unchanged in the body) displaced by the
  empty-category finding to stay inside the seven-bullet cap; intro widened
  beyond Edinburgh; two open questions added (demand-side vs supply-side
  vacuum; why no Fringe-scale Clashfinder). Sibling pages:
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md) owns the
  festivals themselves.
