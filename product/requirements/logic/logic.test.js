// The logic kind's runner: each case proves a pure product rule by importing
// the SHIPPED module (never re-implementing it) and asserting in code. No
// browser — this runs in the default `npm test` lane alongside the coverage
// gate. The assertions are the owner-approved expected.
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadCases } = require("../shared/cases");

const CASES = loadCases().filter((c) => c.kind === "logic");

test("there is at least one logic case", () => {
  assert.ok(CASES.length > 0, "no logic cases found");
});

test("every logic case declares a verify()", () => {
  const bad = CASES.filter((c) => typeof c.verify !== "function").map((c) => c.name);
  assert.deepEqual(bad, [], "logic cases without a verify():");
});

for (const testCase of CASES) {
  test(`logic "${testCase.name}" (${testCase.description})`, async () => {
    await testCase.verify(assert);
  });
}
