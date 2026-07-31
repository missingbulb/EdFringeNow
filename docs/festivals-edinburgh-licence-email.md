# Draft email — Festivals Edinburgh (Listings API licence questions)

> **Status:** draft, not sent. Every question below quotes the clause it asks
> about, states our reading, and asks them to confirm or correct — so it can be
> answered quickly, and a one-line "yes to all" is a valid reply.

**To:** support@api.edinburghfestivalcity.com
*(the address given on the API's Fringe-approval page; the service is operated by
Festivals Edinburgh Limited, SC331673, and managed by inGenerator)*

**Subject:** Listings API — licence questions before we build (static site, Fringe approval, availability data)

**Send when:** ideally **after the festival** (this draft is dated 31 July; the
Fringe opens 7 August and they will be at their busiest until September). Nothing
here is urgent enough to justify landing in that inbox during August.

**Before sending, fill in:** your name, and confirm the live URL is current.

---

Hello,

I'm building **EdFringeNow** (<https://missingbulb.github.io/EdFringeNow/>), a
free, non-commercial-to-use tool for Edinburgh's festivals. It has two surfaces:
a mobile page that answers "what can I actually get to right now?" from your
location, travel mode and next commitment, and a desktop planner at `/plan` that
turns a list of shows into a clash-free itinerary across chosen dates.

It currently covers the Fringe only. I'd like to extend it across all the
festivals your API carries, and the Listings API is clearly the right way to do
that — so before writing any code I'd rather check my reading of the licence with
you than guess. Questions are grouped below; each quotes the clause and states
how I've read it, so confirming or correcting should be quick.

**If you only have time for two:** questions 1 and 5 are the ones that decide
whether I can proceed at all.

## 1. Static hosting, and what counts as "redistribution"

> "You must not redistribute listings to third parties by means of either data
> feeds or data dumps." *(Type C)*

The site is entirely client-side — there is no application server. A scheduled
job would fetch from the API, derive a reduced dataset (the fields the pages
actually render), and that file would be served to visitors' browsers by a static
host, which is how the pages get their data at all.

**My reading:** this is my own application serving its own users, not
redistribution to third parties — a static file is simply the transport a
serverless site uses in place of a backend.

**Please confirm.** And one sharper sub-question: today the project is an
open-source repository, so a derived data file committed to it would be publicly
fetchable by anyone, which I can see reading as a "data dump" regardless of
intent. **Would keeping the derived data out of the public repository — generated
at deploy time and served only from the site — resolve that?** I'd rather adopt
whichever arrangement you're comfortable with than argue the edge.

## 2. Refresh cadence

> "All applications and/or associated servers check for updates from the API at
> least every 24 hours."

**My reading:** a nightly scheduled rebuild that pulls changes via
`modified_from` satisfies this.

**Please confirm** — and clarify whether the 24-hour requirement applies to my
pipeline refreshing from you, or also to how long a returning visitor's browser
may hold a cached copy (which would affect the cache headers I set).

## 3. Fringe approval — process and timing

I understand live Fringe data requires building against the `demofringe` dataset
and then submitting the app for review.

- What's the typical turnaround, and is there a time of year when it's better
  to apply?
- Who conducts the review — Festivals Edinburgh, or the Fringe Society?
- Is there anything you'd want to see in the app *before* I submit, so the first
  submission isn't wasting your reviewers' time?

## 4. The Fringe linking rule — does it extend past the Fringe?

> "All links to individual Fringe shows or events deep link to the appropriate
> URL on the edfringe.com website" … "Links relating to Fringe shows or events
> must not be made to any other ticketing site, including the venue's own site."

Two readings I'd like confirmed:

- **(a)** This is Fringe-specific. For the other festivals, we may link to that
  festival's own booking page as supplied by the API's `website` field —
  eif.co.uk for an International Festival performance, edbookfest.co.uk for a
  Book Festival event, and so on.
