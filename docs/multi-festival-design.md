# Beyond the Fringe — a multi-festival design proposal

> **Status:** proposal. No code changes accompany this document. It is written to
> be argued with, cut down, or rejected in parts — the phasing at the end assumes
> that.

## 1. The premise

The product is built on one festival. The city runs at least eight in August, and
they overlap almost completely:

| Festival | Dates 2026 | Rough scale |
|---|---|---|
| Festival Fringe | 7–31 Aug | 3,649 shows / 53,884 performances / 258 venues |
| International Festival | 7–30 Aug | 147 performances |
| Military Tattoo | 7–29 Aug (not Sun) | one show, nightly, ~9,000 seats |
| Deaf Festival | 7–16 Aug | 80+ events |
| Film Festival | 13–19 Aug | 38 features, 21 world premieres |
| Art Festival | 14–30 Aug | 40+ exhibitions, mostly free |
| Book Festival | 15–30 Aug | ~600 events |
| Fringe by the Sea | 31 Jul–9 Aug | small Fringe, **in North Berwick** |

Plus a June–July season that finishes before the Fringe opens (Hidden Door, the
Meadows Festival, Jazz & Blues, the Multicultural Festival's Carnival, Folk &
Food).

Two numbers govern every design decision below:

- **The Fringe is ~80% of August's events.** Anything ranked purely on relevance
  or proximity shows a Fringe-only city. Volume alone will bury the other seven.
- **Scarcity runs the opposite way.** A Fringe show plays ~25 times. A Book
  Festival author appears once. An EIFF screening is often a single showing. The
  events hardest to replace are exactly the ones volume ranking hides.

That inversion — abundance and scarcity pointing in opposite directions — is the
design opportunity, not a complication to be smoothed over.

## 2. The core model: two independent axes

The brief for this work was specific: *a film screening must not look like a
stand-up show*. The reason it must not is twofold, and the two reasons want
different mechanisms.

**Axis A — festival identity (who is presenting it).** A brand signal: name,
colour, mark. Purely presentational. Its job is that a user builds a mental map
of the city's festival diversity by *seeing* it repeatedly, not by reading an
about page.

**Axis B — event shape (how the event behaves in time).** Structural. It changes
what the product can truthfully promise, what the scheduler is allowed to do with
it, and what missing it costs. Six shapes cover everything found:

| Shape | Meaning | Examples | Cost of missing it |
|---|---|---|---|
| **Run** | repeats near-daily at one time, long run | Fringe, Fringe by the Sea | none — go tomorrow |
| **Season** | a handful of dated performances, times vary | EIF theatre/opera/dance | high |
| **One-off** | happens exactly once | Book Festival author events, most EIFF screenings, Jazz concerts | total |
| **Anchor** | same show nightly, one venue, sold months ahead | the Tattoo | it's a commitment, not a candidate |
| **Drop-in** | no start time — opening hours, you choose the duration | Art Festival exhibitions | none |
| **Occasion** | one dated outdoor thing, no seat, no slot | the Carnival parade, Meadows Festival, Folk & Food | total |

Only **Run** is modelled today. **One-off** and **Drop-in** break the most
assumptions: a one-off is a *point*, not a lane, and a drop-in has no start time
to be reachable in time for.

### The rule that keeps the two from fighting

> **Shape decides the silhouette and the logic. Festival decides the colour and
> the mark.**

A Book Festival one-off and an EIFF one-off share a card shape — a dated point
with a "once only" marker — but carry different festival colours. A Fringe run
and an EIF season share a festival-agnostic time-block silhouette but differ in
how many dates they offer. A drop-in exhibition looks like neither, in any
festival's colours.

This is what stops the design collapsing into either failure mode: eight
identically-shaped cards in eight paint jobs (pretty, still lies about what the
events *are*), or one shape per festival (breaks the moment a festival programmes
something unusual — and they all do; EIF runs exhibitions, the Fringe runs
free non-ticketed shows).

### On festival branding, concretely

