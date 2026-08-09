# The search bar (with results) — design research & behavioural spec

> **Status: research + specification only — nothing here is implemented by this
> document.** It records what the published UX research says a search control
> like ours should do, audits what the planner's `#showSearch` control already
> does (`plan/plan.js`, `plan/lib/search.js`), and specifies the target
> behaviour in enough detail that a later implementation PR can be judged
> against it line by line. Where the spec matches today's behaviour it says
> *keep*; where it doesn't, the change is listed in §10 with a priority.

---

## 1. What this control is (and is not)

The planner has one search bar, under the board body, in the same place in both
board states. It is **not a query-completion search box** (Google-style: type,
pick a query, land on a results page). It is a **picker**: the results list *is*
the destination, and the primary act is toggling a show onto the working
favourites grid via the same `applyFavourites` path a CSV upload takes. One
session typically adds several shows in a row, so the popup is a workspace the
user stays inside, not a stepping stone they pass through.

That one distinction drives most of the behaviour below, because the bulk of
published search-UX research (Baymard, NN/g) studies query completion, and a
picker legitimately deviates from it in specific, nameable places:

| Query-completion norm | This control | Why |
|---|---|---|
| Selecting a suggestion closes the popup and submits | Selecting (starring) a show **keeps the popup open**, state toggles in place | Multi-add is the normal session; closing after each star would make adding five shows five searches. Matches multi-select combobox findings — see §2.4 |
| Arrowing onto a suggestion copies its text into the field | Arrowing **never touches the field text** | Rows are shows, not queries; overwriting the query with a show title would destroy the search that found it |
| ≤10 suggestions, no scrollbar | Up to 30 rows, scrolling after ~8 | The list is a result set to browse, not a query menu to pick from — see §5.2 |

Two sibling controls are explicitly **out of scope**, with one obligation each:

- **The Now page's "Not a show? Type a place" destination lookup**
  (`js/places.js`) is a different animal — an explicit-submit geocoder over
  Nominatim, rate-limited to one request per press, returning ≤5 places. It
  must stay submit-driven (the API's usage policy forbids keystroke-driven
  requests) and is not covered here.
- **A future Now-page show search**, if one is built, should inherit this spec
  wholesale and apply the mobile deltas noted in §11 — not grow a third set of
  semantics. The price vocabulary is already shared (`shared/price.js`)
  precisely so the two pages can't disagree; search behaviour deserves the
  same treatment.

## 2. What the research says

Sources read for this doc, and the load-bearing findings from each:

### 2.1 Baymard Institute — autocomplete design patterns
([baymard.com/blog/autocomplete-design](https://baymard.com/blog/autocomplete-design))

Benchmark finding: 80% of e-commerce sites offer autocomplete, only 19% get the
details right. The nine patterns, mapped to us:

1. **Keep the list manageable** (≤10 desktop, 4–8 mobile) — we deviate
   deliberately (§5.2) but the *visible* count before scrolling should honour
   the spirit: roughly 8 rows in view.
2. **Style scope/category suggestions differently** from plain suggestions —
   our facet rows already are (icon + "Genre/Subgenre/Venue" kind label +
   "Filter to N shows" hint, tinted background, bolder title). Keep.
3. **Highlight the match** — differentiate the user's typed text from the rest
   of each row. **We don't do this today**; §5.4 specifies it.
4. **Avoid scrollbars** — deviation justified in §5.2.
5. **Reduce visual noise** — no trending searches, no ads, no thumbnails in the
   popup. We comply; keep it that way (the meta line is one muted line).
6. **Highlight the active suggestion; full keyboard support** — arrow
   navigation, Enter activates, the list **loops** at the ends. We comply,
   including the loop. One sub-point — "copy the focused suggestion's text
   into the field" — is a query-completion behaviour we deliberately reject
   (§1 table).
7. **Design for visual depth** — border/shadow so the popup reads as a layer.
   The popup has both. Keep.
8. **(Mobile) reduce competition from surrounding chrome** and
9. **(Mobile) generous spacing/hit areas** — deferred with the Now-page port
   (§11).

### 2.2 NN/g — site search suggestions
([nngroup.com/articles/site-search-suggestions](https://www.nngroup.com/articles/site-search-suggestions/))

- **Every suggestion must lead somewhere good.** "Suggested terms that return
  zero results … are worse than unhelpful." For us: a facet row must never
  offer a filter that yields zero shows, and the footer/empty states must keep
  the user moving (§7).
- **Visually separate what the user typed from what the system added** —
  reinforces Baymard #3.
- **Rich extras (thumbnails, product links) underperform** — users prefer
  scanning a plain list. Supports our one-line rows.

### 2.3 NN/g — scoped search
([nngroup.com/articles/scoped-search](https://www.nngroup.com/articles/scoped-search/))

Our facet-suggestion rows ("you typed a venue, not a show") are a scoped-search
device, so its warnings apply:

- **Never scope by default; the user must choose the scope.** We comply: a
  facet row only acts when explicitly clicked/Entered; plain Enter with no
  active row does nothing, and typing never auto-applies a filter.
- **Users overlook scope state and then think the site lacks content.** This
  is our biggest scoped-search risk: filters persist after the query is
  cleared, so a later search can be silently narrowed. §6.3 specifies the
  mitigations (badge, chip labels, filtered-state line in the popup, culprit
  naming at zero results).
- **Make un-scoping one action.** The reset link does this; zero-result rescue
  (§7.2) must too.
- NN/g would put an *unscoped* suggestion first; we put facet rows above show
  hits. §6.2 argues why the inversion is right here and what constraint keeps
  it safe (facet rows are visually loud, capped at 4, and never auto-selected).

### 2.4 W3C WAI-ARIA APG — combobox pattern
([w3.org/WAI/ARIA/apg/patterns/combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/))

The normative accessibility contract: `role="combobox"` on the input with
`aria-expanded`, `aria-controls`, `aria-autocomplete="list"`; popup list as
`role="listbox"` of `role="option"` rows; DOM focus **stays on the input** and
`aria-activedescendant` conveys the highlighted row; Down/Up move the highlight,
Enter accepts, Escape dismisses. We implement all of this today. The APG's
optional keys we adopt or reject deliberately in §6.1. One correction it forces:
`aria-selected` should mean *selection*, and ours means *highlight* while the
real selection (starred) is conveyed only by the star glyph — §8.2.

Related multi-select-combobox field findings (24a11y's screen-reader user
testing; MUI base-ui issue #3181): the popup **staying open across toggles** is
the expected multi-select behaviour, and *filtering the picked option out of the
list on selection* reads as a bug — participants thought something broke when
the list narrowed under them. Us: starring must mutate the row in place (star
fills, row tints) and never remove or reorder it. That is today's behaviour —
now it's a requirement, not an accident.

### 2.5 Typo tolerance & zero results
(Algolia/Typesense engineering guidance; Doofinder zero-results pattern survey)

- Fuzzy matching should be **bounded and ranked below exact**: allow ~1 edit
  for tokens of ≥5 characters, keep short tokens exact, never let a fuzzy hit
  outrank an exact one. §5.5 adopts exactly this shape.
- A zero-results state should **offer a way out** (loosen, correct, or browse),
  not a dead end; sites that do keep a majority of users searching. §7.2.

## 3. The workflow the control must fit

The behaviours below are in service of five concrete user journeys, in order of
frequency:

1. **Top-up**: grid exists; user remembers "that clown show"; types 3–8
   characters, stars the hit, keeps typing the next one. The popup is open for
   minutes at a time. Cost of closing the popup prematurely: high.
2. **Build-from-nothing**: no CSV; user constructs a 10–20 show list by
   alternating queries and facet browsing. Facet chips and the empty-query +
   filters "browse the slate A→Z" mode exist for this.
3. **Category pivot**: user types "cabaret"/"pleasance" meaning a *slate*, not
   a show. Facet rows catch this; picking one clears the query (text and
   filter on the same word would fight) and opens the tools so the changed
   chip is visible.
4. **Un-star**: a show already on the grid is found again and toggled off —
   the search bar is also the undo surface, hence stars must mirror the grid
   live (`syncSearchStars` on every favourites change).
5. **Check**: user searches just to confirm a show is already on the grid
   (filled star = yes). Read-only; no click happens.

And one system journey: the **descriptions sidecar** downloads lazily, so an
open result list can legitimately *deepen* under a stable query. §5.6 specifies
how that may and may not manifest.

## 4. Anatomy (names used throughout)

```
┌─ bar ──────────────────────────────────────────────────────┐
│ 🔍  [input ……………………………………………]  (⨯ clear)  [Search tools ●2] │
└────────────────────────────────────────────────────────────┘
   [tools row — 6 facet chips + reset]           (toggles open)
┌─ popup ────────────────────────────────────────────────────┐
│  ≣ Genre   Cabaret            Filter to 214 shows          │  ← facet rows (≤4)
│  ☆ Cabaret Confidential       £12 · Cabaret · Underbelly…  │  ← show rows (≤30)
│  ★ Cabaret at Midnight        Free · Cabaret · Laughing…   │     (★ = on grid)
│  …                                                         │
│  Showing 30 of 214 matches — keep typing to narrow it down │  ← footer
└────────────────────────────────────────────────────────────┘
```

Everything opens **downward** (results and tools both), because the board body
sits above the bar and must never be shoved around by the search — the "same
place in both states" promise from the planner README.

The `(⨯ clear)` affordance is **new** (§5.1, P1). Everything else exists.

## 5. Behaviour: the input and the result list

### 5.1 Typing, debounce, and clearing

- **Debounce 120 ms** after the last keystroke before recomputing. Keep. The
  search is an in-memory scan of ~4,100 records (no network), so this is a
  render-thrash guard, not a latency mask; anything ≥200 ms would make the
  list feel like it's chasing the user. Recomputation must always run against
  the input's *current* value, so a stale timer can never paint results for a
  superseded query.
- **Query normalisation**: case-folded, accent-folded (NFD strip — "cafe"
  finds "Café"), whitespace collapsed, then split into tokens. Multi-word
  queries AND across tokens. Keep (in `lib/search.js`).
- **Minimum length**: show matching runs from the **first character** (a
  one-letter query is cheap and the ranking keeps it sane); facet suggestions
  require **≥2 characters** (a single letter matches half the programme and
  would bury the show hits under four category rows). Keep both.
- **While the catalogue is still loading**, the input accepts text and does
  nothing else; the first successful load runs the pending query. Keep. No
  spinner in the popup — the popup simply doesn't open until there's something
  true to show.
- **Paste** behaves exactly like typing (it fires `input`; the debounce
  coalesces). **IME composition**: recomputing mid-composition is acceptable
  (results are advisory and non-destructive), so no `compositionstart` gating
  is required — but Enter during composition must not activate a row
  (`e.isComposing` guard). *New, P3.*
- **Clear affordance (new, P1)**: a ⨯ button at the input's right edge,
  visible whenever the input is non-empty. Click: empties the input, closes
  the popup (unless filters are active, in which case the popup re-shows the
  filtered slate — same rule as §5.7's table), returns focus to the input,
  and does **not** touch the filters. Filters have their own reset; one
  control must not silently discharge both, or NN/g's "user didn't notice the
  scope" failure gets a twin: "user didn't notice the clear also dropped
  their scope."

### 5.2 The result list: composition, caps, and the scrollbar deviation

Display order, one flat keyboard-navigable list:

1. **Facet rows** — up to **4**, only for queries ≥2 chars, only for values
   not already ticked (offering an already-on filter is a dead row), ranked
   label-prefix > word-start > substring, score ties broken genre → subgenre
   → venue (broadest first), then venue show-count (the hub above its
   satellite), then A→Z.
2. **Show rows** — up to **30**, ranked by `scoreShow`: title-prefix (4) >
   title word-start (3) > title substring (2) > company/venue hit (1) >
   description-only hit (0.5); ties A→Z. Description-only hits *extend the
   tail*, never reorder the head — a user watching the top of the list must
   not see it shuffle when the sidecar lands (§5.6).
3. **Footer** — only when matches were cut: "Showing 30 of 214 matches — keep
   typing to narrow it down." The footer is informational, never clickable
   (no "show all" — narrowing is the intended move; the empty-query browse
   mode is the enumerate-everything path).

**Empty query + active filters** → the whole filtered slate, A→Z, capped at 30
with the same footer. This is browse-by-facet mode and is the one place A→Z
beats relevance (there is no relevance without a query).

**The Baymard-≤10 deviation, justified**: Baymard's cap targets query-suggestion
menus, where each row is a *guess about intent* and ten guesses is plenty. Our
rows are *the results themselves*; capping at 10 would force re-querying to see
result 11, which is exactly the friction the picker exists to remove. So: cap
the computed list at 30 (protects render time and keeps the footer honest), cap
the **visible height at ~8 rows** (≈ Baymard's window) and scroll inside the
popup for the rest. Baymard's anti-scrollbar rule is the cost we accept; we pay
it only after the 8 best-ranked rows, and wheel/trackpad scrolling inside the
popup must never scroll the page behind it (overscroll containment).

### 5.3 Row anatomy

**Show row**: `[star] Title  meta`, one line, single click target — the star
and the row body do the same thing (toggle). Rationale (from the code's own
comment, promoted to spec): a row whose halves do different things sits one
stray click from a mistake; a picker row has exactly one meaning. The star is
still rendered as a real `<button>` with its own accessible name ("Add *Title*
to your grid" / "Remove *Title* from your grid") so assistive tech gets a
verb, but activation is row-wide.

**Meta line**, in order: price (real amount "£12" / "£22.50–£29.50" where the
price cache has one, "Free" where flagged, *omitted entirely* where unknown — a
search row is no place to advertise a gap in the price cache), genre, venue
name, typical start time. All muted, all optional, dot-separated.

**Facet row**: `[filter icon] KIND  Label  "Filter to N shows"` — styled as a
filter (tinted, bold label, kind tag), emphatically *not* as a show row
(Baymard #2). The N is computed against the catalogue with only that facet
applied, and per NN/g §2.2 a facet row with N = 0 must not be offered at all.
(Today a zero-count value can in principle surface via a name match;
suppressing it is part of P2 in §10.)

### 5.4 Match highlighting (new, P1)

Both Baymard and NN/g: show the user where their words landed. Spec:

- In **show-row titles** and **facet-row labels**, each query token's first
  match is wrapped in a highlight (bold, not colour-only). Matching runs on
  the folded text but highlights the original string (accent-insensitive
  offsets — fold and original are same-length under NFD-strip, so offsets map
  1:1).
- The **meta line is not highlighted**, even when the hit was in venue or
  company. One calm line of context beats a christmas tree (Baymard #5); the
  title highlight plus rank already communicate "why this row".
- A **description-only hit** gets no title highlight (nothing in the title
  matched). Instead the meta line gains a muted trailing `…blurb fragment…`
  containing the first matched token in context, so the row explains itself —
  otherwise a description hit looks like a false positive and erodes trust in
  the whole list.

### 5.5 Typo tolerance (new, P2)

Today: exact substring after folding, or nothing. "stnad up" finds nothing and
the empty state blames spelling in a static string. Adopt the standard bounded
shape from §2.5:

- Per token: length ≤4 → exact only; ≥5 → edit distance ≤1 (insert, delete,
  substitute, adjacent transposition) against the same folded haystacks.
- A show matched only fuzzily scores **below every exact tier** (below 0.5) —
  fuzzy extends the tail exactly as description hits do, and never reorders
  exact results.
- When exact matching found **nothing** and fuzzy found something, show the
  fuzzy results under a leading line: *"No exact matches — showing close
  spellings"*. No modal "did you mean X?" round-trip: the picker's cost of a
  wrong guess is zero (nothing is submitted), so showing beats asking.
- Facet-row matching gets the same tolerance ("cabarte" should still offer
  the Cabaret genre row — a category the user can't reach is a whole slate
  lost to a typo).

### 5.6 The list changing under a stable query

Three legitimate causes, three rules:

- **Descriptions sidecar lands** → the open search re-runs. Because
  description hits rank strictly below name hits, the visible effect is
  *appending* (and a bumped footer total), never reshuffling the head. Any
  future scoring change must preserve this invariant or gate the re-run.
- **Starring** (this tab or the grid's remove buttons) → affected rows restyle
  in place; **no re-render, no reorder, no removal** (§2.4's bug-report
  finding). The active row index survives.
- **Filter change while the popup is open** → full recompute; the active row
  resets to none (the old index would point at an unrelated row).

Nothing else may mutate an open list. In particular no periodic refresh: the
planner's catalogue is static within a session.

### 5.7 Open/close state table

| Event | Popup |
|---|---|
| Query becomes non-empty (post-debounce) | Open with results |
| Query cleared, no filters active | **Close** (nothing true to show) |
| Query cleared, filters active | Open with the filtered slate (browse mode) |
| Input focused, query or filters active | **Re-open** with a fresh run (recompute — favourites/sidecar may have moved since it closed) |
| Input focused, empty query, no filters | Stay closed |
| Escape (popup open) | Close popup only; query and filters untouched; focus stays in input |
| Escape (popup closed, query non-empty) | **Clear the query** (new, P2 — the standard Escape ladder: dismiss, then clear; never touches filters) |
| Click/tap anywhere outside `#showSearch` | Close popup (tools row keeps its open/closed state) |
| Click on a row that re-renders the list (facet pick) | Stays open — the click target is detached by the time it bubbles to `document`; the outside-click handler must ignore detached targets (today's `isConnected` guard, now spec) |
| Starring a row | Stays open |
| Tab / focus leaves the component | Close popup (Tab must move focus, never be swallowed) |
| Facet suggestion picked | Stays open, list becomes the slate, query cleared, tools row forced open, focus returned to input |

Closing the popup **never** discards state: query text, filters, and stars all
survive a close/reopen. The popup is a viewport, not a transaction.

## 6. Behaviour: keyboard, pointer, and the facet layer

### 6.1 Keyboard model

DOM focus never leaves the input; the highlight is `aria-activedescendant`
(APG). Full key table:

| Key | Popup open | Popup closed |
|---|---|---|
| Printable | Type; debounce; recompute; **highlight resets to none** | Type; opens on results |
| ↓ | Move highlight down, **wrapping** last→first (Baymard-endorsed loop; also self-correcting after an overshoot) | Re-open (rows pending) and highlight first row |
| ↑ | Move highlight up, wrapping first→last | — |
| Enter | Highlight ≥0: activate that row (star toggle / facet pick). Highlight = none: **nothing** — see below | Nothing (no form to submit) |
| Escape | Close popup | Clear query if non-empty (§5.7), else nothing |
| Home / End | **First / last row** when a highlight is active; caret-move in the input when none is (new, P3 — don't steal text-editing keys from an unengaged list) | Caret move |
| Tab | Close popup, move focus onward (to Search tools) | Move focus |
| ←/→ | Always caret movement in the input, never row navigation | Caret |

**Enter with no highlight is a no-op — deliberately.** Query-completion search
would submit; a picker has nothing to submit, and the tempting alternative
("star the top hit") turns a reflexive Enter into a silent grid mutation — the
exact "one stray click" class of mistake the single-target row exists to
prevent. A show reaches the grid only through an explicit act on a visible row.
(Revisit only if usage shows users hammering Enter expecting an add; see §12.)

Arrowing onto a row **does not copy its text into the input** (§1) and **must
not** trigger any row's side effects — highlight is inspection, Enter is
commitment.

### 6.2 Facet rows sit above show rows — the scoped-search argument

NN/g's rule is "first suggestion unscoped", because users blindly take the top
suggestion and must not land in a scope unawares. Our inversion is safe iff
three conditions hold, which therefore become requirements:

1. **Nothing auto-selects.** The top row is never pre-highlighted; Enter with
   no highlight does nothing. The user cannot fall into a facet row.
2. **Facet rows cannot be mistaken for show rows** — kind tag, icon, tint,
   and a "Filter to N shows" consequence label showing exactly what picking
   it does.
3. **The cap is small** (4) so the shows a title-typer wants are at most four
   rows down.

The inversion is worth defending because the *frequency* argument NN/g weighs
runs the other way here: "cabaret", "improv", "pleasance" as queries are
category intent nearly every time — a user wanting the specific show "Cabaret"
still finds it four rows down, but a category-intent user given show-hits-first
would star one show and never learn the slate existed.

**Picking a facet row** (click or Enter): tick the value in its facet; **clear
the query** (free text and a filter on the same word would fight — "Comedy" as
leftover text would then *narrow the Comedy slate* to shows with "comedy" in
their text); force the tools row open so the changed chip is on screen
(scope must be visible the moment it starts existing — NN/g); recompute (list
becomes the slate, A→Z); refocus the input. Venue facets key on the venue
*code*, so a pick takes every room of the venue.

### 6.3 The tools row and chips (the persistent-scope safeguards)

The six facet chips (genre, subgenre, venue, accessibility, age, price) are
specced in the planner README; this doc only pins the behaviours that protect
the search bar from NN/g's silent-scope failure:

- The **badge** on "Search tools" always shows the count of set facets, even
  with the tools row folded — filters must never be active *and* invisible.
- Each chip's label states its answer ("Cabaret", "3 genres", "Any venue"),
  and option rows carry live **counts** measured against the pool with every
  *other* facet applied — a count answers "how many shows would ticking this
  give me", so a 0 warns before the user commits (and the row styles as
  empty). An option whose data hasn't landed (accessibility; price caps
  before the price pass) shows an em-dash, never a fake 0, and the whole chip
  presents as "coming soon" rather than broken when its facet has no data at
  all.
- **Reset** clears every facet in one click and refocuses the input; visible
  only when something is set.
- **New (P2): a filtered-state line inside the popup itself.** When facets are
  active, the popup's first line (above facet rows, non-navigable) reads
  e.g. *"Searching within: Cabaret · Free — reset"*. The chips can be
  off-screen below a tall popup or behind a folded tools row; the popup is
  where the user is looking, so the scope disclosure belongs there too. The
  "reset" in that line is the same one-click un-scoping NN/g demands.
- Multi-select facets **widen** with each tick (OR within a facet), facets
  **narrow** against each other (AND across facets). Radios (age, price)
  un-pick via the panel's "everything!" link, not by re-clicking.

### 6.4 Pointer model

- **Hover tracks the highlight** (new, P2): `pointermove` over a row sets it
  active (same state as keyboard, same `aria-activedescendant`), so there is
  exactly **one** highlight at any time. Today hover paints CSS while a
  keyboard highlight can sit elsewhere — two lit rows, and Enter acts on the
  one the mouse user isn't pointing at. `pointermove`, not `pointerover`:
  a list that scrolls or re-renders under a stationary cursor must not steal
  the highlight from the keyboard.
- Click anywhere on a row activates it (§5.3). Click-away closes (§5.7).
- The popup's scrollbar and interior are inside `#showSearch`, so scrolling
  and star-clicking never count as "away".
- Cursor: pointer over rows (Baymard #6).

## 7. Empty, error, and edge states

### 7.1 The state inventory

| State | Presentation |
|---|---|
| Catalogue loading | Bar accepts text; popup stays closed; placeholder still generic. On load the placeholder gains the honest count ("Search all 4,114 shows — title, performer or venue") and any pending query runs |
| Catalogue failed | The page-level failure owns this; the bar disables with the page |
| Query, no matches, no filters | Empty panel: "No shows match '*query*' — check the spelling or try the performer or venue name." Plus fuzzy salvage per §5.5 when it finds anything |
| Query, no matches, **filters active** | **Culprit-naming rescue** — §7.2 |
| Empty query, filters match nothing | Same rescue (the filters alone are the query) |
| 1–30 matches | Rows, no footer |
| >30 matches | Rows + "Showing 30 of N" footer |

### 7.2 Zero results with filters active — name the culprit (new, P2)

Today's static "try fewer filters or a different spelling" makes the user do
the diagnosis. The planner already has the right philosophy elsewhere — the
grid's `placementDiagnostics` names the control that would rescue an unplaced
show. Apply it here:

- Re-run the search once per active facet with that facet lifted. Facets whose
  removal yields results are the culprits.
- One culprit: *"Nothing free matches 'magic' — **21 paid shows** do. [Show
  them]"* — the action un-ticks that facet.
- Multiple: *"No matches with these filters — [remove Free] (21) · [remove
  Pleasance] (14) · [reset all]"*.
- No single-facet lift helps (compound conflict): fall back to *"[reset
  filters] and search again"*.

Every zero-state must contain at least one enabled action (§2.5's finding);
"worse than unhelpful" is the bar to clear.

## 8. Accessibility

### 8.1 Already right (keep, now as requirements)

`role="combobox"` + `aria-expanded` + `aria-controls` + `aria-autocomplete=
"list"` on the input; `role="listbox"` with an `aria-label` naming *both* row
kinds ("Matching categories and shows"); `role="option"` rows with stable ids;
`aria-activedescendant` tracking the highlight; DOM focus pinned to the input;
`scrollIntoView({block: "nearest"})` on highlight moves; star buttons with
verb-carrying accessible names; facet chips as disclosure buttons with
`aria-expanded`; option counts with `aria-label`s ("214 shows") and em-dash
options labelled "no data yet".

### 8.2 Corrections and additions

- **`aria-selected` is currently the highlight, and the starred state is
  invisible to AT.** Split the two (P1): keep conveying the highlight via
  `aria-activedescendant` alone (dropping `aria-selected`-as-highlight), mark
  the listbox `aria-multiselectable="true"`, and put the *starred* state on
  the option as `aria-selected="true"`. A screen-reader user must hear
  "Cabaret at Midnight, selected" for a show already on their grid — that's
  journey 5 (§3) working without sight of the star glyph.
- **Result counts need a live region** (P1): a visually-hidden
  `role="status"` (polite) announcing, debounced with the search itself,
  "*214 shows and 2 category filters found*", "*no matches*", or the rescue
  line. Silent list changes under a stable query (§5.6) stay silent — only a
  user-initiated recompute announces.
- **Facet rows** should expose their consequence in the accessible name
  (already: "Filter to Genre Cabaret — 214 shows"); after activation the
  status region confirms *"Cabaret filter on — showing 214 shows"*, because
  the visual confirmation (chip re-label) is off-highlight for AT.
- **Highlight contrast**: the active-row tint must clear WCAG 1.4.11
  non-text contrast against the popup background; the match highlight (§5.4)
  is bold-weight, not colour-only.
- **Reduced motion**: the popup opens/closes with no animation for
  `prefers-reduced-motion` users (the planner's global rule applies; the
  popup should animate at most trivially for everyone — it opens on every
  keystroke session and any transition >100 ms would fight typing).

## 9. Performance envelope

- Search is a synchronous scan of ~4,100 records with per-show string folds.
  Budget: **< 16 ms** per recompute on a mid desktop so the debounce is the
  only intentional delay. If profiling ever breaks the budget, pre-fold the
  haystacks at hydration (space for time) before reaching for workers.
- Render caps at 34 rows (4 + 30); innerHTML-rebuild per recompute is fine at
  that size, but §5.6's star-sync path must stay a targeted class/glyph patch,
  not a rebuild.
- Zero network per keystroke — this is the property that lets us ignore
  spinners, request cancellation, and result-version races entirely. Any
  future server-side search invalidates half this doc; that's deliberate
  coupling, noted so nobody adds a "quick API call" to the input path.

## 10. Recommendation summary (the implementation queue)

**Keep (now spec, was habit):** picker semantics and stay-open toggling;
single-target rows; in-place star restyling with no reorder; facet rows above
show hits under §6.2's three conditions; wrap-around arrows; Enter-at-rest
no-op; 120 ms debounce; A→Z browse mode; description hits extending the tail;
price silence where unknown; em-dash for missing facet data; click-away with
detached-target guard; downward-only opening.

**P1 — correctness and research-mandated gaps:**
1. Match highlighting in titles and facet labels; blurb-fragment context for
   description-only hits (§5.4).
2. Split highlight from selection in ARIA; `aria-multiselectable`; starred =
   `aria-selected` (§8.2).
3. Live-region result announcements (§8.2).
4. Clear-query ⨯ button (§5.1).

**P2 — resilience of the workflow:**
5. Zero-results culprit naming with one-click rescue (§7.2).
6. Filtered-state line inside the popup with inline reset (§6.3).
7. Typo tolerance, bounded and tail-ranked, for shows and facet labels (§5.5).
8. Hover unification with the keyboard highlight (§6.4).
9. Escape ladder: second Escape clears the query (§5.7).
10. Suppress zero-count facet suggestions (§5.3).

**P3 — polish:**
11. Home/End row navigation when a highlight is active (§6.1).
12. `isComposing` guard on Enter (§5.1).
13. Visible-height cap ~8 rows with contained overscroll (§5.2).

## 11. Porting notes for a future Now-page search

Mobile deltas only — semantics identical: visible suggestions 4–8 (Baymard
mobile cap) with the facet-row cap dropping to 2; row height ≥44 px targets;
the popup must coexist with the software keyboard (open upward from a
bottom-anchored bar, or full-screen takeover — decide there, not here); "reduce
competition" means the map must not pan/zoom under an open popup. The Now
page's reachability filtering would compose as one more (implicit) facet — the
culprit-naming of §7.2 then covers "it's 11pm and nothing's left tonight",
which is that page's most common zero state.

## 12. Open questions for the owner

1. **Enter-at-rest**: keep the no-op (specced), or star the top hit when the
   result is unambiguous (exactly one match)? The spec says no-op; a
   single-match exception is defensible and cheap to add later with usage
   evidence.
2. **Facet rows above shows** — §6.2 defends the inversion, but it's a real
   NN/g deviation. Comfortable?
3. **Typo tolerance scope**: tokens ≥5 chars at distance 1 is conservative;
   Fringe titles are pun-heavy ("Shamilton", "Oedipussy") which argues *for*
   conservatism (fuzzy would blur deliberate near-words). Agree?
4. Is the **descriptions-sidecar deepening** (§5.6) worth its subtlety, or
   should search simply not consult descriptions until the sidecar has landed
   (simpler: one behaviour per session)?

## Sources

- Baymard Institute — [9 UX Best Practice Design Patterns for Autocomplete
  Suggestions](https://baymard.com/blog/autocomplete-design)
- Nielsen Norman Group — [Site Search
  Suggestions](https://www.nngroup.com/articles/site-search-suggestions/)
- Nielsen Norman Group — [Scoped Search: Dangerous, but Sometimes
  Useful](https://www.nngroup.com/articles/scoped-search/)
- W3C WAI-ARIA Authoring Practices — [Combobox
  Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- 24a11y — [`<select>` your poison part 2: test all the
  things](https://www.24a11y.com/2019/select-your-poison-part-2/) (screen-reader
  user testing of multi-select comboboxes)
- MUI base-ui — [issue #3181: popup closes when list is filtered in
  `multiple`](https://github.com/mui/base-ui/issues/3181)
- Algolia — [Search UX best practices and
  pitfalls](https://www.algolia.com/blog/ux/how-to-streamline-your-search-ux-design);
  Typesense — [What is fuzzy search?](https://typesense.org/learn/fuzzy-search/)
- Doofinder — [No-results page examples & best
  practices](https://www.doofinder.com/en/blog/no-search-results-page)
