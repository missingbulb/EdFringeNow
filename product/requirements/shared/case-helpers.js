// Shared recipe pieces for screen/behavior cases: storage seeds, readiness
// waits and common drives — so a case stays a few declarative lines and the
// judgement about "when is the page settled" is made once, here.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { REFERENCE_NOW_UTC_MS } = require("./reference-now");
const { hasPausedClock } = require("./harness/browser");

const FIXTURES_DIR = path.join(__dirname, "fixtures");

// ------------------------------------------------------------ storage seeds --
// Now page: the intro is dismissed for every case except the intro's own.
function nowStorage(extra = {}) {
  return {
    "edfringenow.now.intro.v1": JSON.stringify({ dismissed: true }),
    ...extra,
  };
}

// Now page settings snapshot (filters, plan). Merged over the app's defaults.
function nowSettings(overrides = {}) {
  return {
    "edfringenow.now.v1": JSON.stringify({ date: "2026-08-15", ...overrides }),
  };
}

// Planner: a stored favourites list (fresh at the reference moment, so the
// 3-day TTL is live) and stored preferences.
const PLAN_FAVOURITES = [
  "100-full-blown-redacted",
  "116-grams-a-play-to-lose-weight",
  "15-minutes-of-shame",
  "borderlandscomedy",
  "anyone-fancy-a-bagel",
  "100-million-fish-in-the-aquarium",
  "100-scouse-comedy",
  "4-better-or-4-worse",
  "ray-bradshaw-five-years-in-a-row",
];

function planFavourites(slugs = PLAN_FAVOURITES) {
  return {
    "edfringe.plan.favourites.v1": JSON.stringify({
      v: 1,
      slugs,
      filename: "favourites.csv",
      savedAt: REFERENCE_NOW_UTC_MS,
    }),
  };
}

function planPrefs(overrides = {}) {
  return { "edfringe.plan.prefs.v1": JSON.stringify(overrides) };
}

// Festival planner (/planNG), focused on the Jerusalem Comedy Festival: a
// starred list, under that page's own storage prefix. The page pools several
// festivals, so it names a show `<festival>/<its own id>`; the helpers below
// take the festival's own ids and write them the way the page does.
//
// The cast spans what Part V asserts — a free late-night that repeats on four
// evenings, two runs that play twice in one evening, a film, two shows half an
// hour apart at different venues (so the schedule draws a travel leg), and a
// clash that cannot be fitted (so the grid shows a verdict other than
// "Scheduled").
const JERUSALEM_STARRED = [
  "opening",
  "poetry-slam",
  "salakh",
  "late",
  "king",
  "yona-kapach",
  "neighbor",
];

const JERUSALEM = "jerusalem-comedy";
const JERUSALEM_EDITION = "jerusalem-comedy@2026";
// The festival's own nights. The legacy date window counted positions in
// these, which is how a case still states one (`d0`, `d1`, 1-based).
const JERUSALEM_NIGHTS = ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"];
const inJerusalem = (id) => `${JERUSALEM}/${id}`;

function jerusalemStarred(slugs = JERUSALEM_STARRED) {
  return { "planNG.starred": JSON.stringify(slugs.map(inJerusalem)) };
}

// The three verdicts that are not "favourite" — that one is the starred list
// above, which predates them and keeps its own key.
function jerusalemVerdicts({ locked = {}, noTime = [], noShow = [] } = {}) {
  return {
    "planNG.verdicts": JSON.stringify({
      locked: Object.fromEntries(Object.entries(locked).map(([slug, key]) => [inJerusalem(slug), key])),
      noTime: noTime.map(inJerusalem),
      noShow: noShow.map(inJerusalem),
    }),
  };
}

// The answers to the preference questions, as the page stores them. Only the
// fields a case actually states are seeded; the page fills the rest with the
// defaults a first visit gets.
function jerusalemPrefs(overrides = {}) {
  const { d0, d1, interests, ...rest } = overrides;
  const prefs = { ...rest };
  if (interests) prefs.interests = interests.map(inJerusalem);
  if (d0 || d1) {
    prefs.windows = {
      [JERUSALEM_EDITION]: {
        from: JERUSALEM_NIGHTS[(d0 || 1) - 1],
        to: JERUSALEM_NIGHTS[(d1 || JERUSALEM_NIGHTS.length) - 1],
      },
    };
  }
  return { "planNG.prefs": JSON.stringify(prefs) };
}

