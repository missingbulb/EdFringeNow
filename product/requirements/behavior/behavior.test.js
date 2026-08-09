// The behavior kind's runner: each case drives a real page in the harness and
// asserts the gesture's consequence in code — the coded assertions ARE the
// owner-approved expected, so they are never weakened to pass. Runs in the
// `test:ui` lane. Self-asserts that it covers exactly the behavior cases.
"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadCases } = require("../shared/cases");
const { newPage, closeBrowser, ORIGIN } = require("../shared/harness/browser");

const CASES = loadCases().filter((c) => c.kind === "behavior");

test("there is at least one behavior case", () => {
  assert.ok(CASES.length > 0, "no behavior cases found");
});

test("every behavior case declares a verify()", () => {
  const bad = CASES.filter((c) => typeof c.verify !== "function").map((c) => c.name);
  assert.deepEqual(bad, [], "behavior cases without a verify():");
});

for (const testCase of CASES) {
  test(`behavior "${testCase.name}" (${testCase.description})`, async () => {
    const { page, context } = await newPage({
      viewport: testCase.viewport,
      localStorage: testCase.localStorage,
      geolocation: testCase.geolocation,
      failData: testCase.failData,
    });
    try {
      await testCase.verify(page, { origin: ORIGIN, context, assert });
    } finally {
      await context.close();
    }
  });
}

after(async () => {
  await closeBrowser();
});
