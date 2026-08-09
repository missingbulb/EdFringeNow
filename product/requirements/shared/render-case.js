// Renders one screen case to a PNG buffer — the single pixel source shared by
// the comparing runner (screen.test.js) and the refresh lane (refresh.js), so
// a golden can never be produced one way and checked another.
"use strict";

const { newPage, ORIGIN } = require("./harness/browser");
const { nowReady, planReady } = require("./case-helpers");
const { makeTools } = require("./capture-tools");

async function renderScreenCase(testCase) {
  const { page, context } = await newPage({
    viewport: testCase.viewport,
    localStorage: testCase.localStorage,
    geolocation: testCase.geolocation,
    failData: testCase.failData,
    timezone: testCase.timezone,
    advanceableClock: testCase.advanceableClock,
  });
  try {
    const pagePath = testCase.page || "/";
    await page.goto(`${ORIGIN}${pagePath}`, { waitUntil: "load" });
    if (testCase.ready) await testCase.ready(page);
    else if (pagePath.startsWith("/plan")) await planReady(page);
    else await nowReady(page);
    if (testCase.drive) await testCase.drive(page, { origin: ORIGIN });
    // Capture from a settled scroll position: drives that clicked through the
    // page may have left it part-scrolled (and mid-momentum), which skews
    // viewport→document rect conversion. Already-at-top pages fire no scroll
    // event here, so hover cards and popups survive.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(120);
    // The golden is the smallest surface that proves the leaf: a selector
    // (element crop), or a capture(page, tools) composing clips/stitches.
    // Whole-page capture is the deliberate exception, not the default.
    if (typeof testCase.capture === "string") {
      // Clip at the element's box rather than element.screenshot(): a clip
      // never scrolls, so a hover card or popup can't be dismissed mid-shot.
      const tools = makeTools(page);
      return await tools.element(testCase.capture);
    }
    if (typeof testCase.capture === "function") {
      return await testCase.capture(page, makeTools(page));
    }
    return await page.screenshot({ fullPage: !testCase.viewportOnly, animations: "disabled" });
  } finally {
    await context.close();
  }
}

module.exports = { renderScreenCase };