- **(b)** It restricts **ticketing** links only. A non-ticketing outbound link
  relating to a Fringe show — a venue's own site for opening hours or
  accessibility information, say, or an artist's website — is not caught by it.

If (b) is wrong and the restriction covers *any* outbound link on a Fringe
listing, I'd want to know before designing the card.

## 5. Combining the API with ticket-availability data

This is the question that most affects whether I can adopt the API, and I want to
be straightforward about where the product stands today.

At present I read the Fringe catalogue from the public web API behind
edfringe.com, because it carries **per-performance ticket availability** — the
sold-out and "no allocation, contact venue" states. The Listings API's
`performances` array carries `start`, `end`, `duration_minutes`, `price`,
`concession` and `price_string`, but nothing equivalent.

That matters because the product's entire promise is *"can I actually still get
into this?"*. Showing someone a show they can reach but cannot get into is worse
than showing nothing.

So:

- **(a)** If I adopt the Listings API as the catalogue, may I continue to display
  ticket availability obtained separately, alongside listings sourced from you?
- **(b)** Does approval require the Listings API be the app's **sole** source for
  a festival's data, or may it be the catalogue backbone with a narrower
  availability feed beside it?
- **(c)** Is a per-performance availability or on-sale field something you've
  considered adding? If it's on the roadmap, that changes my architecture
  considerably — and I'd guess I'm not the only developer for whom it would.

If the answer to (a) is no, I'd rather know that now than after building.

## 6. Attribution — form and placement

> "…stating in an appropriate place that data has been provided 'data provided
> courtesy of the Edinburgh Festivals Listings API' or similar including a link
> (where possible) to api.edinburghfestivalcity.com"

**My reading:** that wording, linked, in the site footer on every page plus a
fuller credit on an about/data page, satisfies "an appropriate place".

**Please confirm** — or tell me if you'd want it visible on each individual
listing rather than page-level.

## 7. The price-display condition

The Fringe approval notes say an approved app should display the `price` and
`concession` values and use the `website` field to link to edfringe.com.

**Please confirm** I've read that as a requirement rather than a
recommendation — and what you'd expect displayed where a performance carries no
price data, or is free, pay-what-you-want, or a preview.

## 8. Commercial model

The licence permits commercial applications. For the avoidance of doubt, mine is:
free to use, with **no ticket sales and no ticket commission of any kind** —
I have no arrangement with any box office and don't seek one. Any revenue would
come from accommodation and travel referral links, which are unrelated to ticket
sales and never attached to a show listing's booking action.

**Please confirm** that sits within permitted commercial use, and that such links
aren't caught by the Fringe linking restriction in question 4 (they aren't
ticketing links, but I'd rather ask).

---

Thank you — I appreciate that this is a lot of questions at once, and that a
short "yes to all except X" would be a perfectly useful answer. I'm happy to
share the site, screenshots or the data pipeline in whatever detail is useful,
and equally happy to adjust the architecture to whatever you'd prefer.

Best regards,

[Your name]
EdFringeNow — <https://missingbulb.github.io/EdFringeNow/>

---

## Notes for us (not part of the email)

- **Q1 and Q5 are the real blockers.** Q1 decides whether the current
  static-file architecture survives; Q5 decides whether the product's core
  availability promise survives adoption. Everything else is detail we can
  design around either way.
- **Q7 is a change either way.** The site currently shows only free-vs-paid,
  because the edfringe source carries no price amounts. If price display is a
  condition of approval, the API's real prices become a requirement *and* an
  upgrade.
- **Q5(a) answered "no" is a fork, not a dead end:** we would keep the edfringe
  scrape for the Fringe and use the Listings API for the other ten festivals
  only — which is close to the two-adapter architecture the design proposal
  already assumes.
- The Fringe Society is a separate organisation from Festivals Edinburgh. If
  question 3 reveals that the Fringe Society owns the approval decision, some of
  this may need re-asking of them directly.
