# EdFringeNow — executable UI/UX requirements

What the site's front-ends must render and how they must behave — Part I the
**Now** page, Part II the **Plan** page, then the rules both follow, the trip
planner prototype, and the Jerusalem festival planner. Each numbered leaf is
proven by exactly one executable case; the image under a leaf **is** its
expected rendering, cropped to just what that leaf asserts.

<details><summary>How this document works</summary>

The feature-level story of what the product is and why lives in
[docs/product-spec.md](../docs/product-spec.md); this document holds only
statements a test can prove.

Every leaf is executed by exactly one case under
[product/requirements/](requirements/) — see its
[README](requirements/README.md) for the framework: kinds, runners, goldens,
the coverage gate, and how to add or change a requirement. The committed
golden images and coded assertions are the **owner's approval record**: an
agent may propose a new expected, but never changes a committed one to make a
red case pass — on a mismatch it surfaces actual vs expected and asks.

**Numbering.** Every leaf carries a stable id (e.g. `6.4`). Add new
requirements under new numbers; never renumber or reuse a retired one. Each
leaf has exactly one case named `<slug>.<id>.case.js`; the case's *kind* is the
folder it lives in (`screen/` — a pixel-exact golden cropped to the leaf's
scope; `behavior/` — a driven gesture asserted in code; `logic/` — a pure rule
proved against the shipped module). The line under each leaf tagged
`req-gallery` is machine-managed (the gallery generator rewrites it); the prose
is hand-authored.

**The reference moment.** Visual cases render at **Sat 15 Aug 2026, 19:30**
Edinburgh time, from a fixed fake location in central Edinburgh, against the
frozen fixture dataset ([requirements/shared/reference-now.js](requirements/shared/reference-now.js)).
</details>

> ⚠️ **A green build means "claimed", not "fully verified".** The visual cases
> render the real pages in a real (headless, pinned) Chromium, but the network
> is faked from committed fixtures, external links are asserted as URLs and
> never followed, real geolocation/GPS/device clocks are substituted with fixed
> fakes, and downloads are read back as bytes rather than imported anywhere.
> The fixture dataset is a frozen, curated snapshot of the real committed data
> — provenance and its two documented adjustments in
> [requirements/shared/fixtures/build-fixtures.js](requirements/shared/fixtures/build-fixtures.js).

---

# Part I — the Now page

## 1. Page chrome

- `1.1` The desktop header: logo, centred **Now | Plan** nav with **Now** active, location button.

  ![now-chrome.1.1](requirements/screen/cases/now-chrome.1.1.png) <!-- req-gallery:1.1 -->

  <details><summary>Notes</summary>

  The logo reads `EdFringe` + red `Now`; the nav links are `Now` (`./`, active) and `Plan` (`plan/`); the location button carries `aria-label="Use my location"`. Header is sticky, white, 64px.
  </details>

- `1.2` Below 860px the nav is gone — logo and location button only.

  ![now-chrome.1.2](requirements/screen/cases/now-chrome.1.2.png) <!-- req-gallery:1.2 -->

  <details><summary>Notes</summary>

  Golden renders the whole resting page at the 390px reference viewport: no nav links between the logo and the location button.
  </details>

- `1.3` The footer: tagline, copyright, commission disclosure, quick and legal links.

  ![now-chrome.1.3](requirements/screen/cases/now-chrome.1.3.png) <!-- req-gallery:1.3 -->

  <details><summary>Notes</summary>

  Disclosure text: `Booking links on plans (tables, trains, stays, tours) may earn us a small commission, at no extra cost to you.` Quick Links column: `Contact Us` (mailto:support@edfringenow.com), `Privacy Policy`; Legal column: `Accessibility`, `Terms of Use`.
  </details>

- `1.4` The footer's copyright line opens a small popup carrying the version.

  ![now-chrome.1.4](requirements/screen/cases/now-chrome.1.4.png) <!-- req-gallery:1.4 -->

  <details><summary>Notes</summary>

  A real in-page element, not a native `title` tooltip — the browser paints those
  itself, so nothing could ever show one to you here. It opens on hover, on focus
  and on tap, closes on Escape, and carries no help cursor.
  </details>

- `1.5` The **debug pill** appears only when geolocation reports a position outside the UK.

  - `1.5.1` Outside the UK, the header carries the debug pill.

    ![now-chrome.1.5.1](requirements/screen/cases/now-chrome.1.5.1.png) <!-- req-gallery:1.5.1 -->

    <details><summary>Notes</summary>

    The app also keeps its own simulated clock in this state — it adopts the
    device clock only on an in-UK fix — which is why the pill's tools offer a
    simulated "now".
    </details>

  - `1.5.2` In the UK — or with no location at all — no pill.

    ![now-chrome.1.5.2](requirements/screen/cases/now-chrome.1.5.2.png) <!-- req-gallery:1.5.2 -->

## 2. First-run explainer

- `2.1` A first-time visitor meets the explainer.

  ![now-intro.2.1](requirements/screen/cases/now-intro.2.1.png) <!-- req-gallery:2.1 -->

  <details><summary>Notes</summary>

  Steps, verbatim: **Say when you next have to be somewhere.** A show, dinner, a train. / **We work out how far that leaves you.** On foot, bike, bus or taxi. / **Pick something you can make** — and still get to your next thing.
  </details>

- `2.2` Dismissing the explainer hides it, and a reload keeps it hidden.

  ![now-intro.2.2](requirements/screen/cases/now-intro.2.2.png) <!-- req-gallery:2.2 -->

  <details><summary>Notes</summary>

  An animated golden: the same page-top region shown, dismissed, and after a
  reload. Remembered in `localStorage` under a key of its own, so clearing a
  stale plan never brings the explainer back.
  </details>

## 3. The next-commitment card

- `3.1` With no commitment, a faded plan skeleton under **Tap to set constraints**.

  ![now-commitment.3.1](requirements/screen/cases/now-commitment.3.1.png) <!-- req-gallery:3.1 -->

- `3.2` The open card: wheels at now + 2 hours, a live count, the pick list, a place input.

  ![now-commitment.3.2](requirements/screen/cases/now-commitment.3.2.png) <!-- req-gallery:3.2 -->

  <details><summary>Notes</summary>

  At the reference moment the wheels read `21:30` and the count line reads `2` `shows start at 21:30`; each pick row shows radio, title, venue, genre` · `price. The Find button is disabled while the place input is empty.
  </details>

- `3.3` A minute nothing starts on offers the nearest times instead.

  ![now-commitment.3.3](requirements/screen/cases/now-commitment.3.3.png) <!-- req-gallery:3.3 -->

- `3.4` Picking a show closes the picker and swaps the intake card for the plan.

  ![now-commitment.3.4](requirements/screen/cases/now-commitment.3.4.png) <!-- req-gallery:3.4 -->

  <details><summary>Notes</summary>

  An animated golden: the same card region before and after the pick — the open
  picker, then the plan, with no intake and no open panel.
  </details>

- `3.5` ⚠️ **UNDER-SPECIFIED** — typed-place results: matches around Edinburgh, then a keep-as-note row.

  ![now-commitment.3.5](requirements/screen/cases/now-commitment.3.5.png) <!-- req-gallery:3.5 -->

  <details><summary>Notes</summary>

  The fixture geocoder answers three hits; the out-of-Edinburgh one is dropped, so the list shows 🍽️ The Witchery by the Castle and 🚆 Edinburgh Waverley, then the 📝 note row.
  </details>

- `3.6` An unreachable geocoder says so — the page’s only error message.

  ![now-commitment.3.6](requirements/screen/cases/now-commitment.3.6.png) <!-- req-gallery:3.6 -->

