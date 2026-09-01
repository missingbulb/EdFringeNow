# The Edinburgh festival season

Everything else happening in Edinburgh alongside the Fringe — the other August
festivals, the rest of the summer, and the seasonal things that are not
festivals at all. Compiled once, refined in place.

This page exists because the product's premise ("4,206 shows is too many") is
only true of one festival. In August the city runs at least eight programmes
concurrently, and they are not variations on the Fringe: they differ in scale by
two orders of magnitude, in how an event behaves in time, in whether a ticket
exists, and in whether the data is reachable at all.

## Key insights

- August is at least eight overlapping festivals, not one — the Fringe is ~80% of the events and all of the noise.
- One free API already carries all 11 festivals, with coordinates, start times, durations and prices.
- That API has no sold-out field — our sharpest live signal does not survive a move off the Fringe scraper.
- Its licence bars redistributing dumps to third parties, and we commit our data to a public repo.
- "An event" is six different shapes: daily run, short season, one-off, nightly anchor, drop-in, all-day occasion.
- The Art Festival is 40+ mostly-free drop-in exhibitions with no start time — a shape nothing in the product models.
- Summer starts in June: Hidden Door, the Meadows, the Carnival and Jazz & Blues all finish before the Fringe opens.

## The August cluster (2026)

Eight programmes overlap almost completely. Every one of them is running on
15–19 August; a visitor in the city that week is inside all of them at once
whether they know it or not.

| Festival | Dates | Scale | Where |
|---|---|---|---|
| **Festival Fringe** | 7–31 Aug | 4,206 shows / 60,000+ performances / 299 venues / 74 countries | citywide |
| **International Festival (EIF)** | 7–30 Aug | 147 performances / 44 countries / 2 exhibitions | a few large halls |
| **Royal Edinburgh Military Tattoo** | 7–29 Aug (not Sundays) | one show, ~800 performers, ~9,000 seats a night, ~230,000 a year | one venue |
| **Edinburgh Deaf Festival** | 7–16 Aug | 80+ events | Deaf Action + Fringe venues |
| **International Film Festival (EIFF)** | 13–19 Aug | 38 new features, 21 world premieres | 5–6 cinemas + pop-up |
| **Art Festival** | 14–30 Aug | 40+ exhibitions, 25+ partner galleries, mostly free | galleries citywide |
| **International Book Festival** | 15–30 Aug | ~600 events / ~600 writers / 41 countries | one campus, 3 rooms |
| **Fringe by the Sea** | 31 Jul–9 Aug | a small Fringe of its own | **North Berwick, not Edinburgh** |

Two things fall out of the table:

- **Volume is overwhelmingly Fringe.** Every non-Fringe August festival added
  together is roughly 900 events against the Fringe's 4,206 shows — the Fringe is
  ~82% of the cluster. (Corrected 2026-08-09: this read 3,649, the 4 June
  programme-launch figure, which was ~15% short of the delivered festival; the
  conclusion is unchanged and slightly stronger. See
  [edinburgh-market-and-audience/](../edinburgh-market-and-audience/README.md) for the correction.)
  Any ranking that sorts purely on relevance or proximity will show a Fringe-only
  city.
- **Scarcity runs the other way.** A Fringe show typically plays ~25 times. A
  Book Festival author appears once. An EIFF screening is often a single
  showing. The events that are hardest to replace are the ones the volume
  ranking buries.

**Free Fringe (4–30 Aug) and Free Festival (6–30 Aug)** are not separate
festivals for data purposes — they are producers whose shows appear inside the
Fringe programme, so the existing catalogue already contains them.

**Edinburgh Summer Sessions** (24–29 Aug per a listings aggregator, not yet
confirmed against a promoter source) is an outdoor concert series rather than a
festival programme, and is listed here only so a later pass knows it was
considered.

## The rest of the summer

The season starts in June and the pre-August festivals are almost entirely free
and outdoor — a materially different offer from the ticketed August cluster.

| Event | Dates (2026) | Shape |
|---|---|---|
| **Hidden Door** | 3–7 Jun | pop-up arts festival, The Paper Factory |
| **Meadows Festival** | 6–7 Jun | free community weekend, one park |
| **International Children's Festival (Imaginate)** | May–Jun | children's theatre |
| **Jazz & Blues Festival** | 17–26 Jul | 100–170+ concerts (sources differ), clubs to concert halls |
| **Edinburgh Festival Carnival / Multicultural Festival** | 19 Jul | one-day city-centre parade |
| **Folk & Food Festival** | 24 Jul–2 Aug | free-entry food and folk, George Square Gardens |

