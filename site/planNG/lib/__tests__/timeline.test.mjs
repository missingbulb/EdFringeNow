import { test } from "node:test";
import assert from "node:assert/strict";

import { timelineSpan, timelineBars, monthTicks, stackRows, dayFrac } from "../timeline.js";

test("the span is twelve whole months from the month before today", () => {
  const span = timelineSpan("2026-09-24");
  assert.equal(span.from, "2026-08-01");
  assert.equal(span.to, "2027-07-31");
  assert.equal(span.days, 365);
  assert.equal(monthTicks(span).length, 12);
  assert.equal(dayFrac(span, span.from), 0);
});

test("one bar per edition in the span, sorted by start", () => {
  const registry = {
    festivals: [
      { id: "b", editions: [{ id: "2026", firstDate: "2026-10-01", lastDate: "2026-10-03", dataUrl: "/x" }] },
      {
        id: "a",
        editions: [
          { id: "2025", firstDate: "2025-10-01", lastDate: "2025-10-03", dataUrl: "/y" },
          { id: "2026", firstDate: "2026-09-01", lastDate: "2026-09-02", dataUrl: null },
        ],
      },
    ],
  };
  const bars = timelineBars(registry, timelineSpan("2026-09-24"));
  assert.deepEqual(
    bars.map((b) => b.key),
    ["a@2026", "b@2026"]
  );
  assert.equal(bars[0].hasData, false);
  assert.ok(bars[0].end > bars[0].start);
});

test("bars that would overlap stack onto new rows", () => {
  assert.deepEqual(
    stackRows(
      [
        { from: 0, to: 10 },
        { from: 5, to: 12 },
        { from: 11, to: 20 },
        { from: 13, to: 14 },
      ],
      0
    ),
    [0, 1, 0, 1]
  );
});
