# Brief: EdFringeNow trip planner, second pass

## What the owner said (their words, lightly condensed)
"This needs to feel like a vacation planner, not a corporate app." The first attempt
(read-only reference: /home/user/EdFringeNow/design-concepts/trip-planner/*.body.html — it covers
the right FUNCTIONALITY but looks like "a collection of buttons or an enterprise app") is what
NOT to do.

Do this instead:
- Ease the customer into an iterative building phase. Wizard feel: when you choose something it
  alters the next phases and you don't need to deal with it any longer — an answered question HIDES
  (collapses into a small token/sticker/chip you can reopen).
- Key behaviour questions are shown as a few KEY OPTIONS, each represented by a GRAPHIC — clipart
  that describes the situation — as the mental summary of a simple radio choice. Picture first,
  one or two words at most.
- Very task-dedicated UI is fine, as long as text is MINIMAL by default (the owner says we tend to
  add too much text) and the UI is intuitive to the question at hand.

## The functionality the flow must cover (from the original ask)
1. Which festival: choosable by city, by season, by genre, or a specific festival by name.
   Other festivals in the same city/dates can be added alongside.
2. Priorities: cost (cheap vs expensive), pace (many things a day vs leisurely),
   focus (only the festival vs other plans in the city too).
3. Travel party: alone / a couple / with kids / a group — this changes a lot downstream.
4. Where they come from and go back to (travel arrangements pencilled into the trip).
5. Accommodation: choose 2 of {cost, comfort, location}; we suggest something.
6. Then WE throw a draft plan onto a schedule and the user CORRECTS it: a calendar block lets them
   say "not at this time / not this performance / not this genre / not this venue" (for a repeating
   comedy show); other event types may show other options; a one-time event only offers
   "not interested". Starred items are never swapped out.
7. Longer excursions (half/full day) can be shoved into the calendar in parallel to shows.
8. Food: meals with restaurant bookings.
9. The existing grid (content chooser) stays reachable but is NOT exposed initially; grouped by
   origin (Fringe vs International Festival etc.), everything visible behind "show 20 more",
   starred rows pinned.

## Hard constraints
- Deliver 4 screens, each a standalone HTML file, 1440px wide root (fixed width, height as needed,
  set a background). Files: /tmp/claude-0/-home-user-EdFringeNow/2c58a512-3dd4-57ea-ab4a-3cab56c577af/scratchpad/v2/<dir>/01-*.html … 04-*.html (full <html> documents, ALL CSS in
  one <style> in <head>, no external scripts, no external images). You may link Google Fonts via
  <link> (it will NOT load in the sandbox screenshots — fallbacks render there — but it loads in
  the final published canvas, so pick fallback stacks with similar metrics and check the layout
  survives the fallback).
- Screens to cover, in order: (1) the opening — festival + dates in a way that feels like starting
  a holiday, (2) a mid-wizard question with illustrated radio options (party, or cost/pace/focus),
  (3) the moment answered questions have collapsed and the DRAFT SCHEDULE is revealed, (4) the
  correction gesture on a schedule block (the not-this-time/show/genre/venue choice) — plus, if it
  fits on screen 3 or 4, where excursions/food/"pick shows myself" live.
- ILLUSTRATIONS ARE THE POINT. Draw them as inline SVG: flat, friendly clipart — a family with
  small kids, a couple, a solo traveller, a group of friends; a wallet vs a champagne glass; a
  sprinting figure vs a deckchair; a stage curtain vs a city skyline; a train, a plane, a car; a
  cosy guesthouse vs a hotel; a picnic/day-out; a restaurant table. Simple shapes, 2-4 colours
  each, a consistent stroke and palette. No emoji anywhere. No stock-photo placeholders.
- MINIMAL TEXT. A question is a short line ("Who's coming?"). An option is a picture plus 1-2
  words. No explanatory paragraphs, no helper sentences, no legends unless a picture can't carry it.
  Count words on each screen; if a screen has more than ~60 words of UI copy, cut.
- Keep the product name "EdFringeNow" somewhere small. The current planner's violet #6c4cf1 may be
  an accent but you are free to pick a warmer holiday palette and characterful fonts (avoid Inter,
  Roboto, Arial as the display face). Vacation, not dashboard.
- Realistic sample content for Edinburgh in August: Fringe shows, the International Festival, the
  Book Festival, the Tattoo; venues like Pleasance Courtyard, Assembly George Square, Underbelly,
  Usher Hall; a train from London King's Cross. Sample values are illustrative.
- Hit targets ≥ 44px. Use flex/grid with gap for layout.

## How to check your work
Render each file with the preinstalled headless Chromium and LOOK at the PNG (use the Read tool on
the PNG). Iterate until it looks like a holiday planner you'd be proud of. Script:

  cat > /tmp/claude-0/-home-user-EdFringeNow/2c58a512-3dd4-57ea-ab4a-3cab56c577af/scratchpad/v2/<dir>/shot.mjs <<'JS'
  import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
  const [,, dir, ...names] = process.argv;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  for (const n of names) { await p.goto(`file://${dir}/${n}.html`); await p.screenshot({ path: `${dir}/${n}.png`, fullPage: true }); console.log('shot', n); }
  await b.close();
  JS
  node shot.mjs /tmp/claude-0/-home-user-EdFringeNow/2c58a512-3dd4-57ea-ab4a-3cab56c577af/scratchpad/v2/<dir> 01-opening 02-question 03-schedule 04-correct

(Never npm-install playwright; the absolute import above is the one that works here. Expect a
favicon 404 and Google Fonts failing to load — both are harmless.)

## What to hand back
A short report (≤ 250 words): the direction's name and one-line idea, the list of files, the word
count per screen, and the 2-3 design decisions you most want the reviewers to judge. No file dumps.