Use the festival's **name and one colour token** per festival, plus a small
geometric mark that is *ours*, not theirs. Do **not** reproduce festival logos or
wordmarks — they are trademarks, and an unofficial aggregator reproducing eight
of them invites a takedown that costs more than the design gains. This should be
checked before shipping, not after.

## 3. The Now page

The Now page's soul is reachability, and that survives intact. Four changes, in
descending order of value:

### 3.1 The scarcity line (the highest-value addition)

Every row gains one short phrase next to the reachability verdict:

```
21:15   "Be Good!" with Paulette          🚶 6 min · Free
        Comedy · Underbelly               on again tomorrow

19:30   Ali Smith: Changing Your Mind     🚶 11 min · £14
        Book Festival · Futures Institute ⚡ only tonight
```

This is genuinely new information the Fringe-only product never needed — with one
festival, everything repeats, so scarcity carries no signal. With eight, it is
the difference between a casual choice and one worth rearranging an evening for.
It is derived, not fetched: count the event's remaining performances.

### 3.2 The drop-in answer to an empty list

Today, when nothing fits, the page says *"Nothing reachable in the next couple of
hours — widen your travel window or taste."* With the Art Festival present, the
honest answer is usually better:

> **Nothing starts in your window** — but 3 exhibitions near you are open now,
> and you can leave whenever you like.

A drop-in has no start time, so it can *never* fail the reachability test on
timing — only on distance. It is the perfect filler for exactly the gap the Now
page exists to serve, and it turns the product's worst state into a useful one.
Drop-ins should be a distinct band below the timed list, not interleaved: they
answer a different question and sorting them by start time is meaningless.

### 3.3 A festival filter card, and a deliberate anti-Fringe bias

A festival multi-select joins genre / subgenre / price / travel as a constraint
card, following the existing pattern (live per-option counts, "everything!"
reset). Default: all on.

More interesting is the **ordering**. The stated goal is that users come away
understanding Edinburgh's festival diversity — not merely that they extract
maximum value. Those are different objectives and they conflict, because pure
proximity ranking returns a Fringe-only list ~80% of the time.

**Proposal: cap consecutive same-festival rows.** Within each start-time group,
after N rows from one festival (N = 3 feels right), promote the next-best row
from a different festival. The cost is honest and should be stated in the UI copy
rather than hidden: occasionally a slightly further-away event appears above a
closer one.

This is a product-values decision, not an algorithm detail. It should be made
explicitly by a human, and it is the single place in this proposal where the
product deliberately gives up a little optimality to serve the "show them the
city" goal. It is also trivially reversible — one constant.

### 3.4 Ticket honesty across sources

The Fringe scraper gives per-performance `ticketStatus`; the cross-festival data
source has **no availability field at all** (§5). So the Fringe keeps its live
`Sold out!` stamp and other festivals cannot have one.

Do not paper over this. Non-Fringe rows carry no availability stamp and their
action reads *"Check tickets ↗"* rather than *"Book"*. Inventing parity here
would break the one thing the product brief insists on — *stale or wrong
reachability is worse than no app* — and availability is the same promise.

### 3.5 What deliberately does *not* change

The constraint cards, the reachability calculation, the map, the journey strip.
An event with a start time, a duration and coordinates flows through the existing
engine unchanged regardless of which festival issued it. That is the whole reason
this is tractable.

## 4. The planner

Correctly predicted to be the more intricate side, and it carries more value —
because scarcity is a *planning* concept. Live, you can only catch what is on
now; planning is where "this happens once, on the 19th" actually changes a
decision.

### 4.1 The grid's core assumption breaks

Today: one lane per show, marks across Aug 1–31, scrub a date window. That is
exactly right for a **Run** — the lane's density *is* the information.

A **One-off** in that grid is a lane with a single mark and 30 empty cells. Fill
a board with Book Festival events and the grid becomes a diagonal of dots: a lot
of pixels saying very little, and worse, it looks like a show with terrible
availability rather than a fixed point in time.

**Proposal: two bands on one shared date axis.**

