"use strict";

// A tiny world for buildSchedule: three shows at one venue, one day.
const mkShow = (slug, starts, opts = {}) => ({
  slug,
  title: slug,
  venue: opts.venue || "V1",
  venueName: "Venue One",
  duration: 60,
  performances: starts.map((s) => ({ date: "2026-08-15", start: s, status: "TICKETS_AVAILABLE" })),
});

const BASE = {
  dateStart: "2026-08-15",
  dateEnd: "2026-08-15",
  minGapDifferentVenue: 0,
  dayStartMin: 540,
  dayEndMin: 1500,
};

module.exports = {
  description: "pins plan first: an exact pin overrides day hours and meals; must-sees never overlap each other; pins ignore the cap",
  async verify(assert) {
    const { buildSchedule } = await import("../../../../plan/lib/engine.js");

    // (a) an exact pinned performance is honoured even against a meal break.
    const lunchShow = mkShow("lunchy", ["12:45"]);
    const pinned = buildSchedule([lunchShow], {
      ...BASE,
      mealBreaks: [{ start: "12:30", end: "13:30", enabled: true }],
      forcedPerformances: { lunchy: "2026-08-15T12:45" },
    });
    assert.deepEqual(pinned.scheduled.map((s) => s.slug), ["lunchy"]);
    // …while without the pin the same show is unschedulable.
    const unpinned = buildSchedule([lunchShow], {
      ...BASE,
      mealBreaks: [{ start: "12:30", end: "13:30", enabled: true }],
    });
    assert.deepEqual(unpinned.scheduled, []);

    // (b) two must-sees that overlap: only one can hold.
    const a = mkShow("must-a", ["19:00"]);
    const b = mkShow("must-b", ["19:30"]);
    const clash = buildSchedule([a, b], { ...BASE, forcedSlugs: ["must-a", "must-b"] });
    assert.equal(clash.scheduled.length, 1);
    assert.ok(clash.unscheduled.some((u) => u.reason.includes("clashes with another must-see")));

    // (c) pins ignore the per-day cap.
    const three = [mkShow("f1", ["10:00"]), mkShow("f2", ["12:00"]), mkShow("f3", ["15:00"])];
    const capped = buildSchedule(three, {
      ...BASE,
      maxPerDay: 1,
      forcedSlugs: ["f1", "f2", "f3"],
    });
    assert.equal(capped.scheduled.length, 3);
  },
};
