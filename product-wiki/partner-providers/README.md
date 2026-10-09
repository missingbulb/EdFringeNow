# Partner providers — who we can book through, and who pays us for it

Which third parties could let a visitor *act* on a plan — buy the show
ticket, book the table between shows, the bed, the train, the tour — and
which of them pay us for sending the booking. Created on the owner's
direction (2026-09-25): ticket purchase matters most (a fixed plan, a
transaction, income), and for the rest of the trip we should build on
aggregators that have referral programmes **and** an API rich enough to
take what we know about the visitor (dates, party size, location near the
venues, budget, diet, the gaps between shows), not just link to a search
page and hope.

This page extends three others and does not repeat them:
[city-context-sources/](../city-context-sources/README.md) owns the
*listings* sources (Data Thistle, ATDW, Eventfinda, Ticketmaster Discovery,
Skiddle, OSM/Wikidata, Viator's basic tier);
[festival-circuits/](../festival-circuits/README.md)'s "Ticketing and data
across the circuit" owns which box office each festival runs; and
[competitor-landscape/](../competitor-landscape/README.md) owns the finding
that no rival earns from travel affiliates.
[edinburgh-fringe-ticketing/](../edinburgh-fringe-ticketing/README.md)
already established that no Fringe ticket earns commission. Claims were
checked by direct fetch on 2026-09-25 unless marked **(search-attributed)**,
meaning the provider's page was unreachable and the figure comes from a
named third-party listing — treat it as unverified.

## Key insights

- Nobody lets an outsider put festival tickets in a basket: Ticketmaster says "in most instances, no".
- Ticket commissions are small, and Ticketmaster pays nothing in the first 24 hours of an on-sale.
- No restaurant platform gives an outsider a real "table for 2 at 18:00" availability API — all of them are partner-only.
- Google Places is the richest free-form restaurant query (it even knows "serves vegetarian"), but it costs money and pays nothing.
- Viator is the only big affiliate that lets a small site take the booking on its own page, at 8% commission.
- Amadeus shut its self-service travel APIs on 17 July 2026, and Kiwi.com went invite-only in 2024.
- Stay22's map finds beds around any venue address and pays 30%+ of the OTA commission, no API work needed.

## The shape of the market

Every category splits the same three ways, and the split decides what we
can build:

1. **Affiliate link only** — anyone can join (often through a network:
   Awin, CJ, Impact, Partnerize, Travelpayouts); we pre-fill a search URL
   and the visitor completes the booking on the partner's site. Most
   programmes live here.
2. **Read API, checkout on the partner's site** — we can query real
   inventory with the visitor's parameters and show results, but the
   transaction still leaves our page. Usually a free key or an application.
3. **Transactional API** — the booking completes in our UI. Always gated
   by approval, certification, traffic, or a contract; in most categories
   effectively closed to a site our size.

The realistic ambition for a small site is tier 2 — a query rich enough to
show *bookable* options that fit the plan — ending in a tagged deep link.

## 1. Show and event tickets

| Provider | API and gate | Basket / seat hold for us? | Affiliate | Our cities |
|---|---|---|---|---|
| **Ticketmaster** | Discovery API free key (see city-context); Partner API = reserve, pay, commit cart, fulfilment — approved partners only | Only for "a select few business partners" | Impact; rates tailored at onboarding; ~1% UK, A$0.30/ticket or 0.5% AU, 0.5% NZ **(search-attributed)**; 30-day cookie | UK, AU/NZ, FR, CA all in its 25 affiliate markets |
| **Skiddle** | Free key (see city-context); event feeds and widgets for affiliates | No | Direct; from **30% of Skiddle's booking fee** (fee is 10–15% of face value), typically 10–50p/ticket, up to £4 for festivals; 30-day cookie; £25 payout floor | UK only |
| **See Tickets** | No public API found | No | Awin; 1–2.5% per sale, 30-day cookie; no commission on presales or zero-commission shows **(search-attributed)** | UK |
| **Eventbrite** | API is org-scoped (see city-context) | No | Referral-fee programme exists under its own terms; rates via Insertion Orders, not published | Global, long tail |
| **Fever** (owns DICE) | Partner-only | No | Impact; 6–10% per sale **(search-attributed)** | London, Edinburgh, Melbourne, Montreal etc. — unverified per city |
| **Ticketek** | None public | No | Impact; A$1 / NZ$1 per online sale **(search-attributed)** | AU, NZ |
| **London Theatre Direct** | Fully transactional REST API with interactive seat plans, "Get API key" self-serve | **Yes** — the only transactional ticket API found open to sign-up | Awin and Impact partner programmes; ~10% of order value quoted **(search-attributed)** | London West End only — none of our festivals |
| **TodayTix** | None public | No | 1–2%, 30-day cookie **(search-attributed)** | London, Toronto; not our festivals |
| **Headout** | Distribution partner programme | No (unverified) | 1–10% depending on the listing **(search-attributed — sources disagree)** | Big cities; festival coverage NOT FOUND |
| **Spektrix, Tessitura** | Venue-owned APIs; a third party works on a venue's behalf and credentials | Only with each venue's agreement | None | Spektrix at Traverse, Aberdeen (per fringe-ticketing) |
| **Tikketr, FringeTIX/AVR, Eventotron, MICF's own store** | Festival box offices; no affiliate or agent scheme found (Adelaide's site shows sponsors and donations only) | No | None found | Their own festival |