```
  ┌ FIXED POINTS ─────────────────────────────────────────────┐
  │ ●Book        ●Film    ●Film ●Jazz          ●Book          │   ← one-offs & occasions,
  │      ▲Tattoo ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲ ▲            │      packed, not one per lane
  ├ RUNS ─────────────────────────────────────────────────────┤
  │ Paulette      ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪                   │   ← lanes, exactly as today
  │ Some Theatre    ▪▪▪▪▪▪▪▪▪▪▪▪▪▪                            │
  │ EIF Macbeth        ▪   ▪   ▪                              │
  └───────────────────────────────────────────────────────────┘
       │◄──────── date window ────────►│
```

Same axis, same scrub, same window. One-offs are constraints on the window; runs
are choices within it. Drawing them in the same visual language misrepresents
both.

### 4.2 Anchors go in first (an engine change)

`buildSchedule`'s earliest-finish-first greedy assumes candidates are fungible —
correct when every show has 25 chances. A one-off, a Tattoo ticket, or an EIF
opening night is not a candidate the greedy may drop; it is a fixed point the
rest of the day must accommodate.

The seam already exists: **forced/pinned shows**. Pins already survive the
per-day cap and the min-per-day drop, and a performance-level pin already
overrides the day window and meal breaks. A one-off is, structurally, an
**auto-pin** — the user selected the event, and the event selected its own date.

So the change is smaller than it looks: seed the schedule with the shape-derived
anchors, then run the existing greedy over the remaining runs. What genuinely
needs new work is the **diagnostics** — `placementDiagnostics` currently
attributes an unplaceable show to the control that would rescue it, and needs a
new verdict for *"two one-offs collide and no control can fix it — one has to
go."* That is a real user decision, and surfacing it well is most of the value.

### 4.3 Scarcity-weighted "Pick my best dates" (the biggest unlock)

Today the control scores each candidate window by how many favourites it catches.
Every favourite counts 1. With one festival that is fine — everything repeats, so
the score is essentially "how much of the run does this window overlap".

With eight festivals it is actively wrong. A window catching three one-offs is
worth far more than one catching three Fringe runs you could see on any other
day, yet they score identically.

**Proposal: weight each catchable event by its scarcity.**

```
weight(event) = 1 / (number of performances in the whole festival run)

  one-off (1 performance)      → 1.00
  EIF season (3 performances)  → 0.33
  Fringe run (25 performances) → 0.04
```

Sum the weights over the window instead of counting. The effect is that "pick my
best dates" stops being *"the week with the most stuff"* and becomes *"the week
where the things you cannot otherwise see are happening"* — which is what a
visitor choosing dates is actually asking. It is a handful of lines in the
scoring pass and it changes the answer completely.

Suggested UI honesty: show both numbers — *"catches 14 of your 18 — including 4
you can only see this week."* The second clause is the one that decides a trip.

### 4.4 Diversity as a stated plan property

Per the goal that users should come away understanding the city's festival
range, the plan panel should **report** diversity, not only volume:

> **9 events across 5 festivals, in 4 days**

Reporting is the safe version and should ship first. A **soft objective** —
preferring a plan that touches one more festival over one that packs one more
Fringe show — is the ambitious version, and it deserves its own decision because
it means the planner sometimes returns fewer events on purpose. Worth noting that
the widely-repeated Fringe advice already argues against pure maximisation
("don't fill the day"; the rule of thirds), so this is less heretical than it
sounds.

If it ships, it should be a visible dial (*pack my days ⟷ show me the city*),
never a hidden heuristic. A planner that silently drops a show the user selected,
for a reason they cannot see, has broken its contract.

### 4.5 Drop-ins are offered, never scheduled

An exhibition must never be allocated a block by the greedy — it has no start
time, so any block the scheduler invents is fiction.

Instead, once the plan is built, walk its **gaps**: for each gap over ~45
minutes, offer what is open then, near the venues on either side. This reuses the
travel machinery unchanged and gives leftover time real value without pretending
to schedule it.

```
  14:00  Some Theatre Show        Pleasance Dome
         ↓ 1h50 gap · 6 min walk
         ◇ 3 exhibitions open near here — all free, drop in
  16:30  Ali Smith                Futures Institute
```

