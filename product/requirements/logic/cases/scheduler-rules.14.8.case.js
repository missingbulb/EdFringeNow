"use strict";

const mkShow = (slug, perfs) => ({
  slug,
  title: slug,
  venue: "V1",
  venueName: "Venue One",
  duration: 60,
  performances: perfs.map(([date, start]) => ({ date, start, status: "TICKETS_AVAILABLE" })),
});

module.exports = {
  description: "a day under the per-day minimum is dropped whole — unless a pinned show sits on it",
  async verify(assert) {
    const { buildSchedule } = await import("../../../../plan/lib/engine.js");
    const opts = { dateStart: "2026-08-15", dateEnd: "2026-08-16", minGapDifferentVenue: 0, minPerDay: 2 };

    // Two shows on the 15th, one lone show on the 16th → the 16th is dropped.
    const shows = [
      mkShow("a", [["2026-08-15", "19:00"]]),
      mkShow("b", [["2026-08-15", "21:00"]]),
      mkShow("lone", [["2026-08-16", "19:00"]]),
    ];
    const plan = buildSchedule(shows, opts);
    assert.deepEqual(plan.scheduled.map((s) => s.slug).sort(), ["a", "b"]);
    assert.ok(plan.unscheduled.some((u) => u.slug === "lone" && u.reason.includes("below your minimum")));

    // The same lone day survives when its show is pinned.
    const pinnedPlan = buildSchedule(shows, { ...opts, forcedSlugs: ["lone"] });
    assert.ok(pinnedPlan.scheduled.some((s) => s.slug === "lone"));
  },
};
