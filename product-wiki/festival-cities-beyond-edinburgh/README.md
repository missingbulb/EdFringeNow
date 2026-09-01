# Festival cities beyond Edinburgh

Candidate environments for the product beyond Edinburgh-in-August, scored
against an explicit bar — the **festmaxxing definition** below, extracted from
the owner's stated product direction. The page began as a ranking of festival
*cities* by structural closeness to Edinburgh; the definition generalizes it:
anywhere — festival or not — that is time-boxed, abundant and complex enough
that maximizing a stay there is a genuine optimization problem is a candidate
market. Compiled once, refined in place.

## Key insights

- The festmaxxing bar: week-plus window, options ≫ capacity, real clashes, binding travel, public tickets, same-city recurrence.
- Adelaide is the only real peer, and still under 40% of Edinburgh: 1,648 shows to 4,206.
- Avignon OFF is the closest structural twin — 1,780 open-access shows in 141 theatres inside one walled town.
- 300+ fringes exist worldwide, but only three sell more than 250,000 tickets.
- Edinburgh has a free official cross-festival listings API. No other festival city found has an equivalent.
- Avignon and Montreal break the English-only assumption before any other candidate does.
- Milan's Fuorisalone swarms like a fringe but runs on opening hours, not showtimes — a routing problem, not a scheduling one.

## The festmaxxing bar

The owner's product direction (2026-09-01): the next evolution of EdFringeNow
is **the planning tool for festival fanatics** — people who travel to an event
to maximize their time there, weaving in time off, food and excursions, and who
need a tool *because the environment is complex*. Handling that complexity is
the reason to use the product; the owner's word for the behaviour is
**festmaxxing**. Three characteristics name where such a tool matters — **time
limitation, complexity, abundance** — and they unpack into eight testable
dimensions.

**The shape** — is a stay there an optimization problem at all?

