"use strict";

const mkShow = (slug, perfs) => ({
  slug,
  title: slug,
  venue: "V1",
  venueName: "Venue One",
  duration: 60,
  performances: perfs.map(([date, start]) => ({ date, start, status: "TICKETS_AVAILABLE" })),
});

const BASE = { dateStart: "2026-08-15", dateEnd: "2026-08-16", minGapDifferentVenue: 0 };

module.exports = {
  description: "greedy earliest-finish packing, one performance per show, fully deterministic",
  async verify(assert) {
    const { buildSchedule } = await import("../../../../plan/lib/engine.js");

    // Earliest-finish-first fits all three where naive earliest-start would too,
    // but the point is the count: overlapping options resolve to a full evening.
    const shows = [
      mkShow("long", [["2026-08-15", "19:00"]]), // 19:00–20:00
      mkShow("mid", [["2026-08-15", "19:30"], ["2026-08-15", "21:30"]]),
      mkShow("late", [["2026-08-15", "20:00"]]), // 20:00–21:00
    ];
    const plan = buildSchedule(shows, BASE);
    assert.equal(plan.scheduled.length, 3); // mid takes its 21:30 to clear the way
    assert.deepEqual(
      plan.scheduled.map((s) => `${s.slug}@${s.startTime}`).sort(),
      ["late@20:00", "long@19:00", "mid@21:30"]
    );

    // Determinism: same inputs, same plan, ten times over (shuffled input order).
    const key = (p) => p.scheduled.map((s) => `${s.slug}@${s.date}T${s.startTime}`).join("|");
    const first = key(plan);
    for (let i = 0; i < 10; i++) {
      const shuffled = [...shows].sort(() => (i % 2 ? 1 : -1));
      assert.equal(key(buildSchedule(shuffled, BASE)), first);
    }
  },
};
