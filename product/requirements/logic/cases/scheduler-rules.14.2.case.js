"use strict";

module.exports = {
  description: "a slot must start at/after the day start and end at/before the day end",
  async verify(assert) {
    const { withinDayWindow } = await import("../../../../plan/lib/engine.js");
    const win = { dayStartMin: 540, dayEndMin: 1500 }; // 09:00–25:00
    const slot = (start, end) => ({ startMinuteOfDay: start, endMinuteOfDay: end });
    assert.ok(withinDayWindow(slot(540, 600), win)); // exactly at the start
    assert.ok(withinDayWindow(slot(1440, 1500), win)); // ends exactly at the end
    assert.ok(!withinDayWindow(slot(539, 600), win)); // a minute early
    assert.ok(!withinDayWindow(slot(1441, 1501), win)); // a minute over
  },
};