Outside the summer entirely, and named only so they are not re-researched:
Science Festival (April), Beltane Fire Festival (30 April), Storytelling
Festival (October), Hogmanay (December).

## The seasonal city that is not a festival

The brief's user — someone with a free hour — is not only choosing between
shows. Guide coverage of an Edinburgh summer converges on the same non-ticketed
list: Arthur's Seat and Holyrood Park, the Royal Botanic Garden, Inverleith
Park, the Meadows, Princes Street Gardens, Portobello beach (swimming), the
Water of Leith walkway, and the Saturday markets (Stockbridge, Grassmarket,
Castle Terrace).

Two honest caveats:

- **This is guide-site material, not a dataset.** There is no listings feed for
  "the Meadows is nice in August." Anything the product does here is a
  hand-curated short list, and should be sized accordingly. (Softened
  2026-09-01: for *attractions* specifically, OSM + Wikidata are a free
  machine-readable base layer, and the wider source landscape — for
  Edinburgh and every other festival city — now has its own page,
  [city-context-sources/](../city-context-sources/README.md). The claim
  stands for the curated "nice in August" judgment itself.)
- **The repo already has the seam.** `js/places.js` geocodes arbitrary
  non-show destinations through Nominatim, so a curated seasonal place is
  representable today without new infrastructure.

## What "an event" means differs per festival

This is the finding that matters most for design, and it is not a branding
question. Across the eight August programmes an event behaves in one of six
ways in time, and the differences change what the product can truthfully
promise:

1. **Run** — repeats near-daily at one time across a long run (Fringe, Fringe by
   the Sea). Missing it today costs nothing.
2. **Short season** — a handful of dated performances, often at differing times
   (EIF theatre/opera/dance, larger Deaf Festival work). Each date is scarce.
3. **One-off** — happens exactly once (Book Festival author events, most EIFF
   screenings, Jazz concerts, talks). Missing it is terminal.
4. **Nightly anchor** — the same show every night, one venue, huge capacity,
   sold months ahead (the Tattoo). Behaves like a fixed commitment, not a
   candidate.
5. **Drop-in** — no start time at all: opening hours and a duration the visitor
   chooses (Art Festival exhibitions, typically ~10:00–17:00, mostly free).
6. **All-day occasion** — a single dated outdoor thing with no seat and no slot
   (the Carnival parade, Meadows Festival, Folk & Food).

Only shape 1 is modelled today. Shapes 3 and 5 are the ones that break existing
assumptions hardest: a one-off is a point rather than a lane, and a drop-in has
no start time to reach in time for.

## Locations

- **The Fringe is citywide** (299 venues); everything else is concentrated.
- **The Book Festival is effectively one campus** — Edinburgh Futures Institute
  (1 Lauriston Place), plus McEwan Hall and, new for 2026, Greyfriars Kirk. All
  within a few minutes' walk of each other and of the Fringe's Bristo Square
  cluster.
- **EIF uses a handful of large halls** — Usher Hall, Festival Theatre, The
  Queen's Hall, Church Hill Theatre. Church Hill is the outlier, ~25 minutes
  south of the centre on foot.
- **EIFF spreads deliberately** — Cineworld Fountainbridge, Filmhouse, Cameo,
  Monkey Barrel, plus **Leith Theatre** (a genuine 30+ minute walk from the Old
  Town) and a pop-up screen at the National Gallery.
- **The Tattoo is the Castle Esplanade**, which also means the top of the Royal
  Mile is congested nightly.
- **Fringe by the Sea is in North Berwick**, ~25 miles east — a train journey,
  not a walk. Any travel estimate that treats it as a city venue is wrong by an
  order of magnitude.

## Can we actually get the data?

Yes, and better than expected — with two sharp edges.

### The Edinburgh Festivals Listings API

`api.edinburghfestivalcity.com`, run by Festivals Edinburgh Limited, originally
built by the Science Festival in 2016. It is the **official** listings database
for all 11 major festivals and is **free to use** with a registered access key.

- **Coverage.** The `festival` parameter accepts `fringe, demofringe, jazz,
  book, international, tattoo, art, hogmanay, science, imaginate, film, mela,
  storytelling`. The status page confirms 2026 data is loaded for the
  Children's, Science, Tattoo, Film, International, Jazz, Fringe, Art and Book
  festivals.
