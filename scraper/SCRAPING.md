# Scraping edfringe data — API reference

Working notes on the edfringe.com data API: where the data lives, how to reach
it, the fields it exposes, and the non-obvious bits (pricing, ticket status).
Companion to [README.md](README.md), which covers the two scripts
(`fetch_shows.py`, `normalize.py`) and the workflows.

## The source

edfringe.com's "What's On" is a Next.js SPA; the HTML is an empty shell and the
shows load client-side from a **GraphQL API** on the Tikketr platform:

```
POST https://edfringe-tikketr-web-api.equhost.com/graphql
```

Auth is a bearer token from `POST .../token` with the site's **public anonymous
credentials** (username `anonymous`, password `2add50c2-ac54-4c1e-b5bc-f8d9ca66a067`).
These grant read access to the same public listing everyone sees. Send
`Origin: https://www.edfringe.com`.

## Reaching it from a Claude Code web session

You **can't** hit the API from a web session: the egress proxy blocks
`equhost.com` (and edfringe.com itself returns 403 to `WebFetch`). That block is
policy — do **not** route around it by creating ad-hoc CI workflows. Anything
that touches the live API runs through a sanctioned workflow: the `Scrape
edfringe shows (full)` workflow, `Fetch ticket prices (one-off)`, or the
`refresh-shows` scheduled task (all on GitHub-hosted runners, under the
Claudinite scheduler).

This file is the API reference (field lists via GraphQL introspection:
`__type` / `__schema`) precisely so that nothing needs to re-fetch it. If it
doesn't answer your question, ask the repo owner.

## Operations

