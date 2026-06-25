# Fringe Discover — Product & Experience Brief

> A functional brief for a designer. It describes **what the product does, who it
> serves, and what information and decisions matter** — not how today's screens
> look. Treat the current interface as one possible answer, not a constraint.
> You are free (encouraged) to reinvent the form entirely.

---

## 1. The problem we're solving

The Edinburgh Festival Fringe is overwhelming by design: roughly **3,800 shows**
across **300-plus venues**, packed into three weeks, running from morning to
past midnight. The official programme is a catalogue — brilliant if you already
know what you want and are planning days ahead. It is useless to the person
standing on a street corner with a free hour, asking the only question that
actually matters in the moment:

> **"What can I go and see *right now*, near *here*, that I'd actually enjoy —
> and still make it to wherever I have to be next?"**

Fringe Discover exists for that person. It is not a planning tool for next week;
it is a **spontaneity tool for the next hour or two.** The festival's magic is
often accidental — stumbling into a show you'd never have booked. We want to
make that accident reliable.

### Who they are
- Visitors mid-festival, on foot, often without a fixed plan.
- People with a *gap*: between a booked show and dinner, or a free afternoon.
- Locals and tourists alike who are intimidated by the size of the programme.
- Decisive in the moment, not researchers — they want **a short list of good,
  reachable options**, not 3,800 search results.

The emotional target is **"delight + relief"**: the relief of the overwhelm
lifting, and the delight of a serendipitous find that still fits their day.

---

## 2. The core idea: reachability, not search

Most listings apps answer *"what exists?"* This one answers *"what can I make?"*

Three real-world constraints collapse the giant catalogue down to a handful of
genuinely actionable options:

1. **Where I am** (my location, right now).
2. **How far I'm willing to go and how** (on foot, bike, bus, taxi — and how
   many minutes).
3. **When I next have to be somewhere else** (a later show, a dinner, a train).

A show only earns a place in front of the user if it satisfies all three: it's
within reach, it hasn't already started (or only *just* has), and seeing it
still leaves enough time to get to the next commitment. Everything else is
noise and should disappear.

This is the heart of the product. **The single most important thing the design
must communicate is "can I actually make this?"** — and ideally how much breathing
room (slack) the user has if they go.

---

## 3. What the user tells us (inputs)

Keep the ask **minimal and forgiving**. Every input should have a sensible
default so a brand-new user with zero taps already sees useful results. Inputs,
in rough priority order:

| Input | Why we need it | Notes for design |
|---|---|---|
| **Location** | The origin for every reachability calculation. | Ask for device location, but degrade gracefully to "central Edinburgh" if denied. Let users move/set it manually — a visitor might be planning their *next* stop, not where they're standing. |
| **Taste / genre** | Narrow ~3,800 shows to what they'd enjoy. | Ten festival categories (Comedy, Theatre, Music, Cabaret & Variety, Dance/Physical Theatre & Circus, Musicals & Opera, Spoken Word, Children's Shows, Exhibitions, Events). Multi-select. Consider richer notions of taste than category alone. |
| **Budget** | Some users only want free shows. | Today this is just free vs. all. Price *amounts* aren't available in the data — design around that limitation honestly. |
| **Travel mode + tolerance** | Defines the reachable radius and arrival times. | Walking, bike, bus, taxi/car — each changes how far "10 minutes" reaches. A time budget (e.g. up to 5–60 min) matters more than distance. |
| **Next commitment** *(optional but powerful)* | Turns discovery into a fittable plan: "what can I squeeze in before X?" | A time + a place (which can itself be another show, or a free-text destination like a restaurant or a train). This unlocks the app's best trick — see §5. |

**Design principle:** the user should be able to *converse* with these
constraints — nudge one, watch the world re-shape — rather than fill in a form
and submit. The constraints are a live dial, not a search box.

---

## 4. What we show the user (outputs)

For every candidate show, the underlying data gives us: **title, genre, venue
and room, address & map coordinates, start time, duration, free/paid, sold-out
status, a short blurb, and a deep link to buy.** Design decides which of these
matter when.

What the user most needs to perceive, fast:

- **Reachability verdict** — the make-or-break signal. Can I get there in time?
  Three meaningful states worth distinguishing:
  - **Comfortably reachable** (go now, you have slack).
  - **Tight / just-missed** (it's started or about to — you'd slip in late).
  - **Out of reach** (too far, too late, or it'd blow your next commitment) —
    these should mostly just *not appear*.
- **Slack / cushion** — *how much* spare time, in minutes. "Leave now, 8 min to
  spare" is more motivating and trustworthy than a yes/no.
- **Spatial context** — where it is relative to me and my reachable area. A map
  is the natural medium, but it's not the only one; the point is *orientation*,
  not cartography for its own sake.
- **Time context** — when it starts and how long it runs, framed against "now"
  and against the next commitment.
- **The hook** — title, genre, a line of blurb: just enough to make the call.
- **The action** — how to commit (buy / navigate). Buying ahead can save time at
  the door; surface that when it's relevant.

Two list-level views support different head-states:
- **"Happening now" / reachable options** — the short list of things they could
  walk to and catch. This is the payoff.
- **The plan / journey**, once a next-commitment exists — a legible "you are
  here → (optional stop) → where you need to be" timeline with the slack at each
  hop. See §5.

**What to suppress:** the full catalogue, anything unreachable, and any data we
don't actually have (don't imply precise prices or live seat counts we can't
back up).

---

## 5. The standout journey: fitting a show into a gap

The most distinctive thing this product can do is **plan a two-leg micro-journey**:

> *You are here, now* → *catch this show* → *arrive at your next commitment on time.*

When the user names a next commitment (a later show, dinner, a train), the app
should:
- Filter to only shows that **start late enough to reach** and **end early enough
  to still make the commitment.**
- Let the user pick one as an **intermediate stop**, and show the whole chain as
  a single, confidence-inspiring plan with the time cushion before each leg.
- Make it obvious when a choice is **risky** (negative slack — you'd be late) vs.
  **safe.**

This is where design can shine: turning a stressful logistics puzzle ("can I
squeeze a comedy show in before my 6:30 booking?") into a glanceable,
reassuring answer. Consider how to make the plan feel *trustworthy* — people act
on it with real time and money.

---

## 6. The moments that matter (journeys to design for)

1. **Zero-effort serendipity.** Open app → it already knows roughly where I am →
   I see a handful of nearby things starting soon → I pick one → I buy/go. The
   ideal path has *almost no input.*
2. **Tune to taste.** I only like comedy, I'm on foot with 15 minutes — narrow,
   and watch the options re-shape live.
3. **Fit it into a gap.** I have dinner at 6:30 nearby — show me what I can catch
   first, and prove to me I'll make it.
4. **Free-only browsing.** I'm budget-conscious or sampling new acts — show me
   only free shows in reach.
5. **Decide and commit.** From any option, get enough to judge it and a clean
   path to book and navigate.

---

## 7. Constraints & honesty (things the design must respect)

- **Live, time-relative truth.** Everything pivots on "now" and "my location."
  The experience is only as good as its honesty about what's still catchable.
  Stale or wrong reachability is worse than no app.
- **Data has gaps.** No ticket prices (only free/paid), no live availability
  beyond a sold-out flag, blurbs are short. Don't design UI that promises data
  we can't deliver.
- **Mobile-first, outdoors, in a hurry.** Users are on a phone, on a street, in
  sunlight, possibly with one hand and poor signal. Big targets, fast glance,
  minimal typing, resilient to a denied location prompt.
- **Approachable, not corporate.** The brand is playful and reassuring —
  "navigate the chaos, find your new favourite show." The tone should reduce
  anxiety, not add to it.

---

## 8. Open invitations for the designer

You are not bound by the current map-plus-cards layout. Worth exploring:

- Is a map even the best primary surface, or should "what can I catch" lead and
  the map play a supporting role?
- How might **taste** go beyond ten coarse genres — mood, energy, "surprise me,"
  social proof?
- Could the next-commitment planner extend to **three or more hops** — a whole
  improvised festival evening?
- How do we convey **slack and risk** at a glance, without numbers feeling cold?
- What does the **serendipity / "surprise me"** path feel like for someone who
  doesn't want to choose at all?
- How does the experience evolve as the day progresses and reachable shows shift
  hour by hour?

The brief: keep the **reachability-first** soul, ask the user for as little as
possible, and make catching an unplanned Fringe show feel effortless and a
little magical.
