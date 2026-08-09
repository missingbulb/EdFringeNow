# EdFringeNow — executable UI/UX requirements

The **specific, testable requirements** for the site's two front-ends — what each
surface must render and how it must behave, down to exact strings, states and
semantics. Part I is the **Now** page (`index.html`, the spontaneity tool);
Part II is the **Plan** page (`plan/`, the festival planner). The feature-level
story of what the product is and why lives in
[docs/product-spec.md](../docs/product-spec.md); this document holds only
statements a test can prove.

Every leaf below is executed by exactly one case under
[product/requirements/](requirements/) — see its
[README](requirements/README.md) for the framework: kinds, runners, goldens,
the coverage gate, and how to add or change a requirement. The committed
golden images and coded assertions are the **owner's approval record**: an
agent may propose a new expected, but never changes a committed one to make a
red case pass — on a mismatch it surfaces actual vs expected and asks.

> # ⚠️ A GREEN BUILD MEANS "CLAIMED", NOT "FULLY VERIFIED" ⚠️
>
> Every leaf is claimed by one case of the right kind, and the visual cases
> render the real pages in a real (headless, pinned) Chromium. What the harness
> cannot reach, stated plainly:
>
> - **The network is faked.** Leaflet, fonts, map tiles, the geocoder and the
>   show data are served from committed fixtures — cases prove our code *asks*
>   correctly (the exact URL, the exact request), not that OpenStreetMap,
>   Nominatim or edfringe.com answer.
> - **External links are asserted as URLs**, never followed: a case proves the
>   buy link targets `edfringe.com/tickets/whats-on/<slug>`, not that the shop
>   exists.
> - **Real geolocation, a real GPS fix, and a real device clock** are outside
>   the harness: cases substitute fixed fakes and prove the app's *response* to
>   each outcome.
> - **Downloads are read back as bytes** (CSV/ICS content), not imported into a
>   real calendar.
>
> The fixture dataset is a frozen, curated snapshot of the real committed data
> — see [requirements/shared/fixtures/build-fixtures.js](requirements/shared/fixtures/build-fixtures.js)
> for its provenance and the two documented adjustments in it.

**Numbering.** Every leaf carries a stable id (e.g. `6.4`). Add new
requirements under new numbers; never renumber or reuse a retired one. Each
leaf has exactly one case named `<slug>.<id>.case.js`; the case's *kind* is the
folder it lives in (`screen/` — a pixel-exact golden of the rendered page;
`behavior/` — a driven gesture asserted in code; `logic/` — a pure rule proved
against the shipped module). The line under each leaf tagged
`req-gallery` is machine-managed (the gallery generator rewrites it); the prose
is hand-authored.

**The reference moment.** Visual cases render at **Sat 15 Aug 2026, 19:30**
Edinburgh time, from a fixed fake location in central Edinburgh, against the
frozen fixture dataset ([requirements/shared/reference-now.js](requirements/shared/reference-now.js)).

---

# Part I — the Now page

## 1. Page chrome

- `1.1` At desktop width the header shows the **EdFringeNow** logo, a centred **Now | Plan** nav with **Now** active (red, underlined), and a **Use my location** button on the right.

  <details><summary>Acceptance & golden</summary>

  ![now-chrome.1.1](requirements/screen/cases/now-chrome.1.1.png) <!-- req-gallery:1.1 -->

  The logo reads `EdFringe` + red `Now`; the nav links are `Now` (`./`, active) and `Plan` (`plan/`); the location button carries `aria-label="Use my location"`. Header is sticky, white, 64px.
  </details>

- `1.2` Below 860px the **Now | Plan** nav is hidden — the mobile header is logo + location button only.

  <details><summary>Acceptance & golden</summary>

  ![now-chrome.1.2](requirements/screen/cases/now-chrome.1.2.png) <!-- req-gallery:1.2 -->

  Golden renders the whole resting page at the 390px reference viewport: no nav links between the logo and the location button.
  </details>

- `1.3` The footer carries the tagline **"Helping you navigate the chaos and catch another show!"**, the **© 2026 Missing Bulb** line, the commission disclosure, and the **Contact Us / Privacy Policy / Accessibility / Terms of Use** links.

  <details><summary>Acceptance & golden</summary>

  ![now-chrome.1.3](requirements/screen/cases/now-chrome.1.3.png) <!-- req-gallery:1.3 -->

  Disclosure text: `Booking links on plans (tables, trains, stays, tours) may earn us a small commission, at no extra cost to you.` Quick Links column: `Contact Us` (mailto:support@edfringenow.com), `Privacy Policy`; Legal column: `Accessibility`, `Terms of Use`.
  </details>