// The Jerusalem trip with the day a first draft keeps already cleared by the
// reader: every day drafts shows, for a case whose story is on the day the
// page would otherwise keep for rest.
function jerusalemAllDays() {
  return {
    "planNG.days": JSON.stringify({ kept: {}, own: [], seededFor: "2026-10-17/2026-10-23", mealDates: [] }),
  };
}

// Where the reader said they are coming from, as the page stores it.
function plannerOrigin(origin) {
  return { "planNG.origin": JSON.stringify(origin) };
}

/* The site's fare service (api/fares.js), answering the page for real — the
 * shipped handler, with a token — against the partner's answers committed under
 * fixtures/fares/, one file per route (`partner-<from>-<to>.json`). A route
 * with no file is a partner that found nothing. Returns the questions the page
 * asked, as URLSearchParams, in order. */
async function routeFares(page) {
  const { handleFares } = await import("../../../api/fares.js");
  const asked = [];
  const partner = async (url) => {
    const q = new URL(url).searchParams;
    const file = path.join(FIXTURES_DIR, "fares", `partner-${q.get("origin").toLowerCase()}-${q.get("destination").toLowerCase()}.json`);
    const body = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : JSON.stringify({ success: true, data: [], currency: q.get("currency") });
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  };
  await page.route("**/api/fares?**", async (route) => {
    const url = route.request().url();
    asked.push(new URL(url).searchParams);
    const res = await handleFares(new Request(url), { TRAVELPAYOUTS_TOKEN: "fixture-token" }, partner);
    await route.fulfill({ status: res.status, contentType: "application/json", body: await res.text() });
  });
  return asked;
}

/* The site's where-from service, answering as Cloudflare's edge would for a
 * visitor connecting from `country` (null: an edge that could not tell). */
async function routeWhere(page, country) {
  const { handleWhere } = await import("../../../api/where.js");
  await page.route("**/api/where", async (route) => {
    const request = Object.assign(new Request(route.request().url()), { cf: country ? { country } : {} });
    const res = handleWhere(request);
    await route.fulfill({ status: res.status, contentType: "application/json", body: await res.text() });
  });
}

/* Both flight blocks settled: each has an answer (found or none) or has nothing
 * to look for. */
async function flightsSettled(page) {
  await page.waitForFunction(
    () => [...document.querySelectorAll(".flight[data-fares]")].every((f) => f.dataset.fares !== "wait"),
    null,
    { timeout: 20000 }
  );
  await settle(page);
}

// The calendar re-planned across a trip: its first and last column are the
// trip's first and last day.
async function calendarSpans(page, from, to) {
  await page.waitForFunction(
    ([f, t]) => {
      const cols = [...document.querySelectorAll("#schedule .sch-day")];
      return cols.length > 0 && cols[0].dataset.date === f && cols[cols.length - 1].dataset.date === t;
    },
    [from, to],
    { timeout: 20000 }
  );
  await settle(page);
}

// Every meal switched on, at the page's own default hours — what the "three
// meals" answer sets, spelled out so a case can seed it without driving the
// question.
function jerusalemMeals(places = {}) {
  return [
    { id: "breakfast", enabled: true, startMin: 8 * 60, endMin: 9 * 60, place: places.breakfast || "" },
    { id: "lunch", enabled: true, startMin: 12 * 60 + 30, endMin: 13 * 60 + 30, place: places.lunch || "" },
    { id: "dinner", enabled: true, startMin: 18 * 60, endMin: 19 * 60, place: places.dinner || "" },
  ];
}

/* The programme's drawer, opened. With the calendar carrying every constraint
 * the reader sets, nothing inside the drawer is needed to work it, so it opens
 * on the reader's own ask — and a case that asserts what is inside it has to
 * make that ask first. */
async function openDrawer(page) {
  await page.evaluate(() => {
    const drawer = document.getElementById("boardDrawer");
    if (!drawer.open) drawer.open = true;
  });
  await page.waitForTimeout(150);
  await settle(page);
}

/* Open a contested hour's list the way a pointer does: by resting on the count
 * its card carries. Scrolled into view first — the pointer is moved in viewport
 * coordinates, and a card below the fold would otherwise be hovered at thin air. */
async function openOthers(page, slot) {
  const others = slot.locator(".sch-others");
  await others.scrollIntoViewIfNeeded();
  await others.hover();
  await page.waitForSelector("#calRivals .pop-rival");
}

