# Market & audience

The scale of the Edinburgh Fringe and the audience behaviour EdFringeNow is built
for. Two decisions live here, not one: the in-the-moment "what can I make right
now" (the home site, *Fringe Discover*) and the weeks-earlier "which shows, which
dates" (the planner at `/plan`). Compiled once, refined in place.

## Key insights

- 3,649 shows across 258 venues in 2026 — and the programme is smaller than 2025.
- 37% of people struggle to pick a show. Two thirds buy just one ticket.
- 78% come to see something they would not normally — they want surprise, not better filters.
- A third of the audience lives in Edinburgh. Two thirds travel in and plan months ahead.
- The advice everyone gives is: do not fill the day. Two or three shows.
- Beds may pick the dates, not shows — over half cannot find an affordable room nearby.
- Nobody has data on how people choose in the street. Not us, not anyone.

## Scale

### 2026 festival (running 7–31 August 2026)

- **3,649 shows** across **258 venues**, **53,884 performances**, artists from
  **71 countries** — announced at the programme launch on 4 June 2026.
- Genre split at launch: **1,401 comedy**, **1,025 theatre**, **168 musicals and
  opera**.
- Smaller than 2025 on both counts (3,893 shows / 301 venues), and still two
  orders of magnitude more than any one visitor can see.

### 2025 festival (latest full ticket data)

- **3,893 shows** across **301 venues**, **53,942 performances**, artists from
  **62 countries**.
- **~2.6 million tickets** issued (2,604,404) — roughly flat on 2024, still below
  the 2019 pre-pandemic peak of about 3 million.
- **edfringe.com took over 3 million visits and 37 million page views**, and
  ~4,300 professional reviews were uploaded to the site to help audiences choose.