- `1.4` The site version is reachable by anyone: the footer's **© 2026 Missing Bulb** line carries tooltip **"EdFringeNow v\<version\>"** read from `package.json`.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:1.4 -->

  `#footerVersion`'s `title` attribute equals `EdFringeNow v` + the version served by `package.json`.
  </details>

- `1.5` The **debug pill** never shows for a visitor whose location is in the UK or unknown; it appears (reading `debug v<version>`, with the simulated-now and move-location tools) only when geolocation reports a position **outside** the UK.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:1.5 -->

  In-UK fix → `#debugMenu` stays `hidden` and the app adopts the real clock. Out-of-UK fix → pill visible, app keeps its simulated clock, and `#debugNowText` reads the simulated moment (`Fri 14 Aug, 15:44 BST`).
  </details>

## 2. First-run explainer

- `2.1` A first-time visitor sees the explainer: kicker **"3,800 shows. One free hour."**, title **"See what you can actually get to — right now."**, the three numbered steps, and the **"Got it — let's go"** button.

  <details><summary>Acceptance & golden</summary>

  ![now-intro.2.1](requirements/screen/cases/now-intro.2.1.png) <!-- req-gallery:2.1 -->

  Steps, verbatim: **Say when you next have to be somewhere.** A show, dinner, a train. / **We work out how far that leaves you.** On foot, bike, bus or taxi. / **Pick something you can make** — and still get to your next thing.
  </details>