### 4.6 Travel gets a mode it does not have

Venues spread well past the Old Town: Leith Theatre is a genuine 30+ minute walk,
Church Hill Theatre is ~25 minutes south, and **Fringe by the Sea is ~25 miles
away in North Berwick** — a train journey, not a walk. The haversine-plus-speed
estimate is wrong by an order of magnitude there.

The honest minimum is to mark out-of-city venues explicitly and refuse to
estimate, rather than quietly returning a plausible-looking number. A "day trip"
mode is a larger piece of work and probably should not gate the rest.

### 4.7 Exports

CSV and ICS both need `festival` and `shape` columns. A drop-in offer should
probably not emit a timed calendar event at all — an all-day note, or nothing.

## 5. Data

### 5.1 The source exists and it is official

`api.edinburghfestivalcity.com` — the **Edinburgh Festivals Listings API**, run
by Festivals Edinburgh Limited, free with a registered key, covering all 11 major
festivals (`festival` accepts `fringe, jazz, book, international, tattoo, art,
hogmanay, science, imaginate, film, mela, storytelling`). 2026 data is loaded for
every August festival.

It carries what the product needs: venue `latitude`/`longitude`, a
`performances[]` array of `{start, end, duration_minutes, price, concession,
price_string, is_at_fixed_time}`, `genre`/`genre_tags`, images, wheelchair
access, and `modified_from` for incremental sync.

Two findings worth calling out:

- **`is_at_fixed_time` is the drop-in flag.** The API already separates a timed
  performance from an open-hours one — the exact distinction §2 needs, provided
  for free.
- **It carries real prices.** The edfringe GraphQL API deliberately does not
  (only `priceType` flags), and the product brief currently apologises for that
  limitation. This would close it for seven of the eight festivals.

### 5.2 The blocker: licence versus this repo's architecture

Commercial use is explicitly permitted and attribution is required (a visible
credit and a link). But developer users **must not redistribute listings to third
parties by means of data feeds or data dumps**, and applications must refresh at
least every 24 hours.

This repo **commits its normalized catalogue to a public git repository and
serves it as a static JSON file from GitHub Pages**. Whether that reads as
"serving your own app's users" (clearly the intended pattern — the whole project
gallery works this way) or as "redistributing a data dump" is not something to
infer from a terms page. **Ask Festivals Edinburgh directly before building on
it.** This is the one genuine blocker in the proposal, and it is cheap to
resolve: one email.

Fallbacks if the answer is no: fetch client-side per user (but then the key is
public), or serve only a reduced derivative and link out for detail.