*(2025's ticket figures stay on this page because they remain the newest
issued-ticket data — the Fringe Society publishes each year's ticket and audience
data after the festival closes, so 2026's cannot land before late August 2026.)*

This scale is the product premise: the official programme is a catalogue that
rewards planning ahead and overwhelms the person deciding in the moment.

## The overwhelm / decision problem

Fringe Society audience data puts numbers on it:

- **37% of audiences struggled to pick a show** to go and see.
- **Two thirds of ticket buyers bought only one ticket** — for most of the
  audience the Fringe is a single decision, not a curated run of shows.
- **78% came to the Fringe to see something they wouldn't go and see otherwise** —
  the appetite is for discovery, not for a known quantity.

The standard advice around that, consistent across guides and relevant to both
surfaces:

- With more than 3,800 shows, choosing "can feel like a daunting task"; the
  advice is to lean on filters, star ratings and reviews, and to **embrace
  serendipity** — the show you'd never have booked is often the one people still
  talk about.
- **Leave travel time.** Edinburgh is compact but August streets are not; guides
  repeat that venues which look close together are not close in August — the
  reachability constraint Fringe Discover makes first-class rather than an
  afterthought.
- **Two to three shows a day** is the pace commonly advised as comfortable —
  leaving room to eat, walk, and stand still.
- **Don't fill the day.** Fringe CEO Tony Lankester's "rule of thirds" — about a
  third of the time pre-planned, the rest left open — alongside reporting that
  visitors who combined structured planning with open time were more satisfied
  than those who over-scheduled.

That last point is load-bearing here: the gaps a planner deliberately leaves are
exactly the gaps the live surface exists to fill.

## Two crowds, not one

This page previously described a single audience (the in-the-moment one) because
it was seeded from the *Fringe Discover* brief. The repo now ships two front
ends — the mobile-first home site and the desktop-first planner at `/plan` — and
they serve different people, or the same people in different states.

### A. Live, in-festival — "what can I make right now"

- **On the ground, deciding for the next hour or two.** Location, travel mode and
  the next commitment are the constraints; the catalogue is noise.
- **A third of the audience lives in Edinburgh** — locals have no trip to plan and
  no accommodation to book, and decide close to the moment by construction.
- **Same-day supply is a real channel, and an in-person one.** The Half Price Hut
  sells same-day (and next-morning) tickets from the Fringe Box Office only — not
  online, not in the app — opening 12 August in 2026, 10:00–18:00 daily.
- **Walk-up availability is not constant across the run.** Guides report walk-ups
  are easy in the opening week and that by weeks two and three popular shows —
  comedy headliners especially — sell out days in advance. The live surface's
  usefulness therefore moves with the calendar as well as the hour.
- **How the decision is actually made in the street is undocumented.** Posters,
  Royal Mile flyering, star ratings and word of mouth clearly drive a large share
  of it, but practitioners writing about Fringe marketing state plainly that
  nobody knows what works — there is no measured breakdown of in-the-moment
  discovery channels to cite.

### B. Trip planners optimising around favourite shows

- **Two thirds of the audience come from outside Edinburgh** — they choose dates,
  book beds and travel, and assemble a show list long before August.
- **Audiences now engage months ahead.** Reporting on how the Fringe audience has
  changed describes a 2026 audience that follows artists online, votes in polls
  and treats the festival as a live-entertainment marketplace well before August —
  a marked shift from the "turn up and grab a flyer" Fringe of a decade ago.
- **Accommodation binds *which dates* a trip can happen**, not as a footnote:
  coverage of the festival's accommodation crisis reports over half of people
  hoping to attend could not find an affordable place to stay within a 90-minute
  commute. Dates get chosen against beds as much as against shows — something the
  planner's "pick my best dates" currently ignores.
- **The favourites list is the planner's raw material, and it lives elsewhere.**
  Shows are favourited on edfringe.com and saved in the official app's *My
  Planner* (which syncs to a personal calendar). Getting that list *out* as a CSV
  is served by a third-party Chrome extension ("EdFringe Favourites to CSV",
  updated per festival year); no native edfringe.com CSV export is documented.
  The planner's front door depends on an export path we do not own.
- **The programme launch is the season's starting gun.** The 2026 programme went
  live on 4 June 2026, with shows revealed in batches from 11 February — so
  planning demand exists for months before any live demand can.

### The same person, at different hours

These are not necessarily two populations. The rule-of-thirds advice describes one
visitor who pre-plans part of a day and leaves the rest open; the planner serves
that first third and the live surface the other two. What differs is not identity
but **state** — horizon, device, inputs, and what "correct" even means. Those
differences are worked through on their own page:
[audience-divergence/](../audience-divergence/README.md). Nothing on this page
should be read as implying one merged requirement set.

## Audience segments (product-brief hypotheses)

From the product brief (`docs/product-spec.md`, an internal hypothesis not yet
externally validated): visitors mid-festival on foot without a fixed plan; people
with a _gap_ between commitments; locals and tourists intimidated by the
programme's size. Decisive in the moment rather than researchers, with an
emotional target of "delight + relief."

Those segments describe crowd **A** only — the brief predates `/plan`, and no
equivalent written segmentation exists for the trip-planning crowd. The partial
external evidence for crowd B is the block above (two thirds non-resident,
months-ahead engagement, accommodation-first date choice); a validated
segmentation for either crowd remains an open question.

## Sources

- [The 2026 Edinburgh Festival Fringe programme is now live (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/mixitup-with-the-2026-edinburgh-festival-fringe-programme/)
- [Edinburgh Festival Fringe 2026 programme launched with 3,649 shows from 71 countries (Theatre Weekly)](https://theatreweekly.com/edinburgh-festival-fringe-2026-programme-launched-with-3649-shows-from-71-countries/)
- [Key dates for your diary in the lead-up to Fringe 2026 (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/key-dates-for-your-diary-in-the-lead-up-to-fringe-2026/)
- [Edinburgh Festival Fringe issues over 2.6 million tickets across 3,893 shows (BroadwayWorld)](https://www.broadwayworld.com/article/Edinburgh-Festival-Fringe-Issues-Over-26-Million-Tickets-Across-3893-Shows-20250826)
- [Fringe Society releases 2025 ticket and audience data (WhatsOnStage)](https://www.whatsonstage.com/news/edinburgh-festival-fringe-society-releases-ticket-and-audience-data-as-2025-event-concludes_1692055/)
- [We've published our review of the year 2025 (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/weve-published-our-review-of-the-year-2025/)
- [An exciting and energising Edinburgh Festival Fringe 2025 comes to a close (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/an-exciting-and-energising-edinburgh-festival-fringe-2025-comes-to-a-close/)
- [How to use your audience data with a purpose: the Edinburgh Festival Fringe (Thrive)](https://wewillthrive.co.uk/resources/case-studies/how-to-use-your-audience-data-with-a-purpose-the-edinburgh-festival-fringe/)
- [Fringe 2026 — How the Audience Has Changed (The Edinburgh Reporter)](https://theedinburghreporter.co.uk/2026/05/fringe-2026-how-the-audience-has-changed/)
- [Edinburgh Fringe 2026: First-Timer's Planning Guide (Discover Edinburgh Fringe)](https://discoveredinburghfringe.com/en/blog/edinburgh-fringe-2026-first-timers-planning-guide)
- [Ten tips for Fringe first-timers in 2026 (Edinburgh Festival City)](https://www.edinburghfestivalcity.com/inspiration/128-five-tips-for-fringe-first-timers)
- [Half Price Hut (edfringe.com)](https://www.edfringe.com/tickets/half-price-hut)
- [Edinburgh Festival Fringe Box Office (edfringe.com)](https://www.edfringe.com/experience/plan-your-visit/fringe-box-office/)
- [Late night transport and 'live dashboard' could solve Edinburgh's festival accommodation crisis (The Scotsman)](https://www.scotsman.com/arts-and-culture/late-night-transport-and-live-dashboard-could-solve-edinburghs-festival-accommodation-crisis-5239090)
- [EdFringe Favourites to CSV (Chrome Web Store)](https://chromewebstore.google.com/detail/edfringe-favourites-to-cs/ebbiecdkhoclnlgfibfhhnpfhmmgdbcc)
- [Fringe app — Edinburgh Festival Fringe](https://www.edfringe.com/experience/plan-your-visit/fringe-app/)
- [Marketing at the Fringe: Everyone Has Theories. No One Has Data. (Danielle Solof)](https://www.daniellesolof.com/home/2025/10/23/marketing-at-the-fringe-everyone-has-theories-no-one-has-data)
- [3,000 Shows, So Little Time! How to Choose (Playbill)](https://playbill.com/article/3-000-shows-so-little-time-how-to-pick-what-to-see-at-the-edinburgh-festival-fringe)
- [How to choose which shows to see at the Fringe (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/how-to-choose-which-shows-to-see-at-the-edinburgh-festival-fringe/)

## Open questions

- **Sizing the two crowds.** "A third of the audience lives in Edinburgh" is the
  only hard split found; there is still no cited figure for spontaneous /
  gap-filling versus pre-planned attendance, nor for how many of the two thirds
  from outside Edinburgh are day-trippers (no accommodation decision) versus
  multi-night stays (the planner's real crowd).
- **How the in-the-moment decision is really made.** Still no measured breakdown
  of in-street discovery channels — the honest current answer is that nobody has
  the data. A small first-party observation (even n=20 on the Royal Mile) would
  beat the citation vacuum.
- **When planning happens.** No cited series for advance-versus-same-day
  purchasing, or for how sales pace across the run. This decides whether the
  planner is a June–July product or an all-August one.
- **Does the favourites list have a native export?** The third-party CSV
  extension exists; whether edfringe.com itself offers an export — and how many
  people ever produce one — is unconfirmed, and the planner's intake depends on
  it.
- **Accommodation as a planning input.** No authoritative price/availability
  series found (guide-site figures only). If beds constrain dates more than shows
  do, "pick my best dates" optimises the wrong variable — worth evidence before
  acting on it.
- Refresh the ticket/audience figures once the 2026 festival's data is published.

## Growth log

- **2026-07-22** — initial seed: 2025 scale figures (shows / venues / tickets),
  the overwhelm-and-serendipity decision context, and the travel-time constraint;
  audience segments flagged as unvalidated product-brief hypotheses. Sources
  cited.
- **2026-07-28** — took the `/plan` surface into account and split the page from
  one audience into two crowds (live in-festival; trip planners optimising around
  favourites). Added 2026 scale figures (3,649 shows / 258 venues / 53,884
  performances / 71 countries, 7–31 Aug) alongside the retained 2025 ticket data;
  added cited decision-difficulty data (37% struggled to pick, two thirds bought
  a single ticket, 78% came for something they wouldn't otherwise see), the "rule
  of thirds" / don't-over-schedule finding, the same-day and walk-up supply
  picture, the non-resident share, the accommodation constraint on date choice,
  and the third-party favourites-CSV dependency. Recorded that the product
  brief's segments cover crowd A only. Open questions rewritten in both
  directions. Requirements implication (two requirement tracks, not one) left for
  human review — see the audience-divergence page.
- **2026-07-29** — added the page's `## Key insights` header: seven terse lines
  distilled from what the page already says (scale, the decision-difficulty
  figures, the two crowds, the accommodation constraint, the evidence gaps).
  Header only: no claim, citation or open question changed.