- `2.2` Dismissing the explainer (✕ or **Got it — let's go**) hides it, and it stays hidden on every later visit.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:2.2 -->

  After dismissal `#intro` is hidden and a reload of the page never shows it again (remembered in `localStorage`, independent of the settings snapshot).
  </details>

## 3. The next-commitment card

- `3.1` With no commitment set, the card shows a faded skeleton of the plan-to-be ("Your plan" / "You are here" / "Your next commitment") under a **"Tap to set constraints"** trigger.

  <details><summary>Acceptance & golden</summary>

  ![now-commitment.3.1](requirements/screen/cases/now-commitment.3.1.png) <!-- req-gallery:3.1 -->
  </details>

- `3.2` Opening the card shows **"Your next commitment \<date\>"** with the time wheels preset to now + 2 hours, a live count of shows starting then, the any-genre pick list, and the **"Not a show? Type a place"** input with a disabled **🔎 Find on map** button.

  <details><summary>Acceptance & golden</summary>

  ![now-commitment.3.2](requirements/screen/cases/now-commitment.3.2.png) <!-- req-gallery:3.2 -->

  At the reference moment the wheels read `21:30` and the count line reads `2` `shows start at 21:30`; each pick row shows radio, title, venue, genre` · `price. The Find button is disabled while the place input is empty.
  </details>

- `3.3` A chosen minute at which nothing starts reads **"No shows start exactly then. Nearest:"** with up to four **"HH:MM · n"** suggestion buttons.

  <details><summary>Acceptance & golden</summary>

  ![now-commitment.3.3](requirements/screen/cases/now-commitment.3.3.png) <!-- req-gallery:3.3 -->
  </details>

- `3.4` Picking a show commits it: the intake card disappears, the plan strip renders, and every open panel closes.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:3.4 -->

  After clicking a `.show-pick` row: `body.has-plan` set, `#journeyStrip` populated, `#constraintPanel` hidden.
  </details>

- `3.5` Finding a typed place lists the matches under **"Which one?"** with a kind icon per hit, keeps only results around Edinburgh, and always ends with a **"Keep "\<q\>" as a note"** row.

  <details><summary>Acceptance & golden</summary>

  ![now-commitment.3.5](requirements/screen/cases/now-commitment.3.5.png) <!-- req-gallery:3.5 -->

  The fixture geocoder answers three hits; the out-of-Edinburgh one is dropped, so the list shows 🍽️ The Witchery by the Castle and 🚆 Edinburgh Waverley, then the 📝 note row.
  </details>

- `3.6` When the geocoder can't be reached the card says **"Map search isn't reachable right now."** — the only user-facing error string on the page.

  <details><summary>Acceptance & golden</summary>

  ![now-commitment.3.6](requirements/screen/cases/now-commitment.3.6.png) <!-- req-gallery:3.6 -->
  </details>

- `3.7` The time wheel offers 5-minute steps from the current minute to 29:55 (the 06:00 fringe-day end), opens at now + 120 minutes snapped to 5, and displays hours past midnight as 00–05.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:3.7 -->

  Proved against `js/constraint-time.js`: `defaultConstraintTime`, `earliestWheelMinutes`, `minutesForHour`, `WHEEL_MINUTES`, and `hourLabel`'s 24→00 wrap.
  </details>

## 4. The plan strip

- `4.1` A committed destination renders the plan: **"Your plan"** with an **Open in Maps** link, the origin node (**"You are here"**, current time, travel mode), a **"🚶 N min walk"** leg, and the destination node subtitled **"Your next commitment"**.

  <details><summary>Acceptance & golden</summary>

  ![now-plan-strip.4.1](requirements/screen/cases/now-plan-strip.4.1.png) <!-- req-gallery:4.1 -->

  Leg minutes are never shown below 1. Each of the stop/destination nodes carries `Change ▾` and `×` controls.
  </details>

- `4.2` With spare time before the commitment and shows that fit, the strip offers **"You have \<duration\> to spare — want to see a show? \<n\> fit below"**, dismissible with ✕.

  <details><summary>Acceptance & golden</summary>

  ![now-plan-strip.4.2](requirements/screen/cases/now-plan-strip.4.2.png) <!-- req-gallery:4.2 -->

  "fits" when n = 1, "fit" otherwise; the link smooth-scrolls to the list.
  </details>

- `4.3` A show slipped into the plan renders as a stop node: time range, title, venue · genre, a slack chip **"\<duration\> to spare"**, and the **"🎟 Buy ahead · skip the queue"** link.

  <details><summary>Acceptance & golden</summary>

  ![now-plan-strip.4.3](requirements/screen/cases/now-plan-strip.4.3.png) <!-- req-gallery:4.3 -->

  A free show renders no buy link; a sold-out one renders a `Sold out` pill instead (see `6.4` for the list-side stamp).
  </details>

- `4.4` A selected show that would make you late for the commitment wears the **"You'll be late"** chip.

  <details><summary>Acceptance & golden</summary>

  ![now-plan-strip.4.4](requirements/screen/cases/now-plan-strip.4.4.png) <!-- req-gallery:4.4 -->
  </details>

- `4.5` The buy-ahead link opens **`https://www.edfringe.com/tickets/whats-on/<slug>`** in a new tab.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:4.5 -->

  `href` equals the pattern with the show's own slug; `target="_blank"`, `rel` includes `noopener`.
  </details>

- `4.6` **Open in Maps** builds a Google Maps directions URL from the user's location to the commitment, in the chosen travel mode, adding the slipped-in show as a waypoint.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:4.6 -->

  `https://www.google.com/maps/dir/?api=1&origin=<lat,lng>&destination=<lat,lng>&travelmode=walking|driving|bicycling` + `&waypoints=` when a leg show is set.
  </details>

- `4.7` The ✕ on the destination clears the commitment but keeps a selected show; the ✕ on the stop clears just the selected show.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:4.7 -->
  </details>

- `4.8` Durations are phrased for humans: minutes under an hour, **"1 hour and 20 minutes"** up to two hours, **"about 2½ hours"** beyond.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:4.8 -->

  `shared/duration.js` `friendlyDuration`: `<60` → `45 minutes`; exact hours → `1 hour`/`2 hours`; 60–120 → `1 hour and 20 minutes`; `>120` → `about 2½ hours` (nearest half hour); negative/non-finite → empty.
  </details>

## 5. Filters

- `5.1` The genre panel asks **"Which genres?"** with an **everything!** escape hatch and the ten festival genres, each with its emoji and a grey count of what ticking it would leave.

  <details><summary>Acceptance & golden</summary>

  ![now-filters.5.1](requirements/screen/cases/now-filters.5.1.png) <!-- req-gallery:5.1 -->

  The ten genres, in order: Cabaret and Variety, Children's Shows, Comedy, Dance, Physical Theatre & Circus, Events, Exhibitions, Music, Musicals and Opera, Spoken Word, Theatre. A zero-count row fades. Counts are measured with every filter applied *except* the panel's own.
  </details>

- `5.2` The subgenre panel asks **"Which subgenres?"** offering only the subgenres present in what the other filters leave, with counts; when nothing is left it says **"No subgenres in what's left — widen your genres."**

  <details><summary>Acceptance & golden</summary>

  ![now-filters.5.2](requirements/screen/cases/now-filters.5.2.png) <!-- req-gallery:5.2 -->
  </details>

- `5.3` The price panel says **"Cheapest ticket, up to:"** over the shared six-step ladder — **Any / Free / £10 / £15 / £20 / £30** — each with a count.

  <details><summary>Acceptance & golden</summary>

  ![now-filters.5.3](requirements/screen/cases/now-filters.5.3.png) <!-- req-gallery:5.3 -->
  </details>

- `5.4` The travel panel asks **"How are you getting there?"** with Walking (3.3 km/h), Taxi/Car (30 km/h), Bicycle (15 km/h) and a 1–60 minute slider reading **"N min max"**.

  <details><summary>Acceptance & golden</summary>

  ![now-filters.5.4](requirements/screen/cases/now-filters.5.4.png) <!-- req-gallery:5.4 -->
  </details>

- `5.5` The chips summarise their state: one genre by name, several as **"n genres"**, all/none as **"All genres"**; a set price cap turns the **$** red and shows **"Up to £N"**; travel reads **"\<Walk|Taxi|Bike\> ≤ N min"**.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:5.5 -->
  </details>

- `5.6` The escape hatch flips: **everything!** ticks every option; once everything is ticked it reads **nothing!** and clears them all.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:5.6 -->
  </details>

- `5.7` Price filtering is honest about unknowns: caps are inclusive (`£10` keeps a £10 show), **Free** means exactly £0, and a show with no known price matches no cap — never smuggled in under one.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:5.7 -->

  `shared/price.js` `matchesPrice` / `showPrice`.
  </details>

## 6. View switch and the show list

- `6.1` One selector chooses the view and the order — **Closest / Soonest / Map** — with **Closest** active by default.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.1](requirements/screen/cases/now-list.6.1.png) <!-- req-gallery:6.1 -->
  </details>