- `3.7` The time wheel.

  - `3.7.1` Minutes step by five.

    ![now-commitment.3.7.1](requirements/screen/cases/now-commitment.3.7.1.png) <!-- req-gallery:3.7.1 -->

  - `3.7.2` It opens at now + 2 hours.

    ![now-commitment.3.7.2](requirements/screen/cases/now-commitment.3.7.2.png) <!-- req-gallery:3.7.2 -->

  - `3.7.3` It ends at 29:55 — the last slot of the fringe day, shown as 05:55.

    ![now-commitment.3.7.3](requirements/screen/cases/now-commitment.3.7.3.png) <!-- req-gallery:3.7.3 -->

    <details><summary>Notes</summary>

    The fringe day ends at 06:00, so the wheel stops five minutes short of it;
    hours past midnight display as 00–05 while the value stays extended (29:55).
    </details>

## 4. The plan strip

- `4.1` A committed destination renders the plan: you, the walk, the commitment.

  ![now-plan-strip.4.1](requirements/screen/cases/now-plan-strip.4.1.png) <!-- req-gallery:4.1 -->

  <details><summary>Notes</summary>

  Leg minutes are never shown below 1. Each of the stop/destination nodes carries `Change ▾` and `×` controls.
  </details>

- `4.2` Spare time before the commitment offers what would fit in it.

  ![now-plan-strip.4.2](requirements/screen/cases/now-plan-strip.4.2.png) <!-- req-gallery:4.2 -->

  <details><summary>Notes</summary>

  "fits" when n = 1, "fit" otherwise; the link smooth-scrolls to the list.
  </details>

- `4.3` A show slipped into the plan shows its slack and a buy-ahead link.

  ![now-plan-strip.4.3](requirements/screen/cases/now-plan-strip.4.3.png) <!-- req-gallery:4.3 -->

  <details><summary>Notes</summary>

  A free show renders no buy link; a sold-out one renders a `Sold out` pill instead (see `6.4` for the list-side stamp).
  </details>

- `4.4` A show that would make you late wears the **You’ll be late** chip.

  ![now-plan-strip.4.4](requirements/screen/cases/now-plan-strip.4.4.png) <!-- req-gallery:4.4 -->

- `4.5` The buy-ahead link opens **`https://www.edfringe.com/tickets/whats-on/<slug>`** in a new tab.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:4.5 -->

  `href` equals the pattern with the show's own slug; `target="_blank"`, `rel` includes `noopener`.
  </details>

- `4.6` **Open in Maps** builds a Google Maps directions URL from the user's location to the commitment, in the chosen travel mode, adding the slipped-in show as a waypoint.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:4.6 -->

  `https://www.google.com/maps/dir/?api=1&origin=<lat,lng>&destination=<lat,lng>&travelmode=walking|driving|bicycling` + `&waypoints=` when a leg show is set.
  </details>

- `4.7` Removing one part of the plan leaves the other.

  - `4.7.1` The ✕ on the commitment clears it and keeps the show you picked.

    ![now-plan-strip.4.7.1](requirements/screen/cases/now-plan-strip.4.7.1.png) <!-- req-gallery:4.7.1 -->

  - `4.7.2` The ✕ on the show clears just the show.

    ![now-plan-strip.4.7.2](requirements/screen/cases/now-plan-strip.4.7.2.png) <!-- req-gallery:4.7.2 -->
- `4.8` Durations are phrased for humans.

  <table><thead><tr><th align="left">Minutes</th><th align="left">Reads</th></tr></thead><tbody><tr><td>1</td><td>1 minute</td></tr><tr><td>45</td><td>45 minutes</td></tr><tr><td>60</td><td>1 hour</td></tr><tr><td>80</td><td>1 hour and 20 minutes</td></tr><tr><td>120</td><td>2 hours</td></tr><tr><td>150</td><td>about 2½ hours</td></tr><tr><td>200</td><td>about 3½ hours</td></tr><tr><td>-5</td><td>(nothing)</td></tr></tbody></table> <!-- req-gallery:4.8 -->
## 5. Filters

- `5.1` The genre panel: ten genres, each counted, with an **everything!** hatch.

  ![now-filters.5.1](requirements/screen/cases/now-filters.5.1.png) <!-- req-gallery:5.1 -->

  <details><summary>Notes</summary>

  The ten genres, in order: Cabaret and Variety, Children's Shows, Comedy, Dance, Physical Theatre & Circus, Events, Exhibitions, Music, Musicals and Opera, Spoken Word, Theatre. A zero-count row fades. Counts are measured with every filter applied *except* the panel's own.
  </details>

- `5.2` The subgenre panel offers only what the other filters leave standing.

  ![now-filters.5.2](requirements/screen/cases/now-filters.5.2.png) <!-- req-gallery:5.2 -->

- `5.3` The price panel: the shared ladder, each step counted.

  ![now-filters.5.3](requirements/screen/cases/now-filters.5.3.png) <!-- req-gallery:5.3 -->

- `5.4` The travel panel: three modes with their speeds, and a 1–60 minute budget.

  ![now-filters.5.4](requirements/screen/cases/now-filters.5.4.png) <!-- req-gallery:5.4 -->

- `5.5` Each chip says what it is set to.

  ![now-filters.5.5](requirements/screen/cases/now-filters.5.5.png) <!-- req-gallery:5.5 -->
- `5.6` **everything!** ticks them all, then flips to **nothing!** and clears them.

  ![now-filters.5.6](requirements/screen/cases/now-filters.5.6.png) <!-- req-gallery:5.6 -->
- `5.7` Price filtering is honest about unknowns: caps are inclusive (`£10` keeps a £10 show), **Free** means exactly £0, and a show with no known price matches no cap — never smuggled in under one.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:5.7 -->

  `shared/price.js` `matchesPrice` / `showPrice`.
  </details>

## 6. View switch and the show list

- `6.1` One selector for view and order: **Closest / Soonest / Map**.

  ![now-list.6.1](requirements/screen/cases/now-list.6.1.png) <!-- req-gallery:6.1 -->

- `6.2` With a commitment the heading counts what still fits, and cards say **fits**.

  ![now-list.6.2](requirements/screen/cases/now-list.6.2.png) <!-- req-gallery:6.2 -->

  <details><summary>Notes</summary>

  Without a commitment the heading reads `<n> shows you could wander into right now` and only shows starting within the next two hours are listed (singular `show` when n = 1). Card anatomy: genre in red caps, serif title, venue, subgenre tags; right column start time, `🚶 N min · <price>`.
  </details>

- `6.3` **Soonest** groups the same cards under their start times.

  ![now-list.6.3](requirements/screen/cases/now-list.6.3.png) <!-- req-gallery:6.3 -->

- `6.4` A show with no online tickets is stamped **SOLD OUT!** and dims.

  ![now-list.6.4](requirements/screen/cases/now-list.6.4.png) <!-- req-gallery:6.4 -->

  <details><summary>Notes</summary>

  "No online tickets" is decided by `ticketStatus` ∈ {SOLD_OUT, NO_ALLOCATION_CONTACT_VENUE}; unknown status counts as available; the `soldOut` boolean is display-only and never trusted.
  </details>

- `6.5` A show you’d reach just after it starts is stamped **TOO LATE!** and dims.

  ![now-list.6.5](requirements/screen/cases/now-list.6.5.png) <!-- req-gallery:6.5 -->

  <details><summary>Notes</summary>

  Travel time is straight-line (haversine) at the mode's speed; with a commitment set, tight shows are hidden too — only shows you fully make are offered.
  </details>

- `6.6` A card is exact about price: **Free**, **£N**, or **Price TBC**.

  ![now-list.6.6](requirements/screen/cases/now-list.6.6.png) <!-- req-gallery:6.6 -->

- `6.7` Nothing reachable, and the list says what would help.

  ![now-list.6.7](requirements/screen/cases/now-list.6.7.png) <!-- req-gallery:6.7 -->

- `6.8` Nothing fits before the commitment, and the list says what would help.

  ![now-list.6.8](requirements/screen/cases/now-list.6.8.png) <!-- req-gallery:6.8 -->

- `6.9` The list pages by twelve.

  ![now-list.6.9](requirements/screen/cases/now-list.6.9.png) <!-- req-gallery:6.9 -->

