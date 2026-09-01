# City context sources — finding everything else that's on

Where "what else is going on in this city" gets published, and how a product
can read it. This page exists on the owner's direction (2026-09-01): a
festival visitor also wants the rest of the city — other events that week,
attractions, markets — and the wiki's job is **not** to hold any particular
weekend's events but to hold **the sources**: which publications, feeds and
APIs carry a city's non-festival goings-on, per festival city, and how
machine-readable each is. Scoped to the cities of the longer festivals
([comedy-festival-circuit/](../comedy-festival-circuit/README.md)'s
fringe-shaped tier), not the weekend showcases. Edinburgh's own August
*festival* cluster is [festival-season/](../festival-season/README.md)'s;
this page is about everything those pages don't list. Compiled once, refined
in place.

Every claim below was verified by direct fetch on 2026-09-01 unless marked
as a search-attributed claim; "closed" verdicts name what was actually
probed.

## Key insights

- Events listings are a per-country licensed market: Data Thistle (UK), ATDW (Australia), Eventfinda (NZ) cover our cities in one API each.
- Montreal is the outlier: the city's own open-data portal publishes its events calendar as CSV/GeoJSON, refreshed daily.
- Tourism-board sites have no APIs — but their event detail pages carry schema.org JSON-LD, so one parser covers every city.
- The open-API era is over: Eventbrite killed public event search in 2020, Songkick takes no new keys, Fever bought DICE.
- Ticketmaster Discovery and Skiddle are the free keyed baseline — geo-searchable, 5k calls/day, with a ticketed-music skew.
- Attractions are solved free: OSM Overpass plus Wikidata; Viator's no-gate affiliate tier adds bookable tours with commission.
- Data Thistle is competitor and supplier at once: it sells the listings feed the UK's own tourism boards run on.

## The source classes