- **Fields we need are present.** Events carry `festival`, `title`, `genre`,
  `genre_tags`, `artist`, `country`, `description`, images, a venue record with
  `latitude`/`longitude`, wheelchair access, and a `performances[]` array of
  `{start, end, duration_minutes, price, concession, price_string,
  is_at_fixed_time}`. Query parameters include lat/lon/distance, date range,
  price range, genre, venue and `modified_from` for incremental sync.
- **`is_at_fixed_time` is the drop-in flag** — the API already distinguishes a
  timed performance from an open-hours one, which is exactly the shape
  distinction the product needs.
- **It carries real prices.** The edfringe GraphQL API deliberately does not
  (only `priceType` flags); the Listings API returns `price` and `price_string`.
  This would close a limitation the product brief currently apologises for.

**Edge 1 — no availability.** The performance object has no sold-out, on-sale or
remaining-tickets field. The Fringe scraper's `ticketStatus` has no counterpart
here, so for non-Fringe festivals the product cannot honestly say whether a
ticket exists. Anything that implies parity would be inventing data.

**Edge 2 — the licence bars redistributing dumps.** Commercial use is explicitly
permitted and attribution is required (a visible credit plus a link to the API).
But developer users "must not redistribute listings to third parties by means of
either data feeds or data dumps", and applications must refresh at least every
24 hours. This repo currently **commits its normalized catalogue to a public git
repo and serves it as a static JSON file from GitHub Pages** — a pattern that
needs an explicit answer from Festivals Edinburgh before it is used with their
data. It is the one genuine blocker found.