- `6.10` **Show more** appends the next page.

  ![now-list.6.10](requirements/screen/cases/now-list.6.10.png) <!-- req-gallery:6.10 -->

- `6.11` Tapping a card slips the show into the plan; tapping again takes it out.

  ![now-list.6.11](requirements/screen/cases/now-list.6.11.png) <!-- req-gallery:6.11 -->

## 7. The map

- `7.1` The map: you, how far you can reach, and a pin per show.

  ![now-map.7.1](requirements/screen/cases/now-map.7.1.png) <!-- req-gallery:7.1 -->

  <details><summary>Notes</summary>

  OpenStreetMap tiles (faked in the harness), attribution visible. Pins carry the genre emoji; sold-out/tight pins dim.
  </details>

- `7.2` A commitment draws the route, ending on the deadline you beat.

  ![now-map.7.2](requirements/screen/cases/now-map.7.2.png) <!-- req-gallery:7.2 -->

  <details><summary>Notes</summary>

  With a slipped-in show the route runs you → show → commitment (two legs); unrelated pins dim to 0.25.
  </details>

- `7.3` Tapping a pin on the map.

  - `7.3.1` It selects that show.

    ![now-map.7.3.1](requirements/screen/cases/now-map.7.3.1.png) <!-- req-gallery:7.3.1 -->

  - `7.3.2` The page does not scroll — unlike tapping a card in the list.

    <details><summary>Proof</summary>

    🚩 _Behavior leaf._ <!-- req-gallery:7.3.2 -->

    A scroll position is not something a picture of the map can show.
    </details>
# Part II — the Plan page

## 9. Page chrome and board states

- `9.1` The planner’s chrome: **Plan** active, the title, the count, the footer.

  ![plan-chrome.9.1](requirements/screen/cases/plan-chrome.9.1.png) <!-- req-gallery:9.1 -->

  <details><summary>Notes</summary>

  Footer: `Fringe Planner · © 2026 Missing Bulb` + the partner-links disclosure; the © carries the `EdFringeNow v<version>` tooltip.
  </details>

- `9.2` The empty board is the favourites dropzone, search bar beneath it.

  ![plan-chrome.9.2](requirements/screen/cases/plan-chrome.9.2.png) <!-- req-gallery:9.2 -->

- `9.3` A catalogue that won’t load says so, and offers a retry.

  ![plan-chrome.9.3](requirements/screen/cases/plan-chrome.9.3.png) <!-- req-gallery:9.3 -->

- `9.4` **Try again** recovers to the working page.

  ![plan-chrome.9.4](requirements/screen/cases/plan-chrome.9.4.png) <!-- req-gallery:9.4 -->
- `9.5` With shows on the board, the count line reports planned out of selected.

  ![plan-chrome.9.5](requirements/screen/cases/plan-chrome.9.5.png) <!-- req-gallery:9.5 -->

## 10. Favourites intake

- `10.1` Uploading the edfringe.com favourites CSV.

  - `10.1.1` It fills the board with every favourite the catalogue knows.

    ![plan-favourites.10.1.1](requirements/screen/cases/plan-favourites.10.1.1.png) <!-- req-gallery:10.1.1 -->

  - `10.1.2` The board survives a reload.

    ![plan-favourites.10.1.2](requirements/screen/cases/plan-favourites.10.1.2.png) <!-- req-gallery:10.1.2 -->

  - `10.1.3` The list is kept for three days.

    <details><summary>Proof</summary>

    🚩 _Behavior leaf._ <!-- req-gallery:10.1.3 -->

    A retention window is a property of stored data over time — no rendering of
    the board can show it.
    </details>
- `10.2` A file that isn’t a CSV is refused.

  ![plan-favourites.10.2](requirements/screen/cases/plan-favourites.10.2.png) <!-- req-gallery:10.2 -->

- `10.3` A CSV carrying no show links is refused.

  ![plan-favourites.10.3](requirements/screen/cases/plan-favourites.10.3.png) <!-- req-gallery:10.3 -->

- `10.4` Favourites from a previous Fringe are refused.

  ![plan-favourites.10.4](requirements/screen/cases/plan-favourites.10.4.png) <!-- req-gallery:10.4 -->

- `10.5` A failed upload leaves an existing board untouched.

  ![plan-favourites.10.5](requirements/screen/cases/plan-favourites.10.5.png) <!-- req-gallery:10.5 -->
- `10.6` The favourites parser reads real exports: quoted RFC-4180 cells, `""` escapes, any line ending, BOM; every cell is scanned for `edfringe.com/tickets/whats-on/<slug>` URLs, de-duplicated in first-seen order; a link-less file falls back to a plain list of URLs or bare slugs.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:10.6 -->

  `plan/lib/favourites.js`.
  </details>

- `10.7` **Clear** asks before it wipes.

  ![plan-favourites.10.7](requirements/screen/cases/plan-favourites.10.7.png) <!-- req-gallery:10.7 -->
## 11. The show search

- `11.1` The search bar invites the whole catalogue.

  ![plan-search.11.1](requirements/screen/cases/plan-search.11.1.png) <!-- req-gallery:11.1 -->

- `11.2` A result row: star, title, price · genre · venue · time; a capped list says so.

  ![plan-search.11.2](requirements/screen/cases/plan-search.11.2.png) <!-- req-gallery:11.2 -->

- `11.3` A query naming a category offers the category first.

  ![plan-search.11.3](requirements/screen/cases/plan-search.11.3.png) <!-- req-gallery:11.3 -->

- `11.4` Nothing matches, and the search says so.

  ![plan-search.11.4](requirements/screen/cases/plan-search.11.4.png) <!-- req-gallery:11.4 -->

- `11.5` Search tools: six facets, each option counted, each clearable.

  ![plan-search.11.5](requirements/screen/cases/plan-search.11.5.png) <!-- req-gallery:11.5 -->

  <details><summary>Notes</summary>

  Age options: `0+ only`, then `Up to 3+/5+/8+/12+/14+/16+`. Price options are the shared ladder (`8.5`). An option with no data shows an em dash and is disabled.
  </details>

- `11.6` The star adds the show to the grid or lifts it off, from the search row itself.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:11.6 -->
  </details>

- `11.7` Clicking or tabbing away from the search clears the typed text and closes the results — but keeps the facet filters, which live on the tools line (with facets active the popup stays as the filtered browse list).

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:11.7 -->
  </details>

- `11.8` Ranking is deterministic and accent-blind: title prefix beats word-boundary beats anywhere-in-title beats performer/venue beats description-only; multi-word queries must land every word; ties break A→Z.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:11.8 -->

  `plan/lib/search.js`.
  </details>

## 12. The day grid

- `12.1` The grid: a lane per favourite, a mark per performance, a verdict per row.

  ![plan-grid.12.1](requirements/screen/cases/plan-grid.12.1.png) <!-- req-gallery:12.1 -->

- `12.2` The legend names every mark.

  ![plan-grid.12.2](requirements/screen/cases/plan-grid.12.2.png) <!-- req-gallery:12.2 -->

  <details><summary>Notes</summary>

  The colours are edfringe.com's own day-picker palette; gold ("In your plan") is the only mark the grid draws itself.
  </details>

- `12.3` A mark’s day card: the show, the date, each performance and its status.

  ![plan-grid.12.3](requirements/screen/cases/plan-grid.12.3.png) <!-- req-gallery:12.3 -->

  <details><summary>Notes</summary>

  Status notes: `locked into your plan` / `in your plan` / the status prose (`tickets available`, `sold out`, `free`, …). Hint: `Click a mark to lock that performance in` (or `Click the locked mark to unlock it`).
  </details>

- `12.4` Clicking a mark locks that exact performance into the plan (gold, 🔒); clicking the locked mark unlocks it.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:12.4 -->
  </details>

- `12.5` Clicking a show's name pins the whole show — the plan must include it, whichever performance fits; its other marks wear a dashed gold outline.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:12.5 -->
  </details>

