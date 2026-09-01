# Edinburgh Fringe ticketing & providers

Who actually sells an Edinburgh Fringe ticket, who all the venue operators
("providers") are, whether a third party can sell tickets itself, and whether
any provider or aggregator feed could replace scraping edfringe.com. Compiled
once, refined in place.

This page exists to answer a specific owner question — *"are edfringe.com and
edfest.com both just fronts for the event organizers?"* — and the answer turned
out to be half yes: one of the two is exactly that, and it is not the one the
product depends on.

## Key insights

- edfringe.com is an independent charity's box office, not the venues' — the venues' own storefront is edfest.com.
- Every ticketed show must give the Fringe box office at least 25% of its tickets; venues sell the rest themselves.
- One vendor, Red61, powers ten of the fifteen biggest operators' box offices. Provider access is one Red61 question.
- Nobody offers an affiliate or agent scheme — not the Society, not the venues. Deep links earn nothing, anywhere.
- Our own scrape is the provider census: 24 operator families cover 83% of the programme; the tail is 171 small venues.
- The official Listings API bans linking to any ticket seller except edfringe.com — even the venue's own site.
- Only the edfringe GraphQL has availability for the whole programme. The scrape cannot be retired.

## Who actually sells a Fringe ticket

The premise to correct first: **edfringe.com is not a front for the venue
operators.** It is run by the [Edinburgh Festival Fringe Society](https://www.oscr.org.uk/about-charities/search-the-register/charity-details?number=SC002995),
an independent registered Scottish charity (SC002995, income £8.28m FY2024)
governed by an open **£5/year membership** that elects its board — structurally
separate from the operators, and [publicly feuded with](https://www.scotsman.com/whats-on/arts-and-entertainment/edinburgh-festival-fringe-longest-running-venue-operator-says-he-has-lost-confidence-in-the-fringe-society-3791322)
by them at times. The Society performs no curation (open access: anyone with a
show, a willing venue and the registration fee is in the programme) and runs the
central box office.

**The allocation model** is the load-bearing mechanic, from the Society's own
[participant guidance](https://help.registration.edfringe.com/create-or-edit-a-show/payout-and-fringe-allocation.aspx):
every ticketed show must allocate a **minimum 25% of tickets per performance**
to the Fringe Box Office (sliding scale above that), on which the Society takes
**5%+VAT commission**; the venue sells the remainder through its own box office
at its own rate ([Assembly charges 4%+VAT](https://s3.eu-west-2.amazonaws.com/cdn.assemblyfestival.com/Assembly%20Festival%202026%20Information%20Pack%20for%20Performers%20(6).pdf);
[Summerhall 8%](https://www.summerhallarts.co.uk/wp-content/uploads/2025/01/Summerhall-Arts-Festival-Information-Pack_2025_web.pdf),
and reports that ~70% of its tickets nonetheless sell through the Fringe box
office). This model is why the scrape's `NO_ALLOCATION_CONTACT_VENUE` status
exists: when the Society's allocation for a performance is exhausted, [the
official advice](https://www.edfringe.com/faqs/) is to check with the venue box
office — the ticket may still exist, just not in the channel we can see. In the
2026 data that status marks 1,279 of ~59,900 performances (2.1%), concentrated
at the big operators.

**Platforms:** since March 2025 edfringe.com runs on an interim site built by
Australian agency equ on its Tikketr platform (the GraphQL the scraper hits;
the [official app](https://play.google.com/store/apps/details?id=com.tikketr.edfringe.prod&hl=en)
is `com.tikketr.edfringe.prod` and takes [~30% of all ticket sales](https://www.edfringe.com/about-us/news-and-blog/our-digital-transformation-strategy-march-2025/)).
[Red61 ran the Society box office 2009–2023](https://www.red61.com/news/red61-celebrates-20-years-at-the-edinburgh-festival-fringe/)
and still powers the venue side (17 federated VIA instances in 2024). A
permanent replacement site is being [built by Storm ID for Fringe 2027](https://www.edfringe.com/about-us/news-and-blog/fringe-society-appoints-storm-id-to-develop-new-website-for-the-fringe/) —
meaning **the scraper's target platform is explicitly interim**.

## edfest.com — the venues' own storefront

The other half of the owner's premise is correct. [edfest.com](https://edfest.com/about)
is operated by **Showcatcher Ltd** ([company 07628569](https://find-and-update.company-information.service.gov.uk/company/07628569/officers),
lead director William Burdett-Coutts — Assembly's founder and artistic
director): a cross-venue storefront formed by the major operators — Assembly,
C ARTS, Gilded Balloon, Just the Tonic, Pleasance, Underbelly, ZOO (Summerhall
was an eighth founder and has left the list). It explicitly
[acts "as an agent on behalf of multiple venues and producers"](https://edfest.com/faqs)
on Red61 rails, sells only participating venues' shows in one basket, caps
booking fees at £5, and fronts the [Love the Fringe membership](https://theqr.co.uk/2026/06/04/edfest-2026-launch-fringe-crisis-how-to-save-on-tickets/).
So the accurate map: **edfringe.com = the charity's central box office;
edfest.com = the big operators' joint venture; venue sites = each operator's
own channel** — three parallel channels selling overlapping inventory.

(Also answered: **Edinburgh Playhouse** is an [ATG receiving house](https://www.atgtickets.com/venues/edinburgh-playhouse/),
not a Fringe operator — but it *is* [registered Fringe venue 59](https://www.edfringe.com/tickets/venues/edinburgh-playhouse)
in 2026, hosting four big ATG-ticketed comedy one-nighters.)

## The provider census

The completeness question has a clean answer: the Fringe is open-access but
**being "in the Fringe" requires paid registration with the Society**, and
venue registration (free) puts every venue in the
[public directory](https://tickets.edfringe.com/venues) — so the registered
catalogue we already scrape **is by construction the exhaustive universe** of
providers. Our `data/venues.json` carries 301 registered venue records for
2026; grouping the 294 venues that carry shows in
[`data/normalized/shows.json`](https://github.com/missingbulb/EdFringeNow/blob/main/data/normalized/shows.json)
by operator family gives the census (computed 2026-07-31, 4,100 shows):

| Operator | Venues | Shows | Own online box office |
|---|---:|---:|---|
| theSpaceUK | 6 | 483 | Red61 (tickets.thespaceuk.com) |
| Laughing Horse Free Festival | 18 | 320 | free; PWYC advance via Fringe box office |
| Assembly | 8 | 300 | Red61 (assemblyfestival.com) |
| Pleasance | 5 | 271 | Red61 (pleasance.co.uk `/via/tickets/…`) |
| Just the Tonic | 7 | 216 | Red61 (edinburgh.justthetonic.com) |
| Hoots | 5 | 201 | — |
| Greenside | 2 | 200 | none found — effectively edfringe-only |
| Gilded Balloon | 4 | 198 | Red61 (tickets.gildedballoon.co.uk) |
| Underbelly | 4 | 193 | Red61 (underbellyedinburgh.co.uk) |
| PBH's Free Fringe | 25 | 190 | unticketed — bucket donations only |
| Monkey Barrel | 5 | 144 | Line-Up for own sales; Fringe runs via edfringe |
| C ARTS / C venues | 4 | 111 | Red61 (CtheArts.com) |
| The Stand | 6 | 109 | in-house (thestand.co.uk) |
| Summerhall | 1 | 82 | Red61 (tickets.summerhallarts.co.uk) |
| Paradise Green | 2 | 75 | volunteer-run non-profit |
| EIFF (Film Festival screenings) | 6 | 63 | own festival ticketing |
| Braw Venues (Hill St, Grand Lodge) | 2 | 58 | — |
| ZOO | 2 | 51 | Red61 (tickets.zoofestival.co.uk) |
| Royal Scots Club | 3 | 34 | — |
| Scottish Storytelling Centre | 1 | 33 | Red61 |
| Scottish Comedy Festival | 2 | 26 | — |
| Traverse | 3 | 12 | **Spektrix — publicly readable API** |
| Bedlam (EUTC) | 1 | 12 | — |
| French Institute | 1 | 3 | — |

The remaining **171 venues carry 715 shows (17%)** — churches, pubs, one-room
independents (largest: Edinburgh New Town Church, 43 shows; The Jazz Bar, 37).
The census caveat: grouping is by venue-name matching, so a mis-named venue can
mis-file — treat counts as ±small, not gospel.

**The one gap in "exhaustive":** [PBH's Free Fringe makes Society registration
optional](https://freefringe.org.uk/performers-faq/) ("It's not compulsory to be
in the program"). PBH's own site lists roughly 800 entries for 2026; only 183
PBH shows are in the edfringe catalogue. Those unregistered shows exist only in
PBH's listings and the printed Wee Blue Book — invisible to edfringe, to the
official Listings API, and to us. [Laughing Horse requires registration](https://freefestival.co.uk/Perform_with_us.aspx)
("All of our shows must be entered into the Official Fringe Programme"), so its
320 shows are fully covered. Free shows otherwise appear in the data like any
other (399 shows `FREE_NON_TICKETED`, 23 `FREE_TICKETED`).

## Can we sell tickets ourselves? No — and nobody can

The verified negative, adversarially checked: **no open affiliate, agent,
reseller, white-label or purchase-API route into Fringe ticketing exists.**

- The **Fringe Society** offers no scheme of any kind; its
  [ticketing T&Cs](https://tickets.edfringe.com/terms-and-conditions) bar using
  tickets "for any commercial, business or re-sale purposes", and its current
  Tikketr platform has no public partner API at all.
- **No venue operator** advertises an affiliate or agent programme. The big
  operators channelled exactly this energy into their own closed joint venture —
  edfest.com — rather than opening a channel to outsiders.
- The **platform layer** has the technology but not the access:
  [Spektrix runs a dedicated Agency API](https://integrate.spektrix.com/docs/agentguide)
  (third-party agents buying on a credit agreement the venue sets up per-agent)
  and [Red61 VIA offers APIs, white-label sales and cross-selling](https://www.red61.com/ticketing-solutions/) —
  but in every case access is granted per-client under a negotiated commercial
  agreement. No self-service signup, no published rates.
- Existing "third-party sellers" prove the pattern: See Tickets and Ents24
  retail [The Stand's own club shows](https://www.seetickets.com/venue/the-stand-comedy-club/8933)
  under explicit venue agency deals; TodayTix and Fever carry **no** actual
  Edinburgh Fringe inventory (London transfers and previews only); LivingSocial
  retails Love the Fringe *memberships*, not tickets. New for 2026, a
  [Sold Out Board lottery pilot](https://www.theticketingbusiness.com/2026/07/west-end-style-lottery-ticketing-system-coming-to-edinburgh-fringe/)
  resells last tickets for sold-out shows at face value — also a closed
  arrangement.

Bottom line for this product: "selling tickets ourselves" would mean separate
negotiated agent agreements with dozens of operators across at least five
ticketing platforms, with no published programme to even apply to. The realistic
ceiling is **deep links to each seller — which earn nothing**, because no
commission scheme exists anywhere in the Fringe ecosystem. (This kills the
hoped-for ticket-affiliate revenue path; `shared/affiliates.js` stays a
travel/accommodation monetisation seam only.)

## Can anything replace the edfringe scrape? Mostly no

- **The official [Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/documentation)**
  is the only licensed catalogue alternative: free, official, same registered-show
  universe, per-performance start/end/price, a near-real-time
  `modified_from` sync ("a delay of a few minutes"), 2026 Fringe data loaded,
  and a beta [MCP endpoint](https://api.edinburghfestivalcity.com/documentation/mcp).
  But Fringe access is **approval-gated** (build against a randomised
  `demofringe` dataset, [submit the app for review](https://api.edinburghfestivalcity.com/documentation/fringe_approval)),
  it has **no availability/sold-out field**, and its licence adds a sharp rule:
  [links for Fringe shows must go to edfringe.com only](https://api.edinburghfestivalcity.com/documentation/fringe_approval) —
  "not… any other ticketing site, including the venue's own site". An
  API-approved product could not deep-link to venue box offices.
- **Venue operators:** probed directly, the big operators publish nothing
  machine-readable (Assembly: locked CMS; Gilded Balloon: WordPress with no
  event type; Pleasance/Underbelly/The Stand: server-rendered HTML; Monkey
  Barrel: Wix). Two real exceptions, found and verified by live fetch:
  **Traverse** exposes a fully public
  [Spektrix v3 JSON API](https://system.spektrix.com/traverse/api/v3/events)
  including **live per-performance seat availability** (a fetched 2 Aug 2026
  performance returned `available: 19, capacity: 302`), and **Summerhall Arts**'
  festival site has an open [WordPress REST API with events and performances](https://festival.summerhallarts.co.uk/wp-json/wp/v2/types).
  Together they cover ~94 of 4,100 shows — real, but not a strategy.
- **Aggregators:** [Data Thistle](https://www.datathistle.com/what-we-do/for-listings-suppliers/)
  has genuine full-Fringe coverage but is paid, contact-for-pricing; Skiddle's
  API is beta and non-commercial-only with thin coverage; WeGotTickets,
  Eventbrite and Ents24 carry effectively nothing.

**The verdict:** for the full programme *with availability* — the thing the Now
page's honesty depends on — **the edfringe GraphQL scrape has no replacement.**
The defensible end-state is: official Listings API as the licensed catalogue
backbone *if* its approval and linking rules are acceptable, with a slimmed
edfringe probe kept solely as the availability overlay — or simply keep the
scrape as-is, knowing its platform is interim (Storm ID site lands for 2027, so
the scraper breaks on that timetable regardless).

## Sources

- [Fringe Society charity record (OSCR SC002995)](https://www.oscr.org.uk/about-charities/search-the-register/charity-details?number=SC002995)
- [Edinburgh Festival Fringe Society (Wikipedia)](https://en.wikipedia.org/wiki/Edinburgh_Festival_Fringe_Society)
- [Payout and Fringe allocation — Society participant guidance](https://help.registration.edfringe.com/create-or-edit-a-show/payout-and-fringe-allocation.aspx)
- [edfringe.com FAQs (allocation exhausted → check venue box office)](https://www.edfringe.com/faqs/)
- [Assembly Festival 2026 information pack for performers (PDF)](https://s3.eu-west-2.amazonaws.com/cdn.assemblyfestival.com/Assembly%20Festival%202026%20Information%20Pack%20for%20Performers%20(6).pdf)
- [Summerhall Arts festival information pack 2025 (PDF)](https://www.summerhallarts.co.uk/wp-content/uploads/2025/01/Summerhall-Arts-Festival-Information-Pack_2025_web.pdf)
- [Our digital transformation strategy, March 2025 (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/our-digital-transformation-strategy-march-2025/)
- [Fringe Society appoints Storm ID to develop new website (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/fringe-society-appoints-storm-id-to-develop-new-website-for-the-fringe/)
- [Red61 celebrates 20 years at the Edinburgh Festival Fringe](https://www.red61.com/news/red61-celebrates-20-years-at-the-edinburgh-festival-fringe/)
- [Red61 ticketing solutions (VIA API, white-label, cross-selling)](https://www.red61.com/ticketing-solutions/)
- [EdFringe official app (Google Play — com.tikketr.edfringe.prod)](https://play.google.com/store/apps/details?id=com.tikketr.edfringe.prod&hl=en)
- [edfest.com — about (the venue collaboration)](https://edfest.com/about)
- [edfest.com — terms (Showcatcher Ltd)](https://edfest.com/terms-conditions)
- [edfest.com — FAQs (agency model)](https://edfest.com/faqs)
- [Showcatcher Ltd officers (Companies House)](https://find-and-update.company-information.service.gov.uk/company/07628569/officers)
- [Assembly founder "lost confidence in the Fringe Society" (The Scotsman)](https://www.scotsman.com/whats-on/arts-and-entertainment/edinburgh-festival-fringe-longest-running-venue-operator-says-he-has-lost-confidence-in-the-fringe-society-3791322)
- [EdFest 2026 launch and Love the Fringe (The QR)](https://theqr.co.uk/2026/06/04/edfest-2026-launch-fringe-crisis-how-to-save-on-tickets/)
- [Edinburgh Playhouse (ATG)](https://www.atgtickets.com/venues/edinburgh-playhouse/)
- [Edinburgh Playhouse as Fringe venue 59 (edfringe.com)](https://www.edfringe.com/tickets/venues/edinburgh-playhouse)
- [PBH's Free Fringe — performers' FAQ (registration optional)](https://freefringe.org.uk/performers-faq/)
- [PBH's Free Fringe — ethos and conditions](https://freefringe.org.uk/ethos-and-conditions-of-the-free-fringe/)
- [Laughing Horse Free Festival — perform with us (registration required)](https://freefestival.co.uk/Perform_with_us.aspx)
- [Fringe venue registration is free; directory listing (Society help)](https://help.registration.edfringe.com/create-or-edit-a-venue/frequently-asized-questions.aspx)
- [Fringe Box Office ticketing terms](https://tickets.edfringe.com/terms-and-conditions)
- [Spektrix Agency API documentation](https://integrate.spektrix.com/docs/agentguide)
- [Traverse public Spektrix v3 events API (live fetch)](https://system.spektrix.com/traverse/api/v3/events)
- [Summerhall Arts festival site open WP REST types (live fetch)](https://festival.summerhallarts.co.uk/wp-json/wp/v2/types)
- [Sold Out Board lottery pilot for Fringe 2026 (TheTicketingBusiness)](https://www.theticketingbusiness.com/2026/07/west-end-style-lottery-ticketing-system-coming-to-edinburgh-fringe/)
- [See Tickets — The Stand Comedy Club venue page](https://www.seetickets.com/venue/the-stand-comedy-club/8933)
- [Edinburgh Festivals Listings API — Fringe approval process](https://api.edinburghfestivalcity.com/documentation/fringe_approval)
- [Edinburgh Festivals Listings API — licence](https://api.edinburghfestivalcity.com/licence)
- [Edinburgh Festivals Listings API — MCP endpoint (beta)](https://api.edinburghfestivalcity.com/documentation/mcp)
- [Data Thistle — for listings suppliers](https://www.datathistle.com/what-we-do/for-listings-suppliers/)
- [The 2026 programme launch — 3,649 shows (edfringe.com)](https://www.edfringe.com/about-us/news-and-blog/mixitup-with-the-2026-edinburgh-festival-fringe-programme/)
- [2026 operator census computed from the repo's scraped catalogue (shows.json)](https://github.com/missingbulb/EdFringeNow/blob/main/data/normalized/shows.json)

## Open questions

- **Would the Listings API approve us, and on what terms?** Whether Fringe
  approval would be granted to a product that also shows availability badges
  scraped from edfringe.com — and whether blending the two sources in one
  product is licence-compliant at all — is unresolved and decides the
  architecture. One email to Festivals Edinburgh covers this *and* the
  static-file question already open on the edinburgh-festival-season page. (New
  evidence 2026-09-01, from
  [competitor-landscape/](../competitor-landscape/README.md): the
  cross-festival planner **planmyfestivals.com** carries exactly the API's
  festival set, genre vocabulary, venue-facilities detail and a "Show data ©
  the participating festivals" credit, and shows **no availability signal**
  anywhere — consistent with an approved, availability-blind Listings API
  consumer. Later the same day, stronger: **edfringemap.com states outright**
  on [its advertise page](https://edfringemap.com/advertise) that it runs on
  "official festivals API data" — while listing every show free, selling
  promoted placement on top, and linking tickets out. So one inferred and one
  self-declared consumer both look approved, planner/map-shaped and
  commercial, which reads well for our chances — and both products' total
  silence on availability is what the licence-plus-API shape produces
  without a second source.)
- **Does Tikketr/equ have any non-public partner API?** Nothing public exists;
  a private capability cannot be ruled out. The Society's arts-industry
  accreditation channel was also not examined.
- **Would any operator actually grant a small site an agent agreement?** No
  operator publishes agent terms or rates; only asking answers it. Red61 VIA
  agent access terms are likewise unpublished.
- **How do venue Red61 instances sync with Tikketr since the platform split?**
  Assembly says its box office "syncs live" with the Society's; the mechanism
  (and what it means for our availability data's freshness) is undocumented.
- **The true size of the PBH unregistered gap.** ~800 own-site listings vs 183
  registered shows is page-count arithmetic, not a confirmed count.
- **The census's name-matching caveat.** 294 venue codes carry shows vs 301
  registered venue records; the 171-venue tail was grouped by hand-checked
  substring rules. A registration-data cross-check (operator field, if the
  GraphQL exposes one) would firm it up.
- **Storm ID's 2027 scope.** Whether the new site replaces the Tikketr
  ticketing engine (breaking the scraper) or only the web front-end is not
  stated anywhere accessible.

## Growth log

- **2026-07-31** — page created. Seeded from an 11-agent research pass
  (5 web-research topics each adversarially fact-checked, plus a local census
  computed from the repo's own scraped catalogue): the Society-vs-venues
  architecture and the ≥25% allocation model (explaining
  `NO_ALLOCATION_CONTACT_VENUE`); edfest.com identified as the seven big
  operators' own storefront via Showcatcher Ltd; the 24-family provider census
  with its 171-venue tail and the PBH unregistered-show gap; the verified
  absence of any affiliate/agent/API selling route anywhere in the ecosystem;
  and the listings-source ranking — official Listings API as the only licensed
  catalogue alternative (approval-gated, availability-blind, edfringe-only
  linking), Traverse's public Spektrix API and Summerhall's open WP API as the
  two genuine venue-feed exceptions, Data Thistle as the only paid aggregator
  with real coverage. Two initial research claims were refuted in verification
  and corrected here (venue feeds do exist — Traverse/Summerhall; "no public
  availability source" is false for Traverse specifically). All claims cited.
  Requirements implications (monetisation ceiling, scrape-replacement
  architecture) left for human review.
- **2026-09-01** — annotated the Listings API approval open question with new
  circumstantial evidence from the competitor research: planmyfestivals.com
  (profiled on [competitor-landscape/](../competitor-landscape/README.md))
  appears to be an approved planner-shaped consumer of the API, and its UI's
  total silence on availability matches the API's availability-blind shape.
  Question narrowed, not closed — the inference is unconfirmed.
- **2026-09-01** *(second pass, same day)* — strengthened the same annotation:
  edfringemap.com **self-declares** "official festivals API data" on its
  advertise page while selling promoted placement over the free listings — a
  second consumer, this time stated rather than inferred, and a commercial
  one. The approval question stays open; what changed is that two live
  products now suggest the path is passable.
- **2026-09-01** — renamed from `fringe-ticketing/` to
  `edinburgh-fringe-ticketing/` on the owner's direction: with the wiki's
  scope now global (many fringes are in scope), the bare name was ambiguous —
  this page is specifically the Edinburgh Fringe's operator census. Content
  unchanged; all inbound links updated in the same change.
