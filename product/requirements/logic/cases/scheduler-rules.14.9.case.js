"use strict";

module.exports = {
  description: "a start before 06:00 folds onto the previous festival day (+1440), and the window is judged on that date",
  async verify(assert) {
    const { festivalNight, eligibleSlots, NIGHT_FOLD_CUTOFF_MIN } = await import(
      "../../../../plan/lib/engine.js"
    );
    assert.equal(NIGHT_FOLD_CUTOFF_MIN, 360);

    assert.deepEqual(festivalNight("2026-08-16", 45), {
      festivalDate: "2026-08-15",
      festivalStartMinute: 45 + 1440,
    });
    assert.deepEqual(festivalNight("2026-08-16", 360), {
      festivalDate: "2026-08-16",
      festivalStartMinute: 360,
    });

    // A 00:45 show on the 16th is a member of a window ending on the 15th…
    const show = {
      slug: "midnight",
      title: "midnight",
      venue: "V1",
      duration: 60,
      performances: [{ date: "2026-08-16", start: "00:45", status: "TICKETS_AVAILABLE" }],
    };
    const inWindow = eligibleSlots([show], { dateStart: "2026-08-15", dateEnd: "2026-08-15" });
    assert.equal(inWindow.get("midnight").length, 1);
    const slot = inWindow.get("midnight")[0];
    assert.equal(slot.date, "2026-08-15"); // festival date
    assert.equal(slot.realDate, "2026-08-16"); // real date kept for exports
    assert.equal(slot.startMinuteOfDay, 45 + 1440);
    // …and NOT a member of a window that only starts on the 16th.
    const outWindow = eligibleSlots([show], { dateStart: "2026-08-16", dateEnd: "2026-08-16" });
    assert.equal(outWindow.get("midnight").length, 0);
  },
};
