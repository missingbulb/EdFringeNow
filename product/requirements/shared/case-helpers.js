// Shared recipe pieces for screen/behavior cases: storage seeds, readiness
// waits and common drives — so a case stays a few declarative lines and the
// judgement about "when is the page settled" is made once, here.
"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { REFERENCE_NOW_UTC_MS } = require("./reference-now");

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

// ------------------------------------------------------------------- waits --
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
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

// ------------------------------------------------------------------ drives --
async function openPanel(page, triggerSelector) {
  await page.click(triggerSelector);
  await page.waitForTimeout(150);
}

// Upload a favourites file into the planner's intake from raw bytes.
async function uploadFile(page, name, content, mimeType = "text/csv") {
  await page.setInputFiles("#csvInput", { name, mimeType, buffer: Buffer.from(content) });
  await page.waitForTimeout(250);
}

const FIXTURE_CSV = () => fs.readFileSync(path.join(FIXTURES_DIR, "favourites.csv"), "utf8");

module.exports = {
  nowStorage,
  nowSettings,
  planFavourites,
  planPrefs,
  PLAN_FAVOURITES,
  jerusalemStarred,
  JERUSALEM_STARRED,
  nowReady,
  planReady,
  jerusalemReady,
  plan2Ready,
  settle,
  openPanel,
  uploadFile,
  FIXTURE_CSV,
  FIXTURES_DIR,
};