- `6.2` With a commitment the heading counts what still fits: **"\<n\> shows you can slip in before \<HH:MM\>"**, and every card's corner says **fits**.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.2](requirements/screen/cases/now-list.6.2.png) <!-- req-gallery:6.2 -->

  Without a commitment the heading reads `<n> shows you could wander into right now` and only shows starting within the next two hours are listed (singular `show` when n = 1). Card anatomy: genre in red caps, serif title, venue, subgenre tags; right column start time, `🚶 N min · <price>`.
  </details>

- `6.3` **Soonest** re-orders the same cards by start time under **"HH:MM"** group headings.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.3](requirements/screen/cases/now-list.6.3.png) <!-- req-gallery:6.3 -->
  </details>

- `6.4` A show with no online tickets wears the diagonal **"SOLD OUT!"** ink stamp and dims — but stays selectable.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.4](requirements/screen/cases/now-list.6.4.png) <!-- req-gallery:6.4 -->

  "No online tickets" is decided by `ticketStatus` ∈ {SOLD_OUT, NO_ALLOCATION_CONTACT_VENUE}; unknown status counts as available; the `soldOut` boolean is display-only and never trusted.
  </details>

- `6.5` A show you'd reach up to five minutes after its start wears the **"TOO LATE!"** stamp and dims; later than that it simply doesn't appear.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.5](requirements/screen/cases/now-list.6.5.png) <!-- req-gallery:6.5 -->

  Travel time is straight-line (haversine) at the mode's speed; with a commitment set, tight shows are hidden too — only shows you fully make are offered.
  </details>

- `6.6` Price on a card is exact about what it knows: **"Free"**, **"£N"**, or **"Price TBC"** when the price is unknown.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.6](requirements/screen/cases/now-list.6.6.png) <!-- req-gallery:6.6 -->
  </details>

- `6.7` With nothing reachable and no commitment, the list says **"Nothing reachable in the next couple of hours — widen your travel window or taste."**

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.7](requirements/screen/cases/now-list.6.7.png) <!-- req-gallery:6.7 -->
  </details>

- `6.8` With a commitment and nothing that fits, it says **"Nothing fits before your next commitment — try a later time or a wider travel window."**

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.8](requirements/screen/cases/now-list.6.8.png) <!-- req-gallery:6.8 -->
  </details>

- `6.9` The list pages by twelve: the button reads **"Show \<k\> more · \<m\> left"**.

  <details><summary>Acceptance & golden</summary>

  ![now-list.6.9](requirements/screen/cases/now-list.6.9.png) <!-- req-gallery:6.9 -->
  </details>

- `6.10` Clicking **Show more** appends the next page to the list.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:6.10 -->
  </details>

- `6.11` Tapping a card slips that show into the plan (and scrolls to it); tapping it again takes it back out.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:6.11 -->
  </details>

- `6.12` A show beyond the travel budget never appears in the list, however good it is.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:6.12 -->

  The fixture carries a show ~28 walking minutes out; at the default 10-minute budget it must be absent from the DOM, and present once the budget is raised to 60.
  </details>

## 7. The map

- `7.1` The map view shows the user dot, the violet reach circle sized to the travel budget, one emoji pin per reachable show, and cluster bubbles where pins crowd.

  <details><summary>Acceptance & golden</summary>

  ![now-map.7.1](requirements/screen/cases/now-map.7.1.png) <!-- req-gallery:7.1 -->

  OpenStreetMap tiles (faked in the harness), attribution visible. Pins carry the genre emoji; sold-out/tight pins dim.
  </details>

