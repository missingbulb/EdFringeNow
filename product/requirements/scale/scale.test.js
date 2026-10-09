// The scale kind's runner: each case drives a real page in the harness with the
// data routes pointed at the repo's real committed data (site/data/) instead of
// the frozen fixture, and asserts bounds in code — the coded assertions ARE the
// owner-approved expected, so they are never weakened to pass. Runs in the
// `test:ui` lane. Self-asserts that it covers exactly the scale cases.
"use strict";

const path = require("node:path");
const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadCases } = require("../shared/cases");
const { newPage, closeBrowser, ORIGIN } = require("../shared/harness/browser");

const CASES = loadCases().filter((c) => c.kind === "scale");
const REAL_DATA = path.join(__dirname, "..", "..", "..", "site", "data");

test("there is at least one scale case", () => {
  assert.ok(CASES.length > 0, "no scale cases found");
});

test("every scale case declares a verify()", () => {
  const bad = CASES.filter((c) => typeof c.verify !== "function").map((c) => c.name);
  assert.deepEqual(bad, [], "scale cases without a verify():");
});

// One at a time: a case times the page, and a neighbour's render competing for
// the same cores would be measured as this page's slowness.
describe("scale cases", { concurrency: 1 }, () => {
  for (const testCase of CASES) {
    test(`scale "${testCase.name}" (${testCase.description})`, async () => {
      const { page, context } = await newPage({
        viewport: testCase.viewport,
        localStorage: testCase.localStorage,
        dataDir: REAL_DATA,
      });
      try {
        await testCase.verify(page, { origin: ORIGIN, context, assert });
      } finally {
        await context.close();
      }
    });
  }
});

after(async () => {
  await closeBrowser();
});