1. **Time-boxed window** — fixed dates, roughly a week or longer. A weekend
   plans itself; a longer run forces choices about *which days to even be
   there*. (Owner: don't focus on the quick 4-day events.)
2. **Abundance** — the catalogue far exceeds one person's capacity; even a
   maximal plan samples a fraction of it.
3. **Simultaneity** — many options run at once, so every pick forecloses
   others; conflicts are the norm, not the exception.
4. **Venue spread** — venues scattered enough that travel time is a binding
   constraint; a plan that ignores the map is infeasible, not merely
   suboptimal.
5. **Repeat chances** — items recur inside the window, turning "which do I
   drop" into "which order do I go". This is the fringe-shaped vs
   showcase-shaped axis worked through on
   [comedy-festival-circuit/](../comedy-festival-circuit/README.md); both
   shapes are planning problems, but recurrence is what makes the product
   *optimization* rather than triage.

**The qualifiers** — can our product serve it, and keep serving it?

6. **Open per-event access** — a member of the public can buy a ticket (or
   book a slot) to a specific item. Badge-only, invite-only and
   one-wristband-for-everything environments can have the shape yet offer no
   bookable unit for a planner to link to.
7. **Anchored recurrence** — annual (or a fixed cycle) in the same city and
   largely the same venues, so venue data, travel matrices and source
   integrations compound year over year instead of resetting. (Owner: "very
   important to know if a festival is an annual event in the same city/venues
   … or a one-off.")

**The enrichment axis** — the "time off" half of festmaxxing.

8. **City context** — real non-event material around the event (food,
   excursions, rest), because a festmaxxing plan is a *stay*, not a bare
   schedule. Where each city publishes that layer is
   [city-context-sources/](../city-context-sources/README.md)'s subject.

Dimensions 1–5 decide whether the environment *has* the problem; 6–7 decide
whether a product can serve it; 8 decides how rich the plan can be. The tiers
below apply the bar to every candidate this page has gathered — festivals and,
since 2026-09-01, non-festival environments that share the shape.

## What "another Edinburgh" actually means

Edinburgh's August is not one festival. Eleven major festivals share the city
across the year, and in August the Fringe (7–31 Aug 2026), the International
Festival (7–30), the Tattoo (7–29), the Art Festival (14–30), the Book Festival
(15–30) and the International Film Festival (13–19) overlap, with the densest
window around 14–25 August.

Underneath that, the thing that actually generates the overwhelm is the Fringe's
**open-access** model: anyone who finds a room and pays a registration fee is
listed, so supply is uncapped and the city converts itself into venues. Scale
figures for the Fringe itself live on
[market-and-audience/](../market-and-audience/README.md) — 4,206 shows across 299
venues in 2026, ~2.6m tickets in 2025.

Three distinct mechanisms produce an Edinburgh-shaped city, and they matter
separately because each implies a different data and product problem:

1. **Open access** — uncapped supply, one registration fee, thousands of parallel
   runs. This is the mechanism EdFringeNow is built against.
2. **A curated core with an unofficial "off"** — a ticketed official programme
   plus a sprawling satellite ecosystem the official body does not list.
3. **A festival *season*** — many discrete, separately-run festivals stacked
   back-to-back in one city, rather than one festival with thousands of shows.

A fourth, weaker pattern — **long temporary exhibition runs** (biennials) — makes
a city swarm without producing a scheduling problem, because a months-long
exhibition has no performance times to clash. Non-festival environments reach
the bar through mechanisms of their own (a convention's parallel programming
tracks, a mega-event's session grid); the bar, not the mechanism, is what
qualifies a candidate.

## The candidates, scored

Every candidate keeps its mechanism label and gets a verdict against the bar.
One standing caution applies to the whole list: scale figures are cited from
programme-launch press unless marked delivered — the launch-vs-delivered trap
recorded in the 2026-08-09 correction below.

### Clears the bar

#### Adelaide — the only peer by scale

Adelaide Fringe is the world's second-largest annual arts festival and is
explicitly open access ("welcomes anyone with an event to participate"). The 2026
edition ran **20 February – 22 March** with **1,648 shows across 562 venues** and
about **1,083,000 tickets** sold, part of more than six million attendances at
ticketed and free events.

It shares the surrounding-cluster property too: the Adelaide Festival, WOMADelaide
and Writers' Week run alongside it, which is why locals call the period "Mad
March."

Two structural differences that matter to the product:

- **It is not one calendar month.** 20 Feb – 22 Mar spans two months. The
  planner's calendar axis is a single month.
- **562 venues to Edinburgh's 258**, in a city with a far less compact core —
  travel-time estimation is doing more work there, not less. On the bar: venue
  spread (dimension 4) binds *harder* than in Edinburgh.

#### Avignon — the closest structural twin

Avignon in July is the same *shape* as Edinburgh in August: a curated Festival
d'Avignon ("the IN") plus the open-access **Festival OFF**, inside a small walled
medieval town. The 60th OFF (**4–25 July 2026**) carried **1,780 shows in 141
theatres**, roughly **27,000 performances**, around 1,250 performances a day, from
~1,600 companies (about 90% French). Average auditorium fill was **54%** —
the same "too much supply chasing too little attention" economics as the Fringe.

If any city is EdFringeNow's second market on structure alone, it is this one.
The blocker is not the bar — every dimension clears — it is that the entire
corpus is in French.

#### The rest of the clear tier

- **Perth, Australia — FRINGE WORLD** (Jan–Feb; open access). The third-largest
  fringe on the planet: **600+ shows across 110 venues** advertised ahead of the
  2026 edition (21 Jan–15 Feb 2026), ~3,000 artists, off **256,000 tickets**
  sold in 2025. That 2026 edition has since run and closed (this repo's clock
  is now 2 Aug 2026): its own final report counts **599 events**, more than
  3,000 artists, **nearly 500,000 attendees**, and **$10.9m spent at the Box
  Office** ($8.34m paid to artists and venues) — up from 2025's 570 events /
  492,369 attendees / $10.78m box office. Note "attendees" and "tickets sold"
  are not the same metric (the 256,000 figure is a narrower paid-ticket count);
  both are kept because neither source reconciles them into one number.
- **Brighton, UK** (1–31 May; open access). Around **400,000 in-person
  attendances**, with over 30% of events from Brighton & Hove companies. English
  language, UK ticketing conventions — the cheapest possible second market.
  Comedy share and its open Eventotron API are on
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md).
- **Melbourne — MICF** (Mar–Apr; open registration). The strongest
  fringe-shaped candidate found anywhere outside the fringe network itself:
  803 shows, 9,164 performances, 26 days, with open JSON endpoints.
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md) owns the
  detail; it sits in this tier on every dimension.
- **Montreal in July** (festival season). Festival International de Jazz de
  Montréal (25 Jun – 4 Jul 2026) puts **350+ shows** and 3,000 performers in
  front of a claimed 2m+ guests; Just For Laughs (15–26 Jul 2026) runs **250
  shows across 25 downtown venues** and 800+ artists **in both official
  languages**, and the Fantasia film festival overlaps JFL for eleven shared
  days. Concentrated in the Quartier des Spectacles, so reachability is real.
  Bilingual by default — the first candidate that forces the localization
  question. On the bar it clears as a *stacked season* rather than one
  festival, which multiplies the data-source cost (each festival is separately
  run). (Corrected 2026-09-01: this entry called JFL "the world's largest
  comedy festival". That label is JFL marketing that survives on attendance
  counting its free outdoor crowds; by ticketed shows it is roughly a third of
  Melbourne's 803, and the company behind it went through 2024 receivership
  and a 2024 cancellation before its 2026 relaunch — see
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md), which now
  owns the comedy-festival detail for this and every other comedy entry.)