- `12.6` The row's ✕ removes the show; removing the last one returns the board to the intake.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:12.6 -->
  </details>

## 13. The date window

- `13.1` The window rail: **From** and **To** over a dimmed outside.

  ![plan-window.13.1](requirements/screen/cases/plan-window.13.1.png) <!-- req-gallery:13.1 -->

- `13.2` A window handle moves by keyboard: ←/→ shift it a day, and the flags and ARIA values follow.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:13.2 -->
  </details>

- `13.3` The optimizer picks the best dates for you.

  ![plan-window.13.3](requirements/screen/cases/plan-window.13.3.png) <!-- req-gallery:13.3 -->

  <details><summary>Notes</summary>

  Best-scoring: most weekend days covered first (when ticked), then most favourites with an available performance, then most available performances.
  </details>

## 14. Scheduling rules

- `14.1` A performance is bookable only when its ticket status says so: sold-out, off-sale, cancelled, postponed, no-allocation **and blank/unknown** all count unavailable; offer statuses (2-for-1, pay-what-you-want) stay bookable.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.1 -->

  `plan/lib/availability.js` `isAvailable` / `UNAVAILABLE_STATUSES`.
  </details>

- `14.2` A slot must fit the day: it starts no earlier than the day start and ends no later than the day end.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.2 -->
  </details>

- `14.3` A slot must not overlap an enabled meal break — touching it edge-to-edge is fine.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.3 -->
  </details>

- `14.4` Between two shows the plan demands `max(chosen gap, travel time)` — travel only *adds* time when it exceeds the gap; a double bill at the same venue needs no travel at all; unknown coordinates fall back to the flat gap.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.4 -->

  `plan/lib/engine.js` `requiredGapMinutes` / `compatible`.
  </details>

- `14.5` Travel time is straight-line at honest August speeds: walk 3.33 km/h (Edinburgh hills and crowds), bike 15, car 22.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.5 -->

  `plan/lib/travel.js`.
  </details>

- `14.6` Pinned shows plan first: an exact pinned performance is taken even against day hours and meal breaks; a must-see can never overlap another must-see; pins ignore the per-day cap.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.6 -->
  </details>

- `14.7` Everything else is packed greedily, earliest finish first, with fully deterministic tie-breaks — the same inputs always give the same plan.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.7 -->
  </details>

- `14.8` A day left holding fewer shows than the per-day minimum is dropped whole — unless a pinned show sits on it.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.8 -->
  </details>

- `14.9` Shows past midnight belong to the evening before: a start before 06:00 is folded onto the previous festival day (+1440 minutes), and window membership is judged on that festival date.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.9 -->
  </details>

- `14.10` No day is packed past the per-day maximum (except by pins).

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.10 -->
  </details>

## 15. Preferences and the schedule

- `15.1` The preferences strip, and what it defaults to.

  ![plan-preferences.15.1](requirements/screen/cases/plan-preferences.15.1.png) <!-- req-gallery:15.1 -->

  <details><summary>Notes</summary>

  Day end accepts up to `27:00` (03:00) — which is why it's a text box, not a native time input. Mode tooltips explain travel is used only when longer than the gap.
  </details>

- `15.2` The schedule: every planned day on one axis, coloured by availability.

  ![plan-preferences.15.2](requirements/screen/cases/plan-preferences.15.2.png) <!-- req-gallery:15.2 -->

  <details><summary>Notes</summary>

  Hours past midnight keep counting (`24:00`, `25:00`, …) so the night reads as one evening. Empty days collapse to slivers. Blocks link to edfringe.com; plain click pins instead.
  </details>

