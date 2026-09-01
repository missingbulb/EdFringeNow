# The comedy-festival circuit

The world's comedy festivals as a market: what exists, what shape each one is,
and what it would take to point EdFringeNow's planning product at any of them.
This page exists because the owner's direction (2026-09-01) is to grow
EdFringeNow into a festival-planning product, and the first expansion axis is
the art form the product already serves best — comedy is the Fringe's largest
genre. Compiled once, refined in place.

Division of labour with the neighbouring pages:
[festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md)
owns the *city* question (which cities carry the Edinburgh-in-August overwhelm
pattern, whatever the art form); this page owns the *comedy festival* question —
the worldwide circuit, each festival's structure, organizer, ticketing and data
reachability — plus a deliberately light survey of the **film** festivals that
share the planner-complex shape (its own section below). Planner-type
competitors found along the way live on
[competitor-landscape/](../competitor-landscape/README.md).

## Key insights

- Only ~8 of 85 census festivals are fringe-shaped. Most of the circuit is one-night showcases with nothing to schedule.
- MICF is the southern Edinburgh — 803 shows, 9,164 performances, open registration — with unauthenticated JSON APIs.
- Leicester's operator went bust in Aug 2026 owing performers ticket money. Feb 2027 is two rival reboots.
- Nearly everything is annual in the same city, but brands churn: JFL survived receivership, Netflix Is A Joke is biennial.
- Recurrence decides planning — in film too: Fringe shows play ~14 times, Berlinale screens films up to 5×, US one-offs are terminal.
- Leicester and Brighton share one platform (Eventotron) and identical open APIs — one adapter reads both.
- No machine-readable comedy-festival calendar exists. The best tracker is one journalist's hand-kept page.

## The census: a year of comedy festivals