**1. Tourism-board (DMO) event calendars** are the best human-curated
coverage of "everything else in town" — promoters submit events directly
(every DMO probed has a submit flow) — and the weakest machine surface: none
probed offers a documented API. The verified pattern across seven DMOs:
index pages carry only site-level JSON-LD, but **event detail pages carry
full schema.org `Event` markup** (wellingtonnz.com's detail pages have
`MusicEvent` with `startDate` and `Place`), so the generic integration is a
sitemap crawl plus a JSON-LD parse of detail pages — one parser for every
city. Some have undocumented JSON backends (aucklandnz.com calls its own
`/api/events/get`); some are bot-hostile (visitmelbourne.com 403s
non-browsers; What's On Melbourne renders client-side).

**2. City open-data portals** carry attractions/POI and event
*infrastructure*, not live listings — with one exception worth building on:
[Montreal's "Événements publics" dataset](https://donnees.montreal.ca/)
(CKAN, API works unauthenticated) is the city's own calendar as
CSV/GeoJSON — date, event type, audience, cost, location — last modified
the day it was checked, i.e. maintained daily. Melbourne's Opendatasoft
portal (239 datasets, open API) has venues, landmarks and event *permits*
but no calendar; Edinburgh's legacy portal was unreachable (502) and its
live ArcGIS portal is spatial-only.

**3. Commercial listings media** (Time Out, The Skinny, Broadsheet, The
List's consumer site) are editorial and scrape-only; no licensing program
surfaced for Time Out. The class that matters sits behind them:

**4. Licensed events-data suppliers — the class the UK actually runs on.**
[Data Thistle](https://www.datathistle.com/) (The List's data arm,
Edinburgh-based) claims over half a million future performances UK-wide and
publishes a [documented Publishing API](https://api.datathistle.com/) —
free registration, event/place/schedule/performance model **with
per-performance prices and booking links** — and its named clients include
VisitScotland, Visit Brighton, Visit Liverpool and Transport for Edinburgh,
via the Simpleview CMS the DMOs run on. One integration would cover
Edinburgh, Brighton and Leicester at once — and its data model is
structurally a superset of what EdFringeNow already stores. Australia's
equivalent is national and official: the
[Australian Tourism Data Warehouse ATLAS API](https://developer.atdw.com.au/)
(products *and events*, feeding the state DMO sites; distributor
registration A$660 once-off with a 30-day trial, per its own FAQ) — one
paid integration covers Melbourne and Adelaide. New Zealand's is
[Eventfinda's API](https://www.eventfinda.co.nz/api/v2/index) (free key by
application, display-only licence with attribution) covering Auckland and
Wellington.

**5. Ticketing-platform discovery APIs** — the survivors and the dead:
[Ticketmaster Discovery](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/)
(free key, 5,000 calls/day, geo+date+venue search, global) and
[Skiddle](https://github.com/Skiddle/web-api) (UK; free key, lat/long/radius,
event codes including COMEDY and EXHIB) are real and open.
**Eventbrite has no public discovery API** — the public event search was
removed in February 2020 and the API is org-scoped now; **Songkick** takes
no new API applications (commercial licence ~$500/month per its support
pages); **DICE** is partner-only and was acquired by **Fever** (itself
closed) in June 2025; **Bandsintown** is artist-scoped — the wrong shape
for city-wide discovery. Universe has an open GraphQL API but niche
inventory.

**6. Event-intelligence aggregators**: [PredictHQ](https://docs.predicthq.com/)
sells exactly "all events in a city" (free tier exists; real pricing
negotiated) but is built for demand forecasting — whether its licence
permits consumer republishing is unverified and decides whether it is
usable at all. SeatGeek's Platform API is real, free-keyed, US-leaning.

**7. Attractions, as distinct from events**: the free, licence-clean base
layer is [OpenStreetMap's Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
(`tourism=attraction|museum|viewpoint`, opening hours where mapped) joined
with [Wikidata's SPARQL endpoint](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service)
(CC0 entities, coordinates, images, Wikipedia links) — the "free hour near
me" gazetteer, and the machine version of the hand-curated list
[festival-season/](../festival-season/README.md) said couldn't exist as a
feed. For *bookable* attractions,
[Viator's Partner API basic-access tier is free with no pre-authorization](https://docs.viator.com/partner-api/technical/)
(search, availability, pricing, commission on referred bookings) — which
also plugs into the affiliate lane
[competitor-landscape/](../competitor-landscape/README.md)'s revenue
analysis found empty among rivals; GetYourGuide gates its API behind 100k
monthly visits and Tiqets behind partner contact; Google Places is paid
per-request; Atlas Obscura is bot-blocked with no API.

## Per-city: what a product would actually read

| City (festival, window) | Best sources | Machine access |
|---|---|---|
| Edinburgh (Fringe, Aug) | Data Thistle API; The List editorial; Ticketmaster + Skiddle | documented API; scrape; APIs |
| Melbourne (MICF, Mar–Apr) | ATDW ATLAS API; What's On Melbourne; data.melbourne | paid API; headless scrape only; open API (POI, no listings) |
| Adelaide (Fringe, Feb–Mar) | ATDW (same integration); southaustralia.com (ATDW-powered) | paid API; detail-page scrape |
| Brighton (Fringe, May) | Data Thistle (VisitBrighton is its client); visitbrighton.com | same UK API; JSON-LD scrape |
| Montreal (JFL, Jul) | city open-data events dataset; mtl.org; Ticketmaster | CSV/GeoJSON, daily; JS site; API |
| Auckland + Wellington (NZICF, May) | Eventfinda API; DMO sites | free key + attribution; JSON-LD scrape |
| Leicester (comedy festival, Feb) | Data Thistle; visitleicester.info; Skiddle | same UK API; detail-page scrape; API |

The synthesis the research supports: **three integrations cover the need at
lowest cost** — (1) one licensed listings API per country (Data Thistle /
ATDW / Eventfinda, with Montreal's open data replacing the class there),
(2) Ticketmaster Discovery + Skiddle as the free cross-city baseline, and
(3) OSM + Wikidata for attractions with Viator's affiliate tier when
bookable tours (and their commission) are wanted. The universal fallback
for any DMO without an API is the sitemap-crawl + `Event` JSON-LD parse.
Time Out, Eventbrite, Songkick, Fever/DICE and Atlas Obscura are closed for
this purpose and not worth integration effort.

## Sources

- [Data Thistle](https://www.datathistle.com/) and the [Publishing API](https://api.datathistle.com/) — coverage claim, client list, data model with per-performance prices; fetched 2026-09-01.
- [ATDW — distributor registration and FAQ](https://atdw.com.au/) and the [ATLAS API documentation](https://developer.atdw.com.au/) — the A$660 registration and 30-day trial are ATDW's own stated terms.
- [Eventfinda API](https://www.eventfinda.co.nz/api/v2/index) and [its terms](https://www.eventfinda.co.nz/api/terms) — free key, display-only licence, attribution.
- [Ville de Montréal open data — package search](https://donnees.montreal.ca/) — the "Événements publics" dataset (CSV/GeoJSON/SHP), modified same-day at check.
- [Ticketmaster Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) — free key, 5,000 calls/day, 5 req/sec defaults.
- [Skiddle web API (GitHub)](https://github.com/Skiddle/web-api) — free key by application; event codes including COMEDY and EXHIB.
- [Eventbrite platform docs](https://www.eventbrite.com/platform/docs/introduction) and the [public-search removal record (Automattic's eventbrite-api issue)](https://github.com/Automattic/eventbrite-api/issues/83) — no public discovery endpoint since Feb 2020.
- [Songkick API support page](https://support.songkick.com/hc/en-us/articles/360012423194) — closed to new applications; commercial licence pricing as stated there.
- [DICE partners](https://dice.fm/partners) and [Fever's acquisition of DICE (Fever newsroom)](https://newsroom.feverup.com/) — partner-only API; June 2025 acquisition.
- [Bandsintown artist API docs](https://artists.bandsintown.com/support/api) — artist-scoped access.
- [PredictHQ docs](https://docs.predicthq.com/) and [pricing page](https://www.predicthq.com/pricing) — plans self-reported; republishing terms unverified.
- [Viator Partner API — levels of access](https://partnerresources.viator.com/travel-commerce/levels-of-access/) and [technical docs](https://docs.viator.com/partner-api/technical/) — free basic affiliate tier, no pre-authorization.
- [GetYourGuide partner API gate](https://partner.getyourguide.support/hc/en-us/articles/13981133907613) — ≥100k monthly visits for Basic.
- [Overpass API (OSM wiki)](https://wiki.openstreetmap.org/wiki/Overpass_API) and [Wikidata SPARQL service](https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service).
- [Google Places web service](https://developers.google.com/maps/documentation/places/web-service/overview) — paid per-request; [Things to do is operator-side](https://support.google.com/google-ads/answer/13189190).
- DMO probes, all fetched 2026-09-01: [wellingtonnz.com events](https://www.wellingtonnz.com/visit/events) (detail-page `MusicEvent` JSON-LD), [aucklandnz.com events](https://www.aucklandnz.com/events) (internal `/api/events/get`), [What's On Melbourne](https://whatson.melbourne.vic.gov.au/) (client-rendered), [visitmelbourne.com](https://www.visitmelbourne.com/) (403 to non-browsers), [data.melbourne explore API](https://data.melbourne.vic.gov.au/), [southaustralia.com](https://southaustralia.com/) (ATDW asset URLs), [visitbrighton.com](https://www.visitbrighton.com/whats-on/) (Simpleview CMS), [visitleicester.info](https://www.visitleicester.info/whats-on/), [edinburgh.org what's-on](https://edinburgh.org/whats-on/), [mtl.org](https://www.mtl.org/en/what-to-do/festivals-and-events), [lavitrine.com](https://www.lavitrine.com/) (JS SPA, no public API), [timeout.com/edinburgh](https://www.timeout.com/edinburgh), [list.co.uk](https://list.co.uk/), [atlasobscura.com](https://www.atlasobscura.com/) (403).

## Open questions

- **What does Data Thistle actually cost, and would its licence allow our
  static-file architecture?** Registration is free but commercial licensing
  is contact-priced — the same two questions
  [festival-season/](../festival-season/README.md) has open against the
  Edinburgh Festivals Listings API (redistribution vs our committed-JSON
  model), now against the UK-wide supplier too. One conversation covers
  both of its roles (supplier here, competitor on
  [competitor-landscape/](../competitor-landscape/README.md)).
- **Does Data Thistle's feed carry the Fringe itself at scrape-grade
  fidelity?** If its half-million UK performances include the full Fringe
  programme with prices, it is also a candidate *second source* for our
  core data — unexamined.
- **PredictHQ's republishing terms** — unverified, and they decide whether
  the category is usable for a consumer product at all.
- **How complete is DMO detail-page JSON-LD in practice?** The pattern is
  verified on single pages per site; nobody has measured what fraction of a
  DMO's events carry parseable markup.
- **Montreal's dataset boundary** — whether "Événements publics" covers
  only city-run events or the full cultural calendar (La Vitrine's
  aggregator ambitions suggest the private layer is separate and closed).
- **Edinburgh's own gap is real**: no UK open-data events feed, The List's
  consumer site is scrape-only, and the council portal was unreachable this
  pass — for our home city, Data Thistle or nothing is the current read.
- **ATDW's 30-day trial** is the cheap probe when Melbourne/Adelaide
  support becomes live — deferred to adoption time, like the circuit
  page's deep dives.

## Growth log

- **2026-09-01** — page created deliberately on the owner's direction
  ("where those are published and how we can find them" — sources, not
  events), from a verification-first research pass: the seven source
  classes with fetch-verified machine-readability verdicts, the
  per-country licensed-supplier finding (Data Thistle / ATDW / Eventfinda),
  Montreal's daily-refreshed open-data events calendar, the DMO
  detail-page JSON-LD pattern, the closed-API graveyard (Eventbrite,
  Songkick, Fever/DICE, Time Out, Atlas Obscura), the OSM+Wikidata
  attractions layer with Viator's free affiliate tier, and the per-city
  source table for the fringe-tier festival cities. All claims cited;
  integration choices left for humans.
