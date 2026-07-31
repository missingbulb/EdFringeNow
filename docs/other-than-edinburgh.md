# Taking the planner to other festivals — a first design sketch

> **Status: rudimentary.** This is a sketch, not a plan of record. Nothing here
> is committed to, no code change is proposed yet, and several sections end in a
> question rather than an answer. Its job is to make the shape of the problem
> visible — and in particular to surface the Edinburgh assumptions that are
> currently invisible because they are spelled as constants, comments and
> regexes rather than as configuration.
>
> Scope: the **planner** (`/plan`) primarily, since that is where the model
> lives; the Now page is noted where it differs.
>
> **Not to be confused with its sibling.**
> [`multi-festival-design.md`](multi-festival-design.md) is about the *other
> Edinburgh festivals* — the eight that share August with the Fringe. This
> document is about *other cities entirely*. The two share a data layer question
> and nothing else; where they overlap, that one defers to this one and vice
> versa rather than restating.

---

## 1. What the planning model actually is

Stripped of Edinburgh, the planner is four pure computations over a catalogue of
`{show → performances[]}` with venue coordinates:

| Step | Module | Depends on |
|---|---|---|
| favourites text → show IDs | `plan/lib/favourites.js` | a stable show ID and a canonical show URL |
| performances → *available* performances | `plan/lib/availability.js` | a ticket-status vocabulary |
| venue pair → travel minutes | `plan/lib/travel.js` | coordinates + a speed model |
| available performances → clash-free itinerary | `plan/lib/engine.js` | a day window, meal bands, per-day caps |
| itinerary → CSV / ICS | `plan/lib/itinerary.js` | a timezone and a wall-clock convention |

**None of that is Edinburgh-specific in principle.** "Given a set of things I
want to see, each with several showings across a date range, in venues that take
time to travel between — which can I actually fit?" is a general problem. The
earliest-finish-first greedy in `engine.js` does not know what a Fringe is.

What *is* Edinburgh-specific is everything around it: where the catalogue comes
from, what its ticket statuses are called, what a date window looks like, what
currency and language it is in, and how a user's shortlist gets into the tool.
Those are the four sections below.

---

## 2. Data accessibility — the binding constraint

This decides feasibility, and it is worse than the language problem.

### 2.1 The tiers

Any candidate festival falls into one of four tiers, and the tier — not the
festival's size — determines the cost:

- **Tier 1 — official, licensed API.** A documented feed with an access key.
  Cheap, legally clean, and stable across years.
- **Tier 2 — an undocumented but stable web API.** What edfringe.com actually
  is today: a Next.js SPA over a Tikketr GraphQL endpoint, reachable with public
  anonymous credentials (see [`scraper/SCRAPING.md`](../scraper/SCRAPING.md)).
  Workable, but it breaks without notice and carries no licence.
- **Tier 3 — HTML scraping only.** Per-festival parsers, brittle against every
  site redesign, and a per-festival maintenance burden that compounds.
- **Tier 4 — no machine-readable programme.** A PDF brochure and a paper guide.
  Not viable.

### 2.2 What we know today

Edinburgh is unusually well served, and this is easy to mistake for normal:

- **Tier 2 is already built** — the Tikketr GraphQL scrape in `scraper/`.
- **Tier 1 exists and is not currently used.** The
  [Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/documentation)
  is a free API over the official listings database for *all eleven* Edinburgh
  festivals (640,000+ performances), with `events` and `venues` endpoints and a
  self-service access key.

That second point is worked through in detail in
[`multi-festival-design.md` §5](multi-festival-design.md), and its conclusions are
taken as given here rather than re-derived. Two of them change what "Tier 1"
means for this document:

- **It is availability-blind.** The performance object carries no sold-out,
  on-sale or remaining-tickets field. Availability is the planner's *first*
  computation (`plan/lib/availability.js`) — a source without it can populate a
  catalogue but cannot drive a schedule. So Tier 1 is not simply "better than
  Tier 2"; the tiers are about *reachability of the data*, not sufficiency of it,
  and a real second city may need both a listings source and a ticketing source.