- `7.2` A committed destination draws the route: a dark line with an arrowhead per leg and a green **"✓ HH:MM"** pill on the destination — the deadline your arrival beats.

  <details><summary>Acceptance & golden</summary>

  ![now-map.7.2](requirements/screen/cases/now-map.7.2.png) <!-- req-gallery:7.2 -->

  With a slipped-in show the route runs you → show → commitment (two legs); unrelated pins dim to 0.25.
  </details>

- `7.3` Tapping a pin selects the show without scrolling the page; the list and map are two views of the same shows, one visible at a time.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:7.3 -->
  </details>

## 8. Time rules (shared)

- `8.1` A fringe day runs **06:00 to 06:00**: a 00:30 show belongs to the evening before, carried as the extended string `24:30` so ordering never breaks, and wrapped back to `00:30` only for display.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:8.1 -->

  `shared/fringe-day.js`: `FRINGE_DAY_START_MINUTES`/`END`, `clockHHMM`, `clockLabel`, `hourLabel`.
  </details>

- `8.2` Every time the app shows or compares is **Edinburgh wall-clock**, whatever the device's zone.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:8.2 -->

  `js/clock.js` `festivalNow` reads any instant through Europe/London (BST in August).
  </details>

- `8.3` The simulated-clock picker round-trips: the instant computed for an Edinburgh wall-clock reading reads back as itself, across DST edges.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:8.3 -->

  `js/clock.js` `festivalDate` ∘ `festivalNow` = identity for valid input; invalid input yields an Invalid Date.
  </details>

- `8.4` The minute ticker re-arms **on** the minute and can never spin: the delay to the next minute is always in (0, 60000].

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:8.4 -->

  `js/clock.js` `msToNextMinute`.
  </details>

- `8.5` Both pages offer the **same** price ladder — Any / Free / up to £10 / £15 / £20 / £30 — from one shared module.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:8.5 -->

  `shared/price.js` `PRICE_OPTIONS` / `PRICE_CAPS`.
  </details>

- `8.6` Price copy is exact: unknown → **"Price TBC"**, zero → **"Free"**, a real range → **"£12–£18"**, a single band → **"£12"**, and whole pounds never show ".00".

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:8.6 -->

  `shared/price.js` `priceLabel` / `formatPounds`.
  </details>

---

# Part II — the Plan page

## 9. Page chrome and board states

- `9.1` The planner header shows the logo, the **Now | Plan** nav with **Plan** active (violet), and the hint **"Edinburgh Fringe · 7–31 Aug 2026"**; the page opens with **"Plan your Fringe!"** over the count line **"No shows planned, no shows selected"**.

  <details><summary>Acceptance & golden</summary>

  ![plan-chrome.9.1](requirements/screen/cases/plan-chrome.9.1.png) <!-- req-gallery:9.1 -->

  Footer: `Fringe Planner · © 2026 Missing Bulb` + the partner-links disclosure; the © carries the `EdFringeNow v<version>` tooltip.
  </details>

- `9.2` The empty board is the intake: **"Drag EdFringe favourites file here"** over an **Upload favourites** button, with the show search bar directly below — the same slot it keeps once the grid exists.

  <details><summary>Acceptance & golden</summary>

  ![plan-chrome.9.2](requirements/screen/cases/plan-chrome.9.2.png) <!-- req-gallery:9.2 -->
  </details>

- `9.3` A failed catalogue load shows **"We couldn't load the show data."** with the reason and a **Try again** button.

  <details><summary>Acceptance & golden</summary>

  ![plan-chrome.9.3](requirements/screen/cases/plan-chrome.9.3.png) <!-- req-gallery:9.3 -->
  </details>

- `9.4` **Try again** re-fetches and, when the data lands, recovers to the working page.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:9.4 -->
  </details>

- `9.5` With shows on the board the count line reads **"\<n\> show(s) planned out of \<m\> selected!"**.

  <details><summary>Acceptance & golden</summary>

  ![plan-chrome.9.5](requirements/screen/cases/plan-chrome.9.5.png) <!-- req-gallery:9.5 -->
  </details>

## 10. Favourites intake

- `10.1` Uploading the edfringe.com favourites CSV fills the board with every favourite the catalogue knows, and the list survives a reload (kept three days).

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:10.1 -->
  </details>

- `10.2` A non-CSV file is refused: **"That's not a CSV file"** — **"Export your favourites from edfringe.com as CSV, then drop that file here."** with a link to **Your favourites page**.

  <details><summary>Acceptance & golden</summary>

  ![plan-favourites.10.2](requirements/screen/cases/plan-favourites.10.2.png) <!-- req-gallery:10.2 -->
  </details>

