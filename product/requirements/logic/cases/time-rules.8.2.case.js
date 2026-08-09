"use strict";

module.exports = {
  description: "festivalNow reads any instant as Edinburgh wall-clock, whatever the device zone",
  async verify(assert) {
    const { festivalNow } = await import("../../../../js/clock.js");
    // 18:30 UTC in August = 19:30 BST in Edinburgh.
    const reading = festivalNow(new Date(Date.UTC(2026, 7, 15, 18, 30)));
    assert.equal(reading.date, "2026-08-15");
    assert.equal(reading.time, "19:30");
    assert.equal(reading.minutes, 19 * 60 + 30);
    // A winter instant reads GMT (UTC+0): the zone rule, not a fixed offset.
    assert.equal(festivalNow(new Date(Date.UTC(2026, 0, 15, 18, 30))).time, "18:30");
  },
};
