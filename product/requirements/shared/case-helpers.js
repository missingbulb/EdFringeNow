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

// ------------------------------------------------------------------- waits --
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

// Now page is ready when the list (or its empty-state note) has rendered and
// the async version fetch has landed in the footer tooltip.
async function nowReady(page) {
  await page.waitForSelector("#showsGrid .show-item, #showsGrid .show-meta", { timeout: 20000 });
  await page.waitForFunction(() => {
    const v = document.getElementById("footerVersion");
    return v && v.title.includes("v0.0.0-spec");
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

// Planner is ready when the catalogue has landed (the search placeholder
// switches to the real count) and the version tooltip is in.
async function planReady(page) {
  await page.waitForFunction(() => {
    const i = document.getElementById("ssInput");
    return i && i.placeholder.startsWith("Search all");
  }, { timeout: 20000 });
  await page.waitForFunction(() => {
    const v = document.getElementById("footerVersion");
    return v && v.title.includes("v0.0.0-spec");
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
  nowReady,
  planReady,
  settle,
  openPanel,
  uploadFile,
  FIXTURE_CSV,
  FIXTURES_DIR,
};