- `10.3` A CSV with no show links reads **"No favourites in that file"** — **"It carries no edfringe.com show links — check you exported your favourites page as CSV."**

  <details><summary>Acceptance & golden</summary>

  ![plan-favourites.10.3](requirements/screen/cases/plan-favourites.10.3.png) <!-- req-gallery:10.3 -->
  </details>

- `10.4` Favourites from a previous year read **"None of those \<n\> favourites are in this year's programme"** — **"That looks like an export from a previous Fringe."**

  <details><summary>Acceptance & golden</summary>

  ![plan-favourites.10.4](requirements/screen/cases/plan-favourites.10.4.png) <!-- req-gallery:10.4 -->
  </details>

- `10.5` A failed upload never touches an existing grid — the board and stored list stay exactly as they were.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:10.5 -->
  </details>

- `10.6` The favourites parser reads real exports: quoted RFC-4180 cells, `""` escapes, any line ending, BOM; every cell is scanned for `edfringe.com/tickets/whats-on/<slug>` URLs, de-duplicated in first-seen order; a link-less file falls back to a plain list of URLs or bare slugs.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:10.6 -->

  `plan/lib/favourites.js`.
  </details>

- `10.7` **Clear** asks before it wipes: first click arms **"Clear all \<n\> shows? Click again"**, a second click within five seconds clears the board; anything else disarms it.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:10.7 -->
  </details>

## 11. The show search

- `11.1` Once the catalogue lands the search bar invites **"Search all \<n\> shows — title, performer or venue"** beside the **Search tools** button.

  <details><summary>Acceptance & golden</summary>

  ![plan-search.11.1](requirements/screen/cases/plan-search.11.1.png) <!-- req-gallery:11.1 -->
  </details>

- `11.2` Result rows carry a ☆/★ star (add to / lift off the grid), the title, and **price · genre · venue · start time** — omitting an unknown price entirely; a capped list ends **"Showing 30 of \<n\> matches — keep typing to narrow it down"**.

  <details><summary>Acceptance & golden</summary>

  ![plan-search.11.2](requirements/screen/cases/plan-search.11.2.png) <!-- req-gallery:11.2 -->
  </details>

- `11.3` A query that names a genre, subgenre or venue offers **category rows first** — "Genre/Subgenre/Venue \<name\> — Filter to \<n\> shows" — which set the filter instead of adding a show.

  <details><summary>Acceptance & golden</summary>

  ![plan-search.11.3](requirements/screen/cases/plan-search.11.3.png) <!-- req-gallery:11.3 -->
  </details>

- `11.4` No matches reads **"No shows match — try fewer filters or a different spelling."**

  <details><summary>Acceptance & golden</summary>

  ![plan-search.11.4](requirements/screen/cases/plan-search.11.4.png) <!-- req-gallery:11.4 -->
  </details>

- `11.5` **Search tools** unfolds six facet chips — genre, subgenre, venue (with a find box), accessibility, age limit, price — each panel with per-option counts and an **everything!** clear; facets whose data hasn't landed present themselves as coming soon, disabled.

  <details><summary>Acceptance & golden</summary>

  ![plan-search.11.5](requirements/screen/cases/plan-search.11.5.png) <!-- req-gallery:11.5 -->

  Age options: `0+ only`, then `Up to 3+/5+/8+/12+/14+/16+`. Price options are the shared ladder (`8.5`). An option with no data shows an em dash and is disabled.
  </details>

- `11.6` The star adds the show to the grid or lifts it off, from the search row itself.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:11.6 -->
  </details>

- `11.7` Clicking or tabbing away from the search clears the typed text and closes the results — but keeps the facet filters, which live on the tools line (with facets active the popup stays as the filtered browse list).

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:11.7 -->
  </details>

- `11.8` Ranking is deterministic and accent-blind: title prefix beats word-boundary beats anywhere-in-title beats performer/venue beats description-only; multi-word queries must land every word; ties break A→Z.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:11.8 -->

  `plan/lib/search.js`.
  </details>

## 12. The day grid

- `12.1` The grid shows one row per favourite (sorted by typical start time) across all 31 August days: two-letter weekday header, violet weekend stripes, greyed pre-festival days 1–6, one coloured mark per performance, and a **Status** column of verdict pills.

  <details><summary>Acceptance & golden</summary>

  ![plan-grid.12.1](requirements/screen/cases/plan-grid.12.1.png) <!-- req-gallery:12.1 -->
  </details>

- `12.2` The **Legend** popup names the grid's whole vocabulary, verbatim: **Tickets available / 2-for-1 / Preview / Free / Event-specific / Sold out / In your plan**.

  <details><summary>Acceptance & golden</summary>

  ![plan-grid.12.2](requirements/screen/cases/plan-grid.12.2.png) <!-- req-gallery:12.2 -->

  The colours are edfringe.com's own day-picker palette; gold ("In your plan") is the only mark the grid draws itself.
  </details>

