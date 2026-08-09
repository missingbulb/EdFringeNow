"use strict";

module.exports = {
  description: "festivalDate is festivalNow's inverse, DST edges included; invalid input yields an Invalid Date",
  async verify(assert) {
    const { festivalDate, festivalNow } = await import("../../../../js/clock.js");
    for (const local of ["2026-08-15T19:30", "2026-03-29T03:00", "2026-10-25T01:30", "2026-12-31T23:59"]) {
      const instant = festivalDate(local);
      const back = festivalNow(instant);
      assert.equal(`${back.date}T${back.time}`, local, `round-trip of ${local}`);
    }
    assert.ok(Number.isNaN(festivalDate("not-a-date").getTime()));
  },
};