- `15.3` Every row carries an honest verdict.

  ![plan-preferences.15.3](requirements/screen/cases/plan-preferences.15.3.png) <!-- req-gallery:15.3 -->

  <details><summary>Notes</summary>

  Sold-out wins over no-dates (a different window won't help). A pinned row's pill is preceded by 🔒.
  </details>

- `15.4` A conflict explains itself in your own numbers.

  ![plan-preferences.15.4](requirements/screen/cases/plan-preferences.15.4.png) <!-- req-gallery:15.4 -->

- `15.5` A setting that shuts shows out says how many.

  ![plan-preferences.15.5](requirements/screen/cases/plan-preferences.15.5.png) <!-- req-gallery:15.5 -->

  <details><summary>Notes</summary>

  A control is culpable only if relaxing it alone would free at least one performance.
  </details>

- `15.6` There is no Plan button: nudging any preference re-plans instantly.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:15.6 -->

  Editing the day-end box immediately changes the schedule and summary.
  </details>

- `15.7` The plan summarises itself in one sentence.

  ![plan-preferences.15.7](requirements/screen/cases/plan-preferences.15.7.png) <!-- req-gallery:15.7 -->

- `15.8` When nothing fits, the schedule says what to relax.

  ![plan-preferences.15.8](requirements/screen/cases/plan-preferences.15.8.png) <!-- req-gallery:15.8 -->

- `15.9` The plan’s edges carry the two partner suggestions.

  ![plan-preferences.15.9](requirements/screen/cases/plan-preferences.15.9.png) <!-- req-gallery:15.9 -->

  <details><summary>Notes</summary>

  Links are plain deep links until affiliate IDs are configured; `rel="sponsored noopener noreferrer"`.
  </details>

- `15.10` Clicking a conflict pill takes you to the setting responsible and flashes it.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:15.10 -->
  </details>

## 16. Exports

- `16.1` **Download itinerary CSV** produces `fringe-itinerary.csv`: UTF-8 with BOM, CRLF, headers **Date, Day, Start, End, Show, Genre, Venue, Room, Status, Tickets**, one row per planned show.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:16.1 -->
  </details>

- `16.2` **Import to calendar ICS** produces `fringe-plan.ics` pinned to Edinburgh: `DTSTART;TZID=Europe/London` with an embedded VTIMEZONE, a stable UID per show+time (re-import updates, never duplicates), the calendar name **"Fringe 2026 · \<d0\>–\<d1\> Aug"**, and a 30-minute reminder.

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:16.2 -->
  </details>

- `16.3` After the ICS download, the two steps into Google Calendar.

  ![plan-exports.16.3](requirements/screen/cases/plan-exports.16.3.png) <!-- req-gallery:16.3 -->

- `16.4` Both export buttons are disabled while nothing is scheduled — and the note under them promises **"Both files are built here in your browser — nothing is uploaded."**

  <details><summary>Proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:16.4 -->
  </details>

- `16.5` The files are correct to the byte: CSV cells are RFC-4180 escaped; ICS lines fold at 75 octets.

  <details><summary>Proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:16.5 -->

  `plan/lib/itinerary.js`.
  </details>

---

# Part III — both pages

Features neither page owns alone. Each is proven on the Now page **and** the
planner, in one picture, because a rule that only half the site follows is not
the feature.

## 8. Time and money, everywhere

- `8.1` Both pages run the festival day to 06:00 — a late show belongs to the night before.

  ![shared-time.8.1](requirements/screen/cases/shared-time.8.1.png) <!-- req-gallery:8.1 -->

  <details><summary>Notes</summary>

  The Now page's wheel stops at the day's last slot, shown as 05:55; the
  planner's schedule counts on past midnight rather than wrapping — 24:00,
  25:00, 26:00. Times are carried in that extended form so they sort correctly,
  and wrapped only where they are displayed.
  </details>

- `8.2` Times are Edinburgh's, whatever your device says.

  ![shared-time.8.2](requirements/screen/cases/shared-time.8.2.png) <!-- req-gallery:8.2 -->

  <details><summary>Notes</summary>

  The same two pages rendered twice — once with the device in London, once with
  it in New York. Every time on both is identical: a doors-at-19:45 show is
  19:45 wherever you are reading from.
  </details>

- `8.3` The page's clock can be driven, for testing.

  ![shared-time.8.3](requirements/screen/cases/shared-time.8.3.png) <!-- req-gallery:8.3 -->

  <details><summary>Notes</summary>

  Now-page only — the planner has no live clock to drive. The picker round-trips:
  the moment you set is the moment the page then reads as "now".
  </details>

- `8.4` The clock moves on by itself.

  ![shared-time.8.4](requirements/screen/cases/shared-time.8.4.png) <!-- req-gallery:8.4 -->

  <details><summary>Notes</summary>

  Now-page only. The plan's "now" advances a minute at the turn of the minute,
  not a minute after the page happened to load.
  </details>

- `8.5` Both pages offer the same ticket-price ladder.

  ![shared-money.8.5](requirements/screen/cases/shared-money.8.5.png) <!-- req-gallery:8.5 -->

- `8.6` Prices are written the same way everywhere.

  <table><thead><tr><th align="left">What is known</th><th align="left">Reads</th></tr></thead><tbody><tr><td>nothing</td><td>Price TBC</td></tr><tr><td>£0</td><td>Free</td></tr><tr><td>one band, £12</td><td>£12</td></tr><tr><td>one band, £8.50</td><td>£8.50</td></tr><tr><td>£12 to £18</td><td>£12–£18</td></tr></tbody></table> <!-- req-gallery:8.6 -->

  <details><summary>Notes</summary>

  Rendered on a card by `6.6` and on a search row by `11.2`; the rule itself is
  the table. An unknown price is never quietly written as free or as £0.
  </details>

---

# Part IV — the trip planner prototype (`/plan2`)

A playable prototype of the illustrated trip planner (design-concepts/trip-planner):
the Postcard direction's opening and question cards, a calendar draft with vertical
day columns, and peel-to-correct tickets — running on committed test data for a
handful of cities, festivals, shows, restaurants, stays, transport modes and day
trips, so the experience can be played with before any of it touches live data.

## 17. The postcard planner

- `17.1` The opening: the city's postcard with its festivals as stamps, the dates as the postmark, and the first question card.

  ![plan2-postcard.17.1](requirements/screen/cases/plan2-postcard.17.1.png) <!-- req-gallery:17.1 -->

  <details><summary>Notes</summary>

  The card asks "Where to?" with four picture ways in (city, season, genre,
  name); the postcard shows the chosen city; every festival the test data
  knows in that city on those dates is a stamp, the planned-around one on the
  postcard and the rest on an "Also on…" sheet to stick on. The postmark
  carries the arrival and departure dates.
  </details>

- `17.2` A question is a card of picture options; the answer becomes a sticker on the postcard and the card is gone.

  ![plan2-postcard.17.2](requirements/screen/cases/plan2-postcard.17.2.png) <!-- req-gallery:17.2 -->

  <details><summary>Notes</summary>

  Rendered on "Who's coming?" with the family option chosen and two kids'
  ages set: the earlier answers (city, festivals, dates) already sit on the
  postcard as stickers; the questions still to come are a stack of cards
  behind the current one. A sticker reopens its question.
  </details>

- `17.3` The draft: the postcard turned over as a calendar, days as vertical columns with the hours running down, one ticket per plan item.

  ![plan2-postcard.17.3](requirements/screen/cases/plan2-postcard.17.3.png) <!-- req-gallery:17.3 -->

  <details><summary>Notes</summary>

  Each kind of item is its own ticket: travel legs, check-in and check-out,
  shows (colour-banded by festival), meals, a day out spanning its hours, and
  free time as a dashed gap. Starred tickets wear a gold ring and are never
  swapped by a redraft. The address side carries the stay and the totals
  (nights, travel, tickets); the "Stick on…" sheet offers a day out, a meal,
  and picking shows yourself.
  </details>

- `17.4` Peeling a ticket reveals the correction stickers; a one-off event reveals only "Not for me".

  ![plan2-postcard.17.4](requirements/screen/cases/plan2-postcard.17.4.png) <!-- req-gallery:17.4 -->

  <details><summary>Notes</summary>

  A repeating show peels to five stickers: not this time, not this show, no
  more of its genre, not its venue, keep it (star). A show with one
  performance on the trip's dates peels to "Not for me" and keep. Both peels
  are rendered together, one on each kind of ticket.
  </details>

- `17.5` The draft is never shown with a question unanswered: reopening one and leaving it half-answered brings that question back.

  🚩 _Behavior leaf._ <!-- req-gallery:17.5 -->

  <details><summary>Notes</summary>

  Driven: from a finished draft, reopen "When?" from its sticker, click one
  day (which starts a new range), hop to another sticker and press Next
  through to the end. The page lands on "When?" again, not on an empty
  calendar; once the range is completed the draft has its day columns.
  </details>

---

# Part V — the Jerusalem Comedy Festival planner (`/planJerusalem`)

## 18. A second festival on the same board

A five-night festival in Jerusalem whose programme is in Hebrew, planned from
the calendar rather than from a list: section 20 is the page's own model, and
the Edinburgh planner's grid survives beneath it as a drawer. The page is
festival-shaped rather than Jerusalem-shaped: everything that differs between
the two — the city, the dates, the storage keys, the palette, the partner
links — comes from one descriptor, so a third festival is a descriptor and a
theme rather than a third page.

- `18.1` The page chrome: the festival's own wordmark, the three-way site nav with **Jerusalem** active, and the festival's dates.

  ![jerusalem-chrome.18.1](requirements/screen/cases/jerusalem-chrome.18.1.png) <!-- req-gallery:18.1 -->

  <details><summary>Notes</summary>

  The nav links are `Now` (`../`), `Plan` (`../plan/`) and `Jerusalem`
  (`./`, active). The header hint reads the festival's own run, not
  Edinburgh's.
  </details>

- `18.2` The programme, listed to browse and search, inside the drawer beneath the calendar.

  ![jerusalem-board.18.2](requirements/screen/cases/jerusalem-board.18.2.png) <!-- req-gallery:18.2 -->

  <details><summary>Notes</summary>

  There is no favourites export to upload for this festival, and since the
  calendar drafts from the whole programme there is nothing a reader must star
  before the page is useful. The list is therefore a way to reach a particular
  show, not the way in: it lives in the drawer, opened from under the calendar.
  </details>

- `18.3` A Hebrew show name renders in Hebrew, right-to-left, wherever the page names a show.

  ![jerusalem-hebrew.18.3](requirements/screen/cases/jerusalem-hebrew.18.3.png) <!-- req-gallery:18.3 -->

  <details><summary>Notes</summary>

  Rendered as one grid lane and one search result for the same show: the title,
  its venue and its category are the source's own Hebrew, each carrying
  `lang="he"` and `dir="rtl"` so punctuation and mixed Latin sit on the correct
  side. Nothing is transliterated.
  </details>

- `18.4` The day grid, in the drawer: one lane per show you have ruled on, its nights marked, its verdict named.

  ![jerusalem-grid.18.4](requirements/screen/cases/jerusalem-grid.18.4.png) <!-- req-gallery:18.4 -->

  <details><summary>Notes</summary>

  Five columns, one per night the programme uses. A lane is drawn for every
  show a verdict has touched — locked, favourited or rejected — so the drawer
  reads as the record of what you have decided rather than as the pool the
  calendar draws from, which is now the whole programme. The festival publishes
  no live availability and never cancels, so a mark is only ever on sale or
  free and the Edinburgh grid's sold-out and offer-status colours never appear;
  the performance the calendar drafted is gold. The lane that cannot be fitted
  says so.
  </details>

- `18.5` The schedule: the catchable shows fitted across the window, with the walk between venues.

  ![jerusalem-schedule.18.5](requirements/screen/cases/jerusalem-schedule.18.5.png) <!-- req-gallery:18.5 -->

  <details><summary>Notes</summary>

  Six venues inside one square kilometre of central Jerusalem, so the travel
  legs are short; two of them share a building and the leg between them is
  zero.
  </details>

- `18.6` "Find a bed" opens Booking.com's Hebrew edition for Jerusalem, on the window's own nights.

  🚩 _Behavior leaf._ <!-- req-gallery:18.6 -->

  <details><summary>Notes</summary>

  Asserted as the URL the link carries, never followed: the `searchresults.he.html`
  path, `ss=Jerusalem`, `selected_currency=ILS`, and the check-in/check-out
  taken from the date window.
  </details>

- `18.7` "Getting here" offers the paid airport transfer and the train beside it.

  🚩 _Behavior leaf._ <!-- req-gallery:18.7 -->

  <details><summary>Notes</summary>

  Two links, both asserted as URLs. Israel Railways runs no referral
  programme; it is offered anyway because it is the cheapest way in from the
  airport, and it ships untagged.
  </details>

- `18.8` Starred shows survive a reload, and never reach the Edinburgh planner's own stored list.

  🚩 _Behavior leaf._ <!-- req-gallery:18.8 -->

  <details><summary>Notes</summary>

  Driven: star two shows, reload, and the same two lanes are back. The
  Edinburgh planner's `localStorage` key is untouched throughout — the two
  planners share code, never state.
  </details>

- `18.9` Exported times are Jerusalem wall clock, and a show with no published running time is exported as an instant.

  🔧 _Logic leaf._ <!-- req-gallery:18.9 -->

  <details><summary>Notes</summary>

  The ICS carries `Asia/Jerusalem` times and that zone's own `VTIMEZONE`, so a
  calendar anywhere in the world shows the hour the audience will be in the
  room. Four of the festival's shows publish no running time; those export with
  end equal to start rather than a guessed length, which is the same
  unknown-is-a-state discipline the price fields keep.
  </details>

## 19. The reader's language, direction and theme

The programme is Hebrew and the reader may not be. The page's own chrome is
translated — English, Hebrew, Russian and Japanese — and follows the reader's
choice of direction and theme; the shows' own names, venues and kinds stay in
the source's Hebrew whichever language the chrome is in. Every string is keyed
in one translations file that carries, per key, the width its slot can afford.

- `19.1` The whole page in Hebrew: the layout mirrors, right to left.

  ![jerusalem-i18n.19.1](requirements/screen/cases/jerusalem-i18n.19.1.png) <!-- req-gallery:19.1 -->

  <details><summary>Notes</summary>

  One whole-page golden, deliberately: what this leaf asserts is that the
  *layout* survives the flip — the header, the board's browse list, the
  preference questions and the calendar's day columns and blockers all run the
  other way — not how any one component reads. The pages' own
  right-to-left components are proven here rather than replicated leaf by leaf
  across Part V.
  </details>

- `19.2` The whole page in dark mode.

  ![jerusalem-theme.19.2](requirements/screen/cases/jerusalem-theme.19.2.png) <!-- req-gallery:19.2 -->

  <details><summary>Notes</summary>

  Rendered with the device asking for a dark colour scheme and nothing stored,
  so what the golden proves is the default the system preference gets. The
  header's toggle overrides it either way.
  </details>

- `19.3` The same chrome in Russian and in Japanese.

  ![jerusalem-i18n.19.3](requirements/screen/cases/jerusalem-i18n.19.3.png) <!-- req-gallery:19.3 -->

  <details><summary>Notes</summary>

  The header, the board's heading and count, and the preference questions in
  both languages, stitched. Two more scripts on the same slots is what catches a
  layout that only ever fitted English.
  </details>

- `19.4` The theme a reader picks survives a reload.

  🚩 _Behavior leaf._ <!-- req-gallery:19.4 -->

  <details><summary>Notes</summary>

  Driven: pick a theme, reload, and the page comes back in it — stored under
  the festival's own storage prefix, so the Edinburgh planner's keys are
  untouched. The theme is the only preference storage carries; the language is
  the URL's, under 19.7.
  </details>

- `19.5` Every string the page can render carries a translation in every supported language.

  <table><thead><tr><th align="left">Language</th><th align="left">Code</th><th align="left">Direction</th><th align="left">Plural categories</th></tr></thead><tbody><tr><td>English</td><td>en</td><td>ltr</td><td>one, other</td></tr><tr><td>עברית</td><td>he</td><td>rtl</td><td>one, two, other</td></tr><tr><td>Русский</td><td>ru</td><td>ltr</td><td>few, many, one, other</td></tr><tr><td>日本語</td><td>ja</td><td>ltr</td><td>other</td></tr></tbody></table> <!-- req-gallery:19.5 -->

  <details><summary>Notes</summary>

  Proved against the shipped catalogue: no key missing a language, no empty
  string, no key without a pixel budget, the same placeholders in every
  language, and every plural form the language's own CLDR categories require.
  </details>

- `19.6` Every translated string fits the pixel budget its key declares, in every language and layout.

  🚩 _Behavior leaf._ <!-- req-gallery:19.6 -->

  <details><summary>Notes</summary>

  A budget is a width in CSS pixels, per key — XLIFF 1.2's `maxwidth` with its
  own default `size-unit="pixel"`. Each string is measured where it actually
  renders: a clone of its own slot in the real page, under the pinned
  Chromium's own fonts, across every language and both committed viewports, so
  the number a translator is given is the number the browser will hold them to.
  </details>

- `19.7` The page's language is the one its URL names, and nothing else changes it.

  🚩 _Behavior leaf._ <!-- req-gallery:19.7 -->

  <details><summary>Notes</summary>

  One URL per language — English at the planner's own address, each other
  language a path segment under it. Driven with the device asking for Hebrew:
  the bare URL still answers in English, because a page that redirects on a
  device preference is a page whose other versions no reader and no crawler
  can reach. Nothing about the language is stored, so the same link opens the
  same language for everyone.
  </details>

- `19.8` Choosing a language in the picker takes the reader to that language's URL.

  🚩 _Behavior leaf._ <!-- req-gallery:19.8 -->

  <details><summary>Notes</summary>

  The picker is the only way to change language now that no device preference
  and no stored choice do, so it navigates rather than re-rendering in place —
  which is what leaves the reader on an address they can bookmark and share.
  </details>

- `19.9` Every language's page is served already in that language, before any script runs.

  <table><thead><tr><th align="left">URL</th><th align="left">Language</th><th align="left">html lang</th><th align="left">Direction</th></tr></thead><tbody><tr><td>/planJerusalem/</td><td>English</td><td>en</td><td>ltr</td></tr><tr><td>/planJerusalem/he/</td><td>עברית</td><td>he</td><td>rtl</td></tr><tr><td>/planJerusalem/ru/</td><td>Русский</td><td>ru</td><td>ltr</td></tr><tr><td>/planJerusalem/ja/</td><td>日本語</td><td>ja</td><td>ltr</td></tr></tbody></table> <!-- req-gallery:19.9 -->

  <details><summary>Notes</summary>

  Read off the committed bytes of each page rather than a rendered one: the
  document's own language and direction, its title and description, and every
  string the markup binds, all in that language before a line of JavaScript
  has run. This is the half that fixes what a browser offers to translate —
  it decides from the document it received, not from what the page later
  becomes.

  The pages are generator output. `scripts/localize-pages.mjs` derives them
  from the planner's own `index.html`, and `--check` re-derives and compares,
  so a hand-edit or a drifted source fails the gate rather than shipping.
  </details>

- `19.10` Each page names itself as canonical and points at every other language, including a default.

  🔧 _Logic leaf._ <!-- req-gallery:19.10 -->

  <details><summary>Notes</summary>

  A self-referencing `rel="canonical"` on every language, and a reciprocal
  `hreflang` set — each page listing all four languages plus `x-default` on
  the bare URL — which is what tells a search engine that these are one page
  in four languages rather than four pages competing with each other. Asserted
  over the committed HTML, both directions: every alternate resolves to a page
  that exists, and every page that exists is listed by all the others.

## 20. Deciding in the calendar

The page's own model, and the one thing it does that the Edinburgh planner does
not. The calendar leads: it drafts from the **whole programme**, before anyone
has starred anything, by asking of each contested hour "who else could you be
watching, and which of them will you not get another chance at?" The scarcest
contender takes the hour — a show with one night beats a show with three,
because the three-night show can be caught tomorrow.

A contested hour is drawn as what it is: the card that won, in front of the
cards it beat. The face of a card carries only the show — its name, its hour,
its venue, and a mark when the reader has locked it. Everything the page has to
say *about* that card, and the four answers back — **lock this night**,
**favourite the show**, **not this night**, **not this show** — are in the
popup that opens under the pointer, so a calendar at rest reads as a calendar
rather than as a control panel.

- `20.1` The calendar leads the page: every night of the window drafted from the whole programme, with nothing starred.

  ![jerusalem-calendar.20.1](requirements/screen/cases/jerusalem-calendar.20.1.png) <!-- req-gallery:20.1 -->

  <details><summary>Notes</summary>

  Rendered with empty storage — no favourites, no verdicts — which is the state
  a first visit lands in. Under the old model that state was an empty schedule
  and a prompt to go and star something; here it is a full week.
  </details>

- `20.2` A contested hour is drawn as a stack: the card that won, in front of the ones it beat.

  ![jerusalem-scarcest.20.2](requirements/screen/cases/jerusalem-scarcest.20.2.png) <!-- req-gallery:20.2 -->

  <details><summary>Notes</summary>

  The cards behind are the shows the scarcity rule turned down for that hour,
  one edge each, so how contested an hour was is something the calendar shows
  rather than something it says. An uncontested hour is a single card.
  </details>

- `20.3` Clicking the stack offers the hour to one of the shows behind it.

  ![jerusalem-contenders.20.3](requirements/screen/cases/jerusalem-contenders.20.3.png) <!-- req-gallery:20.3 -->

  <details><summary>Notes</summary>

  Each is named with the count of nights that lost it the hour, and taking one
  is the same act as locking a night: it holds the hour from then on. Only
  shows that could really take it are offered — see `20.11`.
  </details>

- `20.4` Hovering a card opens everything about it: how rare the show is, every night it plays, and the four verdicts.

  ![jerusalem-preview.20.4](requirements/screen/cases/jerusalem-preview.20.4.png) <!-- req-gallery:20.4 -->

  <details><summary>Notes</summary>

  One popup, because these are one thought: how few nights the show has is the
  reason it holds the hour, its other nights are what "not this night" would
  fall back on, and the four buttons are the answers. Nothing here is on the
  card's own face. The popup is reached by pointer and by keyboard alike, and
  stays open while the pointer travels into it, because it is something to act
  on rather than something to read.
  </details>

- `20.5` A locked card is marked as locked, and its hour stops offering anyone else.

  ![jerusalem-verdicts.20.5](requirements/screen/cases/jerusalem-verdicts.20.5.png) <!-- req-gallery:20.5 -->

  <details><summary>Notes</summary>

  Two nights side by side: one the draft is still guessing at, where both
  hours show what they turned down, and one with a lock in it. The lock is the
  one thing a card's face says beyond the show itself. Nothing on the settled
  night is on offer any more — not only at the locked hour, because what a
  lock rules out for the rest of its night is exactly what `20.11` says it
  does. Unlocking brings the offers back.
  </details>

- `20.6` Locking a night holds it, even against a scarcer contender.

  ![jerusalem-lock.20.6](requirements/screen/cases/jerusalem-lock.20.6.png) <!-- req-gallery:20.6 -->

  <details><summary>Notes</summary>

  Animated, before and after the lock. A lock is placed before the draft runs,
  so it is the one verdict that can seat a show the scarcity rule would never
  have picked, and the contender it displaces moves to the list of shows it
  beat.
  </details>

- `20.7` "Not this night" moves the show to another of its own nights.

  ![jerusalem-not-tonight.20.7](requirements/screen/cases/jerusalem-not-tonight.20.7.png) <!-- req-gallery:20.7 -->

  <details><summary>Notes</summary>

  Animated. The rejected night leaves that show's pool and nothing else does,
  so the show competes for its remaining nights as a scarcer show than it was —
  which is the honest reading of a reader who has ruled one night out.
  </details>

- `20.8` "Not this show" hands its hour to the next contender.

  ![jerusalem-not-this.20.8](requirements/screen/cases/jerusalem-not-this.20.8.png) <!-- req-gallery:20.8 -->

  <details><summary>Notes</summary>

  Animated. The show leaves the programme entirely — every night of it, and its
  name off every contender list — and the hour it held is re-drafted from
  whoever is left. Where nobody left can fit the hour, the hour goes empty
  rather than being filled by something that clashes.
  </details>

- `20.9` Verdicts survive a reload, and never reach the Edinburgh planner's own stored list.

  🚩 _Behavior leaf._ <!-- req-gallery:20.9 -->

  <details><summary>Notes</summary>

  Driven: lock one night, reject another show, reload, and the calendar comes
  back drafted the same way. Stored under the festival's own prefix, like every
  other thing this page remembers.
  </details>

- `20.11` An hour is only ever offered to a show that could really take it.

  🔧 _Logic leaf._ <!-- req-gallery:20.11 -->

  <details><summary>Notes</summary>

  Two ways a contender is no offer at all, and both are filtered before the
  stack is drawn rather than discovered after the reader picks. A show already
  drafted somewhere else in the calendar is one: offering it here would be
  offering to move it, which is not what the picker says it does. A show that
  cannot be reached from the night's other shows is the other — the walk
  between the venues and the rest the reader asked for between shows are the
  same constraint the draft itself obeys, so an offer that ignored them would
  be an offer to break the day.
  </details>

- `20.10` The draft's order of precedence, verdict by verdict.

  <table><thead><tr><th align="left">Verdict</th><th align="left">What it does to the show's nights</th><th align="left">When the show is placed</th></tr></thead><tbody><tr><td>Lock this night</td><td>all stay; that one is taken, your day hours and all</td><td>first, before anything else</td></tr><tr><td>Favourite the show</td><td>all stay</td><td>after the locks, before the undecided rest</td></tr><tr><td>Not this night</td><td>that night leaves</td><td>with the rest, from what is left</td></tr><tr><td>Not this show</td><td>every night leaves</td><td>never — and no block offers it either</td></tr><tr><td>No verdict</td><td>all stay</td><td>with the rest, scarcest first</td></tr></tbody></table> <!-- req-gallery:20.10 -->

  <details><summary>Notes</summary>

  A table generated from the shipped drafter: for each verdict, what it does to
  the show's pool of nights and when it is placed relative to the undrafted
  rest. Read top to bottom it is the whole selection rule.
  </details>

## 21. Saying what you want

The calendar drafts before the reader has said anything, so what they say is
not a form standing in front of it: it is a row of questions above the
calendar, each asked in one line and answered by picking a picture, and four
blockers on the calendar itself. A question that has a finer answer behind it
opens to show it — the picture is the short way to a setting, never the only
way. Nothing above the calendar explains the calendar.

- `21.1` Four questions above the calendar: what you are here for, how full a day, how you get around, how you eat.

  ![jerusalem-prefs.21.1](requirements/screen/cases/jerusalem-prefs.21.1.png) <!-- req-gallery:21.1 -->

  <details><summary>Notes</summary>

  Each question is one line and two to five picture answers, and the row is the
  whole of the page's chrome above the calendar: the panel's heading, the
  paragraph that explained contention and the "N shows across N nights" summary
  are all gone. Rendered with nothing stored, so the golden is the set of
  answers a first visit opens on.
  </details>

- `21.2` A question opens on the exact numbers behind its pictures.

  ![jerusalem-prefs-open.21.2](requirements/screen/cases/jerusalem-prefs-open.21.2.png) <!-- req-gallery:21.2 -->

  <details><summary>Notes</summary>

  "How full a day?" opened: the three pictures still selected as before, with
  the shows-per-day count and the rest between shows they stand for now
  editable underneath. A picture is a shortcut to a pair of numbers rather than
  a coarser control than them, so opening the question never discards the
  answer already given.
  </details>

- `21.3` A kind you are here for outranks one you are not, and a day takes at most one show from outside them.

  <table><thead><tr><th align="left">What you said</th><th align="left">Which shows are drafted first</th><th align="left">How many a night from outside it</th></tr></thead><tbody><tr><td>Nothing — every kind</td><td>the scarcest, whatever kind it is</td><td>no limit: a night takes what fits</td></tr><tr><td>Some kinds</td><td>the scarcest of those kinds</td><td>one, then the night is full of them</td></tr><tr><td>Some kinds, and a favourite outside them</td><td>locks, then the favourite, then those kinds</td><td>the favourite is placed anyway, and is the one</td></tr></tbody></table> <!-- req-gallery:21.3 -->

  <details><summary>Notes</summary>

  A table generated from the shipped drafter: for each kind of reader — one
  with no interests stated, one with some — when a show of a chosen kind is
  placed relative to the rest, and how many shows from outside the chosen kinds
  one day may take. Saying what you are here for narrows nothing: an hour no
  chosen kind wants is still filled, and the whole programme is still in the
  drawer. What the reader would want instead of that one-a-day cap is the
  variety question, which `21.4` says is not yet wired.
  </details>

- `21.4` The variety question is offered, and says plainly that it does not work yet.

  ![jerusalem-variety.21.4](requirements/screen/cases/jerusalem-variety.21.4.png) <!-- req-gallery:21.4 -->

  <details><summary>Notes</summary>

  How much of the festival outside your own taste you want is the question that
  should set the cap in `21.3`, and the rule that answers it has not been
  decided. It is drawn where it belongs — behind "what are you here for?",
  which is the question it refines — marked as not yet wired and refusing to be
  answered, rather than left out and added later, and rather than drawn live
  over a rule that ignores it, which is the shape that would lie.
  </details>

- `21.5` A meal you asked for is a band the calendar drafts around; sorting food out yourself leaves the day clear.

  ![jerusalem-food.21.5](requirements/screen/cases/jerusalem-food.21.5.png) <!-- req-gallery:21.5 -->

  <details><summary>Notes</summary>

  The same two nights twice, stitched: once with breakfast, lunch and dinner
  asked for — each a band nothing is drafted through, carrying the place when
  the reader has named one — and once with "I'll sort it out myself", which
  draws no bands at all and is the reader's signal to stop crowding the
  calendar with food.

  Naming the place is the reader's own for now. Choosing it for them — from
  what is open, close enough to reach between the shows either side, and in
  the style and price they said they wanted — is the question this row is
  shaped for and does not yet answer.
  </details>

- `21.6` Where your day starts and ends are blockers on the calendar, dragged to where you want them.

  ![jerusalem-dayhours.21.6](requirements/screen/cases/jerusalem-dayhours.21.6.png) <!-- req-gallery:21.6 -->

  <details><summary>Notes</summary>

  Two draggable lines with the shut-out hours shaded behind them, on the
  calendar rather than in a strip above it: the constraint is drawn against the
  hours it applies to, so what it rules out is visible beside it. The axis
  covers the evening the festival actually runs and stretches only an hour
  beyond it towards a slack boundary, which is then drawn on the axis edge with
  the hour it really holds on its flag; a day genuinely that long — three meals
  asked for, say — draws its hours shorter instead, so the calendar stays a
  calendar rather than a screen of empty morning.
  </details>

- `21.7` Dragging the day's end earlier drops what no longer fits.

  ![jerusalem-dayend.21.7](requirements/screen/cases/jerusalem-dayend.21.7.png) <!-- req-gallery:21.7 -->

  <details><summary>Notes</summary>

  Animated, before and after the drag. The draft is rebuilt from the whole
  programme as the line moves, so what the constraint costs is the calendar
  redrawing rather than a number changing.
  </details>

- `21.8` The first and last nights are the same kind of blocker, on the same calendar.

  ![jerusalem-window.21.8](requirements/screen/cases/jerusalem-window.21.8.png) <!-- req-gallery:21.8 -->

  <details><summary>Notes</summary>

  Every night of the festival is a column whether or not the reader's window
  takes it; the nights outside it are shaded like the hours outside the day,
  with a draggable edge at each end of the window. The date window therefore
  lives on the calendar with the other three constraints, rather than on a rail
  over the drawer's grid.
  </details>

- `21.9` Every preference survives a reload.

  🚩 _Behavior leaf._ <!-- req-gallery:21.9 -->

  <details><summary>Notes</summary>

  Driven: state an interest, open a question and change a number, ask for
  dinner, move the day's end and the first night, reload, and all of it comes
  back — stored under the festival's own prefix like everything else this page
  remembers.
# Part VI — what the site tells a crawler

A public website has to be findable, and findable is a thing the site states
rather than a thing a search engine guesses: which pages it publishes for a
reader, which of them are the same page in another language, and which are not
for listing at all. Google's own guidance asks for both files below — a sitemap
so nothing depends on a crawler finding its way to every page by link alone,
and a `robots.txt` naming it. Both are generated from the published tree, so a
page cannot be added to the site and forgotten here.

## 22. The sitemap and robots.txt

- `22.1` The sitemap lists every page the site publishes for a reader.

  <table><thead><tr><th align="left">URL</th><th align="left">Served from</th></tr></thead><tbody><tr><td>/</td><td>index.html</td></tr><tr><td>/accessibility.html</td><td>accessibility.html</td></tr><tr><td>/plan/</td><td>plan/index.html</td></tr><tr><td>/planJerusalem/</td><td>planJerusalem/index.html</td></tr><tr><td>/planJerusalem/he/</td><td>planJerusalem/he/index.html</td></tr><tr><td>/planJerusalem/ja/</td><td>planJerusalem/ja/index.html</td></tr><tr><td>/planJerusalem/ru/</td><td>planJerusalem/ru/index.html</td></tr><tr><td>/privacy.html</td><td>privacy.html</td></tr><tr><td>/terms.html</td><td>terms.html</td></tr></tbody></table> <!-- req-gallery:22.1 -->

  <details><summary>Notes</summary>

  Read off the published tree rather than a list kept by hand, so a page added
  to the site is in the sitemap without anyone remembering: every HTML page
  wrangler uploads, at the URL the site's own trailing-slash handling serves it
  at. No `lastmod`, `changefreq` or `priority` — the first would have to be
  true to be worth anything and nothing here can keep it true, and a search
  engine reads neither of the others.
  </details>

- `22.2` A page that asks not to be indexed is left out of it.

  🔧 _Logic leaf._ <!-- req-gallery:22.2 -->

  <details><summary>Notes</summary>

  The page's own `<meta name="robots" content="noindex">` is what decides,
  rather than a second list beside the sitemap that someone would have to keep
  in step. Two pages say it today: the trip-planner prototype, which is for
  playing with rather than for finding, and the error page, which is not a
  page at all.
  </details>

- `22.3` Each language of the festival planner is listed with the others beside it.

  🔧 _Logic leaf._ <!-- req-gallery:22.3 -->

  <details><summary>Notes</summary>

  The same reciprocal set the pages carry in their own markup (19.10), repeated
  in the sitemap as `xhtml:link` alternates, which is the form a search engine
  is most reliably given it in. Asserted against the pages' own annotations
  rather than against a copy, so the two cannot disagree.
  </details>

- `22.4` `robots.txt` admits every crawler and names the sitemap.

  🔧 _Logic leaf._ <!-- req-gallery:22.4 -->

  <details><summary>Notes</summary>

  A sitemap nothing points at is one a crawler has to be told about out of
  band; the `Sitemap:` line is what makes it discoverable, and it is the only
  reason this file exists here. Nothing is disallowed — what must not be listed
  says so on the page itself (22.2), which keeps it out of results rather than
  merely out of a crawl.
  </details>
