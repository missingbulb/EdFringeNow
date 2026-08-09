// The screen kind's runner: every screen case is rendered by the shared
// harness and compared pixel-exact to its committed golden. Runs in the
// `test:ui` lane (needs the pinned Playwright Chromium). On a mismatch the
// failure artifacts land in shared/.artifacts/ — surface them to the owner;
// never refresh a golden to silence a red case.
"use strict";

const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { loadCases, goldenPath } = require("../shared/cases");
const { renderScreenCase } = require("../shared/render-case");
const { compareToGolden } = require("../shared/compare");
const { closeBrowser } = require("../shared/harness/browser");

const CASES = loadCases().filter((c) => c.kind === "screen");

test("there is at least one screen case", () => {
  assert.ok(CASES.length > 0, "no screen cases found");
});

for (const testCase of CASES) {
  test(`screen "${testCase.name}" (${testCase.description}) matches its golden`, async () => {
    const png = await renderScreenCase(testCase);
    const result = compareToGolden(testCase.name, png, goldenPath(testCase));
    assert.ok(result.ok, result.reason);
  });
}

after(async () => {
  await closeBrowser();
});
