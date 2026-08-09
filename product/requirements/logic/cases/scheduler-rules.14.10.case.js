"use strict";

const mkShow = (slug, start) => ({
  slug,
  title: slug,
  venue: "V1",
  venueName: "Venue One",
  duration: 60,
  performances: [{ date: "2026-08-15", start, status: "TICKETS_AVAILABLE" }],
});

module.exports = {
  description: "no day is packed past the per-day maximum",
  async verify(assert) {
    const { buildSchedule } = await import("../../../../plan/lib/engine.js");
    const shows = [mkShow("a", "10:00"), mkShow("b", "13:00"), mkShow("c", "16:00"), mkShow("d", "19:00")];
    const plan = buildSchedule(shows, {
      dateStart: "2026-08-15",
      dateEnd: "2026-08-15",
      minGapDifferentVenue: 0,
      maxPerDay: 2,
    });
    assert.equal(plan.scheduled.length, 2);
    assert.ok(plan.unscheduled.length >= 2);
  },
};
