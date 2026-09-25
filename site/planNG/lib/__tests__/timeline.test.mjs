import { test } from "node:test";
import assert from "node:assert/strict";

import { timelineSpan, timelineBars, timelineBunches, monthTicks, stackRows, dayFrac } from "../timeline.js";

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

test("a city's festivals that meet are one bunch, led by the longest run with a programme", () => {
  const fest = (id, city, firstDate, lastDate, dataUrl = "/x") => ({
    id,
    city,
    country: "GB",
    editions: [{ id: "2026", firstDate, lastDate, dataUrl }],
  });
  const registry = {
    festivals: [
      fest("tattoo", "Edinburgh", "2026-08-07", "2026-08-29", null),
      fest("fringe", "Edinburgh", "2026-08-07", "2026-08-31"),
      fest("film", "Edinburgh", "2026-08-13", "2026-08-19"),
      fest("hogmanay", "Edinburgh", "2026-12-29", "2027-01-01"),
      fest("seaside", "North Berwick", "2026-07-31", "2026-08-09"),
    ],
  };
  const bunches = timelineBunches(registry, timelineSpan("2026-08-15"));
  assert.deepEqual(
    bunches.map((b) => [b.key, b.bars.map((x) => x.festival.id)]),
    [
      ["seaside@2026", ["seaside"]],
      ["fringe@2026", ["fringe", "tattoo", "film"]],
      ["hogmanay@2026", ["hogmanay"]],
    ]
  );
  const edinburgh = bunches[1];
  assert.equal(edinburgh.start, Math.min(...edinburgh.bars.map((b) => b.start)));
  assert.equal(edinburgh.end, Math.max(...edinburgh.bars.map((b) => b.end)));
});