| query | purpose |
|---|---|
| `events(input: SearchCriteriaInput)` — "EventsSearch" | the paged listing. `per: 50`, `sortBy: TITLE`, a fixed `sortBySeed` for stable paging, `recentlyAdded: ANY \| LAST_SEVEN_DAYS \| LAST_TWENTY_FOUR_HOURS`. ~3,900 shows over ~77 pages. Returns a subset of `EventDetail`. |
| `event(id: String!, isSlug: Boolean)` | a single show. Pass the slug with `isSlug: true` (the site's URLs are slugs); pass a bare id with `isSlug` false/omitted. Returns the **full** `EventDetail`. Note `id` is **non-null** — a `$id: String` variable is rejected ("not compatible with the type of the current location"); declare `String!`. |
| `performancePrices(performanceRef: String)` | **live pricing** for one performance (see below). `performanceRef` = the performance's `boxOfficeId` (e.g. `"1:790001"`). |
| `genres` | `GenreOption { label, iconName, value }` — the 10 headline categories. |
| `subgenreOptions` | 104 `{ value, label }` subgenre tags. |
| `venues` — "VenueTypeAhead" | venue directory (name, address, postcode). |
| `priceTypes`, `ageRestrictions`, `accessibilityOptions`, `ticketStatusOptions`, `recentlyAddedOptions` | reference/enum lookups. |
| `eventReviews`, `searchEventReviews` | audience reviews per show (`audienceReviewEnabled` gates them). |
| auth-only: `login`, `me`, `account`, `basket`, `basketItems`, `tickets`, `transactionFeeInfo`, `offers`, … | booking/account flow; not used. |

## `EventDetail` — the per-show fields

The `EventsSearch` fragment pulls a subset; `event()` returns all of it.

- **Identity/refs:** `id`, `title`, `titleKeyword`, `titleSort`, `slug`, `cmsId`,
  `cmsRef`, `boxOfficeId`, `boxOfficeIds`, `boxOfficeIdsKw`, `boxOfficeRef`
- **Descriptive:** `description`, `presentedBy`, `countryName`, `purchaseInfo`,
  `duration`, `digitalShow`, `audienceReviewEnabled`
- **Classification:** `genre` (enum), `subGenre` (String), `subgenres` ([String])
- **Suitability:** `ageRestriction` (enum), `accessibility` ([enum]), `accessibilityNotes`
- **Dates/availability:** `startingDate`, `endingDate`, `datesDisplay`,
  `hasVariousStartingTime`, `onSale`, `onSaleDate`, `canceleld` *(their spelling)*
- **Pricing:** `priceType` ([enum] — flags only, **no amounts**), `freeTicketed`
- **Location:** `venues`, `spaces`, `geoLocation`, `distance`
- **Media/links:** `images`, `socialLinks`
- **Nested lists:** `performances`, `attributes`

`event()` returns richer nested objects than the search fragment — full venue
records (with their own `attributes` bag for accessibility / age / food&drink) and
per-space accessibility notes.

### Genre & subgenre

`genre` is the `Genre` enum: `COMEDY, MUSIC, THEATRE, CHILDRENS_SHOWS, CABARET,
CIRCUS, EVENTS, OPERA, SPOKEN_WORD, EXHIBITIONS` (10). `subGenre` is a comma-joined
human string whose casing is **inconsistent across shows** ("Alternative Comedy"
vs "Alternative comedy"); `subgenres` is the enum-ish list. There are **104**
canonical labels (`subgenreOptions`). `normalize.py`'s `unify_subgenre_casing`
collapses case-variants to one display casing so the lookup lands on those 104.

### `attributes[]` — the per-show key/value bag

Keyed by `attributeTypes`: `event_warnings` (content warnings, e.g. "Strong
language/swearing, Audience participation"), `age_restrictions` ("16+ (Restriction)"
vs "16+ (Guideline)"), `social_media` (facebook/instagram/tiktok/youtube/twitter/website),
`babes_in_arms` (policy + age). Venue-level `attributes` also carry `accessibility`
and `food_drink`. Content warnings and social links live **here**, not in dedicated
fields.

### `images[]`

Each has `url`, `imageType` (`"Small"` / `"Large"`), `boxOfficeId`, `cmsId`. Images
are served from `registration.edfringe.com/resource/image/<uuid>`. `normalize.py`
keeps both the Large (`image`) and Small (`smallImage`) variants, selected by
`imageType`, and stores just the trailing `<uuid>` — the client re-attaches the
host prefix.

## Performances

`performances[]` (`PerformanceMaster`): `id`, `dateTime`, `estimatedEndDateTime`,
`status`, `duration`, `notes`, `cancelled`, `soldOut`, `ticketsAvailable`,
**`ticketStatus`**, `boxOfficeId`, `boxOfficeRef`, `accessibility` ([enum]),
`badges` ({label, colour}), `concessions`.

**`ticketStatus` is the signal for "can I get a ticket".** Values seen in a full
scrape: `TICKETS_AVAILABLE`, `TWO_FOR_ONE`, `FREE_NON_TICKETED`, `FREE_TICKETED`,
`PREVIEW_SHOW`, `EVENT_SPECIFIC`, `NO_ALLOCATION_CONTACT_VENUE` (and `SOLD_OUT`
appears once tickets actually sell out; the authoritative set is
`ticketStatusOptions`). The site treats `SOLD_OUT` and
`NO_ALLOCATION_CONTACT_VENUE` as "no ticket available" (→ SOLD OUT stamp) and
everything else as available. **Do not rely on the `soldOut` boolean** — a
performance can be `soldOut: false` yet `ticketStatus: NO_ALLOCATION_CONTACT_VENUE`
(nothing to sell online). e.g. Daniel Sloss 14 Aug: `soldOut:false`,
`ticketStatus:NO_ALLOCATION_CONTACT_VENUE`.

## Pricing (the non-obvious part)

`event()` and the search results carry **no price amounts** — `priceType` is just
flags (`priceTypes`: `TWO_FOR_ONE, FREE, FRIENDS_TWO_FOR_ONE, GROUP_DISCOUNTS,
PAY_WHAT_YOU_WANT, PREVIEW`). Real money comes only from **`performancePrices`**,
per performance:

```
performancePrices(performanceRef: "1:790001")
  -> ResponseWrapperOfPerformancePriceDto { success, error, message, result }
     result: PerformancePriceDto {
       performanceId, isFromAllocation, allocationDetails,
       performancePercentageRemaining, performanceAvailabilityLevel,
       prices: [ Price ]
     }
```

`Price` (one per band): `priceBandId`, `pricetype` ("Price A"/"Price B"/…),
`priceValue`, `totalPrice`, `transactionFeesPrice`, `outsideFeesPrice`,
`feeInTicketPrice`, `description`, `priceBandReservationLevel` ("SEAT"), `seats`
(bool), **`seatPercentageRemaining`** (live), `availabilityLevel`, `hideFullPrice`,
`fees` ([{code, title, value, feeType:"HANDLING"}]), `concessions`
([{code, title, concPrice, feeExempt, …}]), `eventFeeExempt`, `handlingFeeExempt`.

Key facts:
- **There is no bulk price endpoint** — amounts are one call **per performance**.
- Price bands are typically **identical across a show's performances**, so ~one
  call per *show* gives representative pricing (still ~3,900 calls for the whole
  festival).
- `performancePrices` returns **live** availability (`seatPercentageRemaining`,
  `performancePercentageRemaining`) — real-time, not something to bake into the
  nightly static scrape.

### What the response actually looks like

Captured from `performancePrices("1:790001")` — Daniel Sloss: BITTER, 14 Aug.
Four things the field
list above doesn't tell you, each of which the extraction has to handle:

- **Amounts are JSON *strings***, not numbers: `"priceValue": "29.50"`. Parse,
  don't assume.
- **`totalPrice` equals `priceValue`.** The booking fee is broken out in
  `transactionFeesPrice` (`"1.50"`) with `feeInTicketPrice: false` — so the band
  value *is* the advertised face price and the fee is added at checkout. Don't
  read `totalPrice` as "price with fees".
- **`concessions` is dominated by a £0.00 "Personal Assistant" band** (code
  `PA`) — the companion ticket for a disabled patron's carer, present on
  essentially every show. Taking the literal cheapest concession records a
  £29.50 show as costing nothing; only concessions **above £0** are prices.
- **A sold-out performance still returns prices.** The 14 Aug performance is
  `performancePercentageRemaining: 0` /
  `ticketStatus: NO_ALLOCATION_CONTACT_VENUE` and prices come back regardless,
  so the price pass needn't pick an available performance.

The three bands ("Price A/B/C" at £29.50 / £25.00 / £22.50) were **identical
across both of that show's performances**, which is the assumption
`fetch_prices.py --sample-performances N` re-checks: it prices N performances of
a show and reports whether the bands agree.

## How the repo turns this into the site

`fetch_shows.py` → raw pages (git-ignored cache). `normalize.py` →
`data/normalized/shows.json` (master), `data/venues.json` (the shared lookup:
`{venues, rooms, genres, subgenres}`), and compact `data/days/2026-08-DD.json`
(genre/room/subgenres referenced by index into the lookup, flags as 1/0). See
[README.md](README.md) for the exact layout and the daily/full workflows.