- **Makhanda (Grahamstown), South Africa — National Arts Festival** (late
  June–July; open-access fringe beside a curated core). **270+ productions** on
  the main programme in 2026 plus a Fringe of **200+ new works**, in a town
  small enough that the visitor-to-resident ratio may be the most extreme of
  any candidate here. Clears the bar at the small end — abundance is relative
  to the visitor's capacity, and eleven days of ~470 productions clears it.
- **Sibiu, Romania — FITS** (19–28 June 2026; curated season). **800+ events**
  in ten days in a small old town; one of Europe's largest performing-arts
  festivals. Curated rather than open access, but 80 events a day produces
  real simultaneity — the mechanism differs, the bar clears.
- **The film festivals that clear it** — Berlinale above all (274 films, each
  screened up to five times, public tickets €9–15), then TIFF and MIFF.
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md)'s film
  adjacency owns the detail and citations; they belong on this page's map
  because each is an anchored, publicly-ticketed, repeat-screening city event.

### Near misses — one dimension short

- **Milan — Salone del Mobile / Fuorisalone** (April; curated core + off). The
  purest non-theatre version of the Edinburgh dynamic: a ticketed trade fair at
  Rho with 1,900+ exhibitors, plus **1,100+ events listed on the official
  Fuorisalone guide (1,300+ across the city) spread over 16 districts** and
  **500,000+ visitors**. Brera alone carried 320 events across 217 showrooms.
  Installations run for the week rather than to performance times, so
  simultaneity (dimension 3) never bites: the *scheduling* problem is weaker
  than the *reachability* problem — which is the half of the product the Now
  page serves.
- **Charleston, SC — Spoleto Festival USA / Piccolo Spoleto** (late May–June;
  curated core + open companion). Piccolo Spoleto 2026 offered **250 events**,
  190 of them produced by independent arts and community groups, 113 free — a
  deliberately open companion to a curated core, at a scale where a planner is
  plausible but not urgent. Short of the bar on abundance (dimension 2).
- **Toronto, Canada** (30 Jun – 12 Jul 2026; lottery-selected fringe). **123
  shows**, selected by *lottery* rather than pure open access — a different
  supply mechanism, and small enough that overwhelm is not really the user's
  problem. Short on abundance (dimension 2).
- **Galway, Ireland — GIAF** (13–26 July 2026; curated season). Fourteen days,
  audiences well in excess of 200,000, in a small city fully consumed by it.
  Programme size unassessed — provisionally here until a show count is cited.

### Fails the bar, instructively