- `12.3` Hovering a day mark opens the day card: title, genre · venue, **"\<Dw\> \<d\> Aug"**, one row per performance with its colour swatch, start and status note, the blurb, and the pin hint.

  <details><summary>Acceptance & golden</summary>

  ![plan-grid.12.3](requirements/screen/cases/plan-grid.12.3.png) <!-- req-gallery:12.3 -->

  Status notes: `locked into your plan` / `in your plan` / the status prose (`tickets available`, `sold out`, `free`, …). Hint: `Click a mark to lock that performance in` (or `Click the locked mark to unlock it`).
  </details>

- `12.4` Clicking a mark locks that exact performance into the plan (gold, 🔒); clicking the locked mark unlocks it.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:12.4 -->
  </details>

- `12.5` Clicking a show's name pins the whole show — the plan must include it, whichever performance fits; its other marks wear a dashed gold outline.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:12.5 -->
  </details>

- `12.6` The row's ✕ removes the show; removing the last one returns the board to the intake.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:12.6 -->
  </details>

## 13. The date window

- `13.1` The window rail shows draggable **From / To** flags, the band reading **"\<n\> days"**, an **Optimize?** button, and dims the days outside the window (default 7–24 Aug).

  <details><summary>Acceptance & golden</summary>

  ![plan-window.13.1](requirements/screen/cases/plan-window.13.1.png) <!-- req-gallery:13.1 -->
  </details>

- `13.2` A window handle moves by keyboard: ←/→ shift it a day, and the flags and ARIA values follow.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:13.2 -->
  </details>

- `13.3` **Optimize?** opens **"Pick the best dates"**: a day count (prefilled with the window's length), **"Include the most weekends"** on by default, and **Find best dates** — which glides the window to the best-scoring dates.

  <details><summary>Acceptance & golden</summary>

  ![plan-window.13.3](requirements/screen/cases/plan-window.13.3.png) <!-- req-gallery:13.3 -->

  Best-scoring: most weekend days covered first (when ticked), then most favourites with an available performance, then most available performances.
  </details>

## 14. Scheduling rules

- `14.1` A performance is bookable only when its ticket status says so: sold-out, off-sale, cancelled, postponed, no-allocation **and blank/unknown** all count unavailable; offer statuses (2-for-1, pay-what-you-want) stay bookable.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.1 -->

  `plan/lib/availability.js` `isAvailable` / `UNAVAILABLE_STATUSES`.
  </details>

- `14.2` A slot must fit the day: it starts no earlier than the day start and ends no later than the day end.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.2 -->
  </details>

- `14.3` A slot must not overlap an enabled meal break — touching it edge-to-edge is fine.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.3 -->
  </details>

- `14.4` Between two shows the plan demands `max(chosen gap, travel time)` — travel only *adds* time when it exceeds the gap; a double bill at the same venue needs no travel at all; unknown coordinates fall back to the flat gap.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.4 -->

  `plan/lib/engine.js` `requiredGapMinutes` / `compatible`.
  </details>

- `14.5` Travel time is straight-line at honest August speeds: walk 3.33 km/h (Edinburgh hills and crowds), bike 15, car 22.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.5 -->

  `plan/lib/travel.js`.
  </details>

- `14.6` Pinned shows plan first: an exact pinned performance is taken even against day hours and meal breaks; a must-see can never overlap another must-see; pins ignore the per-day cap.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.6 -->
  </details>

- `14.7` Everything else is packed greedily, earliest finish first, with fully deterministic tie-breaks — the same inputs always give the same plan.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.7 -->
  </details>

- `14.8` A day left holding fewer shows than the per-day minimum is dropped whole — unless a pinned show sits on it.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.8 -->
  </details>

- `14.9` Shows past midnight belong to the evening before: a start before 06:00 is folded onto the previous festival day (+1440 minutes), and window membership is judged on that festival date.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.9 -->
  </details>

- `14.10` No day is packed past the per-day maximum (except by pins).

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:14.10 -->
  </details>

## 15. Preferences and the schedule

- `15.1` The preferences strip reads as one sentence of ground rules, with these defaults: **Day 09:00–25:00**, **Lunch on 12:30–13:30**, **Dinner off**, **1–3 shows/day**, **30 min apart**, **Walk**.

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.1](requirements/screen/cases/plan-preferences.15.1.png) <!-- req-gallery:15.1 -->

  Day end accepts up to `27:00` (03:00) — which is why it's a text box, not a native time input. Mode tooltips explain travel is used only when longer than the gap.
  </details>

