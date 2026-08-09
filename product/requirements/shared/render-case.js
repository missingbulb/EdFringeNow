// Renders one screen case to a PNG buffer — the single pixel source shared by
// the comparing runner (screen.test.js) and the refresh lane (refresh.js), so
// a golden can never be produced one way and checked another.
"use strict";

const { newPage, ORIGIN } = require("./harness/browser");
const { nowReady, planReady } = require("./case-helpers");

async function renderScreenCase(testCase) {
  const { page, context } = await newPage({
    viewport: testCase.viewport,
    localStorage: testCase.localStorage,
    geolocation: testCase.geolocation,
    failData: testCase.failData,
  });
  try {
    const pagePath = testCase.page || "/";
    await page.goto(`${ORIGIN}${pagePath}`, { waitUntil: "load" });
    if (testCase.ready) await testCase.ready(page);
    else if (pagePath.startsWith("/plan")) await planReady(page);
    else await nowReady(page);
    if (testCase.drive) await testCase.drive(page, { origin: ORIGIN });
    return await page.screenshot({ fullPage: !testCase.viewportOnly, animations: "disabled" });
  } finally {
    await context.close();
  }
}

module.exports = { renderScreenCase };