// ------------------------------------------------------------------- waits --
// "Settled" is a state the page reaches, not a duration to sit out: the fonts
// are in, every image has decoded, the page has stopped scrolling, and the DOM
// has stopped changing across consecutive animation frames. A page that never
// goes quiet — something re-rendering on an interval — is captured at the frame
// cap rather than held forever, which is the old blind wait's behaviour and its
// worst case.
//
// The scroll position is watched because a scroll is NOT a DOM mutation: a
// gesture that sends the page smoothly somewhere leaves the DOM still while the
// view is a third of the way there, and an observer alone calls that settled.
// The page must hold still for longer than the product's longest debounce, or
// "quiet" catches the gap between a gesture and the reaction it schedules: the
// time wheel reads its settled value 130ms after scrolling stops, and the
// planner's search runs 120ms after the last keystroke. Anything slower than
// this has to be waited for by name, on the case.
const QUIET_MS = 150;
const QUIET_FRAMES = 2;
const MAX_FRAMES = 60;
// Nothing here may wait forever. A frame wait is raced against a timer, since
// requestAnimationFrame is throttled to a standstill on a page the browser
// considers hidden — several at once, and one of them stalls where a lone page
// never would. The whole wait is bounded from this side too, so a page that
// cannot go quiet reports which case it was instead of hanging the lane.
const FRAME_TIMEOUT_MS = 50;
const SETTLE_TIMEOUT_MS = 5000;

async function bounded(promise, ms, what) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${what} did not finish within ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function settle(page) {
  if (hasPausedClock(page)) {
    // The frames belong to the case, which winds them deliberately — there is
    // nothing here to wait out but the loading the network still owes.
    await page.evaluate(async () => {
      await document.fonts.ready;
      const pending = [...document.images].filter((i) => !i.complete);
      await Promise.all(pending.map((i) => i.decode().catch(() => {})));
    });
    return;
  }
  await bounded(
    page.evaluate(
      async ({ quietFrames, quietMs, maxFrames, frameTimeoutMs }) => {
      const frame = () =>
        new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          requestAnimationFrame(finish);
          setTimeout(finish, frameTimeoutMs);
        });
      await document.fonts.ready;
      let dirty = false;
      const observer = new MutationObserver(() => {
        dirty = true;
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
      try {
        let quiet = 0;
        let quietSince = performance.now();
        for (let i = 0; i < maxFrames; i++) {
          if (quiet >= quietFrames && performance.now() - quietSince >= quietMs) break;
          // An image still loading will change the layout when it lands, so it
          // is decoded first and the quiet count starts over.
          const pending = [...document.images].filter((img) => !img.complete);
          if (pending.length) {
            await Promise.all(pending.map((img) => img.decode().catch(() => {})));
            quiet = 0;
            quietSince = performance.now();
            continue;
          }
          dirty = false;
          const before = window.scrollX + "," + window.scrollY;
          await frame();
          const moved = before !== window.scrollX + "," + window.scrollY;
          if (dirty || moved) {
            quiet = 0;
            quietSince = performance.now();
          } else {
            quiet++;
          }
        }
      } finally {
        observer.disconnect();
      }
    },
      { quietFrames: QUIET_FRAMES, quietMs: QUIET_MS, maxFrames: MAX_FRAMES, frameTimeoutMs: FRAME_TIMEOUT_MS }
    ),
    SETTLE_TIMEOUT_MS,
    `settle(${page.url()})`
  );
}

// Now page is ready once the list (or its empty-state note) has rendered, the
// version has landed in the footer popup, and the fixed-clock reference day has
// taken over from the app's built-in simulated one.
async function nowReady(page) {
  await page.waitForSelector("#showsGrid .show-item, #showsGrid .show-meta", { timeout: 20000 });
  // The version lands in the footer's popup element (shared/version-popup.js),
  // which is the signal that the page's own scripts have run — the number comes
  // from the page's stamp, pinned by the harness.
  await page.waitForFunction(() => {
    const pop = document.querySelector("#footerVersion .version-pop");
    return pop && pop.textContent.includes("v0.0.0-spec");
  }, { timeout: 20000 });
  // The app boots on a simulated day and moves to the pinned one only once the
  // in-UK geolocation fix lands. The page says when that is done: the date
  // label flips BEFORE the new day's shows are fetched and every panel, count
  // and list rebuilt from them, so waiting on the label caught the page still
  // showing what it booted with — an empty list reading "nothing reachable".
  await page.waitForSelector("body[data-settled]", { timeout: 20000 });
  await page.waitForFunction(() => {
    const l = document.getElementById("constraintDateLabel");
    return l && l.textContent.includes("15 Aug");
  }, { timeout: 20000 });
  await settle(page);
}

