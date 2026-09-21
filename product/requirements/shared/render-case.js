// Renders one screen case to a PNG buffer — the single pixel source shared by
// the comparing runner (screen.test.js) and the refresh lane (refresh.js), so
// a golden can never be produced one way and checked another.
"use strict";

const { newPage, ORIGIN } = require("./harness/browser");
const { nowReady, planReady, scrollToTop } = require("./case-helpers");
const { makeTools } = require("./capture-tools");

async function renderScreenCase(testCase) {
  const { page, context } = await newPage({
    viewport: testCase.viewport,
    localStorage: testCase.localStorage,
    geolocation: testCase.geolocation,
    failData: testCase.failData,
    timezone: testCase.timezone,
    colorScheme: testCase.colorScheme,
    advanceableClock: testCase.advanceableClock,
  });
  try {
    return await driveAndCapture(page, testCase);
  } catch (err) {
    // A case that fails in CI cannot be re-run by the reader, and its failure
    // artifacts go to a host a session cannot reach — so the error carries what
    // the page actually showed at the moment it gave up.
    err.message += `\n\nPage state when this failed:\n${await describePage(page)}`;
    throw err;
  } finally {
    await context.close();
  }
}

// A compact account of what is on screen: enough to tell a page that rendered
// the wrong thing from one that rendered the right thing too late.
async function describePage(page) {
  try {
    const state = await page.evaluate(() => {
      const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 60) : null);
      const cards = [...document.querySelectorAll(".show-item")];
      return {
        url: location.pathname,
        scroll: [window.scrollX, window.scrollY],
        cards: cards.length,
        firstCards: cards.slice(0, 3).map((c) => text(c)),
        lastCard: text(cards[cards.length - 1]),
        showMore: text(document.getElementById("showMore")),
        day: text(document.getElementById("constraintDateLabel")),
        heading: text(document.querySelector("#showsGrid .show-meta, #showsHeading")),
      };
    });
    return JSON.stringify(state, null, 2);
  } catch (err) {
    return `(the page could not be read: ${err.message.split("\n")[0]})`;
  }
}

async function driveAndCapture(page, testCase) {
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
  await scrollToTop(page);
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
}

module.exports = { renderScreenCase };