Two further Fringe-specific gates, verified against the API's own pages
(2026-07-31): live Fringe data is **approval-gated** — you build against a
randomised `demofringe` dataset and [submit the app for review](https://api.edinburghfestivalcity.com/documentation/fringe_approval) —
and the Fringe terms require that show links go **only to edfringe.com**, "not…
any other ticketing site, including the venue's own site". Both belong in the
same Phase-0 conversation with Festivals Edinburgh as the static-file question.

### 5.3 Keep the Fringe on its own scraper

The existing edfringe GraphQL scraper stays the better Fringe source:
per-performance `ticketStatus`, the 104-label subgenre taxonomy, content warnings
and age guidance, all at a fidelity the Listings API does not match. Two adapters
into one normalized schema — not a migration.

### 5.4 Schema additions

```jsonc
{
  "festival":  "book",              // festival key — drives colour, mark, filter
  "shape":     "one-off",           // run | season | one-off | anchor | drop-in | occasion
  "chances":   1,                   // performances in the whole run — drives scarcity
  "ticketing": "external",          // live | external | none  (§3.4 honesty)
  "outOfCity": false,               // suppresses walk estimates (§4.6)
  "openHours": null                 // { open, close } for drop-in shapes
}
```

`shape` is **derived at normalize time**, not fetched: `is_at_fixed_time` false →
`drop-in`; then bucket on performance count and cadence (1 → `one-off`, 2–6 →
`season`, near-daily long run → `run`, and the Tattoo is a hand-set `anchor`).
Deriving it in the pipeline rather than the client keeps both front ends and the
engine free of festival-specific special cases — which is the property that makes
the ninth festival cheap to add.

## 6. What this costs

Stated plainly, because each is a real trade:

- **The name.** "EdFringeNow", covering eight festivals, is a mismatch. Not for
  this document to decide, but it will be asked the moment this ships.
- **Fringe depth versus city breadth.** Effort spent on cross-festival shape
  handling is effort not spent on the Fringe's live-reachability edge, which is
  still the product's most distinct claim and still unmatched by competitors.
- **The availability asymmetry is permanent** until another source appears. Users
  will notice that some events say "sold out" and others say nothing.
- **A second data dependency**, on a licence we do not control and a refresh
  cadence we must honour.
- **Diversity ranking gives up optimality on purpose.** Defensible, but it must
  be a stated value, visible in the UI, not a silent thumb on the scale.

## 7. Phasing

| Phase | What | Gate |
|---|---|---|
| **0** | Put the licence questions to Festivals Edinburgh; register a key; make one real call | Blocks everything |
| **1** | Schema + adapter. Fringe only, everything `shape: "run"`. **No visible change** | The refactor is provably inert |
| **2** | Now page: festival filter, festival marks, scarcity line, drop-in empty state | The cheapest real user value |
| **3** | Planner: two-band grid, anchors, scarcity-weighted best dates, gap offers | The intricate part |
| **4** | Diversity reporting; the pack ⟷ explore dial if wanted | Values decision first |

Phase 1 is the one worth insisting on: shipping the schema change with no user-visible
effect is what proves the abstraction holds before any of it is load-bearing.

## 8. Decisions this proposal cannot make

1. **Does the licence permit our architecture?** (§5.2 — blocks phase 1.)
2. **Should ranking deliberately favour festival diversity over proximity?**
   (§3.3 — a product-values call.)
3. **Should the planner ever return fewer events to return more festivals?**
   (§4.4 — the stronger version of the same call.)
4. **Fringe depth or city breadth**, if the two compete for the next quarter.
5. **The name**, eventually.

## Sources

- [Edinburgh Festivals Listings API](https://api.edinburghfestivalcity.com/) — [events fields](https://api.edinburghfestivalcity.com/documentation/events), [venues fields](https://api.edinburghfestivalcity.com/documentation/venues), [licence](https://api.edinburghfestivalcity.com/licence), [2026 status](https://api.edinburghfestivalcity.com/status), [projects](https://api.edinburghfestivalcity.com/projects)
- [Edinburgh Festivals: What's On in 2026](https://www.edinburghfestivalcity.com/inspiration/573-edinburgh-festivals-whats-on-in-2026)
- [Edinburgh Festival 2026 dates (Data Thistle)](https://edinburghfestival.datathistle.com/festivals/)
- [Edinburgh International Festival 2026](https://www.eif.co.uk/brochure)
- [Book Festival 2026 programme — ~600 events, 41 countries](https://www.whatsoninedinburgh.co.uk/news/2026/06/16/nearly-600-writers-from-41-countries-to-gather-as-edinburgh-international-book-festival-returns-with-global-2026-programme/)
- [Film Festival 2026 programme (Screen Scotland)](https://www.screen.scot/news/2026/july/edinburgh-international-film-festival-announces-2026-programme)
- [Art Festival 2026 programme (Creative Scotland)](https://www.creativescotland.com/news-stories/latest-news/archive/2026/04/edinburgh-art-festival-reveal-2026-programme-across-the-city)
- [Military Tattoo 2026 first look](https://www.edinburghchamber.co.uk/the-royal-edinburgh-military-tattoo-unveils-a-first-look-at-the-2026-show/)
- [Edinburgh Deaf Festival 2026 (Creative Scotland)](https://www.creativescotland.com/news-stories/latest-news/archive/2026/07/fifth-edinburgh-deaf-festival---bigger-brighter-bolder-than-ever)
- [Fringe by the Sea, 31 July–9 August 2026](https://edinburghfestival.datathistle.com/festival/fringe-by-the-sea/)