// The postcard planner (/plan2): the page marks itself ready once the test
// data and the symbol sheet are in and the first render has landed.
async function plan2Ready(page) {
  await page.waitForSelector("body[data-ready]", { timeout: 20000 });
  await settle(page);
}

// Planner is ready when the catalogue has landed (the search placeholder
// switches to the real count) and the version is in the footer popup.
async function planReady(page) {
  await page.waitForFunction(() => {
    const i = document.getElementById("ssInput");
    return i && i.placeholder.startsWith("Search all");
  }, { timeout: 20000 });
  // Same footer-popup wait as nowReady, above.
  await page.waitForFunction(() => {
    const pop = document.querySelector("#footerVersion .version-pop");
    return pop && pop.textContent.includes("v0.0.0-spec");
  }, { timeout: 20000 });
  await settle(page);
}

// The festival planner is ready once the programme has landed (the board has
// either its browse list or its lanes) and the page's scripts have put the
// version in the footer popup.
// The festival planner focused on a festival that may have no programme yet:
// its theme is on the page and its calendar has a column per day. A festival
// with a programme wants jerusalemReady (or its like) as well.
async function plannerReady(page, festivalId) {
  await page.waitForSelector(`html[data-festival="${festivalId}"]`, { state: "attached", timeout: 20000 });
  await page.waitForSelector("#schedule .sch-day", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => {
    const pop = document.querySelector("#footerVersion .version-pop");
    return pop && pop.textContent.includes("v0.0.0-spec");
  }, { timeout: 20000 });
  await settle(page);
}

// The calendar's days, first to last, as ISO dates.
function calendarDays(page) {
  return page.$$eval("#schedule .sch-day", (cols) => cols.map((c) => c.dataset.date));
}

async function jerusalemReady(page) {
  // `attached`, not `visible`: the browse list and the grid are the board's two
  // states and exactly one of them is on screen, so a visibility wait on both
  // can only ever resolve against the hidden one.
  // A pool too long to browse (a period reaching a neighbouring festival) asks
  // for a search instead of listing, which is its own settled state.
  await page.waitForSelector("#browseList .ss-row, #lanes .lane, #browseMore .browse-search-first", {
    state: "attached",
    timeout: 20000,
  });
  // The calendar is the page's own surface and is drafted from the programme
  // rather than from anything stored, so it renders in every state.
  await page.waitForSelector(".sch-show", { timeout: 20000 });
  await page.waitForFunction(() => {
    const pop = document.querySelector("#footerVersion .version-pop");
    return pop && pop.textContent.includes("v0.0.0-spec");
  }, { timeout: 20000 });
  await settle(page);
}

// Wait until a value the page computes stops changing across consecutive
// animation frames — the hook for anything the product positions or measures a
// frame or two after the gesture that caused it, where the element exists from
// the start and only its state is in flight.
async function stableValue(page, readFn, { quietFrames = 2, maxFrames = 40 } = {}) {
  await bounded(
    page.evaluate(
      async ({ src, quiet, max, frameTimeoutMs }) => {
        const read = new Function("return (" + src + ")")();
        let last = JSON.stringify(read());
        let same = 0;
        for (let i = 0; i < max && same < quiet; i++) {
          await new Promise((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve();
            };
            requestAnimationFrame(finish);
            setTimeout(finish, frameTimeoutMs);
          });
          const now = JSON.stringify(read());
          same = now === last ? same + 1 : 0;
          last = now;
        }
      },
      { src: readFn.toString(), quiet: quietFrames, max: maxFrames, frameTimeoutMs: FRAME_TIMEOUT_MS }
    ),
    SETTLE_TIMEOUT_MS,
    "stableValue"
  );
}

// The time wheels are positioned from state on the frame after their panel is
// shown, and re-applied a frame later when the first attempt found no laid-out
// height to scroll. Both have landed once each wheel's scroll position holds
// still and the selected item is marked.
async function wheelsSettled(page) {
  await page.waitForSelector("#hourWheel .wheel-item.sel");
  await stableValue(page, () => ["hourWheel", "minWheel"].map((id) => (document.getElementById(id) || {}).scrollTop));
  await settle(page);
}