**Edge 3 — Fringe data specifically is approval-gated and link-restricted**
(found 2026-07-31 in the ticketing pass): developers build against a randomised
`demofringe` dataset and must [submit the app for review](https://api.edinburghfestivalcity.com/documentation/fringe_approval)
before live Fringe access; the Fringe terms require that show links go **only to
edfringe.com** — "not… any other ticketing site, including the venue's own
site". Sync is near-real-time (`modified_from`, "a delay of a few minutes"), and
a beta [MCP endpoint](https://api.edinburghfestivalcity.com/documentation/mcp)
exists. The full ticketing/provider picture is on
[edinburgh-fringe-ticketing/](../edinburgh-fringe-ticketing/README.md).

### Keeping the Fringe on its own source

The existing edfringe GraphQL scraper stays the better Fringe source: it carries
per-performance `ticketStatus`, the 104-label subgenre taxonomy, content
warnings and age guidance the Listings API does not expose at the same fidelity.
The realistic architecture is two adapters into one normalized schema, not a
migration.

### Other aggregators

**Data Thistle** (`edinburghfestival.datathistle.com`) publishes combined
listings across the Fringe, International, Book, Jazz, Tattoo, Art, Film, Free
Fringe, Free Festival and Fringe by the Sea, and sells an events API — evidence
that cross-festival listings are a real product, and the closest thing found to
a direct multi-festival competitor.

The Listings API's own project gallery lists 13 apps built on it (Plan My
Fringe, FringeFlow, TicketBadger, Frindr, myFestival, Festival Clock, Fringe
Vibes and others). Notably, nearly all of them are named and framed around the
**Fringe** despite the API carrying all 11 festivals — no listed project claims
cross-festival planning as its point. That gap is unverified beyond the gallery
blurbs and belongs in the competitor page once someone actually uses them.

## Sources

- [#MixItUp at the Edinburgh Festival Fringe and discover your new favourite show (edfringe.com, 7 August 2026)](https://www.edfringe.com/about-us/news-and-blog/mixitup-at-the-edinburgh-festival-fringe-and-discover-your-new-favourite-show/) — the Fringe's delivered 2026 scale: 4,206 shows, 299 venues, 74 countries, 60,000+ performances.
- [Edinburgh Festivals: What's On in 2026 (Edinburgh Festival City)](https://www.edinburghfestivalcity.com/inspiration/573-edinburgh-festivals-whats-on-in-2026)
- [Edinburgh Festivals (VisitScotland)](https://www.visitscotland.com/things-to-do/events/edinburgh-festivals)
- [Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/)
- [Listings API — events documentation (fields and query parameters)](https://api.edinburghfestivalcity.com/documentation/events)
- [Listings API — venues documentation](https://api.edinburghfestivalcity.com/documentation/venues)
- [Listings API — licence terms](https://api.edinburghfestivalcity.com/licence)
- [Listings API — 2026 data status by festival](https://api.edinburghfestivalcity.com/status)
- [Listings API — projects built on the data](https://api.edinburghfestivalcity.com/projects)
- [Edinburgh Festival 2026 dates (Data Thistle)](https://edinburghfestival.datathistle.com/festivals/)
- [Edinburgh International Festival 2026 (Edinburgh Festival City)](https://www.edinburghfestivalcity.com/festivals/edinburgh-international-festival)
- [Edinburgh International Festival 2026 brochure (eif.co.uk)](https://www.eif.co.uk/brochure)
- [Nearly 600 writers from 41 countries as the Book Festival returns with its 2026 programme (What's On Edinburgh)](https://www.whatsoninedinburgh.co.uk/news/2026/06/16/nearly-600-writers-from-41-countries-to-gather-as-edinburgh-international-book-festival-returns-with-global-2026-programme/)
- [Our venues (Edinburgh International Book Festival)](https://www.edbookfest.co.uk/visit-us/venues)
- [Edinburgh International Book Festival 2025 footfall up 60% (The Bookseller)](https://www.thebookseller.com/news/2025-edinburgh-international-book-festival-footfall-up-60)
- [Edinburgh International Film Festival announces 2026 programme (Screen Scotland)](https://www.screen.scot/news/2026/july/edinburgh-international-film-festival-announces-2026-programme)
- [EIFF pop-up screen at the National Gallery (The Scotsman)](https://www.scotsman.com/arts-and-culture/edinburgh-festivals/film-and-tv/edinburgh-international-film-festival-pop-up-screen-at-national-gallery-to-host-screenings-in-august-5200818)
- [Edinburgh Art Festival reveal 2026 programme across the city (Creative Scotland)](https://www.creativescotland.com/news-stories/latest-news/archive/2026/04/edinburgh-art-festival-reveal-2026-programme-across-the-city)
- [Edinburgh Art Festival — what's on](https://edinburghartfestival.com/whats-on/)
- [The Royal Edinburgh Military Tattoo unveils a first look at the 2026 show (Edinburgh Chamber of Commerce)](https://www.edinburghchamber.co.uk/the-royal-edinburgh-military-tattoo-unveils-a-first-look-at-the-2026-show/)
- [The Royal Edinburgh Military Tattoo (Scotland.org)](https://www.scotland.org/events/edinburgh-festivals/the-royal-edinburgh-military-tattoo)
- [Fifth Edinburgh Deaf Festival — bigger, brighter, bolder than ever (Creative Scotland)](https://www.creativescotland.com/news-stories/latest-news/archive/2026/07/fifth-edinburgh-deaf-festival---bigger-brighter-bolder-than-ever)
- [Edinburgh Deaf Festival](https://edinburghdeaffestival.com/)
- [Jazz & Blues Festival 2026 programme announced (Edinburgh Festival City)](https://www.edinburghfestivalcity.com/inspiration/662-jazz-blues-festival-2026-programme-announced)
- [Edinburgh Jazz & Blues Festival (Scotland.org)](https://www.scotland.org/events/edinburgh-festivals/edinburgh-jazz-and-blues-festival)
- [Best things to do in Edinburgh in July 2026 (The Real Mary King's Close)](https://www.realmarykingsclose.com/blog/best-things-to-do-in-edinburgh-in-july-2026-festivals-events-and-summer-adventures/)
- [Edinburgh Folk & Food Festival, 24 July–2 August 2026](https://edfoodfest.com/)
- [Edinburgh Multicultural Festival](https://www.edmcf.co.uk/)
- [Hidden Door Festival (What's On Edinburgh)](https://www.whatsoninedinburgh.co.uk/event/156971-hidden-door-festival-2025/)
- [Edinburgh Summer Sessions 2026 (Music Festival Wizard)](https://www.musicfestivalwizard.com/festivals/edinburgh-summer-sessions-2026/)
- [Edinburgh Festivals inject £852m a year into the Scottish economy (The Edinburgh Reporter)](https://theedinburghreporter.co.uk/2026/06/edinburgh-festivals-inject-852m-a-year-into-scottish-economy-new-study-reveals/)
- [Outdoor activities in Edinburgh (Edinburgh Tourism)](https://www.edinburghtourism.org/outdoor-activities-edinburgh/)
- [10 awesome things to do in Edinburgh in summer (Grumpy Camel)](https://www.grumpycamel.com/things-to-do-in-edinburgh-in-summer/)

## Open questions

- **Does the licence permit our static-file architecture?** The one blocker.
  Committing Listings API data to a public repo and serving it as a JSON file
  from GitHub Pages may read as redistributing a data dump. Needs a direct
  answer from Festivals Edinburgh, not an inference from the terms page.
- **What does the API actually return?** Every field claim here comes from the
  documentation, not from an authenticated response — nobody has registered a
  key. (Narrowed 2026-07-31: the public explorer confirms 2026 Fringe data is
  loaded, and the per-performance field list was verified against the events
  documentation; per-festival event counts and `is_at_fixed_time` population
  remain unchecked.)
- **Is `is_at_fixed_time` enough to derive event shape?** It separates timed from
  drop-in, but not one-off from run from nightly. Those may be derivable by
  counting performances per event — unconfirmed.
- **Does the API carry the Deaf Festival?** It is not in the `festival`
  parameter list, and its events are produced with the Fringe — so they may
  appear under `fringe` with no distinguishing marker, which would make the
  festival invisible in a festival filter.
- **Jazz & Blues event count.** Sources say "over 170 performances", "more than
  100 concerts" and "over 150 concerts" — no authoritative figure found.
- **Cross-festival audience behaviour.** No data found on how many Fringe-goers
  attend a second festival, or whether the two are the same crowd. The whole
  "help people see the diversity of Edinburgh" goal rests on an unmeasured
  assumption that they would if they knew.
- **Non-festival seasonal has no source of truth.** If a curated places list
  ships, who maintains it and how does it stay true?
- **Is a multi-festival product still called EdFringeNow?** A naming/brand
  question for a human, raised here only because the research makes it real.

## Growth log

- **2026-07-31** — page created. Seeded from research into the other Edinburgh
  festivals in August and across the summer: the eight-festival August cluster
  with dates, scale, venues and programme diversity; the June–July season;
  Fringe by the Sea's out-of-city location; the non-festival seasonal city; the
  six event *shapes* that distinguish a Fringe run from a one-off screening, a
  drop-in exhibition and a nightly anchor; and the data-availability picture —
  the official Edinburgh Festivals Listings API covering all 11 festivals with
  coordinates, times, durations and real prices, its missing availability field,
  and its no-redistribution licence term that conflicts with this repo's
  committed-static-JSON architecture. Data Thistle recorded as the closest
  multi-festival competitor. All claims cited; every figure is a published
  programme claim, none verified against a live API response. Requirements
  implications (the Now page and planner design) left for human review — the
  proposal is written up outside the wiki.
- **2026-07-31** *(second pass)* — added Edge 3 to the Listings API section from
  the edinburgh-fringe-ticketing research pass: Fringe data is approval-gated
  (`demofringe` review process) and Fringe show links must go only to
  edfringe.com — never a venue's own site; recorded the near-real-time
  `modified_from` sync and the beta MCP endpoint, and narrowed the "what does
  the API actually return" open question (2026 Fringe data confirmed loaded via
  the public explorer; still no authenticated call). Cross-linked the new
  edinburgh-fringe-ticketing page.
- **2026-08-09** — corrected the Fringe's row in the August cluster table and the
  volume arithmetic beneath it from the 4 June programme-launch snapshot (3,649
  shows / 53,884 performances / 258 venues / 71 countries) to the Fringe
  Society's opening-day figures (4,206 / 60,000+ / 299 / 74). The superseded
  numbers and the reason they were wrong are kept on
  [edinburgh-market-and-audience/](../edinburgh-market-and-audience/README.md), which owns them. The
  Fringe's share of the cluster moves from ~80% to ~82%, so the page's
  conclusions and its Key insights header are unchanged — only the figures moved.
- **2026-09-01** — softened the "no listings feed" caveat under *The seasonal
  city that is not a festival*: the new
  [city-context-sources/](../city-context-sources/README.md) page now owns
  the machine-readable source landscape for non-festival events and
  attractions (OSM + Wikidata cover the attractions half for free); the
  caveat's core — the curated judgment has no feed — stands. No other claim
  changed.
- **2026-09-01** — renamed from `festival-season/` to
  `edinburgh-festival-season/` on the owner's direction: with the wiki's
  scope now global, this page's Edinburgh-specific subject needs the city in
  its name. Content unchanged; all inbound links updated in the same change.