- **Salzburg, Austria** (17 Jul – 30 Aug 2026). **208 performances** across
  opera, drama and concerts. The town is overwhelmed, but the programme is
  curated, expensive and elite — 208 performances is a brochure, not an
  overwhelm problem. The boundary case this page keeps on purpose: *city
  swarming* alone fails abundance (dimension 2).
- **Venice — Biennale Arte** (9 May – 22 Nov 2026). **100 national
  participations** — 29 in the Giardini, 25 in the Arsenale and **46 scattered
  across the city** — plus **31 collateral events**. A months-long run means
  opening hours, not performance times: fails time-boxing (1) and simultaneity
  (3) at once. **Kassel — Documenta** (every five years, 100 days) fails the
  cadence half of recurrence; the roving **Manifesta** fails the anchor half.
- **Cannes**, **SXSW Austin** (March). Both convert a city into temporary
  venues at high density with genuine clash-resolution problems, but both are
  trade/badge-driven rather than public-audience-driven — failing open access
  (dimension 6) — and SXSW already ships its own scheduling tool.

### The unassessed tail

Also in the fringe network and unassessed: **Prague**, **Dublin**, **Winnipeg**,
**Orlando**, **Minnesota**, **Wellington**, **Camden**, **Melbourne Fringe**.
**Miami Beach — Art Basel plus satellite fairs** (December) is the same
curated-core-plus-off shape as Milan, unassessed.

## Where Edinburgh is still singular

Two findings cut against expanding, and both should be said plainly:

- **Nothing is close on density.** Edinburgh's Fringe alone is ~2.6× Adelaide on
  show count (4,206 vs 1,648, both 2026) and ~2.4× on tickets (2.6m in 2025 vs
  1.08m in 2026 — the newest full-year figure each publishes), in a smaller, more
  walkable centre, and it overlaps five other major festivals. The overwhelm the
  product exists to solve is genuinely worst here. (Corrected 2026-08-09: the
  Edinburgh side of this comparison was 3,649, the 4 June programme-launch
  snapshot, against Adelaide's delivered total — an unfair comparison that
  *understated* the gap, at ~2.2×. Both sides are now delivered figures. The
  general trap is worth carrying to every candidate on this page: **a
  festival's launch announcement and its delivered programme are different
  numbers**, and this page's tail is built almost entirely from launch
  announcements.)