The seed source is the festival tracker kept by From The Comic's Comic
([fromthecomicscomic.com/comedy-festivals/](https://fromthecomicscomic.com/comedy-festivals/),
fetched 2026-09-01), which lists the circuit by month for 2026 with a stated
confirmation policy — "If it's not listed, it's not confirmed yet." The full
2026 list, with run lengths computed from its dates:

| Festival | 2026 dates | Days | City |
|---|---|---:|---|
| SF Sketchfest | 15 Jan – 1 Feb | 18 | San Francisco, US |
| Leicester Comedy Festival | 4–22 Feb | 19 | Leicester, UK |
| SoWal Comedy Festival | 12–14 Feb | 3 | South Walton FL, US |
| Just For Laughs Vancouver | 12–22 Feb | 11 | Vancouver, CA |
| Adelaide Fringe | 20 Feb – 22 Mar | 31 | Adelaide, AU |
| Black Women in Comedy Laff Fest | 25 Feb – 1 Mar | 5 | Brooklyn NY, US |
| Vice City Comedy Festival | 26–28 Feb | 3 | Miami FL, US |
| SLO Comedy Festival | 26 Feb – 1 Mar | 4 | San Luis Obispo CA, US |
| Toronto Sketch Comedy Festival | 4–15 Mar | 12 | Toronto, CA |
| West End Comedy Festival | 6–8 Mar | 3 | Atlanta GA, US |
| Gilda's LaughFest | 11–15 Mar | 5 | Grand Rapids MI, US |
| Sprung! | 12–15 Mar | 4 | Silver Spring MD, US |
| SXSW (comedy) | 13–16 Mar | 4 | Austin TX, US |
| Toledano Street Comedy Festival | 19–22 Mar | 4 | New Orleans LA, US |
| JFL Belgium | 23–29 Mar | 7 | Belgium, BE |
| Melbourne International Comedy Festival | 25 Mar – 19 Apr | 26 | Melbourne, AU |
| Bergamot Comedy Festival | 24–28 Mar | 5 | Santa Monica CA, US |
| DC Sketchfest | 25–28 Mar | 4 | Washington DC, US |
| Lil Rhody Laugh Riot | 26–29 Mar | 4 | Providence RI, US |
| Riot Comedy Festival | 1–4 Apr | 4 | Houston TX, US |
| Asheville Comedy Festival | 3–4 Apr | 2 | Asheville NC, US |
| YALL Comedy Fest | 8–10 Apr | 3 | New York NY, US |
| Big Pine Comedy Festival | 8–11 Apr | 4 | Chandler AZ, US |
| Moontower Comedy Festival | 8–19 Apr | 12 | Austin TX, US |
| Nashville Comedy Festival | 9–19 Apr | 11 | Nashville TN, US |
| Sydney Comedy Festival | 13 Apr – 17 May | 35 | Sydney, AU |
| Traverse City Comedy Fest | 16–18 Apr | 3 | Traverse City MI, US |
| Winnipeg Comedy Festival | 20–26 Apr | 7 | Winnipeg, CA |
| Coconut Grove Comedy Festival | 24–25 Apr | 2 | Miami FL, US |
| Paragon Sports UO Comedy Festival | 30 Apr – 2 May | 3 | New York NY, US |
| Brighton Fringe | 1–31 May | 31 | Brighton, UK |
| NZ International Comedy Festival | 1–24 May | 24 | Auckland + Wellington, NZ |
| Netflix Is A Joke Fest | 4–10 May | 7 | Los Angeles CA, US |
| Halifax ComedyFest | 5–9 May | 5 | Halifax, CA |
| Rogue Island Comedy Festival | 21–24 May | 4 | Newport RI, US |
| Vail Comedy Festival | 22–24 May | 3 | Vail CO, US |
| Wells Comedy Festival | 22–24 May | 3 | Wells, UK |
| Dallas Sketch Festival | 28–31 May | 4 | Dallas TX, US |
| London Clown Festival | 30 May – 13 Jun | 15 | London, UK |
| Fallout Fringe | 3–26 Jun | 24 | Las Vegas NV, US |
| NY Laughs Fest | 4–7 Jun | 4 | New York NY, US |
| Jersey City Comedy Festival | 9–13 Jun | 5 | Jersey City NJ, US |
| Del Close Marathon | 12–14 Jun | 3 | New York NY, US |
| Grindstone Comedy Festival | 2–12 Jul | 11 | Edmonton, CA |
| Fun & Dumb Improv Festival | 9–12 Jul | 4 | Brooklyn NY, US |
| JFL Montreal | 15–26 Jul | 12 | Montreal, CA |
| Greenwich Comedy Festival | 15–19 Jul | 5 | London, UK |
| Just For Laughs Quebec | 22 Jul – 2 Aug | 12 | Quebec City, CA |
| Lucille Ball Comedy Festival | 6–9 Aug | 4 | Jamestown NY, US |
| Edinburgh Festival Fringe | 7–31 Aug | 25 | Edinburgh, UK |
| Hawaii Comedy Festival | 14–15 Aug | 2 | Honolulu HI, US |
| Austin Sketchfest | 14–23 Aug | 10 | Austin TX, US |
| Hampton Beach Comedy Festival | 18–23 Aug | 6 | Hampton Beach NH, US |
| Blue Whale Comedy Festival | 20–23 Aug | 4 | Tulsa OK, US |
| ImprovCon | 20–23 Aug | 4 | San Diego CA, US |
| Roundhouse Comedy Festival | 23–26 Aug | 4 | London, UK |
| Columbus Comedy Festival | 27–30 Aug | 4 | Columbus OH, US |
| Great Outdoors Comedy Festival (Vancouver stop) | 28–30 Aug | 3 | Vancouver, CA |
| Baltimore Comedy Festival | 2–7 Sep | 6 | Baltimore MD, US |
| Let's Fest | 3–6 Sep | 4 | Indianapolis IN, US |
| Bend Comedy Festival | 4–6 Sep | 3 | Bend OR, US |
| Fugazi Funny Festival | 9–12 Sep | 4 | San Francisco CA, US |
| DC Comedy Festival | 9–12 Sep | 4 | Washington DC, US |
| Saratoga Comedy Festival | 11–12 Sep | 2 | Saratoga Springs NY, US |
| "Dublin Comedy Festival" | 11 Sep – 3 Oct | 23 | Dublin, IE |
| Motor City Comedy Festival | 16–20 Sep | 5 | Detroit MI, US |
| JFL Paris | 17–20 Sep | 4 | Paris, FR |
| Tokyo International Comedy Festival | 17–27 Sep | 11 | Tokyo, JP |
| Aberdeen Comedy Festival | 19 Sep – 4 Oct | 16 | Aberdeen, UK |
| Just For Laughs Toronto | 24 Sep – 3 Oct | 10 | Toronto, CA |
| WHAT THE FESTIVAL! | 24–27 Sep | 4 | Toronto, CA |
| Omaha Comedy Fest | 24–27 Sep | 4 | Omaha NE, US |
| Latina Comedy Festival | 1–3 Oct | 3 | Chicago IL, US |
| Little Egypt Comedy Festival | 8–10 Oct | 3 | Marion IL, US |
| Dubai Comedy Festival | 9–18 Oct | 10 | Dubai, AE |
| Atlantic City Comedy Festival | 9–10 Oct | 2 | Atlantic City NJ, US |
| Catskills Comedy Festival | 16–18 Oct | 3 | Catskill NY, US |
| Galway Comedy Festival | 20–26 Oct | 7 | Galway, IE |
| 312 Comedy Festival | 5–15 Nov | 11 | Chicago IL, US |
| New York Comedy Festival | 6–15 Nov | 10 | New York NY, US |
| Just For Laughs Sydney | 9–22 Nov | 14 | Sydney, AU |
| Boston Comedy Festival | 10–14 Nov | 5 | Boston MA, US |
| Helena Comedy Festival | 12–14 Nov | 3 | Helena MT, US |
| Skankfest | 13–15 Nov | 3 | New Orleans LA, US |
| Flyover Comedy Fest | 12–15 Nov | 4 | St. Louis MO, US |

Not in the table: three undated entries — the **San Francisco Comedy
Competition** ("across the Bay Area") and **Seattle International Comedy
Competition** ("all month across Western Washington", November), both
month-long *touring competitions* rather than city takeovers, and **Just For
Laughs Singapore** (tbd) — plus the first 2027 confirmations (JFL Bermuda,
17–20 Feb 2027; SXSW, 17–20 Mar 2027). The tracker's own dates are treated
here as launch-time claims, not delivered totals — and the dossiers below
correct five of its entries against primary sources: Roundhouse actually ran
1–18 Aug, Greenwich has rebranded to "Comedy Garden", the "Dublin Comedy
Festival" is a suburban pub circuit, JFL Paris appears dead, and
Machynlleth (the UK's best small-town takeover) is missing entirely.

What the census says before any per-festival research:

- **The circuit is mostly weekend showcases.** 45 of 85 dated festivals run ≤4
  days, and 56 of 85 are in the US — overwhelmingly club-scale, curated or
  submission-based weekends where a visitor picks a headliner, not a schedule.
- **The fringe-length tier is small and un-American.** Only 13 festivals run
  ≥14 days, and the US contributes just two (SF Sketchfest and the new Fallout
  Fringe in Las Vegas); the other eleven are UK, Irish, Australian and NZ
  events — Edinburgh, Adelaide, Brighton, Melbourne, Sydney Comedy Festival,
  JFL Sydney, NZICF, Leicester, Aberdeen, the London Clown Festival, and the
  Dublin entry examined below.
- **Run length is a strong first classifier.** A festival long enough to need
  repeat performances of the same show is where a scheduling product has work
  to do; a weekend of one-night showcases is not. The dossiers below test that
  presumption festival by festival.

## The two shapes, and what decides planner-worthiness

The owner's framing question — which festivals behave like the Fringe and
which like music festivals — turns out to rest on two measurable axes, and
the dossiers below supply the numbers:

1. **Parallel volume**: how many shows run at once. Edinburgh peaks in the
   thousands per day; MICF at ~350; Leicester's own API shows 242 on its
   peak Saturday; Netflix Is A Joke ~100; Sydney ~29; most of the census
   runs single digits. Below a few dozen parallel shows, "which can I make"
   stops being a problem a product needs to solve.
2. **Recurrence**: how many times one show plays. Edinburgh averages ~14
   performances per show and MICF ~11 — miss tonight, catch tomorrow, so
   planning is *packing*. Sydney averages 2.4 and Leicester 2.28; the US
   majors run one-night events almost exclusively — every clash is
   terminal, so planning is *triage*, and with few parallel shows it
   reduces to picking headliners.

Two more axes modulate the answer: **venue geography** (a walkable core —
Edinburgh, MICF's CBD, Machynlleth — makes multi-show days physically
possible; a car city like LA or Dubai caps a day at one neighbourhood;
a single site has nothing to route) and **access model** (open access —
anyone who pays registers — is what produces uncapped supply; curation caps
it by construction).

The resulting map of the census:

- **Fringe-shaped** (open access, repeated runs, many venues, real clash
  grid): Edinburgh, Adelaide, **MICF**, **Brighton** (46% comedy), and
  **Leicester** in its short-visit variant — plus **NZICF** small and
  **Machynlleth** miniature. This is the entire planner-market tier, and
  outside Edinburgh none of it has a third-party planner
  ([competitor-landscape/](../competitor-landscape/README.md)).
- **Showcase-shaped** (curated one-nighters, pick-your-headliner): the JFL
  empire, NYCF, Sydney, Perth, Galway, Dubai, Aberdeen, Winnipeg, Halifax,
  Nashville, 312, and — at fringe *breadth* but one-off depth — SF
  Sketchfest and Netflix Is A Joke, where the planning problem is real but
  is scarcity-triage (nothing repeats) rather than schedule-packing.
- **Distinct sub-shapes the two poles don't cover**: the **badge-graze**
  festivals (Moontower's club binge, Del Close Marathon, SXSW) where entry
  is walk-in and the constraint is room capacity, not tickets; the
  **roving franchise** (Great Outdoors; 57 Festivals' Comedy Gardens) — one
  stage, touring cities; the **anti-planner compound** (Skankfest, schedule
  released day-of); the **touring competitions** (Boston's bracket, SF and
  Seattle's month-long circuits); the **TV-taping festivals** (Winnipeg,
  Halifax — the broadcast is the product); the **venue season** (Aberdeen,
  Roundhouse); the **club hub** (Tokyo, Grindstone); and the **pub circuit**
  wearing a festival name (the "Dublin Comedy Festival").

The product read: **run length in the census predicts the shape but does
not decide it** — Sydney (35 days) and Aberdeen (16) are showcases, while
Machynlleth (3 days) has a denser grid than either. The deciding pair is
parallel volume × recurrence, and only the fringe-shaped tier scores high
on both.

## The fringe-shaped tier: dossiers

The festivals where "which of tonight's shows can I make" is a real problem —
long runs, repeated performances, many parallel rooms. This is the tier a
planning product can serve.

### Melbourne International Comedy Festival — the southern Edinburgh

The standout of the whole census, and the closest thing to a second Edinburgh
Fringe anywhere in comedy.

- **Scale, delivered 2026** (the festival's own
  [40th-year wrap](https://www.comedyfestival.com.au/news/celebrating-a-record-40th-year/)):
  **803 shows and events, 9,164 performances, 26 days** (25 Mar–19 Apr),
  796,975 attendees (+13% YoY), A$26.6m box office, average paid ticket
  A$38.20. That is ~350 performances a day — genuinely fringe-like clash
  density. Launch press said "over 750 shows", so ~50 more landed after
  launch: the launch-undercount trap
  [market-and-audience/](../market-and-audience/README.md) documents holds
  here too.
- **Show model**: Edinburgh-style seasons — one show is the same hour repeated
  across the run (sampled runs of 7–24 performances; cheaper previews,
  cheap-Tuesday flags). Participation is **open registration**
  ([registrations open each October](https://www.comedyfestival.com.au/participate/),
  with independent venues found via a venue finder) — the Fringe's
  open-access mechanism, at ~one-fifth Edinburgh's scale.
- **Organizer & recurrence**: its own festival organization, annual every
  autumn since 1987, always Melbourne, centred on Melbourne Town Hall;
  [self-described](https://www.comedyfestival.com.au/about-us/) as "one of
  the three largest comedy festivals in the world, alongside Edinburgh
  Festival Fringe and Montreal's Just for Laughs" and "Australia's largest
  ticketed cultural event". Stable through a 2026 leadership handover
  (Susan Provan retired after 32 years;
  [Dylan Cole appointed CEO/Festival Director](https://www.comedyfestival.com.au/news/melbourne-international-comedy-festival-appoints-dylan-cole-as-new-ceofestival-director/)).
  2027 dates already announced (24 Mar–18 Apr).
- **Venues**: 143 venue buildings in its own venues data — 66 in the CBD, the
  rest a suburban tail (Northcote, Box Hill…) — a walkable core plus
  outliers, the Edinburgh pattern loosened one notch.
- **Ticketing**: comedyfestival.com.au is **its own central box office** with
  one basket across shows (a cart API, accounts, native favourites with
  share-a-favourites-list); a minority of external-venue shows link out to
  Ticketmaster/Ticketek/Arts Centre Melbourne.
- **Data reachability — best in the census**: unauthenticated JSON endpoints,
  verified by fetch:
  `POST /umbraco/api/searchapi/searchShows` (826 show records for 2026, paged,
  with runs, performance counts, venue rooms),
  `GET /umbraco/api/venuesapi/getvenues` (all 143 venues with address,
  capacity, accessibility flags), and each show page embeds a `sessionData`
  JSON array with per-performance date, time, **on-sale status and
  sold-out/preview/cheap-night flags** — near enough 1:1 onto the fields the
  Edinburgh scraper already produces. A
  [sitemap](https://www.comedyfestival.com.au/sitemap.xml) lists every show
  URL.
- **Concurrent**: Melbourne Food & Wine Festival and the Flower & Garden Show
  overlap the window, with the AFL season running throughout (per
  [melbournetourism.org](https://www.melbournetourism.org/melbourne-events-and-festivals-calendar/))
  — city-draw amplifiers, though nothing on the scale of Edinburgh's August
  cluster.
- **Planner field**: the site's account favourites are the only planning tool;
  no current official app found (a
  [2010-era iPhone app](https://itwire.com/software/laugh-it-up-on-the-iphone-melbourne-international-comedy-festival-app.html)
  is the last trace), and no third-party planner exists — see
  [competitor-landscape/](../competitor-landscape/README.md).

### Adelaide Fringe — covered elsewhere, plus the ticketing angle

Scale, open access and the "Mad March" cluster are on
[festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md);
what this pass adds is ticketing and data. Adelaide Fringe Inc. (a
not-for-profit, incorporated 1975) runs **its own ticketing platform,
FringeTIX** — [first used in 1998](https://en.wikipedia.org/wiki/Adelaide_Fringe),
today a Rails app inside adelaidefringe.com.au with a central cart across all
shows and venues — and [markets that platform (AVR) to other open-access
festivals](https://adelaidefringe.com.au/about-us) as "the best solution for
collating and managing open access festivals". No public API was found
(probes 404/500 off-season); a scrape would target the server-rendered
FringeTIX listing in season. Comedy's share of the ~1,500-show programme is
not published —
[the 2026 launch](https://adelaidefringe.com.au/fringefeed/news/2026-program-unveiled-with-more-than-1500-shows)
lists comedy first among genres with no counts.

### NZ International Comedy Festival — one festival, two cities at once

- **Organizer**: the [New Zealand Comedy Trust](https://comedyfestival.co.nz/about-us/the-new-zealand-comedy-trust/),
  a charitable not-for-profit; festival annual each May since 1995 (roots
  1993), 2026 = the 33rd Auckland edition and the Wellington leg's 30th.
- **The two-city model**: one programme, one window (1–24 May 2026), running
  **simultaneously** in Auckland and Wellington with region-filtered listings
  (plus a "Gala toe-dip" in Christchurch in 2026); some acts play a season in
  each city inside the window. Each city is a compact centre cluster
  (Auckland: Q Theatre, Basement, The Classic + big halls for headliners;
  Wellington: BATS' three rooms, Te Auaha, Hannah Playhouse).
- **Scale & model**: the Trust's steady-state description is
  ["over 120 show seasons, over 600 performances, around 200 comedians"](https://comedyfestival.co.nz/about-us/new-zealand-international-comedy-festival/),
  75,000+ attendance in 2025 — Edinburgh-style short seasons (~5 performances
  each), a real but small evening-choice problem (~a dozen parallel shows per
  city on peak nights).
- **Ticketing**: **no central basket** — the festival site is a catalogue that
  [hands buyers to the right agent per show](https://comedyfestival.co.nz/how-to-buy-tickets):
  Ticketmaster, Q Theatre's box office, Eventfinda or iTicket, each with its
  own fees. A cross-show plan means juggling up to four seller accounts.
- **Data**: server-rendered SilverStripe site, no JSON API found; a scrape
  targets the find-a-show HTML per region.
- **Concurrent**: May in Auckland is genuinely congested — NZ Music Month plus
  the Auckland Writers Festival inside the window;
  [The Spinoff](https://thespinoff.co.nz/pop-culture/06-05-2026/auckland-has-a-problem-everything-awesome-is-happening-in-may-all-at-once):
  "Auckland has a problem. Everything awesome is happening in May, all at
  once."
- **Planner field**: the official planning tool is a downloadable timetable
  PDF. Nothing else exists.

### Sydney Comedy Festival — the boundary case

Fringe-scale show count, showcase-shaped mechanics — the census's clearest
demonstration that show count alone doesn't decide the shape:

- **Delivered 2026** (per the festival's wrap, carried by
  [The Movie Boards](https://www.themovieboards.net/2026/05/18/record-growth-and-huge-crowds-for-sydney-comedy-festival/)):
  **411 shows, close to 1,000 performances, 57 venues, 175,000+ attendees**
  over 35 days (13 Apr–17 May) — but that is **~2.4 performances per show**
  against MICF's ~11.4: mostly weekend-length visits, galas and showcases,
  not month-long seasons.
- **Structure**: run by [Century Entertainment](https://www.century.com.au/about/),
  a commercial venue group (Enmore Theatre, Comedy Store…), **curated by
  application**, venues scattered "from Bondi to Penrith" (a metro
  constellation, not a walkable core), **per-venue ticketing** with no
  central basket (Century venues on TicketSearch, tour venues on their own
  sellers), followed by a national showcase tour May–December. Concurrent:
  Sydney Royal Easter Show and Writers' Festival brush the window, Vivid
  starts just after.
- Century also produces the **[Perth Comedy Festival](https://www.perthcomedyfestival.com/about/)**
  (20 Apr–17 May 2026, ~70 gigs across 5 venues — fully showcase-shaped) on
  the same WordPress codebase — one scrape adapter would cover both.

### Leicester Comedy Festival — the UK's second clash problem, operator now dead

The February anchor of UK comedy, and this pass's most dramatic finding:
**the organising charity collapsed in August 2026**, weeks before this page
was written.

- **Shape**: open access — "anyone can pay a fee to put on an event",
  registered through Eventotron
  ([registration page](https://comedy-festival-takepart.co.uk/how-to-register-your-show))
  — annual each February since 1994, same city. 2026:
  [700+ shows across 81 venues](https://leicestertimes.com/leicester-news/leicester-comedy-festival-launches-with-over-700-shows-celebrating-the-art-of-comedy/52061/)
  over 19 days, plus a kids' comedy festival. Its own events API (fetched)
  counts 753 shows whose bookings average **2.28 days per show** — so the
  clash problem is fringe-scale (**242 shows on the peak Saturday**, per the
  API's date taxonomy) while the *runs* are short visits, not
  Edinburgh-length seasons. Venues run from a city-centre core out to county
  village halls.
- **Ticketing & data**: central box office on the festival's own site — the
  **Eventotron** WordPress plugin plus Stripe, leaving a fully open REST API
  (`events.comedy-festival.co.uk/wp-json/wp/v2/events`, 753 events with
  dates/genres/venues taxonomies, verified by fetch) — the same substrate
  and API shape as Brighton Fringe below: **one adapter would read both**.
- **The collapse**: operator Big Difference Company (charity 1135167) became
  insolvent and ceased trading —
  [its own 26 Aug 2026 statement](https://irp.cdn-website.com/b436dc39/files/uploaded/Statement+BDC+26_08_2026.docx)
  — with [debts over £215,000](https://www.chortle.co.uk/news/2026/08/22/61391/leicester_comedy_festival_charitys_debts_exceed_%c2%a3215,000)
  and performers owed their ticket money (the Feb 2026 festival *happened*;
  Wikipedia's "cancelled" lede is wrong). February 2027 is now contested:
  the [city council has pledged a successor festival](https://www.chortle.co.uk/news/2026/08/06/61209/leicester_mayor:_we_will_have_a_comedy_festival_next_year)
  (3–21 Feb 2027 per the old site's banner) while comedian Alex Hylton's
  [**Independent Comedy Festival**](https://www.chortle.co.uk/news/2026/08/11/61247/leicester_gets_a_new_comedy_festival)
  launches in the same window and venues — on **TixEvery**, a platform that
  pays comedians directly so the festival never holds box-office money (a
  ticketing model born directly of the collapse). For the product: the
  incumbent data source works today and its owner is in liquidation — which
  festival "is" Leicester next year is genuinely open.

### Brighton Fringe — half of it is a comedy festival

Already profiled as a city on
[festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md);
what this pass adds is measured comedy share, mechanics and the cluster.
**Comedy is 46% of the live programme** — 394 of 864 events in its own
events API carry the Comedy genre (fetched; cross-edition genre totals give
42%) — making open-access, month-long Brighton effectively half a comedy
festival, the largest comedy event in the UK after Edinburgh with Leicester
gone. Central box office on brightonfringe.org itself, on the **same
Eventotron + Stripe substrate as Leicester** with the same open REST API
(the what's-on grid is client-rendered, but the API is not). Its May window
contains a real cluster:
[Brighton Festival (curated, 105 events, 1–25 May)](https://brightonfestival.org/press-office/press-release-brighton-festival-2026-launch/)
and [The Great Escape new-music showcase (13–16 May, 30+ venues)](https://www.livenation.co.uk/event/the-great-escape-2026-brighton-tickets-edp1637482)
sit wholly inside Brighton Fringe's 1–31 May.

### Machynlleth — the small-town takeover (missing from the tracker)

[Machynlleth Comedy Festival](https://machcomedyfest.co.uk/) is not on the
seed tracker at all and belongs in the census: run by producer Little
Wander, 15th year in 2026, **200+ shows in three days (1–3 May) in a Welsh
town of ~2,000 people** — ~65+ parallel-ish shows a day, a genuine clash
problem at miniature scale, with an official festival app. Single-curator
in structure, fringe-dense in feel: the reference point for the
"small-town takeover" model (Wells is its curated-weekend little sibling).

## The showcase majors: dossiers

Big festivals where the visitor picks headliners rather than solves a
schedule — one-night curated events, few or no repeats, tickets scattered
across vendors. The blunt cross-cutting finding from the US research: **no US
major is fringe-shaped.**

### The Just For Laughs empire — survived receivership, showcase to the bone

The census's nine JFL entries are one company plus its licensees, and its
recent history is the sharpest annual-vs-durable case in the circuit:

- **The ownership arc**: founded 1983 (Gilbert Rozon); sold 2018 to the Howie
  Mandel / ICM / Bell Media / Groupe CH group after Rozon's resignation;
  **filed for creditor protection in March 2024** — the 2024 Montreal and
  Toronto festivals were cancelled outright, with
  [$22.5m of debt and an $800k loss to email phishing](https://en.wikipedia.org/wiki/Just_for_Laughs)
  later revealed; assets acquired mid-2024 by **ComediHa!** (Sylvain
  Parent-Bédard's Quebec City group, per
  [CTV](https://www.ctvnews.ca/montreal/article/quebec-entertainment-group-comediha-confirms-acquisition-of-just-for-laughs-assets/)),
  parent since renamed Groupe Juste pour divertir. A reduced 2025 comeback,
  then a full-volume 2026: the
  [44th Montreal edition, 15–26 July — ~250 shows, ~25 venues, 800+ artists](https://www.themain.com/articles/just-for-laughs-montreal-2026-guide),
  with [2027 satellite dates already published](https://comedyevent.bm/).
  Read: a durable annual anchor again — two years into a turnaround, its
  scale figures its own marketing.
- **The Montreal model** is three tiers, none of them fringe runs: TV-taping
  **galas** at Place des Arts; **curated showcase runs of 1–5 nights** (The
  Nasty Show, Midnight Surprise) plus premium one-offs (Letterman at up to
  $550, per [Cult MTL](https://cultmtl.com/2026/07/just-for-laughs-and-off-jfl-are-showcasing-hundreds-of-great-comedians-in-montreal-from-july-15-to-26/));
  and a huge **free outdoor** programme at Place des Festivals.
  [Place des Arts' "nearly two million visitors"](https://www.placedesarts.com/en/festival/just-for-laughs-festival)
  counts those free crowds — which is how "world's largest comedy festival"
  survives as a label while MICF trebles its ticketed show count. The
  fringe-ish annex is **OFF-JPR** (the relaunched
  [Zoofest](https://www.offjpr.com/), ~one-night $24–32 club sets), and the
  industry layer is ComedyPRO with the New Faces showcases. Everything sits
  in the Quartier des Spectacles — concentrated, walkable, evening slots at
  7:00/9:30/midnight; a missed showcase usually repeats tomorrow, so clash
  pain is modest.
- **Franchise map**: Montreal, Quebec City (the rebranded 25-year-old
  ComediHa! Fest, now deliberately overlapping Montreal's dates), Toronto
  (ex-JFL42, relaunched 2025, [24 Sep–3 Oct 2026](https://toronto.hahaha.com/))
  and Vancouver ([12–22 Feb, 100+ shows](https://dailyhive.com/vancouver/just-for-laughs-vancouver-2026))
  are owned-and-operated; Sydney and Singapore run with promoter Bohm
  Presents ([justforlaughs.sydney](https://www.justforlaughs.sydney/) is a
  tour-stop model on Opera House + external venue ticketing); Bermuda,
  Belgium (Namur) and Switzerland are local promoters carrying the brand.
  **The tracker's "JFL Paris" entry appears dead** — the hahaha.com festival
  URL 404s and no 2026 edition was found.
- **Ticketing & data**: the hahaha.com family sells on its **own platform**
  (a proprietary "Nova" CMS with Stripe, per-city baskets and a wishlist);
  Sydney explicitly fans out to six external sellers. No structured API; the
  programme loads as client-side HTML fragments — and **listings are
  ephemeral: city sites were emptied within weeks of the festival ending**,
  so any programme capture has to happen during the on-sale window.
- **Concurrents**: Montreal's window near-totally overlaps the
  [Fantasia film festival](https://en.wikipedia.org/wiki/Fantasia_International_Film_Festival)
  with Nuits d'Afrique brushing its first weekend — a real multi-festival
  cluster; Toronto's autumn slot dodges TIFF entirely.

### Netflix Is A Joke — maximum scale, biennial, and an anti-planner FAQ

- **Biennial, not annual**: editions
  [2022, 2024, 2026 — no 2023 or 2025](https://en.wikipedia.org/wiki/Netflix_Is_a_Joke_Festival)
  (a resale SEO site wearing a 2025 name misleads searches). Corporate-run
  by Netflix; 4–10 May 2026 delivered.
- **Scale**: its own site banner claims "475+ shows, 500+ artists, 45+
  venues… the largest comedy event in history"; the schedule page's inlined
  dataset carries **498 dated events across 116 venue slugs**, peaking at
  **101 events on the Saturday** — numerically the hardest clash problem in
  US comedy, spread across greater LA from the Hollywood Bowl to the Intuit
  Dome, where cross-town same-night stacking is impractical. Attendees treat
  it as pick-your-headliner anyway.
- **Ticketing**: the FAQ is explicit — "there are no festival passes"; 498
  events fan out to **12+ vendors** (counted from its own payload:
  Ticketmaster 167, Eventbrite 118, ShowClix 51, TicketWeb 34, …).
- **Data**: paradoxically the easiest big scrape in the US — a Next.js site
  that **inlines the entire event dataset (1.4MB) in the server-rendered
  payload** of [/schedule](https://www.netflixisajokefest.com/schedule):
  per-event times, venue ids, ticket URLs, per-venue lat/long, capacity,
  even parking and bag policy. One HTML fetch gives everything.
- **Planner field**: no official app; the site's favourites are the only
  tool, and no third party exists.

### SF Sketchfest — fringe breadth, one-off depth

[Founded 2001 and still run by its three founders](https://en.wikipedia.org/wiki/SF_Sketchfest);
annual each Jan/Feb (a COVID gap 2021–22), 23rd edition in 2026: **200+
shows, 500+ performers, 13 venues, 18 days** (per
[Deadline](https://deadline.com/)). The catch that decides its shape: the
programming is **reunions, tributes and one-night specials that structurally
cannot repeat** (a *Brain Candy* 30th anniversary, "The Women of SNL") — ~11
shows/day of unresolvable clashes, since nothing gets a second chance.
Tickets per show via a single
[Eventbrite organizer account](https://www.eventbrite.com/o/sf-sketchfest-57967098043);
planning outsourced to a yearly [Sched instance](https://sfsketchfest2026.sched.com/);
the festival's own site is bot-walled (SiteGround captcha), making Eventbrite
the practical machine surface.

### Moontower — the US festival with a fringe inside it

Run by the nonprofit [Paramount Theatre](https://www.austintheatre.org/moontower-comedy/)
(Austin Theatre Alliance) each April since 2012. Two tiers: two weeks of
theatre headliners on single tickets (Tessitura, the venue's own system) —
and the **4-day Club Binge**, where a **badge is walk-in access to 10+
walkable downtown clubs, no tickets or reservations**, 100+ comedians
playing multiple showcase slots. That binge is genuine fringe mechanics
(turn-up-and-graze, room-capacity risk instead of ticket clashes) — the
closest any US major comes. Note the census-table caveat: the "12 days"
overstates the fringe-like part; the binge is four.

### SXSW Comedy — a garnish on a badge mega-festival

[Since 2008](https://sxsw.com/festivals/comedy/), but tiny: the official
stats block for 2027 says **"4 nights, 2 venues, 65+ performers, 30 shows"**
— all included with an SXSW badge ($550–$1,395 tiers), no per-show tickets.
Comedy barely clashes with itself; it clashes with the 1,000+ music
showcases, film premieres and conference tracks on the same credential — the
purest "the city is the draw" case in the census, and the reason SXSW ships
the circuit's best official planner
([SXSW GO on Eventbase](https://www.eventbase.com/sxsw-go) + schedule.sxsw.com).

### New York Comedy Festival, and the November pile-up

[Founded 2004 by Caroline Hirsch and still produced by Carolines / 550
Comedy Inc.](https://nycomedyfestival.com/faq/) — "10 days, 5 boroughs,
100+ shows, 200+ comedians" grown to 150+ by August: headliner one-nighters
(Beacon, Town Hall, Kings Theatre, a Stand Up for Heroes gala) over ~39
venues with **per-venue ticketing** (Ticketmaster / ATG / house systems) and
open submissions confined to three contest-style showcases. Data note: a
live WordPress REST API
([/wp-json/wp/v2/lineup](https://nycomedyfestival.com/wp-json/wp/v2/lineup?per_page=2))
makes it scrapable without a browser. Its window sits in the **US November
pile-up**: NYCF (6–15), 312 Chicago (5–15), Boston (10–14) and Skankfest
New Orleans (13–15) all overlap, circulating the same touring headliners
through different cities.

### The promoter slates and the rest, briefly

- **[Nashville Comedy Festival](https://www.nashcomedyfest.com/)** and
  **[312 Comedy Festival](https://www.312comedyfestival.com/)** (Chicago)
  are both "presented by Outback Presents" — a promoter's April/November
  booking slate wearing a festival name: arena and theatre one-nighters plus
  club weekends, per-venue ticketing (Etix/AXS/Ticketmaster counted in the
  hundreds of links on their own pages). 312's Zanies club weekends — the
  same comic doing 2 shows a night for a weekend — are the nearest thing to
  a "run" in US club culture.
- **[Boston Comedy Festival](https://www.bostoncomedyfest.com/)** (26th
  year) is **competition-spined**: open submissions, ~96 comics through
  bracket rounds to a Somerville Theatre final — fringe-adjacent spirit,
  contest schedule.
- **[Skankfest](https://skankfest.com/)** (GaS Digital) is the
  **anti-planner**: one venue compound, pass-only (Tixr), 11am–midnight
  overlapping sets — and **"the full festival schedule will be released the
  day of the festival"**. Fans buy the brand, not a lineup; sold out seven
  years running. Roving city history (Queens → Houston → Las Vegas → New
  Orleans).
- **[Del Close Marathon](https://ucbcomedy.com/)** (UCB, NYC): **56
  nonstop hours** of improv across six stages in two venues on a badge —
  round-the-clock grazing, structurally one continuous show.
- **[NY Laughs Fest](https://nylaughsfest.com/)** (2nd year, nonprofit):
  free public-space comedy (Union Square) plus 20+ club shows — a civic
  showcase.

### The UK & Ireland showcase belt, briefly

- **[Galway Comedy Festival](https://galwaycomedyfestival.ie/)** — "Ireland's
  largest comedy festival" by its own meta description, ex-"Vodafone Comedy
  Carnival": a curated headliner week each October
  ([69 shows / 16 venues in 2025, per RTÉ](https://www.rte.ie/culture/2025/0911/1533013-galway-comedy-festival-reveals-2025-line-up-ahead-of-october-bash/)),
  grown out of the Róisín Dubh venue, ~10 shows/day. Self-run ticketing on a
  custom SPA built with Base44 (an AI app-builder) — which also exposes its
  operator admin routes in the page shell.
- **The "Dublin Comedy Festival" untangled** — the tracker's 23-day September
  entry links to what
  [redirects to dublincomedyfestival.ie](https://www.dublincomedyfestival.ie/),
  whose own headline is "**West Dublin's Comedy Takeover**": ~20 shows of the
  same few acts rotating suburban pubs and hotels (Reginald D Hunter ×4
  nights), per-event tickets on Universe. It is a rebranded pub circuit, not
  a fringe — the census's second-longest UK entry dissolves on inspection.
  Dublin's real big comedy event is the
  [Paddy Power Comedy Festival](https://aikenpromotions.com/show/paddy-power-comedy-festival/)
  (Aiken Promotions, Iveagh Gardens, four days each July); September in
  Dublin belongs to the theatre-led
  [Dublin Fringe](https://www.fringefest.com/news/dublin-fringe-festival) —
  the likely source of the label confusion.
- **[Aberdeen Comedy Festival](https://www.aberdeenperformingarts.com/aberdeen-comedy-festival/)**
  — the venue-trust model: Aberdeen Performing Arts (the charity running the
  Music Hall, His Majesty's and The Lemon Tree) programmes a curated
  three-weekend season (19 Sep–4 Oct 2026, Russell Howard, Susan Calman) on
  its own Spektrix box office. A handful of shows a night; no clash problem.
  The census's 16-day length flatters it — it is three weekends, not a run.
- **[Wells Comedy Festival](https://www.wellscomfest.com/)** — the curated
  small-town weekend: produced by Plosive (the podcast company), 10th
  edition 2026, three walkable rooms in England's smallest city, big-name
  bills (Acaster, Pascoe, Kumar), TicketSource ticketing.
- **[Greenwich Comedy Garden](https://www.greenwichcomedygarden.co.uk/)** —
  tracker correction: rebranded from "Greenwich Comedy Festival" (the old
  domain redirects). Producer 57 Festivals' five-night big-top residency at
  the Old Royal Naval College — mixed-bill headliner nights, See Tickets —
  and the same team runs Brighton/Cambridge/Norwich Comedy Gardens: a
  **replicated single-site format**, the UK's polite cousin of the Great
  Outdoors model below.
- **[Roundhouse Comedy Festival](https://www.roundhouse.org.uk/seasons/roundhouse-comedy-festival/)**
  — tracker correction: 2026 actually ran **1–18 August** (not 23–26), one
  Camden building, curated with Berk's Nest, headline one-nighters and live
  podcasts on the venue's own box office — a single-building season that
  deliberately counter-programs the Edinburgh month.
- **[London Clown Festival](https://www.londonclownfest.online/)** (tracker's
  domain is dead; this is the live one) — niche curated clown/physical
  programme split between Soho Theatre and Jacksons Lane, each on its own
  box office. The census's 15-day length is two venues' seasons, not a
  dense festival.

### Dubai Comedy Festival — the destination-marketing umbrella

- **Organizer**: a government-backed promoter consortium — [BRAG "partnered
  with DTCM (Dubai's tourism department) and Live Nation to bring back the
  festival" in 2020](https://brag.world/dubai-comedy-festival); recent editions
  are presented by Dubai Calendar and produced by BRAG, Live Nation, GME
  Events and DXB Live (per [Katch International](https://katchinternational.com/)).
  Annual since the 2020 revival, 7th edition in 2026, grown from 4 days to 10.
- **Scale & model**: ["50+ artists, 40+ shows, 3+ venues"](https://www.dubaicomedyfest.ae/about)
  over 10 days — one-night international touring acts (Mo Gilligan, Katherine
  Ryan, Vir Das…), many "presented by" third-party promoters under the
  festival umbrella, deliberately multilingual (English, Arabic, Hindi, Urdu,
  Russian), plus a small up-and-comers sidebar ("Comedy Bizarre").
- **Venues & clash**: spread across a car-scale city — Dubai Opera, Coca-Cola
  Arena, Mall of the Emirates theatre, clubs; 2–3 shows per evening across
  distant venues. Lineup-picking with traffic, not a schedule grid.
- **Ticketing & data**: per-show, multi-vendor — mostly
  [Platinumlist](https://dubaicomedyfestival.platinumlist.net/) (which runs an
  aggregating microsite), plus venue box offices and Ticketmaster.ae for some
  shows. The [shows page](https://www.dubaicomedyfest.ae/shows) is
  server-rendered Squarespace carrying every show's date, venue, language,
  price and vendor link in plain HTML — the easiest large-festival page to
  read mechanically in the whole census.

## The structural exhibits

Festivals that mark out the edges of the taxonomy — none is a planner market,
and each pins down one shape the census keeps producing.

### Great Outdoors Comedy Festival — the music-festival pole, confirmed

The hypothesis the census raised, confirmed and then some: GOCF is not even a
serial tour but a **franchise running parallel one-stage city productions on
shared weekends** — [seven 2026 stops](https://greatoutdoorscomedyfestival.com/):
Edmonton *and* Winnipeg both 17–19 July, Calgary *and* Vancouver 28–30 August
with Spokane the same weekend, Halifax 6–9 August, Mississauga 11–13
September; 2027 dates already on sale. Owned and run by
[Trixstar](https://greatoutdoorscomedyfestival.com/about), an Edmonton
promoter; since 2021 it claims 400,000+ cumulative attendees. One outdoor
stage per city (Vancouver's Stanley Park permit caps at
[10,000/day](https://dailyhive.com/vancouver/the-great-outdoors-comedy-festival-proposal-stanley-park)),
two shows a day (matinee + evening), each a one-off bill of touring headliners
(Bill Burr, Matt Rife, Pete Davidson tiers), grounds cleared between shows,
explicitly [no application process](https://greatoutdoorscomedyfestival.com/gocf-faqs)
for performers, GA/VIP tiers, no re-entry, 18+/19+. Ticketing is
[Tixr-only](https://greatoutdoorscomedyfestival.com/cities/vancouver); the
Webflow site is fully server-rendered. **Scheduling problem: none by design —
the only decision is which city you are in.** This is what "comedy festival"
means when the shape is literally a music festival's.

### The TV-taping festivals — Winnipeg and Halifax

Canada's two legacy festivals are shaped end to end by broadcast production,
and they show what a "festival" is when its real product is television:

- **[Winnipeg Comedy Festival](https://www.winnipegcomedyfestival.com/about-us)**
  (annual since 2002, produced by the nonprofit Gas Station Arts Centre):
  ["30+ shows. 9 venues. 85 comics"](https://www.winnipegcomedyfestival.com/news/post/105)
  over 7 days, anchored by five "Mega Shows" **recorded for CBC** at the
  Burton Cummings Theatre — celebrity host + six comics, PG while cameras
  roll, in a venue chosen for camera/crew needs (which forces Ticketmaster;
  everything else sells through local ticketer 3Common, per
  [its FAQ](https://www.winnipegcomedyfestival.com/faqs)). The broadcast
  audience ("over 2 million viewers annually — CBC Television's highest-rated
  comedy festival series") dwarfs the live one. 2–3 parallel rooms at peak;
  lineup-picking.
- **[Halifax ComedyFest](https://www.halifaxcomedyfest.ca/about-the-fest.html)**
  (annual since 1995): self-described as "one of only three major comedy
  festivals broadcast nationally in prime time on CBC Television… as a
  six-episode series"; [its application page](https://www.halifaxcomedyfest.ca/apply.html)
  demands "corporate clean" audition tapes and caps international bookings
  because of Canadian-content broadcast rules — the clearest possible case of
  TV shaping the programme. Galas tape at the
  [Light House Arts Centre](https://lighthouseartscentre.ca/); ticketing via
  [Tixr](https://tixr.com/groups/hfxcomedyfest).

### The month-long touring competitions

The [San Francisco Comedy Competition](https://sanfranciscocomedycompetition.com/)
("across the Bay Area") and [Seattle International Comedy
Competition](https://seattlecomedycompetition.org/) (November, "all month
across Western Washington") are a third structure: one bill of competitors
playing a different regional venue each night for weeks. A visitor intersects
one night; there is nothing to plan.

### The institution anchor — Lucille Ball Comedy Festival

Run by the [National Comedy Center](https://comedycenter.org/festival/) (the
US comedy museum and archive) in Lucille Ball's hometown of Jamestown NY each
August since 1991: 50+ events, ~15,000 attendees, arena headliners (2026:
Seinfeld, Kreischer, Meyers) wrapped in museum programming, sold through the
museum's own ticketing. Comedy-as-heritage powering small-town destination
tourism — a shape no other census entry has.

### The club-hub festivals — Tokyo and Grindstone

The smallest recurring structure: a comedy venue programming its own
multi-week takeover. [Tokyo International Comedy Festival](https://www.tokyocomedybar.com/festival)
(3rd edition, "120+ shows" in 11 days, self-billed East Asia's largest) is run
by the Tokyo Comedy Bar club with small Shibuya satellites, ticketed per-show
on Fienta; [Grindstone Comedy Festival](https://www.grindstonecomedyfest.com/about-grindstone)
in Edmonton (7th edition, ~44 events in 11 days) is the Grindstone Theatre's
own production — one-night curated showcases plus competition pipelines,
ticketed on [Showpass](https://www.showpass.com/s/events/all/?search_string=gcf2026),
2–4 rooms at peak. Fringe-ish energy, showcase mechanics, club scale.

### The nested micro-festival

Toronto's [WHAT THE FESTIVAL!](https://www.wtfestival.ca/whats-on) (3rd
edition: ~8 clown/puppet/drag events, 3 small rooms, Eventbrite) runs its
entire 24–27 September slate **inside JFL Toronto's dates** — a
micro-festival deliberately sheltering under a mega-festival's visitor draw.
The concurrency pattern in miniature.

## Annual fixtures vs one-offs and rovers

The owner flagged this as the most important single property, and the answer
is reassuring with sharp exceptions: **nearly the whole census is an annual
event in the same city, usually the same venues** — Edinburgh since 1947,
MICF every autumn since 1987 around the Town Hall, Leicester every February
since 1994, Winnipeg 25 years in Osborne Village, Lucille Ball in Jamestown
since 1991 — and the healthy ones publish next year's dates before this
year's edition is cold (MICF, Winnipeg, Wells, Great Outdoors and JFL's
Bermuda/Namur satellites all have 2027 dates up already).

The exceptions are exactly the ones a planning product must model:

- **Biennial**: Netflix Is A Joke runs even years only (2022/2024/2026) — an
  annual-assumption would show users a phantom 2027 edition.
- **Brand survives, operator changes**: Just For Laughs was cancelled
  outright in 2024 by its owner's insolvency, then relaunched under new
  ownership — same city, same district, new company. Quebec City's festival
  kept running while its *name* changed (ComediHa! Fest → Juste pour rire
  Québec).
- **Operator dies, festival forks**: Leicester 2026 delivered, then the
  charity behind it liquidated; February 2027 has **two** claimants to the
  same slot and venues. "Which festival is Leicester" is currently
  unanswerable.
- **Experiments and departures**: JFL Paris appears dropped (404s, no 2026
  edition found) despite sitting on the tracker; JFL Singapore's second
  edition is unconfirmed; SF Sketchfest skipped 2021–22 (COVID).
- **Rovers**: Skankfest has moved Queens → Houston → Las Vegas → New
  Orleans (the brand, not the city, is the fixture); Great Outdoors is a
  franchise whose "city" is a list; the SF and Seattle competitions tour
  their own regions by design.

The modelling implication: **key a festival calendar on city + month slot,
but track the operator separately from the brand** — the three failure modes
above (skipped year, renamed brand, contested succession) are all invisible
to a calendar that stores only "festival X happens each February".

## Concurrent-festival clusters

Which comedy festivals sit inside a bigger city moment — the owner's "the
city is a bigger draw" question. Three patterns emerged:

**Real clusters (the Edinburgh property).** Cities where other festivals
overlap the comedy window and change the visitor's calculus:

| Comedy festival | Overlapping in the same city |
|---|---|
| Edinburgh Fringe (Aug) | seven other festivals — owned by [festival-season/](../festival-season/README.md) |
| Adelaide Fringe (Feb–Mar) | Adelaide Festival, WOMADelaide, Writers' Week — "Mad March", on [festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md) |
| Brighton Fringe (May) | Brighton Festival (105 curated events, 1–25 May) and The Great Escape (30+ music venues, 13–16 May), both wholly inside the Fringe's month |
| NZICF, Auckland leg (May) | NZ Music Month all month + Auckland Writers Festival inside the window — [The Spinoff](https://thespinoff.co.nz/pop-culture/06-05-2026/auckland-has-a-problem-everything-awesome-is-happening-in-may-all-at-once): "everything awesome is happening in May, all at once" |
| JFL Montreal (Jul) | Fantasia film festival in near-total overlap, Nuits d'Afrique on the first weekend, Complètement Cirque ending just before, Jazz Fest just before that — the Quartier des Spectacles is a festival machine all July |
| SXSW comedy (Mar) | the cluster *is* the festival: film + music + interactive + comedy on one badge, one downtown |

**Amplifiers, not clusters.** Melbourne's MICF window brushes the Food &
Wine Festival, the Flower & Garden Show and the AFL season — more reasons
to be in town, but nothing a cross-festival planner would join. Sydney's
window touches the Easter Show and Writers' Festival with Vivid just after.

**The festival is the draw.** Leicester in February, LA in Netflix week,
SF Sketchfest in January, Dubai in October (GITEX moved to December) — the
comedy festival stands alone. Two curiosities: Toronto's JFL deliberately
sits *after* TIFF and gets the autumn to itself, with the micro-festival
WHAT THE FESTIVAL! nesting inside JFL's own dates; and the US November
pile-up (NYCF, 312, Boston, Skankfest in one fortnight) is concurrency
across *cities* — the same touring headliners circulating — not within one.

## Ticketing and data across the circuit

The owner asked for ticketing, scraping and organizers per festival — the
dossiers carry each; this section is the cross-festival picture.

**Ticketing splits into central-basket festivals and fan-out festivals.**
Central, festival-owned box offices: Edinburgh (Tikketr), Adelaide (its own
FringeTIX/AVR), MICF (its own Umbraco store), JFL's hahaha.com family (its
own "Nova" platform + Stripe, one basket per city), Brighton and Leicester
(Eventotron + Stripe), Galway (self-built), plus pass-gated singletons
(SXSW badge, Skankfest's Tixr pass, Moontower's badge on the venue's
Tessitura). Fan-out festivals hand the buyer to a different seller per
show: Sydney and NZICF (up to four agents), NYCF (Ticketmaster/ATG/house),
Netflix Is A Joke (**12+ vendors** counted from its own payload),
Nashville/312 (Etix/AXS/TM), Dubai (Platinumlist + venues), JFL Sydney (six
sellers). The vendor names recur — Tixr (Great Outdoors, Halifax,
Skankfest), Eventbrite, Showpass, Fienta, See Tickets, TicketSource,
SISTIC, Spektrix (Aberdeen — the same vendor whose public API the
[fringe-ticketing/](../fringe-ticketing/README.md) census found at
Edinburgh's Traverse), and post-collapse Leicester's challenger runs on
TixEvery, which pays performers directly. Red61, which powers Edinburgh's
venue side, appears nowhere else in this census.

Two product observations sit in that split:

- **A planner is worth more where ticketing fans out** — at MICF or Adelaide
  one basket already holds the whole trip; at NZICF, Sydney or Netflix Is A
  Joke *nothing* unifies the trip except a planner.
- **But data is hardest exactly where ticketing fans out** — the fan-out
  festivals have no single machine surface, so per-festival adapters are
  unavoidable there.

**Data reachability, ranked from the fetches** (every entry verified
first-hand this pass):

1. **MICF** — unauthenticated JSON APIs (show search, venues with
   capacities) plus per-performance status flags embedded in show pages:
   near enough the Edinburgh scraper's field set, no scraping gymnastics.
2. **Leicester + Brighton** — the **same Eventotron WordPress substrate**
   exposing identical open REST APIs (`/wp-json/wp/v2/events` with
   dates/genres/venues taxonomies): one adapter, two festivals — and the
   registration layer under many more fringes worldwide is Eventotron too.
3. **Netflix Is A Joke** — the whole dataset (times, venues, lat/long,
   capacities, ticket URLs) inlined in one server-rendered page: a single
   fetch.
4. **NYCF** — live open WordPress REST API.
5. **Clean server-rendered HTML**: Dubai (every show's date/venue/language/
   price/vendor in plain HTML), Great Outdoors, Winnipeg, Nashville, 312,
   Sydney + Perth (one shared Century WordPress codebase — one adapter for
   both), NZICF (SilverStripe).
6. **Hard or fragile**: JFL (client-side HTML fragments, no structured API,
   and **listings are ephemeral — city sites were emptied within weeks of
   the festival ending**, so capture must happen in-season); Adelaide
   (in-season server HTML only, no API found); SF Sketchfest
   (captcha-walled site; the Eventbrite organizer account is the practical
   surface); SXSW (client-rendered SPA); Galway (a Base44 app-builder SPA);
   Tokyo (client-rendered lineup; Fienta pages are the surface).

**What nobody exposes**: per-performance availability. MICF's embedded
session flags (sold-out/preview/cheap-night) are the one census-wide
sighting of Edinburgh-scraper-grade availability data; everywhere else the
best case is a binary sold-out badge on a sales page. The two-source shape
[festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md)
worried about (a listings source plus a separate availability source) is
not the general case — the general case is *worse*: one source for
listings, and no availability source at all.

## The film adjacency — surveyed light, on the owner's direction

Film festivals run on the same two axes as comedy, and the owner asked for
the planner-complex ones flagged without deep research (2026-09-01; each
entry is one look, not a dossier). The bar: multi-venue, many parallel
screenings, public single tickets, ~8+ days, ideally **repeat screenings**
— the recurrence property that turns triage into optimization.

The strongest planner-fits, ranked:

1. **Berlinale** (Berlin, 11 days each Feb) — film's closest thing to a
   fringe: 274 films in 2026, **each screening up to five times**
   ([its own entry guidelines](https://www.berlinale.de/en/film-entry/guidelines/general-guidelines.html)),
   fully public tickets at €9–15 released online three days before each
   screening, venues spread across the city — and an official
   [**"My Festival Planner"**](https://www.berlinale.de/en/programme/festival-planner.html)
   (favourites → schedule → iCal), the most planner-shaped official tool
   seen in any circuit this wiki covers.
2. **TIFF** (Toronto, 11 days each Sep) — 200+ films, ~2 public screenings
   each, clustered downtown venues, an official app with favourites and
   in-app tickets — and the only healthy **third-party festival planner
   found in film**: [tiffr.com](https://2026.tiffr.com/), TIFF-only, one
   site per year, alive for 2026.
3. **MIFF** (Melbourne, **18 days** each Aug) — 275+ films, ~10 venues,
   180,000+ attendees ([ACMI](https://www.acmi.net.au/whats-on/miff-2026/))
   — the longest major, in a city we already track for MICF (different
   months; no overlap).
4. **IFFR Rotterdam** (11 days, ~480 films, 300k+ admissions citywide),
   **SIFF Seattle** (11 days, 203 films, a walkable multi-screen cluster,
   the most-attended US festival), **BFI London** (12 days, ~240 features,
   7 venues), **Locarno** (11 days, public, an 8,000-seat open-air piazza),
   **Sundance** (11 days, $35 public single tickets, two towns — **moving
   to Boulder for 2027** on a ten-year deal, per
   [THR](https://www.hollywoodreporter.com/movies/movie-news/sundance-boulder-colorado-move-from-park-city-1236135102/) —
   the census's rare city *move*), **Sydney FF** (12 days, 13 spread
   venues, on Eventival), **Busan** (10 days, 329 films on 31 screens in
   one cluster, sell-out-in-minutes scarcity).
5. Second tier: Fantasia (Montreal, 18 days, clustered, selective repeats),
   IDFA, Hot Docs, Glasgow.

**The Israeli circuit** (owner question, 2026-09-01: does Docaviv fit the
mold?). It does — Berlinale-shaped at half the scale — and it is not even
Israel's strongest fit:

- **Jerusalem Film Festival** (11 days each July, 43rd edition
  [9–19 Jul 2026](https://jff.org.il/en/article/91360)) — the best planner
  fit in the country: 200+ films from 60 countries, 22–28 screenings a day
  across five halls (the Cinematheque's four plus Lev Smadar), films
  verified screening twice across the window (e.g. the
  [17 July](https://jff.org.il/en/festival-calendar/2026-07-17) and
  [18 July](https://jff.org.il/en/festival-calendar/2026-07-18) calendar
  days share four titles), singles at ₪48 (member ₪43) with 6- and
  10-ticket [passes](https://jff.org.il/he/%D7%9E%D7%90%D7%9E%D7%A8/85822),
  ~70,000 expected attendees, running since 1984 — and a real urgency
  engine: the
  [Jerusalem Post reports](https://www.jpost.com/israel-news/culture/article-900392)
  more than three-quarters of its international films have no Israeli
  distributor, so the festival screening is likely the only one.
- **Docaviv** (Tel Aviv, 10 days late May–June, since 1998) — 123 film
  pages on the 2026 site including shorts (press blurbs say "over 80
  films"), each film screened 2–3 times across the window (premiere plus
  [1–2 additional screenings](https://nfct.org.il/blog/docaviv-2026/)),
  centred on the five-hall Tel Aviv Cinematheque with ten satellite venues
  [listed for 2026](https://www.docaviv.co.il/%D7%9E%D7%A4%D7%94-%D7%95%D7%9E%D7%99%D7%93%D7%A2-%D7%A9%D7%99%D7%9E%D7%95%D7%A9%D7%99/),
  singles at [₪49 (~€12.50) with carnets down to ~₪31](https://www.docaviv.co.il/tickets-and-benefits/),
  ~40,000 attendance — Oscar-qualifying, self-described Israel's largest
  international film festival.
- **Haifa International Film Festival** (8 days, 42nd edition
  [26 Sep – 3 Oct 2026](https://www.haifaff.co.il/eng), since 1983) — ~170
  films, 4–5 parallel halls
  [clustered on one Carmel Center boulevard](https://www.haifaff.co.il/eng/Screening_Halls)
  (five of seven within ~400 m), films screened ~2×, singles ₪49 — and it
  runs **inside the Sukkot national holiday week**
  ([Wikipedia](https://en.wikipedia.org/wiki/Haifa_International_Film_Festival)),
  a built-in "planning my time off" audience.

The rest of the Israeli calendar (TLVFest, Solidarity, Epos, Utopia, Animix,
Cinema South Sderot, the student festival) is one-cinematheque scale. The
shared limit across all three majors: everything concentrates in a
cinematheque hub, so travel never binds, and daily volume tops out near 28
screenings against the Fringe's hundreds — a planner is useful there, not
indispensable.

Failing the bar, for the record: **Cannes** (no meaningful public
ticketing), **Venice** (public tickets exist but premiere-driven, industry
absorbs the seats), **SXSW Film** (badge-first, cut to 7 days), **Fantastic
Fest** (one venue, badge-driven).

What the light pass established for the taxonomy: **repeat screenings are
the norm at the big public film festivals and absent at the premiere
festivals** — the same recurrence split as comedy's fringe-vs-showcase; the
**Fantasia × JFL overlap gives Montreal eleven shared days** of film ×
comedy co-planning (the one such city found); and film's third-party
planner category is one TIFF-only specimen — as empty as comedy's outside
Edinburgh. A future film expansion would start at Berlinale/TIFF/MIFF, and
each needs the deep pass this survey deliberately skipped.

## Festival trackers

Sources that track the circuit itself — what a future multi-festival product
would use to keep a festival calendar current. The 2026-09-01 sweep's headline
is negative and load-bearing: **no machine-readable comedy-festival calendar
exists anywhere.** The best global list is one journalist's hand-maintained
page; Wikipedia has no list article at all
([the URL 404s](https://en.wikipedia.org/wiki/List_of_comedy_festivals)); the
UK trade press keeps gig listings, not a festival calendar. A festival
calendar for a multi-festival product would have to be assembled and
maintained by us.

- **[From The Comic's Comic — Comedy Festivals](https://fromthecomicscomic.com/comedy-festivals/)**
  — the seed list above, and the best tracker found. Kept by
  [Sean L. McCarthy](https://fromthecomicscomic.com/about-me/), a career
  comedy journalist (Boston Herald, NY Daily News, Decider reviews since
  2015), on his WordPress.com newsletter site: ~90 festivals for 2026 by
  month, one line and one link each, a stated only-if-confirmed policy, and
  email submissions from festivals (the
  [frozen pre-2024 list](https://thecomicscomic.com/comedy-festivals/) on his
  old domain still carries the submission address). Hand-maintained prose —
  scrapeable HTML, but unstructured. Two link defects found on the 2026-09-01
  fetch are worth knowing when reusing it: its Melbourne International Comedy
  Festival link points at the festival's stale `/2024` page, and its "Dublin
  Comedy Festival" entry links to `dublinwestcomedyfest.ie` — a different,
  smaller festival than the label suggests (untangled in the dossiers below).
- **[Chortle](https://www.chortle.co.uk/)** — the UK comedy trade site. No
  festival calendar (its `/festivals` URL 404s); what it has is the
  [Comedy Diary](https://www.chortle.co.uk/comedy-diary), a venue-submitted
  **gig-level** listings engine for the UK and Ireland in which "Edinburgh
  Fringe" is one region filter, plus per-festival show databases and heavy
  Fringe editorial. A per-show data source for UK festivals, not a circuit
  tracker.
- **[British Comedy Guide](https://www.comedy.co.uk/live/festivals/)** — a UK
  comedy festivals directory with per-festival pages, per its own indexed
  pages; the site Cloudflare-blocks non-browser fetches, so coverage depth is
  unverified here — and the block itself signals that scraping it would be
  contested.
- **[Wikipedia](https://en.wikipedia.org/wiki/Comedy_festival)** — no "List of
  comedy festivals" article exists; the Comedy festival article's "notable
  examples" section lists ~19 festivals, tagged unsourced since 2010, with
  obvious gaps (no Netflix Is A Joke, no New York Comedy Festival, no
  Moontower). The
  [category tree](https://en.wikipedia.org/wiki/Category:Comedy_festivals) is
  usable as a seed of notable names, useless as a calendar.
- **[World Fringe](https://worldfringe.com/)** — the fringe-network
  association's member directory (
  [Fringe A-Z](https://worldfringe.com/members/), a
  [festival calendar page](https://worldfringe.com/festival-calendar/), maps,
  a touring directory) — authoritative for *which fringes exist*, ~32
  countries, but fringe-network-only and effectively not machine-readable:
  both directory and calendar render client-side through a WordPress
  members plugin, so plain fetches see empty templates.
- **Submission-side and defunct**: [FilmFreeway](https://filmfreeway.com/)
  lists thousands of "comedy festivals" but they are overwhelmingly comedy
  *film* festivals and contests seeking submissions — the performer-side
  lens, not a visitor calendar; Everfest, once the big festival directory,
  [shut down in 2024](https://en.wikipedia.org/wiki/Everfest);
  [FestivalNet](https://festivalnet.com/) (26,000+ events) is craft-fair and
  music-vendor territory with no comedy presence.

## Sources

The seed and the trackers:

- [Comedy Festivals (From The Comic's Comic)](https://fromthecomicscomic.com/comedy-festivals/) — the 2026 census table above: every festival, date and official-site link, fetched 2026-09-01.
- [About Me (From The Comic's Comic)](https://fromthecomicscomic.com/about-me/) — Sean L. McCarthy's background; and [the frozen pre-2024 list](https://thecomicscomic.com/comedy-festivals/) with its submission address.
- [Chortle](https://www.chortle.co.uk/) and its [Comedy Diary](https://www.chortle.co.uk/comedy-diary); [British Comedy Guide festivals directory](https://www.comedy.co.uk/live/festivals/) (Cloudflare-walled); [Wikipedia's Comedy festival article](https://en.wikipedia.org/wiki/Comedy_festival) and [category tree](https://en.wikipedia.org/wiki/Category:Comedy_festivals); [World Fringe](https://worldfringe.com/) with its [members directory](https://worldfringe.com/members/) and [calendar page](https://worldfringe.com/festival-calendar/); [FilmFreeway](https://filmfreeway.com/); [Everfest's shutdown (Wikipedia)](https://en.wikipedia.org/wiki/Everfest); [FestivalNet](https://festivalnet.com/).

Australia / New Zealand:

- [MICF — about](https://www.comedyfestival.com.au/about-us/), [the 2026 wrap: "celebrating a record 40th year"](https://www.comedyfestival.com.au/news/celebrating-a-record-40th-year/) (803 shows, 9,164 performances, 796,975 attendees, A$26.6m), [participate/registration](https://www.comedyfestival.com.au/participate/), [Dylan Cole appointment](https://www.comedyfestival.com.au/news/melbourne-international-comedy-festival-appoints-dylan-cole-as-new-ceofestival-director/), and the fetched JSON endpoints (`/umbraco/api/searchapi/searchShows`, `/umbraco/api/venuesapi/getvenues`) plus per-show `sessionData` (e.g. [The Cave](https://www.comedyfestival.com.au/browse-shows/the-cave/)).
- [Sydney Comedy Festival — about](https://www.sydneycomedyfest.com.au/about/), [applications](https://www.sydneycomedyfest.com.au/artist-applications-2/), and [the 2026 wrap carried by The Movie Boards](https://www.themovieboards.net/2026/05/18/record-growth-and-huge-crowds-for-sydney-comedy-festival/) (411 shows, ~1,000 performances, 57 venues, 175,000+); [Century Entertainment](https://www.century.com.au/about/); [Perth Comedy Festival](https://www.perthcomedyfestival.com/about/) and [Broadsheet's 2026 preview](https://www.broadsheet.com.au/perth/event/perth-comedy-festival-2026).
- [NZ Comedy Trust](https://comedyfestival.co.nz/about-us/the-new-zealand-comedy-trust/), [festival history and steady-state scale](https://comedyfestival.co.nz/about-us/new-zealand-international-comedy-festival/), [how to buy tickets (multi-agent)](https://comedyfestival.co.nz/how-to-buy-tickets), [2026 launch](https://comedyfestival.co.nz/news-feed/be-in-on-the-laughs-this-may-at-the-2026-nz-international-comedy-festival-with-best-foods-mayo/); [The Spinoff on Auckland's May pile-up](https://thespinoff.co.nz/pop-culture/06-05-2026/auckland-has-a-problem-everything-awesome-is-happening-in-may-all-at-once).
- [Adelaide Fringe (Wikipedia — FringeTIX history, Adelaide Fringe Inc.)](https://en.wikipedia.org/wiki/Adelaide_Fringe), [about-us (AVR platform)](https://adelaidefringe.com.au/about-us), [2026 programme launch](https://adelaidefringe.com.au/fringefeed/news/2026-program-unveiled-with-more-than-1500-shows), [official app](https://adelaidefringe.com.au/our-app) and [My plan](https://adelaidefringe.com.au/my-fringe/plan).
- Concurrents: [melbournetourism.org events calendar](https://www.melbournetourism.org/melbourne-events-and-festivals-calendar/); [sydneyexpert.com April](https://sydneyexpert.com/sydney-in-april/) and [May](https://sydneyexpert.com/sydney-in-may/).

The Just For Laughs empire:

- [Just for Laughs (Wikipedia)](https://en.wikipedia.org/wiki/Just_for_Laughs) — the receivership, the $22.5m debt and phishing loss, the 2024 cancellations; [ComediHa's acquisition (CTV News)](https://www.ctvnews.ca/montreal/article/quebec-entertainment-group-comediha-confirms-acquisition-of-just-for-laughs-assets/); [the 2025 return (The Hollywood Reporter)](https://www.hollywoodreporter.com/business/business-news/just-for-laughs-returns-2025-1236069413/).
- [The Main's JFL Montreal 2026 guide](https://www.themain.com/articles/just-for-laughs-montreal-2026-guide) (44th edition, ~250 shows / ~25 venues / 800+ artists); [Cult MTL's 2026 programme piece](https://cultmtl.com/2026/07/just-for-laughs-and-off-jfl-are-showcasing-hundreds-of-great-comedians-in-montreal-from-july-15-to-26/); [Place des Arts festival page](https://www.placedesarts.com/en/festival/just-for-laughs-festival); [OFF-JPR](https://www.offjpr.com/); [the 2026-dates press release (quebec.hahaha.com)](https://quebec.hahaha.com/page/detail/news/juste-pour-rire--just-for-laughs-quebec--announces-2026-festival-dates-74/).
- Satellites: [toronto.hahaha.com](https://toronto.hahaha.com/); [Daily Hive on JFL Vancouver 2026](https://dailyhive.com/vancouver/just-for-laughs-vancouver-2026); [justforlaughs.sydney](https://www.justforlaughs.sydney/); [Bohm Presents (Singapore)](https://www.bohmpresents.com/current-events/show/just-for-laughs-singapore); [comedyevent.bm (Bermuda 2027)](https://comedyevent.bm/); [Namur is a Joke](https://www.namurisajoke.be/).
- Montreal concurrents: [Fantasia (Wikipedia)](https://en.wikipedia.org/wiki/Fantasia_International_Film_Festival); [Cult MTL on Nuits d'Afrique](https://cultmtl.com/).

US majors:

- [SF Sketchfest (Wikipedia)](https://en.wikipedia.org/wiki/SF_Sketchfest); [Deadline's 2026 announcement](https://deadline.com/); [the Eventbrite organizer account](https://www.eventbrite.com/o/sf-sketchfest-57967098043); [the Sched instance](https://sfsketchfest2026.sched.com/).
- [Netflix Is A Joke (Wikipedia — biennial pattern)](https://en.wikipedia.org/wiki/Netflix_Is_a_Joke_Festival); [the official schedule (inlined dataset)](https://www.netflixisajokefest.com/schedule) and [FAQ ("there are no festival passes")](https://www.netflixisajokefest.com/faq); [The Hollywood Reporter's 2026 lineup piece](https://www.hollywoodreporter.com/tv/tv-news/netflix-is-a-joke-festival-2026-lineup-schedule-los-angeles-1236478031/).
- [New York Comedy Festival FAQ (produced by Carolines / 550 Comedy Inc.)](https://nycomedyfestival.com/faq/) and its [open REST API](https://nycomedyfestival.com/wp-json/wp/v2/lineup?per_page=2).
- [Moontower (Paramount/Austin Theatre Alliance)](https://www.austintheatre.org/moontower-comedy/) and [its FAQ (badge walk-in mechanics)](https://www.austintheatre.org/moontower-comedy/faq/).
- [SXSW Comedy](https://sxsw.com/festivals/comedy/) ("4 nights, 2 venues, 30 shows"); [SXSW GO on Eventbase](https://www.eventbase.com/sxsw-go).
- [Nashville Comedy Festival](https://www.nashcomedyfest.com/) and [312 Comedy Festival](https://www.312comedyfestival.com/) (both "presented by Outback Presents", per their own footers); [Boston Comedy Festival](https://www.bostoncomedyfest.com/); [Skankfest and its FAQ](https://skankfest.com/) (schedule released day-of); [UCB's Del Close Marathon](https://ucbcomedy.com/); [NY Laughs Fest](https://nylaughsfest.com/); [San Francisco Comedy Competition](https://sanfranciscocomedycompetition.com/); [Seattle International Comedy Competition](https://seattlecomedycompetition.org/) (site currently defaced by a payment dispute — treat as non-authoritative).

Canada and rest of world:

- [Winnipeg Comedy Festival — about](https://www.winnipegcomedyfestival.com/about-us), [2026 announcement ("30+ shows. 9 venues. 85 comics")](https://www.winnipegcomedyfestival.com/news/post/105) and [FAQ (3Common/Ticketmaster split, PG-while-taping)](https://www.winnipegcomedyfestival.com/faqs).
- [Halifax ComedyFest — about](https://www.halifaxcomedyfest.ca/about-the-fest.html) and [apply ("corporate clean", CanCon limits)](https://www.halifaxcomedyfest.ca/apply.html); [Halifax Comedy Festival (Wikipedia)](https://en.wikipedia.org/wiki/Halifax_Comedy_Festival).
- [Grindstone — about](https://www.grindstonecomedyfest.com/about-grindstone) and [schedule](https://www.grindstonecomedyfest.com/schedule); [Toronto Sketch Comedy Festival](https://torontosketchfest.com/about/); [WHAT THE FESTIVAL! — what's on](https://www.wtfestival.ca/whats-on); [Exclaim on JFL Toronto 2026](https://exclaim.ca/).
- [Great Outdoors Comedy Festival](https://greatoutdoorscomedyfestival.com/) with [about (Trixstar, 400,000+ since 2021)](https://greatoutdoorscomedyfestival.com/about), [the Vancouver stop](https://greatoutdoorscomedyfestival.com/cities/vancouver) and [FAQs (Tixr-only, no applications)](https://greatoutdoorscomedyfestival.com/gocf-faqs); [Daily Hive on the Stanley Park capacity](https://dailyhive.com/vancouver/the-great-outdoors-comedy-festival-proposal-stanley-park).
- [Dubai Comedy Festival — about](https://www.dubaicomedyfest.ae/about) and [shows](https://www.dubaicomedyfest.ae/shows); [BRAG on the DTCM/Live Nation revival](https://brag.world/dubai-comedy-festival); [the Platinumlist microsite](https://dubaicomedyfestival.platinumlist.net/).
- [Tokyo International Comedy Festival (Tokyo Comedy Bar)](https://www.tokyocomedybar.com/festival); [Lucille Ball Comedy Festival (National Comedy Center)](https://comedycenter.org/festival/).

UK & Ireland:

- Leicester: [comedy-festival.co.uk](https://comedy-festival.co.uk/) (successor-festival banner); [Big Difference Company's insolvency statement, 26 Aug 2026](https://irp.cdn-website.com/b436dc39/files/uploaded/Statement+BDC+26_08_2026.docx); Chortle's reporting — [the firm goes bust](https://chortle.co.uk/news/2026/08/05/61188/leicester_comedy_festival_firm_goes_bust), [debts exceed £215,000](https://www.chortle.co.uk/news/2026/08/22/61391/leicester_comedy_festival_charitys_debts_exceed_%c2%a3215,000), [the mayor's 2027 pledge](https://www.chortle.co.uk/news/2026/08/06/61209/leicester_mayor:_we_will_have_a_comedy_festival_next_year), [the Independent Comedy Festival on TixEvery](https://www.chortle.co.uk/news/2026/08/11/61247/leicester_gets_a_new_comedy_festival); [the 700+ shows launch (Leicester Times)](https://leicestertimes.com/leicester-news/leicester-comedy-festival-launches-with-over-700-shows-celebrating-the-art-of-comedy/52061/); [show registration via Eventotron](https://comedy-festival-takepart.co.uk/how-to-register-your-show); the fetched open API (`events.comedy-festival.co.uk/wp-json/wp/v2/events`, 753 events; peak-day counts from its dates taxonomy); [Leicester Comedy Festival (Wikipedia — history and stats table)](https://en.wikipedia.org/wiki/Leicester_Comedy_Festival).
- Brighton: [brightonfringe.org](https://www.brightonfringe.org/) and its open events API (the 46% comedy measurement); [Brighton & Hove News on the 2026 launch](https://www.brightonandhovenews.org/2026/04/08/brighton-fringe-unveils-spectacular-2026-line-up-of-comedy-theatre-and-dance-for-21st-year/); [Brighton Festival 2026 launch](https://brightonfestival.org/press-office/press-release-brighton-festival-2026-launch/); [The Great Escape 2026 (Live Nation)](https://www.livenation.co.uk/event/the-great-escape-2026-brighton-tickets-edp1637482).
- [Galway Comedy Festival](https://galwaycomedyfestival.ie/); [RTÉ's 2025 lineup piece (69 shows / 16 venues)](https://www.rte.ie/culture/2025/0911/1533013-galway-comedy-festival-reveals-2025-line-up-ahead-of-october-bash/).
- Dublin: [dublincomedyfestival.ie ("West Dublin's Comedy Takeover")](https://www.dublincomedyfestival.ie/); [Paddy Power Comedy Festival (Aiken Promotions)](https://aikenpromotions.com/show/paddy-power-comedy-festival/); [Dublin Fringe](https://www.fringefest.com/news/dublin-fringe-festival).
- [Aberdeen Comedy Festival (Aberdeen Performing Arts)](https://www.aberdeenperformingarts.com/aberdeen-comedy-festival/) and [Chortle's programme piece](https://www.chortle.co.uk/other-news/2026/05/30/60704/aberdeen_comedy_festival_unveils_its_2026_programme).
- [Wells Comedy Festival](https://www.wellscomfest.com/) (Plosive) and [Beyond The Joke's 10th-anniversary piece](https://www.beyondthejoke.co.uk/content/16887/wells-comedy-festival); [Machynlleth Comedy Festival](https://machcomedyfest.co.uk/) and [its 2026 programme post (200+ shows)](https://machcomedyfest.co.uk/2026/04/02/the-2026-programme-has-been-released/).
- [Greenwich Comedy Garden](https://www.greenwichcomedygarden.co.uk/) (57 Festivals); [Roundhouse Comedy Festival](https://www.roundhouse.org.uk/seasons/roundhouse-comedy-festival/) and [Theatre Weekly's dates piece](https://theatreweekly.com/roundhouse-comedy-festival-returns-to-camden-for-august-2026/); [London Clown Festival](https://www.londonclownfest.online/).

The film adjacency (light survey, 2026-09-01):

- [Berlinale — general entry guidelines (up to five screenings per film)](https://www.berlinale.de/en/film-entry/guidelines/general-guidelines.html), [My Festival Planner](https://www.berlinale.de/en/programme/festival-planner.html), [2026 press releases](https://www.berlinale.de/en/2026/news-press-releases/267074.html), and [Berlin.de on the public ticket presale](https://www.berlin.de/en/tourism/insider-tips/2925756-5766508-berlinale-ticket-presale-where-to-buy.en.html).
- [tiffr — the unofficial TIFF planner, 2026 edition](https://2026.tiffr.com/); [TIFF's official app](https://tiff.net/the-review/welcome-to-the-official-tiff-app); [Now Toronto on TIFF 2026](https://nowtoronto.com/news/tiff-2026-first-movies-announced-tickets-venue/).
- [MIFF 2026 at ACMI (275+ films, 180k+ attendees)](https://www.acmi.net.au/whats-on/miff-2026/); [SIFF 2026 full lineup (203 films)](https://www.siff.net/media/news/pr-fest26-full-lineup) and [2026 SIFF (Wikipedia — the walkable venue set)](https://en.wikipedia.org/wiki/2026_Seattle_International_Film_Festival); [IFFR (Wikipedia — ~480 films, 300k+ admissions)](https://en.wikipedia.org/wiki/International_Film_Festival_Rotterdam); [BFI London Film Festival (Wikipedia)](https://en.wikipedia.org/wiki/BFI_London_Film_Festival); [79th Locarno (Wikipedia)](https://en.wikipedia.org/wiki/79th_Locarno_Film_Festival); [Sydney Film Festival on Eventival](https://vp.eventival.com/sff/2026); [30th Busan (Wikipedia — 329 films, 31 screens)](https://en.wikipedia.org/wiki/30th_Busan_International_Film_Festival).
- [Sundance's move to Boulder (The Hollywood Reporter)](https://www.hollywoodreporter.com/movies/movie-news/sundance-boulder-colorado-move-from-park-city-1236135102/) and [2026 single tickets (Park Record)](https://www.parkrecord.com/2026/01/09/2026-sundance-film-festival-tickets-on-sale-wednesday/).
- [Fantasia 2026 (30th edition, 16 Jul–2 Aug)](https://fantasiafestival.com/en/fantasia-2026) and [Cult MTL's programme piece](https://cultmtl.com/2026/07/montreal-fantasia-film-festival-turns-30-with-an-incredible-program-for-2026/) — the JFL overlap.
- The failed bar: [Cannes public access (Pearl)](https://joinpearl.co/blogs/cannes-film-festival-in-person-how-to-get-in-and-what-youll-see), [Venice accreditation (La Biennale)](https://www.labiennale.org/en/cinema/2026/cinema-accreditation), [SXSW 2026 badges (Austin American-Statesman)](https://www.statesman.com/story/entertainment/2025/03/16/sxsw-2026-schedule-half-price-badges-early-bird-available-now/82470583007/), [Fantastic Fest badges (Drafthouse)](https://drafthouse.com/show/fantastic-fest-badges).

## Open questions

- **Which festival is Leicester in February 2027?** The council-backed
  reboot and the performer-run Independent Comedy Festival both claim the
  slot and the venues; whichever wins also decides whether the open
  Eventotron API survives as the data source. Chortle is covering the story
  — re-check after the autumn announcements.
- **Comedy's share of the open-access programmes is only measured for
  Brighton (46%).** Adelaide publishes no genre counts; MICF's genre split
  wasn't captured from its API this pass. Both are one in-season API/page
  read away.
- **JFL's post-relaunch scale is its own marketing.** ~250 shows / 800+
  artists / "nearly two million visitors" all trace to the festival or its
  venue partners; no independently audited attendance for the relaunched
  Montreal edition was found.
- **Can the hahaha.com programme actually be captured in-season?** The
  listings emptied within weeks of the festival ending; the client-rendered
  fragment endpoints were identified but not exercised during a live
  window. Needs a timed probe next July if JFL support is ever pursued.
- **Delivered totals are missing for several dossiers**: NZICF 2026 (no
  wrap release found), Leicester 2026 delivered counts, Moontower's show
  count, SF Sketchfest and Netflix Is A Joke attendance — all NOT FOUND
  rather than zero.
- **Does the biennial pattern hold for Netflix Is A Joke 2028?** Predicted
  by 2022/2024/2026, confirmed nowhere.
- **The seed tracker is one journalist's page.** Its US skew is visible
  (Machynlleth and Dublin's actual big comedy festival both absent); its
  bus factor is one person. A future calendar needs at least a second
  source — the UK's would be Chortle/BCG coverage — and nobody has
  quantified what the tracker misses.
- **Does the fringe-shaped tier share an audience with Edinburgh?** The
  same unknown
  [festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md)
  already carries for cities — unmeasured there, unmeasured here.
- **Whether official-app planners satisfy the planning demand** at
  MICF/Adelaide scale is the competitor question —
  [competitor-landscape/](../competitor-landscape/README.md) carries it.
- **The film adjacency is a survey, not research.** Per-film repeat-screening
  norms are confirmed only for Berlinale and TIFF; MIFF/SIFF run encores
  rather than stated policies, and IFFR/BFI/Sydney are unverified on
  repeats. Sundance's 2027 Boulder move needs a re-check once the first
  Colorado edition is announced. If film expansion ever becomes live,
  Berlinale/TIFF/MIFF each need the deep pass this page's comedy dossiers
  got — likely as a page of their own.

## Growth log

- **2026-09-01** — page created deliberately on the owner's direction, seeded
  from the From The Comic's Comic tracker and a six-territory research pass
  (AU/NZ, the JFL empire, UK/Ireland, US majors, Canada + rest of world,
  trackers & planners), with primary pages fetched first-hand wherever the
  egress proxy allowed. Contents: the 85-festival 2026 census with computed
  run lengths and five tracker corrections; the parallel-volume × recurrence
  taxonomy with the fringe-shaped tier (MICF, Brighton, Leicester, NZICF,
  Machynlleth beside Edinburgh and Adelaide) and its structural exhibits
  (Great Outdoors' roving franchise, the TV-taping and competition shapes,
  Skankfest's day-of schedule); per-festival dossiers covering organizer,
  recurrence, scale (launch vs delivered), show model, venues, clash
  reality, ticketing platform and data reachability; the annual-vs-churn
  map (JFL's receivership and relaunch, Netflix's biennial cadence,
  Leicester's operator collapse and contested 2027); the concurrent-cluster
  table; the cross-festival ticketing/data ranking (MICF's open JSON,
  Eventotron's shared API under Leicester + Brighton, JFL's ephemeral
  listings); and the festival-tracker survey (no machine-readable calendar
  exists anywhere). All claims cited; per-festival deep dives deliberately
  deferred to adoption time.
- **2026-09-01** *(second pass, same day — the owner asked for film festivals
  with planner-complex characteristics, explicitly light-touch)* — added *The
  film adjacency*: a ranked survey of the film festivals that clear the bar
  (multi-venue, parallel screenings, public single tickets, 8+ days,
  repeats), led by Berlinale (public short-notice ticketing, films screening
  up to 5×, an official favourites→iCal planner), TIFF (with tiffr, the only
  live third-party film planner found), and MIFF (18 days in a city we
  already track), with the failed-bar cases recorded (Cannes, Venice, SXSW
  Film, Fantastic Fest) and two cross-circuit facts: repeat screenings split
  film's public majors from its premiere festivals exactly as recurrence
  splits comedy, and Fantasia × JFL gives Montreal eleven shared film×comedy
  days. Key insight 5 widened to carry the film parallel; one open question
  added (the survey's own limits and the Sundance-to-Boulder re-check). No
  comedy claim changed.
- **2026-09-01** *(third pass, same day — the owner asked whether Docaviv
  fits the mold, and about other Israeli film festivals)* — extended the
  film adjacency with *The Israeli circuit*: Docaviv does fit
  (Berlinale-shaped at half the scale — ~120 films screened 2–3×, ₪49 open
  tickets, annual Tel Aviv since 1998), Jerusalem FF outranks it as
  Israel's best planner fit (200+ films, 22–28 screenings/day, verified
  repeats, plus the no-Israeli-distributor urgency), and Haifa is third
  with the Sukkot holiday-week angle. All three share the cinematheque-hub
  limit (travel never binds; daily volume ≤~28 screenings), which places
  them as one near-miss entry on
  [festival-cities-beyond-edinburgh/](../festival-cities-beyond-edinburgh/README.md).
  The Israeli tail (TLVFest, Solidarity, Epos, Utopia, Animix, Cinema
  South, TISFF) is recorded as one-cinematheque scale. Fact base fetched
  first-hand from the festivals' own 2026 pages (dates, prices, halls,
  repeat screenings); a Docaviv dates discrepancy (its official pages say
  28 May – 6 Jun, JPost says 30 May) is left to the fetched primary.
