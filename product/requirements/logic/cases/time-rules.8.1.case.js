"use strict";

module.exports = {
  description: "the fringe day runs 06:00→06:00; past-midnight times carry extended strings, wrapped only for display",
  async verify(assert) {
    const fd = await import("../../../../shared/fringe-day.js");
    assert.equal(fd.FRINGE_DAY_START_MINUTES, 360);
    assert.equal(fd.FRINGE_DAY_END_MINUTES, 1800);

    // Extended strings keep ordering: "24:30" (00:30 next morning) sorts after "23:00".
    assert.equal(fd.timeToMinutes("24:30"), 1470);
    assert.ok("24:30" > "23:00");
    assert.equal(fd.minutesToTime(1470), "24:30");

    // Display wraps back to the real clock.
    assert.equal(fd.clockHHMM(1470), "00:30");
    assert.equal(fd.clockLabel("24:30"), "00:30");
    assert.equal(fd.clockLabel("19:45"), "19:45");
    assert.ok(fd.isAfterMidnight(1470));
    assert.ok(!fd.isAfterMidnight(1170));

    // The real calendar moment of a folded time lands on the NEXT day.
    const m = fd.realMoment("2026-08-15", "24:30");
    assert.equal(m.date, "2026-08-16");
    assert.equal(m.time, "00:30");
  },
};