**What this means.** The owner's goal of "put the plan in a basket and
earn" is not reachable at any festival we cover. The festival box offices
(Tikketr, FringeTIX, Eventotron, MICF's store) sell almost every fringe
ticket, and none has an affiliate or agent route. The platforms that do pay
(Ticketmaster, Skiddle, See Tickets, Ticketek) sell the city's *other*
events — the local concert or comedy night on the free evening — so ticket
income belongs to the "what else is on" lane, not the festival plan. The
best ticket experience available is a **deep link per show into the
festival's own basket**, with the plan already built. Ticketmaster's
affiliate terms also exclude primary sales during presales and the first 24
hours after on-sale, which is exactly when a planner's users would buy a
headliner.

## 2. Restaurants

The key question — "table for 2 near these coordinates at 18:00 on this
date, vegetarian, real availability" — **has no open answer.** Every
reservation platform with real availability keeps it behind a partner
contract:

- **OpenTable** — Partner API (availability, slot locks, bookings) is
  OAuth-gated by partner approval, no self-serve key; applicants hear back
  in 3–4 weeks **(search-attributed; opentable.com timed out from here)**.
  An affiliate programme pays on *seated diners*; the rate is not published
  anywhere we could reach. Strong in UK, AU, CA; weaker in FR and NZ
  (unverified).
- **TheFork** (Tripadvisor; absorbed Australia's **Dimmi**) — affiliate
  programme with a fixed payout per seated booking on Awin and regional
  networks, 20-day cookie; old listed rates about €1 per booking
  **(search-attributed)**. No public availability API found. Strong in FR
  (Avignon) and AU.
- **Quandoo** — has a documented Public API, but "the level of available
  functionality … is dependent solely on each Partner agreement". Affiliate
  programme by email, in Germany, UK, Italy and Singapore
  **(search-attributed)**. UK and AU coverage.
- **Resy, SevenRooms** — partner-only APIs (SevenRooms' can search
  shift-level availability and create bookings), gated to venues and
  approved integrators; no affiliate programme found **(search-attributed)**.
- **ResDiary / DesignMyNight** (UK, strong in Scotland) — DesignMyNight is
  ResDiary's own booking channel; ResDiary's APIs serve venue-side
  integrations (PMS, data extraction). No consumer affiliate programme found.

The **discovery** layer is open, but paid and earns nothing:

- **Google Places API (New)** — Text and Nearby Search take lat/lng +
  radius, `openNow`, price level and type. The fields we need are in the
  top price tiers: `regularOpeningHours` is Enterprise, and
  `servesVegetarianFood` is Enterprise + Atmosphere. List prices per 1,000
  calls: Nearby/Text Search Pro $32, Enterprise $35, Enterprise +
  Atmosphere $40; 5,000 / 1,000 free calls a month per SKU. No booking and
  no commission.
- **Yelp Places API** — paid plans after a free trial (the plan page
  404'd here); it also documents a Reservations API, partner-only.
- **Foursquare Places API** — priced since new Places API/V2 Pro-endpoint
  rates took effect 1 June 2026 (the old V3 endpoints deprecated 15 May
  2026): pay-as-you-go, roughly 500 free Pro calls a month then **$15 per
  1,000 calls** (Place Search, Place Details, Autocomplete); Tips & Photos
  and premium-field requests sit in a costlier Premium tier **(2026-09-27,
  search-attributed — foursquare.com did not load from here)**. No
  booking, no commission.
- **Tripadvisor Content API** — the developer page returned 403.

**What this means.** For restaurants, the most we can do is: use Places
(or OSM for free) to pick candidates near the gap venue that are open and
match diet and price, then deep-link each one into OpenTable or TheFork
with date, time and party size filled in, earning a per-diner fee where the
restaurant is on that platform. A true "these three tables are free at
18:00" answer needs an OpenTable or Quandoo partner contract.

## 3. Hotels and stays

- **Booking.com** — the affiliate programme is joined *through CJ*
  (Booking.com's own page). The **Demand API** (search, availability,
  booking for accommodation, cars and attractions) requires being a
  "Managed Affiliate Partner" with a signed contract and an account manager
  — not open to a small site. The rate is a share of Booking's commission,
  25% rising to ~40% with monthly stayed-booking volume; CJ listings quote
  about 4% of stays **(search-attributed)**. Full coverage of our cities.
  Already our partner in code (`bookingAid`).
- **Expedia Group** — Rapid API is a full build-your-own-booking API,
  gated; there is also a lighter "Travel Redirect API" for search then
  redirect. The creator programme advertises "up to 4%" on Expedia,
  Hotels.com and Vrbo.
- **Agoda** — 6% through Travelpayouts, but only a **1-day cookie**.
- **Hostelworld** — 5–7% through Travelpayouts, 30-day cookie; useful for
  the budget Fringe crowd.
- **Stay22** — no API work: an embeddable map that shows available stays
  around **any address** (a venue) from Booking, Expedia, Vrbo and others,
  and pays a split "starting at 30%" of the OTA commission. It markets the
  map to event and ticketing platforms. The nearest thing to "near the
  venues, on these dates, in this budget" without a contract.
- **LiteAPI (Nuitee)** — the exception: free sandbox, "no supplier
  contracts", live rates across 3M+ properties with search → prebook →
  book, so booking **in our UI** is possible. We would be the seller (their
  margin model, not an affiliate cookie) — a bigger commitment with
  customer-service duties. Pricing not published.
- **Airbnb** — confirmed 2026-09-27: no public, cash-paying affiliate
  programme for a site like ours. What exists is application-only —
  **Airbnb Creators** (social-media influencers) and **Airbnb Demand**
  (bloggers/publishers) — plus a "refer a host" scheme that pays the
  *referrer* $15 per host once they get one guest stay (capped at $375),
  not a per-booking rate on guest traffic we'd send **(search-attributed —
  airbnb.com did not load from here)**. Closed for our purpose, not merely
  unfound.
- **Amadeus hotel APIs** — gone for new developers (see transport).

## 4. Getting there and getting around

- **Flights** — we already use **Travelpayouts' Aviasales data API**
  (`api/fares.js`: cached prices, not live seats). **Duffel** is the open
  transactional option: $3 per order + 1% of value, free searches up to a
  1,500:1 search-to-book ratio — we would be the seller. **Skyscanner**'s
  Travel APIs (flights, hotels, car hire) are by application; an
  affiliate programme also exists. **Amadeus Self-Service** stopped taking
  sign-ups in spring 2026 and turned off on **17 July 2026**
  **(search-attributed: PhocusWire 403'd)**. **Kiwi.com Tequila** is
  invitation-only since 2024; Kiwi's own press release says it dropped
  public API, white-label and affiliate tools.
- **Rail and coach** — **Trainline**'s affiliate programme runs on
  **Partnerize** (links, banners, widgets, no fee; rate by Partnerize terms),
  and its Global API is for distribution partners on negotiated terms.
  **Omio** (already in our code) pays **6%** with a 30-day cookie through
  Travelpayouts (also on Impact) — train, coach and flight in one search,
  which suits UK and French festivals.
- **Door-to-door routing** — Rome2Rio's API reportedly still offers 100k
  free searches a month **(search-attributed; its docs 403'd)**.
  **Citymapper**'s self-service APIs ended on 23 June 2023.
- **Local transit between venues** — Google Routes API (paid) or open GTFS
  via **Transitland** (REST API; routing beta free for 1,000 queries a
  month, professional plan $200–250 a month **(search-attributed)**). City
  APIs such as TfL's are free but London-only.
- **Taxis** — Uber has an affiliate programme on Impact that pays for
  *new* riders (about $5 each), not per ride **(search-attributed; its
  developer page 404'd)**. Bolt's only public referral scheme is
  **B2B** — "Bolt for Business", paying €150 per company it signs up, not
  a per-ride consumer rate — so, like Uber's, it rewards new-account
  acquisition rather than the trips a plan would actually generate
  **(2026-09-27, search-attributed — bolt.eu did not load from here)**.
- **Car hire** — **DiscoverCars** pays 70% of its rental profit plus 30% of
  its cover revenue (~$20 per booking), with a **365-day cookie**; Booking's
  CJ programme quotes ~6% on cars **(search-attributed)**. Relevant for
  Avignon and Adelaide, hardly for Edinburgh.

## 5. Tours, excursions and attraction tickets

- **Viator** — three levels. *Basic* is self-serve with no approval: search,
  single-product availability and price; checkout on viator.com. *Full*
  (approval + certification) adds real-time availability, bulk data and
  reviews. *Full + Booking* lets the customer **book on our site**, with
  Viator as merchant of record handling customer service. **8%**
  commission, 30-day cookie (Travelpayouts listing). Covers all our cities.
- **GetYourGuide** — 8% and a 31-day cookie through Travelpayouts (7% on
  Awin **(search-attributed)**); its partner API needs 100k monthly visits
  (see city-context).
- **Tiqets** (museums, attractions) — a real Distributor API with catalogue,
  live availability, and a create/confirm/cancel booking flow, for partners
  approved via affiliates@tiqets.com; 3.5–8%, 30-day cookie through
  Travelpayouts. Strong in Europe; AU/NZ coverage unverified.
- **Klook** — 2–5%, 30-day cookie (Travelpayouts); Asia-first, thin in our
  cities (unverified).
- **Civitatis** — Spanish-language-led, 10%, 30-day cookie
  **(search-attributed)**; relevant to Avignon.
- **Go City** passes — up to 6%, 90-day cookie **(search-attributed; its
  page 403'd)**; passes exist for some of our cities (which ones: NOT
  FOUND).
- **Booking.com Attractions** — inside the same Demand API, same gate; ~4%
  via CJ **(search-attributed)**.
- **Musement/TUI** — not researched this pass (NOT FOUND).

## 6. Local non-festival events — the commission angle only

Listings sources are on city-context-sources. For income: Skiddle (UK, the
best per-ticket rate), Ticketmaster (every one of our countries, ~1%, not
in the first 24 hours of an on-sale), Fever (6–10%, strong on candlelight
concerts and exhibitions **(search-attributed)**), See Tickets (UK, 1–2.5%)
and Eventbrite (referral fees, rate not published). DICE is part of Fever
and has no affiliate route of its own.

## 7. Sightseeing fallback

When no provider fits, the plan is a hand-curated list of 15–30 sites per
city (gardens, landmarks, markets). The free sources for opening hours:
OSM's `opening_hours` tag through Overpass (how complete it is in our
cities has not been measured), and Google Places' `regularOpeningHours` (an
Enterprise-tier field, so paid). Markets and gardens change hours by
season, so a curated list needs a re-check date.

## Recommended short-list

The one or two providers per category that best combine a rich query, an
income, and our cities — by the evidence above:

- **Show tickets — the festival box office by deep link, plus Skiddle and
  Ticketmaster for other events.** No festival ticket earns anything, so
  build one-click paths into each festival's own basket. Earn on the rest of
  the city through Skiddle (UK, best rate, geo API) and Ticketmaster (all
  countries, free Discovery key, Impact tracking added automatically once
  the publisher ID is in the developer account).
- **Restaurants — Google Places (or OSM) to choose, OpenTable and TheFork
  to book.** Places can answer "near the venue, open at 18:00, vegetarian,
  cheap"; the booking link carries date, time and party size. Apply to
  OpenTable's partner programme if restaurant booking proves central — it
  is the only route to real availability. *Rates unverified.*
- **Hotels — Booking.com (already wired) plus the Stay22 map.** Booking
  covers every city; Stay22 answers "near these venues, these nights" with
  no integration and at least as good a split. LiteAPI is the future
  option if we ever want the booking inside our page.
- **Transport — Omio (already wired) and Trainline for trains; keep
  Travelpayouts for flights; DiscoverCars where people drive.** Omio pays 6%
  and covers UK and France; Trainline covers UK rail best.
- **Tours and attractions — Viator first, Tiqets second.** Viator is the
  only partner whose query API is free from day one, whose Full + Booking
  level allows checkout on our page, and which covers all our cities at 8%.
  Tiqets adds museum and attraction tickets with a real booking API.
- **Sightseeing — OSM + a hand-curated list**, Places only where hours are
  missing.

Everything marked **(search-attributed)** above is unverified and should be
re-read from the provider's own page before any money decision.

## Sources

All fetched 2026-09-25.

- [Ticketmaster Partner API](https://developer.ticketmaster.com/products-and-docs/apis/partner/) — reserve, payment, commit cart, fulfilment; approval and test-order certification.
- [Ticketmaster developer FAQ](https://developer.ticketmaster.com/support/faq/) — affiliate via Impact, rates "tailored during onboarding", no commission in presales or the first 24h after on-sale, own cart "in most instances, no", the 25 affiliate markets.
- [Ticketmaster partners page](https://developer.ticketmaster.com/partners/) — Distribution Partner Program; Partner API for "approved partners".
- [Travelpayouts — Ticketmaster offer](https://www.travelpayouts.com/en/offers/ticketmaster-affiliate-program/) — 0–4.15% by region, up to 30-day cookie. Per-country rates (1% UK, A$0.30 AU, 0.5% NZ) are from [Lasso](https://getlasso.co/affiliate/ticketmaster-au/) and [TapRefer](https://taprefer.com/ticketmaster-affiliate-program/ticketmaster/) search snippets — search-attributed.
- [Skiddle affiliate programme](https://www.skiddle.com/affiliates/) — 30% of booking fee, 30-day cookie, £25 threshold.
- [See Tickets on Awin](https://ui.awin.com/merchant-profile/7816/commission-groups) — search snippet only, search-attributed.
- [Eventbrite affiliate programme terms](https://www.eventbrite.com/help/en-us/articles/328394/eventbrite-affiliate-program-terms-and-conditions/) — referral fees under Insertion Orders.
- [Fever on Impact (HiEnergy listing)](https://app.hienergyrocket.com/a/fever-labs-inc-hienergy-impact) and [Ticketek listing (affi.io)](https://affi.io/m/ticketek-australia) — search-attributed.
- [London Theatre Direct API solutions](https://partners.londontheatredirect.com/products/api-ticketing-solutions/) — transactional REST API, seat plans, self-serve key.
- [TodayTix (LinkClicky listing)](https://linkclicky.com/affiliate-program/todaytix/) and [Headout (Lasso listing)](https://getlasso.co/affiliate/headout/) — search-attributed.
- [Adelaide Fringe FringeTIX page](https://adelaidefringe.com.au/fringetix) — sponsors and donations, no agent scheme visible.
- [OpenTable Partner API (StayAPI summary)](https://stayapi.com/blog/opentable-partner-api) and [OpenTable help: affiliate program](https://help.opentable.com/s/article/OpenTable-Affiliate-Program-1505261059868?language=en_US) — search-attributed; opentable.com connections failed from here.
- [TheFork affiliate (affi.io)](https://affi.io/m/thefork) — 20-day cookie, per-booking payout; search-attributed.
- [Quandoo Public API](https://docs.quandoo.com/quandoo-public-api/) — functionality set per partner agreement; affiliate countries from [Quandoo's affiliate page](https://quisine.quandoo.co.uk/become-affiliate/) (502 here), search-attributed.
- [Resy (API Evangelist profile)](https://github.com/api-evangelist/resy) and [SevenRooms integrations](https://sevenrooms.com/platform/integrations-apis/) — search-attributed; sevenrooms.com refused the connection.
- [ResDiary / DesignMyNight FAQ](https://resdiary.freshdesk.com/en/support/solutions/articles/4000215365-designmynight-faqs) — search-attributed.
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) and [Places data fields](https://developers.google.com/maps/documentation/places/web-service/data-fields) — SKU prices, free caps, field tiers.
- [Yelp Places API intro](https://docs.developer.yelp.com/docs/places-intro) — plans, trial, Reservations API listed.
- [Booking.com affiliate programme](https://www.booking.com/affiliate-program/v2/index.html) (registration via CJ) and [Demand API prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites) (Managed Affiliate Partner). Tiers 25–40% and the CJ 4% figures from [track360](https://track360.io/blog/booking-com-affiliate-partner-program-operator-teardown-2026) and [referly](https://marketplace.referly.so/affiliate-programs/bookingcom) snippets — search-attributed.
- [Expedia Rapid hub](https://developers.expediagroup.com/docs/products/rapid) and [Expedia Group affiliates](https://affiliates.expediagroup.com/) — "up to 4%".
- Travelpayouts offer pages: [Agoda](https://www.travelpayouts.com/en/offers/agoda-affiliate-program/), [Hostelworld](https://www.travelpayouts.com/en/offers/hostelworld-affiliate-program/), [Omio](https://www.travelpayouts.com/en/offers/omio-affiliate-program/), [Viator](https://www.travelpayouts.com/en/offers/viator-affiliate-program/), [GetYourGuide](https://www.travelpayouts.com/en/offers/getyourguide-affiliate-program/), [Tiqets](https://www.travelpayouts.com/en/offers/tiqets-affiliate-program/), [Klook](https://www.travelpayouts.com/en/offers/klook-affiliate-program/).
- [Stay22 home](https://www.stay22.com/) and [Stay22 FAQ](https://www.stay22.com/faq) — address-anywhere map, split "starts at 30%".
- [LiteAPI / Nuitee](https://www.liteapi.travel/) — free sandbox, no supplier contracts, search/prebook/book.
- [Duffel pricing](https://duffel.com/pricing) — $3/order + 1%, 1,500:1 search ratio.
- [Skyscanner Travel API](https://www.partners.skyscanner.net/product/travel-api) — apply to access.
- [Amadeus shutdown (PhocusWire)](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) — 403 here; dates search-attributed.
- [Kiwi.com: new approach to partnerships](https://media.kiwi.com/articles-and-interviews/better-for-business-kiwi-com-takes-a-new-approach-to-partnerships/) — invitation-only Tequila.
- [Trainline affiliate and partnership programmes](https://www.thetrainline.com/about-us/affiliates) — Partnerize, fee-free; Global API negotiable.
- [Rome2Rio search API docs](https://www.rome2rio.com/documentation/1-4/search/) — 403 here; free tier search-attributed.
- [Citymapper: SDKs and APIs come to an end](https://citymapper.com/news/2596/sdks-and-apis-come-to-an-end).
- [Transitland plans](https://www.transit.land/plans-pricing) — search-attributed. [TfL API portal](https://api-portal.tfl.gov.uk/) — free, registration.
- [Uber affiliate program](https://developer.uber.com/docs/riders/affiliate-program/introduction) — 404 here; terms search-attributed.
- [DiscoverCars affiliate](https://www.discovercars.com/affiliate) — 70% of profit, 365-day cookie.
- [Viator — levels of access](https://partnerresources.viator.com/travel-commerce/levels-of-access/) — Basic / Full / Full + Booking.
- [Tiqets Distributor API](https://api.tiqets.com/v2/docs/) — catalogue, availability, booking flow, affiliates@tiqets.com.
- [Civitatis affiliates](https://www.civitatis.com/en/affiliates/) and [Go City affiliate](https://gocity.com/en/affiliate-program) (403) — rates search-attributed.

Fetched 2026-09-27 (search-attributed; foursquare.com, airbnb.com and bolt.eu all failed to load from here):

- [Foursquare — pay-as-you-go Places API pricing announcement](https://foursquare.com/resources/blog/news/heads-up-developers-with-fsq-places-api-you-can-now-pay-as-you-go/) and [upcoming Places API changes](https://docs.foursquare.com/developer/reference/upcoming-changes) — the 1 June 2026 Pro-endpoint rate change and 15 May 2026 V3 deprecation; per-1,000-call rate and free-call tier via [openplacesapi.com's Foursquare pricing comparison](https://openplacesapi.com/compare/foursquare-places-api).
- [Airbnb's affiliate program (Airbnb Help Center)](https://www.airbnb.com/help/article/4236) — Creators and Demand programmes are application-only; [track360's Airbnb affiliate teardown](https://track360.io/blog/airbnb-vacation-rental-affiliate-referral-programs-operator-teardown-2026) and [PriceLabs on why the old affiliate programme ended](https://hello.pricelabs.co/blog/airbnb-affiliate-program/) — no cash commission on guest bookings; the host-referral cash payout ($15/host, $375 cap) is separate from either.
- [Bolt for Business affiliate listing (OpenAffiliate)](https://openaffiliate.dev/programs/bolt-for-business) — €150 per referred company; no consumer per-ride affiliate programme found alongside it.

## Open questions

- **OpenTable's actual affiliate rate and API route** — opentable.com
  would not connect from here; the partner application is the one route to
  real table availability. Worth one application.
- **Ticketmaster's rate for us** — "tailored during onboarding"; the
  per-country numbers are third-party listings.
- **Does Fever sell in Edinburgh, Melbourne, Adelaide, Montreal during the
  festivals**, and at what real affiliate rate?
- **Stay22 versus Booking direct** — which pays us more on the same stay?
  Needs real numbers from both dashboards.
- **LiteAPI's pricing and duties** as a seller of record (refunds, customer
  service) — would it be worth booking hotels inside the plan?
- **Musement/TUI** — still not researched.
  **Answered 2026-09-27, the other three**: Airbnb has no cash affiliate
  route open to us (Creators/Demand are application-gated, and the host
  referral scheme pays for referred hosts, not guest bookings); Bolt's only
  public referral scheme is B2B company sign-ups, not consumer rides; and
  Foursquare's Places API is priced (pay-as-you-go, ~500 free Pro calls a
  month then $15/1,000) as of its 1 June 2026 rate change — all three
  search-attributed, since foursquare.com, airbnb.com and bolt.eu did not
  load from here this pass either.
- **OSM `opening_hours` coverage** for attractions in each of our cities —
  unmeasured; it decides how much hand-curation the fallback needs.
- **Do any festival box offices take agents in-season** (group or hotel
  concierge schemes) even without an affiliate programme? Nothing public
  found.

## Growth log

- **2026-09-25** — page created deliberately on the owner's direction
  (ticket purchase first; aggregators with referral programmes and rich
  query APIs for restaurants, stays, transport, excursions, local events
  and sightseeing). Direct fetches of provider developer and affiliate
  pages where reachable; search snippets attributed by publisher where
  pages blocked us (OpenTable, Omio, GetYourGuide, Tripadvisor, Rome2Rio,
  PhocusWire, Go City, SevenRooms). Headline findings: no outside basket
  for festival tickets; no open restaurant availability API; Viator is the
  one open route to on-page checkout; Amadeus Self-Service and Kiwi Tequila
  are closed. Short-list per category added; integration decisions left to
  humans.
- **2026-09-27** — worked three of the page's "not found this pass" gaps
  (`WebFetch` still returns `EGRESS_BLOCKED` on every host probed this
  pass — foursquare.com, airbnb.com, bolt.eu, news.leicester.gov.uk and,
  as a control, example.com all failed identically, confirming the block
  is session-wide rather than domain-specific, as recorded on other pages;
  `WebSearch` still returns live snippets). Foursquare's Places API
  turned out to be priced (pay-as-you-go, ~500 free Pro calls/month then
  $15/1,000) since a 1 June 2026 rate change — closing a real gap in
  section 2's discovery-layer table.
  Airbnb and Bolt both resolve from "not found" to a firm "closed for our
  purpose": Airbnb has no cash affiliate route for guest bookings (only
  gated Creator/Demand programmes and a host-referral payout), and Bolt's
  only public referral scheme pays for B2B company sign-ups, not consumer
  rides — both narrow, not merely fill, their sections' NOT FOUND lines and
  the corresponding open-question bullet. All three search-attributed, so
  flagged for re-verification once a fetch-capable pass is possible.
  Spot-checked the Leicester 2027 succession question and the Pittock
  Fringe impact study (both on sibling pages) for anything new this pass
  might supersede — neither has moved since its last update, so nothing
  else changed.