// The map is drawn once every tile in view has loaded — a tile still in flight
// paints as blank, and the layers above it (pins, clusters, the reach circle)
// are placed as the tiles arrive.
async function tilesSettled(page) {
  await page.waitForSelector(".leaflet-tile-loaded");
  await page.waitForFunction(() => {
    const tiles = [...document.querySelectorAll(".leaflet-tile")];
    return tiles.length > 0 && tiles.every((t) => t.classList.contains("leaflet-tile-loaded"));
  });
  await stableValue(page, () => document.querySelectorAll(".leaflet-marker-icon, .leaflet-tile").length);
  await settle(page);
}

// Put the page back at the top and wait for the frame that paints it there,
// rather than for a duration long enough to cover it. Smooth scrolling is
// frozen, so the position itself lands synchronously.
async function scrollToTop(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  if (hasPausedClock(page)) return;
  await bounded(
    page.evaluate(
      (frameTimeoutMs) =>
        new Promise((resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            resolve();
          };
          requestAnimationFrame(finish);
          setTimeout(finish, frameTimeoutMs);
        }),
      FRAME_TIMEOUT_MS
    ),
    SETTLE_TIMEOUT_MS,
    "scrollToTop"
  );
}

// Perform a gesture whose consequence arrives later than the gesture itself —
// a file read, a fetch, anything behind a debounce — and wait for it. The page
// is quiet in the gap between the two, so waiting for quiet alone would return
// before the reaction; this waits for the DOM to change at least once first.
async function awaitReaction(page, gesture) {
  await page.evaluate(() => {
    window.__reacted = false;
    window.__reactionObserver = new MutationObserver(() => {
      window.__reacted = true;
    });
    window.__reactionObserver.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
  await gesture();
  try {
    await page.waitForFunction(() => window.__reacted);
  } finally {
    await page.evaluate(() => {
      window.__reactionObserver.disconnect();
      delete window.__reactionObserver;
      delete window.__reacted;
    });
  }
  await settle(page);
}

// ------------------------------------------------------------------ drives --
async function openPanel(page, triggerSelector) {
  await page.click(triggerSelector);
  await settle(page);
}

// Page the whole list in. A paging click appends asynchronously, so the
// button's visibility only means anything once the appended page has landed —
// re-reading it straight after the click can catch it mid-render and leave the
// list half-paged, with the card a case was scrolling towards never arriving.
async function revealWholeList(page) {
  const more = page.locator("#showMore");
  const cards = page.locator(".show-item");
  // Stop when the list stops growing, not when the button goes: the button
  // outlives the last page as "Show 0 more · 0 left", so trusting it alone can
  // spin. A paging click also appends asynchronously, so each page has to land
  // before the next count means anything.
  for (let before = -1; before !== (await cards.count()); ) {
    before = await cards.count();
    if (!(await more.isVisible())) return;
    await more.click();
    await settle(page);
  }
}

// Upload a favourites file into the planner's intake from raw bytes.
async function uploadFile(page, name, content, mimeType = "text/csv") {
  await awaitReaction(page, () =>
    page.setInputFiles("#csvInput", { name, mimeType, buffer: Buffer.from(content) })
  );
}

const FIXTURE_CSV = () => fs.readFileSync(path.join(FIXTURES_DIR, "favourites.csv"), "utf8");

module.exports = {
  nowStorage,
  nowSettings,
  planFavourites,
  planPrefs,
  PLAN_FAVOURITES,
  jerusalemStarred,
  jerusalemVerdicts,
  jerusalemPrefs,
  jerusalemMeals,
  jerusalemAllDays,
  plannerOrigin,
  plannerReady,
  routeFares,
  routeWhere,
  flightsSettled,
  calendarDays,
  calendarSpans,
  JERUSALEM,
  JERUSALEM_EDITION,
  openDrawer,
  openOthers,
  JERUSALEM_STARRED,
  nowReady,
  planReady,
  jerusalemReady,
  plan2Ready,
  settle,
  stableValue,
  wheelsSettled,
  tilesSettled,
  scrollToTop,
  awaitReaction,
  openPanel,
  revealWholeList,
  uploadFile,
  FIXTURE_CSV,
  FIXTURES_DIR,
};
