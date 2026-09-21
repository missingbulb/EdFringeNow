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

// Festival planner (/planJerusalem): a starred list, under that page's own
// storage prefix. The cast spans what Part V asserts — a free late-night that
// repeats on four evenings, two runs that play twice in one evening, a film,
// two shows half an hour apart at different venues (so the schedule draws a
// travel leg), and a clash that cannot be fitted (so the grid shows a verdict
// other than "Scheduled").
const JERUSALEM_STARRED = [
  "opening",
  "poetry-slam",
  "salakh",
  "late",
  "king",
  "yona-kapach",
  "neighbor",
];

function jerusalemStarred(slugs = JERUSALEM_STARRED) {
  return { "jerusalemPlan.starred": JSON.stringify(slugs) };
}

// The three verdicts that are not "favourite" — that one is the starred list
// above, which predates them and keeps its own key.
function jerusalemVerdicts({ locked = {}, noTime = [], noShow = [] } = {}) {
  return { "jerusalemPlan.verdicts": JSON.stringify({ locked, noTime, noShow }) };
}

/* Hand a contested hour on: click the band the stack of beaten cards leaves
 * showing past the winner's edge, which is where a reader's pointer lands.
 * Scrolled into view first — the band is addressed by viewport coordinates,
 * and a slot below the fold would otherwise be clicked at thin air. */
async function clickStackBand(page, slot) {
  const beaten = slot.locator(".sch-beaten").last();
  await beaten.scrollIntoViewIfNeeded();
  const box = await beaten.boundingBox();
  await page.mouse.click(box.x + box.width - 4, box.y + box.height / 2);
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
const QUIET_FRAMES = 2;
const MAX_FRAMES = 30;

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
  await page.evaluate(
    async ({ quietFrames, maxFrames }) => {
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
        for (let i = 0; i < maxFrames && quiet < quietFrames; i++) {
          // An image still loading will change the layout when it lands, so it
          // is decoded first and the quiet count starts over.
          const pending = [...document.images].filter((img) => !img.complete);
          if (pending.length) {
            await Promise.all(pending.map((img) => img.decode().catch(() => {})));
            quiet = 0;
            continue;
          }
          dirty = false;
          const before = window.scrollX + "," + window.scrollY;
          await new Promise((resolve) => requestAnimationFrame(() => resolve()));
          const moved = before !== window.scrollX + "," + window.scrollY;
          quiet = dirty || moved ? 0 : quiet + 1;
        }
      } finally {
        observer.disconnect();
      }
    },
    { quietFrames: QUIET_FRAMES, maxFrames: MAX_FRAMES }
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
  // The app boots on its built-in simulated day and only adopts the (fixed)
  // real clock once the in-UK geolocation fix lands — wait for the reference
  // day to actually be in force, or a slow fix leaves the preset day rendered.
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
async function jerusalemReady(page) {
  // `attached`, not `visible`: the browse list and the grid are the board's two
  // states and exactly one of them is on screen, so a visibility wait on both
  // can only ever resolve against the hidden one.
  await page.waitForSelector("#browseList .ss-row, #lanes .lane", { state: "attached", timeout: 20000 });
  // The calendar is the page's own surface and is drafted from the programme
  // rather than from anything stored, so it renders in every state.
  await page.waitForSelector(".sch-show", { timeout: 20000 });
  await page.waitForFunction(() => {
    const pop = document.querySelector("#footerVersion .version-pop");
    return pop && pop.textContent.includes("v0.0.0-spec");
  }, { timeout: 20000 });
  // With shows on the board, the date-window overlay is positioned from the
  // laid-out day header two frames after the first render; capturing before
  // that catches every piece of it at zero width. An empty board has no
  // overlay to wait for.
  await page.waitForFunction(() => {
    if (!document.querySelector("#lanes .lane")) return true;
    const band = document.getElementById("railBand");
    return band && band.style.width !== "";
  }, { timeout: 20000 });
  await settle(page);
}

// Wait until a value the page computes stops changing across consecutive
// animation frames — the hook for anything the product positions or measures a
// frame or two after the gesture that caused it, where the element exists from
// the start and only its state is in flight.
async function stableValue(page, readFn, { quietFrames = 2, maxFrames = 40 } = {}) {
  await page.evaluate(
    async ({ src, quiet, max }) => {
      const read = new Function("return (" + src + ")")();
      let last = JSON.stringify(read());
      let same = 0;
      for (let i = 0; i < max && same < quiet; i++) {
        await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const now = JSON.stringify(read());
        same = now === last ? same + 1 : 0;
        last = now;
      }
    },
    { src: readFn.toString(), quiet: quietFrames, max: maxFrames }
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
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
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
  clickStackBand,
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
  uploadFile,
  FIXTURE_CSV,
  FIXTURES_DIR,
};
