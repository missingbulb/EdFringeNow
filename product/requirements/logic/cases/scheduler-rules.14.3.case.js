"use strict";

module.exports = {
  description: "a slot must not overlap an enabled meal break — edge-to-edge contact is fine",
  async verify(assert) {
    const { withinDayWindow, normalizeMealBreaks } = await import("../../../../plan/lib/engine.js");
    const win = {
      dayStartMin: 0,
      dayEndMin: 1620,
      mealBreaks: normalizeMealBreaks([{ start: "12:30", end: "13:30", enabled: true }]),
    };
    const slot = (start, end) => ({ startMinuteOfDay: start, endMinuteOfDay: end });
    assert.ok(!withinDayWindow(slot(765, 825), win)); // 12:45–13:45 overlaps
    assert.ok(!withinDayWindow(slot(700, 751), win)); // ends 12:31 — one minute in
    assert.ok(withinDayWindow(slot(690, 750), win)); // ends exactly 12:30
    assert.ok(withinDayWindow(slot(810, 870), win)); // starts exactly 13:30
    // A disabled break doesn't exist.
    const off = { ...win, mealBreaks: normalizeMealBreaks([{ start: "12:30", end: "13:30", enabled: false }]) };
    assert.ok(withinDayWindow(slot(765, 825), off));
  },
};