- `15.2` The schedule draws each planned day as a column on one 09:00→27:00 time axis: availability-coloured show blocks, travel legs between close shows, the lunch band **"12:30–13:30 · 🍽 Lunch"**, shaded before/after-hours zones, and the **"🚆 Arrive"** / **"🧳 Leave"** trip blocks on the boundary days.

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.2](requirements/screen/cases/plan-preferences.15.2.png) <!-- req-gallery:15.2 -->

  Hours past midnight keep counting (`24:00`, `25:00`, …) so the night reads as one evening. Empty days collapse to slivers. Blocks link to edfringe.com; plain click pins instead.
  </details>

- `15.3` Every row wears an honest verdict pill: **✓ Scheduled!**, amber **▲** conflicts (**Too early / Too late / Lunch conflict / Dinner conflict / Meal conflict** or the two-culprit combo), **Can't fit**, **Sold out**, or **📅 No dates**.

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.3](requirements/screen/cases/plan-preferences.15.3.png) <!-- req-gallery:15.3 -->

  Sold-out wins over no-dates (a different window won't help). A pinned row's pill is preceded by 🔒.
  </details>

- `15.4` Hovering a conflict pill explains it in the user's own numbers — e.g. **"Every performance of this show runs during your lunch break (12:30–13:30), so the plan can't take it."** — with **"Click to go to the setting and change it"**.

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.4](requirements/screen/cases/plan-preferences.15.4.png) <!-- req-gallery:15.4 -->
  </details>

- `15.5` A setting that shuts shows out wears **"⚠ Prevents \<n\>"** beside it, naming the shows in its tooltip.

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.5](requirements/screen/cases/plan-preferences.15.5.png) <!-- req-gallery:15.5 -->

  A control is culpable only if relaxing it alone would free at least one performance.
  </details>

- `15.6` There is no Plan button: nudging any preference re-plans instantly.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:15.6 -->

  Editing the day-end box immediately changes the schedule and summary.
  </details>

- `15.7` The summary is one sentence: **"Planned \<n\> of \<m\> shows across \<d\> days (\<d0\>–\<d1\> Aug)."**

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.7](requirements/screen/cases/plan-preferences.15.7.png) <!-- req-gallery:15.7 -->
  </details>

- `15.8` When nothing fits at all: **"Nothing could be scheduled in this window. Try widening your dates, raising the per-day maximum, shortening the gap, or relaxing your day hours / meal breaks."**

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.8](requirements/screen/cases/plan-preferences.15.8.png) <!-- req-gallery:15.8 -->
  </details>

- `15.9` The plan's edges carry the two partner nags — **"Need a place to sleep?"** in the night zone and **"Transportation sorted?"** on the trip blocks — each dismissible for good.

  <details><summary>Acceptance & golden</summary>

  ![plan-preferences.15.9](requirements/screen/cases/plan-preferences.15.9.png) <!-- req-gallery:15.9 -->

  Links are plain deep links until affiliate IDs are configured; `rel="sponsored noopener noreferrer"`.
  </details>

- `15.10` Clicking a conflict pill takes you to the setting responsible and flashes it.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:15.10 -->
  </details>

## 16. Exports

- `16.1` **Download itinerary CSV** produces `fringe-itinerary.csv`: UTF-8 with BOM, CRLF, headers **Date, Day, Start, End, Show, Genre, Venue, Room, Status, Tickets**, one row per planned show.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:16.1 -->
  </details>

- `16.2` **Import to calendar ICS** produces `fringe-plan.ics` pinned to Edinburgh: `DTSTART;TZID=Europe/London` with an embedded VTIMEZONE, a stable UID per show+time (re-import updates, never duplicates), the calendar name **"Fringe 2026 · \<d0\>–\<d1\> Aug"**, and a 30-minute reminder.

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:16.2 -->
  </details>

- `16.3` After the ICS download the page walks you into Google Calendar: **"Downloaded — now into Google Calendar"** with the two steps and the own-calendar note.

  <details><summary>Acceptance & golden</summary>

  ![plan-exports.16.3](requirements/screen/cases/plan-exports.16.3.png) <!-- req-gallery:16.3 -->
  </details>

- `16.4` Both export buttons are disabled while nothing is scheduled — and the note under them promises **"Both files are built here in your browser — nothing is uploaded."**

  <details><summary>Acceptance & proof</summary>

  🚩 _Behavior leaf._ <!-- req-gallery:16.4 -->
  </details>

- `16.5` The files are correct to the byte: CSV cells are RFC-4180 escaped; ICS lines fold at 75 octets.

  <details><summary>Acceptance & proof</summary>

  🔧 _Logic leaf._ <!-- req-gallery:16.5 -->

  `plan/lib/itinerary.js`.
  </details>