- **Edinburgh is the only candidate with an official aggregation layer.** The
  Edinburgh Festivals Listings API is a free API over the official listings
  database for all **11** Edinburgh festivals, carrying over **640,000
  performances**, with `events` and `venues` endpoints and a self-service access
  key. Its coverage, fields, licence terms and the two edges that matter (it is
  **availability-blind**, and its no-redistribution clause sits awkwardly with
  this repo's committed static data) are worked through on
  [festival-season/](../festival-season/README.md) and not repeated here. The
  point for *this* page is comparative: **no equivalent single-source feed was
  found for Adelaide, Avignon, Perth, Milan or Montreal** — those are
  per-festival scrapes or nothing. That asymmetry, not language, is the real cost
  of a second city.

## Sources

- [#MixItUp at the Edinburgh Festival Fringe and discover your new favourite show (edfringe.com, 7 August 2026)](https://www.edfringe.com/about-us/news-and-blog/mixitup-at-the-edinburgh-festival-fringe-and-discover-your-new-favourite-show/) — Edinburgh's delivered 2026 comparison figures: 4,206 shows across 299 venues.
- [Edinburgh Festivals: What's On in 2026 (Edinburgh Festival City)](https://www.edinburghfestivalcity.com/inspiration/573-edinburgh-festivals-whats-on-in-2026)
- [Edinburgh's summer festivals (Forever Edinburgh)](https://edinburgh.org/blog/edinburghs-summer-festivals/)
- [Edinburgh Festivals Listings API — documentation](https://api.edinburghfestivalcity.com/documentation)
- [Edinburgh Festivals Listings API — Fringe listings approval](https://api.edinburghfestivalcity.com/documentation/fringe_approval)
- [Edinburgh Festivals Listings API — licence](https://api.edinburghfestivalcity.com/licence)
- [New Fringe boss reveals record festival spend (InDaily)](https://www.indailysa.com.au/news/just-in/2026/07/14/new-fringe-boss-reveals-record-festival-spend)
- [About Us — FRINGE WORLD (fringeworld.com.au)](https://fringeworld.com.au/about-us) — "a global landscape of more than 400 Fringe festivals"; the 2026 edition's final count (599 events, ~500,000 attendees, $10.9m box office) and the 2025 comparison figures.
- [About Adelaide Fringe (adelaidefringe.com.au)](https://adelaidefringe.com.au/about-us)
- [Adelaide Fringe FAQ (adelaidefringe.com.au)](https://adelaidefringe.com.au/faq)
- [Off d'Avignon 2026 : la 60e édition proposera cet été plus de 1 700 spectacles et 27 000 représentations (franceinfo)](https://www.franceinfo.fr/culture/spectacles/theatre/off-d-avignon-2026-la-60e-edition-proposera-cet-ete-plus-de-1-700-spectacles-et-27-000-representations_7967651.html)
- [Festival Off d'Avignon : environ 1 700 spectacles et une réflexion sur leur « diffusion » (sceneweb)](https://sceneweb.fr/festival-off-davignon-environ-1-700-spectacles-et-une-reflexion-sur-leur-diffusion/)
- [Festival Off Avignon 2026 : un taux de remplissage moyen de 54% (ARTCENA)](https://www.artcena.fr/fil-vie-pro/festival-off-avignon-2026-un-taux-de-remplissage-moyen-de-54)
- [Festival Off Avignon — site officiel](https://www.festivaloffavignon.com/)
- [FRINGE WORLD 2026 to light up the City (City of Perth)](https://perth.wa.gov.au/news-and-updates/all-news/fringe-world-2026-to-light-up-the-city)
- [World Fringe — support us / network](https://worldfringe.com/fringe-membership/)
- [How to Fringe (Brighton Fringe)](https://www.brightonfringe.org/how-to-fringe/)
- [National Arts Festival returns to Makhanda with expanded 2026 programme (Music In Africa)](https://www.musicinafrica.net/magazine/national-arts-festival-returns-makhanda-expanded-2026-programme)
- [National Arts Festival Fringe 2026 Brings 200+ Bold New Works to Makhanda (Joburgstyle)](https://www.joburgstyle.co.za/national-arts-festival-fringe-2026-brings-200-bold-new-works-to-makhanda/)
- [Toronto Fringe — about](https://fringetoronto.com/fringe/about)
- [Toronto Fringe Festival 2026 reviews (Intermission Magazine)](https://www.intermissionmagazine.ca/reviews/toronto-fringe-2026-2/)
- [Milan Design Week 2026: what happened (Fuorisalone.it)](https://www.fuorisalone.it/en/magazine/focus/article/2013/milan-design-week-2026-what-happened-milano-fuorisalone)
- [Milan Design Week 2026 — dates, tickets, districts, Salone del Mobile](https://milandesignweek.org/)
- [Piccolo Spoleto 2026 to offer 250 events (Charleston City Paper)](https://charlestoncitypaper.com/2026/04/24/piccolo-spoleto-2026-to-offer-250-events/)
- [SXSW Conferences & Festivals](https://sxsw.com/)
- [Montréal Jazz Fest will hit the highest notes of summer 2026 (Tourisme Montréal)](https://www.mtl.org/en/experience/jazz-festival)
- [Star-studded 2026 Just For Laughs Montréal (Tourisme Montréal)](https://www.mtl.org/en/experience/just-for-laughs-festival)
- [FITS 2026 — about (Sibiu International Theatre Festival)](https://www.sibfest.ro/en/despre-noi)
- [Galway International Arts Festival announces its 2026 Programme](https://www.giaf.ie/media/news/galway-international-arts-festival-announces-its-2026-programme)
- [The Salzburg Festival Sets Dates and Programming For 2026 (BroadwayWorld)](https://www.broadwayworld.com/austria/article/The-Salzburg-Festival-Sets-Dates-and-Programming-For-2026-20251205)
- [Biennale Arte 2026 — National Participations and Collateral Events](https://www.labiennale.org/en/news/national-participations-and-collateral-events-biennale-arte-2026)

## Open questions

- **Does any candidate publish a machine-readable programme?** The single biggest
  unknown, and the one that decides feasibility. Adelaide's site is known to be
  API-driven internally (a ticketing/artist-system integration) but no public
  developer API was found; Avignon OFF publishes a website and app but no
  documented feed; the only open Avignon dataset found is a historical venue-map
  file, not a programme. Each candidate needs a real probe, not a search.
  (Narrowed 2026-09-01: the comedy candidates are now probed — MICF, Adelaide
  and Brighton's actual endpoints are on
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md).)
- **Does the Edinburgh source question have a portable answer?**
  [festival-season/](../festival-season/README.md) establishes that the Listings
  API cannot replace the Tikketr scrape here — it is availability-blind, so two
  adapters into one schema is the realistic architecture. Open question for *this*
  page: whether that two-source shape (a listings source plus a separate ticketing
  source) is the general case for every city, or an Edinburgh accident. If it is
  general, the cost per new city roughly doubles.
- **Which mechanism actually correlates with the user's pain?** The premise is that
  open access → overwhelm → the product. Salzburg (208 curated performances) and
  Venice (a six-month exhibition run) are both crowded cities with no scheduling
  problem. No evidence yet on where the threshold sits — how many parallel runs it
  takes before "which of these can I make" is a real question. (Reframed
  2026-09-01: the festmaxxing bar names the dimensions, but the *threshold* on
  each — how many events a day, how spread the venues — is still uncalibrated.)
- **Is there any audience overlap between festivals?** Whether a Fringe-goer is
  also an Avignon or Adelaide-goer decides whether a second city is a new product
  or a new market for the same users. No data found. The festmaxxing framing
  sharpens this: does the "festival fanatic" who travels the circuit actually
  exist at scale, and where do they congregate?
- **Perth cites 400+ fringes, World Fringe cites 300+.** Narrowed 2026-08-02:
  FRINGE WORLD's own about-us page says "a global landscape of more than 400
  Fringe festivals" — a broad claim about fringes generally, not a stated count
  of the World Fringe network specifically, which is what worldfringe.com's own
  page puts at 300. The two may simply be counting different things (all known
  fringes vs. paid network members) rather than disagreeing, but neither site
  states its methodology, so this is a narrower guess, not a resolution. The
  real count of *fringes above 100,000 tickets* is still the number that matters
  and is still unknown.
- **The candidates in this page's tail are unassessed on everything** — scale
  figures for Cannes, Miami Beach, Documenta, Manifesta, Melbourne, Prague,
  Dublin, Winnipeg, Orlando, Minnesota, Wellington and Camden are not yet cited.
  (Narrowed 2026-09-01: the **comedy-festival** side of Melbourne, Dublin,
  Winnipeg and Wellington is now covered on
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md) — MICF
  turns out to be the strongest fringe-shaped candidate anywhere, 803 shows
  with open JSON APIs. Those cities' *fringe-network* festivals — Melbourne
  Fringe, Winnipeg Fringe, NZ Fringe — remain unassessed here.)
- **Are the tail's scale figures launch announcements or delivered totals?**
  Raised 2026-08-09 after Edinburgh's own figure turned out to be a launch
  snapshot ~15% short of the delivered festival. Avignon OFF, Adelaide, Perth,
  Makhanda, Sibiu and Piccolo Spoleto are all cited here from programme-launch
  press. If open-access festivals generally keep registering shows after launch,
  every ranking on this page is comparing numbers taken at different moments,
  and the whole tail is understated by an unknown amount.
- **Should this page be renamed?** Since 2026-09-01 its scope is festmaxxing
  *environments* (festival or not), but the folder is still
  `festival-cities-beyond-edinburgh/`. Renaming breaks inbound links from four
  sibling pages; kept as-is pending an owner call.

## Growth log

- **2026-07-31** — initial seed, from an owner question ("are there any other
  cities like Edinburgh in the summer?"). Established the four mechanisms that
  produce an Edinburgh-shaped city (open access; curated core plus unofficial off;
  festival season; long exhibition run), the two close analogues (Adelaide,
  Avignon) with 2026 scale figures, an "Other potential candidate events" tail
  grouped by mechanism, and the finding that Edinburgh's official cross-festival
  listings API has no counterpart elsewhere — making data accessibility, not
  language, the binding constraint on a second city. All claims cited; data
  accessibility per candidate recorded as the top open question.
- **2026-07-31** — reconciled with [festival-season/](../festival-season/README.md),
  seeded in parallel the same day. That page owns the Edinburgh Listings API in
  full, so this page's treatment was cut back to the comparative point (no other
  candidate city has an equivalent feed) and now defers rather than restates.
  Picked up its finding that the API is **availability-blind**, which reframes
  this page's open question: no longer "is the official API a better source" but
  whether the resulting two-source shape — a listings feed plus a separate
  ticketing source — is the general case for every city or an Edinburgh accident.
- **2026-08-09** — corrected Edinburgh's side of every comparison on this page
  from the 4 June programme-launch snapshot (3,649 shows / 258 venues) to the
  delivered 2026 festival (4,206 / 299), per the correction on
  [market-and-audience/](../market-and-audience/README.md). The Adelaide density
  ratio moves from ~2.2× to ~2.6×, so Key insight 1 is rewritten ("less than
  half" → "under 40%") and the *Where Edinburgh is still singular* finding gets
  stronger, not weaker. The reason the old figure was wrong is kept in the body.
  The correction also surfaced a methodological risk that applies to this page
  more than any other — its entire candidate tail is cited from launch
  announcements, not delivered totals — and that is added as an open question
  rather than assumed away.
- **2026-08-02** — the Perth FRINGE WORLD entry cited a still-upcoming 2026
  edition; that edition (21 Jan–15 Feb 2026) has since run and published final
  results, so added them alongside the original preview figures rather than
  replacing them (599 events / ~500,000 attendees / $10.9m box office, vs the
  2025 comparison of 570 events / 492,369 attendees / $10.78m), with a note that
  "attendees" and "tickets sold" are different metrics so this does not resolve
  the existing 256,000-tickets figure. Narrowed the "400+ vs 300+ fringes" open
  question with FRINGE WORLD's exact wording, without closing it. Checked (not
  resolved) whether any tool plans across festivals — see the same-day
  competitor-landscape update.
- **2026-09-01** — corrected the Montreal entry's "world's largest comedy
  festival" claim (a JFL marketing label resting on free-outdoor attendance;
  by ticketed shows JFL Montreal is ~a third of Melbourne's MICF, and the
  operator passed through 2024 receivership before relaunching), with the
  reason kept in place. The new sibling page
  [comedy-festival-circuit/](../comedy-festival-circuit/README.md) now owns
  comedy-festival detail — this page defers to it for MICF, JFL and every
  other comedy entry, and the unassessed-tail open question is narrowed
  accordingly (comedy side covered there; the cities' fringe-network
  festivals remain unassessed here).
- **2026-09-01** — restructured the whole page around the **festmaxxing bar**,
  extracted from the owner's stated product direction (a planning tool for
  festival fanatics; time limitation, complexity, abundance; non-festival
  activities woven into the plan). The bar is eight dimensions (shape 1–5,
  qualifiers 6–7, enrichment 8); the mechanism-grouped candidate tail is
  re-tiered into *clears / near miss / fails instructively*, with each entry's
  failing dimension named. No candidate's facts changed — this is a
  reorganization, all corrections kept in place. Melbourne (MICF), Brighton and
  the film festivals (Berlinale, TIFF, MIFF) join the clear tier as
  cross-references to [comedy-festival-circuit/](../comedy-festival-circuit/README.md).
  Scope widened to non-festival environments sharing the shape; a rename
  question is opened rather than acted on.
