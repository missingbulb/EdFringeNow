"use strict";

module.exports = {
  description: "the time wheel steps by 5 minutes from now to 29:55, opening at now + 2 h",
  async verify(assert) {
    const ct = await import("../../../../js/constraint-time.js");
    const fd = await import("../../../../shared/fringe-day.js");

    assert.equal(ct.WHEEL_STEP, 5);
    assert.deepEqual(ct.WHEEL_MINUTES, ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"]);

    // Reference now: 19:30 = 1170. Default = +120 min, snapped to 5.
    assert.equal(ct.CONSTRAINT_DEFAULT_LEAD_MINUTES, 120);
    assert.equal(ct.defaultConstraintTime(1170), "21:30");
    assert.equal(ct.defaultConstraintTime(1173), "21:35"); // 19:33 + 120, snapped to 5

    // Earliest offered slot: the next whole 5 minutes.
    assert.equal(ct.earliestWheelMinutes(1170), 1170);
    assert.equal(ct.earliestWheelMinutes(1171), 1175);

    // The wheel runs to 29:55 — five minutes short of the 06:00 fringe-day end.
    const hours = ct.wheelHours(1170);
    assert.equal(hours[0], "19"); // zero-padded strings
    assert.equal(hours[hours.length - 1], "29");
    const lastHour = ct.minutesForHour(29, 1170);
    assert.equal(lastHour[lastHour.length - 1], "55");
    assert.equal(fd.FRINGE_DAY_END_MINUTES, 1800); // 29:55 = 1795 = END - 5

    // The current hour drops minutes already gone; other hours are complete.
    assert.deepEqual(ct.minutesForHour(19, 1172), ["35", "40", "45", "50", "55"]);
    assert.deepEqual(ct.minutesForHour(20, 1172), ct.WHEEL_MINUTES);

    // Hours past midnight display as 00–05.
    assert.equal(fd.hourLabel(24), "00");
    assert.equal(fd.hourLabel(29), "05");
  },
};
