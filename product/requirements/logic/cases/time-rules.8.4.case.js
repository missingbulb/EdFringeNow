"use strict";

module.exports = {
  description: "the ticker's delay to the next minute is always in (0, 60000] — it fires on the minute and can't spin",
  async verify(assert) {
    const { msToNextMinute } = await import("../../../../js/clock.js");
    const base = Date.UTC(2026, 7, 15, 18, 30, 0, 0);
    assert.equal(msToNextMinute(new Date(base)), 60000); // exactly on the minute → a whole minute
    assert.equal(msToNextMinute(new Date(base + 1)), 59999);
    assert.equal(msToNextMinute(new Date(base + 59999)), 1);
    for (const off of [0, 1, 12345, 59999]) {
      const ms = msToNextMinute(new Date(base + off));
      assert.ok(ms > 0 && ms <= 60000, `offset ${off} → ${ms}`);
    }
  },
};