- **The licence and this repo's architecture are in tension.** Commercial use is
  permitted with attribution, but developers must not redistribute listings as
  data feeds or dumps, and applications must refresh at least every 24 hours.
  This repo commits its normalized catalogue to a public git repo and serves it
  from GitHub Pages. Whether that reads as a dump is unresolved, and it is a
  *prerequisite* for the global work rather than a detail of it: the answer
  ("client fetches a live feed" vs. "we ship a snapshot") changes the whole data
  layer, and whichever shape wins becomes the template every other city is fitted
  to.

Two smaller terms that shape the deep-link contract in §3.1: Fringe listings need
**separate approval from a Fringe review team** (development happens against a
demonstration dataset first), and show links must **deep-link to edfringe.com**.
A per-festival `showUrlPattern` is therefore a licence obligation in at least one
case, not just a convenience.

For every other candidate city, no equivalent Tier 1 source has been found.
Assume Tier 2 or Tier 3 per festival until a probe says otherwise.

### 2.3 The favourites-import problem is per-festival

The planner's front door — a shortlist you already built elsewhere — is the least
portable part of the product. Today it depends on:

- `plan/lib/favourites.js:7` — a regex hard-coded to
  `edfringe.com/tickets/whats-on/<slug>`;
- the fact that edfringe.com has favouriting at all;
- a **third-party Chrome extension** to get that list out as CSV, since no native
  export is documented.

That chain has to be re-established, festival by festival, and there is no reason
to expect it exists. A portable product probably cannot depend on it: the
in-tool search path (`plan/lib/search.js`, already built) is the one intake that
travels, and for a new festival it may have to be the *only* one.

---

## 3. Integration — what the code would need

### 3.1 A festival descriptor

The natural shape is one **festival adapter** plus one **festival descriptor**,
with the pure engine untouched. The descriptor is the config object that every
constant listed in §5 currently stands in for:

```
{
  id, name,
  city, country,
  locale, timezone, currency,
  runStart, runEnd,              // real dates, not "August 1–31"
  siteBase, showUrlPattern,      // deep-link contract
  imageHostPrefix,
  ticketStatus: { unavailable[], nonTicketed[] },
  genres[], subgenres[],         // per-festival taxonomy, not a shared enum
  travel: { modes[], speedsKmh{} },
  defaultCentre: [lat, lng],
  geocodeBounds,
}
```

Two design calls worth making early, because they are hard to reverse:

- **One descriptor per *festival*, not per *city*.** Edinburgh in August is six
  festivals with different date ranges and different data sources. If the unit is
  a city, the Adelaide/Avignon cases fit but Edinburgh itself does not.
- **Taxonomies are per-festival data, not a shared enum.** edfringe's 10 genres
  and 104 subgenres are its own vocabulary. Mapping Avignon's *théâtre / humour /
  cirque* split onto it would be a lossy translation nobody asked for. A shared
  cross-festival taxonomy is a much later problem, and probably not worth it.

### 3.2 The adapter boundary

`scraper/` becomes per-festival fetchers behind one normalizer contract, rather
than one script that knows edfringe's schema. The contract is already implicitly
defined — `data/normalized/shows.json`'s shape, decoded by `js/app.js`'s
`adaptShow` and `plan/lib/hydrate.js`'s `rehydrateShows` — but it is not written
down anywhere as a spec, and it uses **positional index encoding** against
`data/venues.json`'s global lookup lists. Any second festival forces that
implicit contract to become explicit, and the positional encoding to become
per-festival rather than global.

### 3.3 Data layout and payload

Today the planner fetches the full `data/normalized/shows.json` (~1.1 MB gzipped,
4,078 shows) on load. That is already noted as borderline in
[`plan/README.md`](../plan/README.md). Multi-festival makes it a real constraint,
and the fix is structural rather than an optimisation: data is partitioned per
festival (`data/<festival-id>/…`) and only the selected festival's file is
fetched. Which festival is selected has to come from the URL — `/plan/` becomes
`/<festival>/plan/` or `/plan/?f=<festival>` — so that a shared link opens the
right catalogue.

### 3.4 What stays untouched

`plan/lib/engine.js` should not change at all. If a festival adapter requires an
engine change, that is a signal the descriptor is missing a field.

---

## 4. Localization and translation

Four separable problems, routinely conflated:

**a. UI strings.** There is no i18n layer at all today — every label is a literal
in `plan/plan.js`, `js/app.js` and the two `index.html` files, both of which are
`<html lang="en">`. Introducing one is mechanical but touches everything, and
should happen before, not after, a second locale exists.

**b. Content strings — the hard one.** Show titles, descriptions, company names,
venue names and content warnings come from the festival, in the festival's
language. Avignon OFF is ~90% French companies; there is no English corpus to
serve. This means:

- a localized UI over French content is the *realistic* target, not a fully
  translated product;
- machine-translating descriptions is possible but is a per-show cost against
  1,780 shows and a quality risk on marketing copy;
- **search must work in the content's language.** `plan/lib/search.js` matching
  needs diacritic-insensitive normalization (`théâtre` ≈ `theatre`) and
  locale-aware collation before it is useful in French, and the same again for
  Romanian (Sibiu) or Italian (Milan).

**c. Formatting and units.** Dates (`js/app.js:2544` hard-codes `en-GB`),
24-hour vs. 12-hour clocks (Adelaide and Charleston are 12-hour cultures; the
planner's axis is 24-hour and runs to `27:00`), first day of week (the "best
Sat–Sun weekend" heuristic is not universal), and currency — `£` appears as a
literal in `plan/index.html:298`, `plan/plan.js:1588` and the `search.js` price
contract. `Intl.NumberFormat` and `Intl.DateTimeFormat` cover most of this once
a locale exists to pass them.

**d. Timezone.** `plan/lib/itinerary.js:141` hard-codes `TZID = "Europe/London"`
for ICS export. This is currently *correct and deliberate* — floating local time
is right for an on-the-ground plan — but it must become a descriptor field.
Adelaide adds a genuinely awkward case: `Australia/Adelaide` is UTC+9:30, and the
Fringe run (20 Feb – 22 Mar) **crosses a daylight-saving transition**, so a
naive wall-clock model drifts by an hour mid-festival.

**Sequencing note:** (a) and (c) are prerequisites for any non-UK festival —
including English-speaking Adelaide and Perth. (b) is what makes Avignon
expensive. So the cheapest second market is Brighton or Perth, not the closest
structural twin.

---

## 5. Edinburgh-specific assumptions currently baked in

These are the "aspects not considered" — the places where Edinburgh is spelled as
a constant rather than as config. Grouped by how hard they are to unpick.

### Hard — model-level, not just a constant

- **The calendar axis is one calendar month.** `plan/plan.js:56-59` fixes
  `YEAR = 2026`, `MONTH = "08"`, `DAYS_IN_MONTH = 31`, `FEST_START_DAY = 7`, and
  the whole grid, date-window scrubber and "pick my best dates" search iterate
  over days 1–31 of that month. **Adelaide Fringe runs 20 Feb – 22 Mar** — the
  second-largest fringe in the world breaks this on day one. Piccolo Spoleto
  (22 May – 7 Jun) and Perth (Jan–Feb) break it too. The axis has to become an
  arbitrary date range, which is a rewrite of the calendar rendering and the
  window maths, not a config swap.
- **The day axis is 09:00 → 27:00** (`plan/plan.js:70-71`), with a default day end
  of 25:00, because a Fringe evening runs past midnight and late shows fold onto
  the previous festival night. That is a real cultural property of *this*
  festival. A design-week or exhibition festival is a 10:00–18:00 opening-hours
  model with no after-midnight concept at all, and a Spanish-scheduled festival
  would push later still.
- **Every show has ticketed performances with start times.** Milan's Fuorisalone,
  the Edinburgh Art Festival and the Venice Biennale are *exhibitions* — open
  during hours, not at times. The scheduling engine has no concept of "drop in
  any time between 10:00 and 18:00, allow 45 minutes", and that is arguably the
  single largest missing capability for the non-theatre candidates.
- **Ticket-status vocabulary is Tikketr's enum.** `plan/lib/availability.js:20`
  denylists `SOLD_OUT`, `NO_ALLOCATION_CONTACT_VENUE` and friends — values from
  one ticketing platform. Another festival's platform has a different vocabulary,
  or none. The concept ("is this bookable") generalises; the strings do not.
- **The show ID is an edfringe slug.** It is the join key between favourites,
  the catalogue and deep links (`plan/lib/favourites.js:7,27`). Portability needs
  a `(festivalId, showId)` pair throughout, including in `localStorage` keys —
  otherwise a stored Edinburgh shortlist collides with an Adelaide one.

### Medium — tuned values presented as physics

- **Walking speed is Edinburgh's terrain.** `plan/lib/travel.js:18-21` dials walking
  down to ~3.33 km/h explicitly because of "Edinburgh's closes, hills, stairs and
  festival crowds", and `car: 22` km/h (`:25`) is calibrated to "the congested August city
  centre". Applied to flat, sprawling Adelaide these are simply wrong — and wrong
  in the direction that silently drops schedulable shows.
- **There is no public-transport mode.** `plan/lib/travel.js:13` offers walk/bike/
  car only, with the stated reason that honest headway-aware bus times aren't
  available. That is defensible in a compact walkable centre. In Adelaide (562
  venues), Melbourne or Montreal, transit *is* the mode, and its absence is a
  correctness problem rather than a missing nicety.
- **Crow-flies distance stands in for routing.** Fine across Edinburgh's Old Town;
  much worse across a river, a rail corridor or Venice's canals.
- **Geography defaults.** `js/app.js:23` defaults to central Edinburgh;
  `js/places.js:27,30` bounds the Nominatim geocoder to a greater-Edinburgh box
  and `inEdinburgh()` gates results by it; `shared/geo.js:12` deliberately ignores
  a real user location that is nowhere near Edinburgh. All three are correct today
  and all three actively break elsewhere.

### Easy — one-line config once a descriptor exists

- `plan/lib/itinerary.js:141` — `TZID = "Europe/London"` (but see the DST note in §4d).
- `plan/lib/itinerary.js:197` — ICS UIDs suffixed `@edfringenow.com`.
- `plan/lib/hydrate.js:13` — `IMAGE_HOST_PREFIX` pinned to `registration.edfringe.com`.
- `js/app.js:2544` — `en-GB` date formatting.
- `plan/index.html:298`, `plan/plan.js:1588`, `plan/lib/search.js:12,50` — `£`.
- `shared/affiliates.js:75` — Booking.com search hard-coded to `ss: "Edinburgh"`,
  and the Omio route pages likewise. Affiliate partners and their coverage differ
  by country, so this is easy to *parameterise* and separately a commercial
  question.

### Product-level, outside the code

- **The brand is the city.** "EdFringeNow", `edfringenow.com`, and the ICS UID
  domain all name one festival. A multi-festival product needs a different name,
  and that decision gates the domain and the deep-link contract.
- **"Two or three shows a day" and "don't fill the day"** are Fringe-culture
  advice this product's defaults encode. They may not be the right defaults for a
  design week or a jazz festival.

---

## 6. A plausible order of work

Sequenced so each step is useful on its own and none is wasted if the next is
never taken:

1. **Resolve the data-source question for Edinburgh itself** (Tier 1 official API
   vs. the current Tier 2 scrape, and whether committed static data is licence-
   compatible). This sets the pattern for everything after it.
2. **Make the calendar an arbitrary date range** instead of a fixed month. This is
   independently correct — the current data already spans 24 Jul – 31 Aug and the
   July previews fall off the axis — and it is the largest single blocker.
3. **Extract the festival descriptor** and route the constants in §5 through it,
   with Edinburgh as the only entry. No behaviour change; the diff is the point.
4. **Add an i18n layer and `Intl`-based formatting**, still English-only.
5. **Prove it with a second English festival** (Brighton or Perth) end to end,
   including the intake question — that is where the model gets tested, not the
   engine.
6. Only then consider a non-English festival, and only with the translation cost
   in §4b priced honestly.

---

## 7. What this sketch does not answer

- Whether any candidate festival has an accessible programme at all. Every
  feasibility claim above is conditional on a probe nobody has run.
- Whether the Edinburgh Festivals Listings API licence permits this repo's
  committed-static-data architecture. §2.2 raises it; it is unresolved.
- How exhibition-style events (open hours, no start times) would be modelled — the
  gap that rules out most of the non-theatre candidates as things stand.
- Whether a second festival is a second *market* or a second *product*. If the
  audiences don't overlap, most of the leverage assumed here doesn't exist.
- Anything about cost, demand or commercial viability. This is a technical sketch
  only.
