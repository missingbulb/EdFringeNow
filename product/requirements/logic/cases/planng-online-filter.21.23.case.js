"use strict";

// The rows ARE the requirement: what leaving out online shows keeps. verify()
// runs the shipped filter.
const TABLE = {
  columns: ["Online shows", "Kept"],
  rows: [
    ["kept", "every show, every performance"],
    ["left out", "every show but the online ones"],
    ["left out, a show that plays a hall and streams", "the show, at the hall only"],
  ],
};

const perf = (date, online) => ({ date, start: "19:00", online });
const SHOWS = [
  { slug: "brighton-fringe/stream", online: true, performances: [perf("2026-05-02", true)] },
  { slug: "brighton-fringe/hall", online: false, performances: [perf("2026-05-02", false)] },
  { slug: "edinburgh-book-festival/both", online: false, performances: [perf("2026-08-15", false), perf("2026-08-16", true)] },
];

module.exports = {
  description: "leaving out online shows takes every streamed performance off the calendar, and nothing else",
  table: TABLE,
  async verify(assert) {
    const { applyFilters } = await import("../../../../site/planNG/lib/filters.js");
    const kept = (filters) => applyFilters(SHOWS, filters).map((s) => `${s.slug} ${s.performances.map((p) => p.date).join(",")}`);
    assert.deepEqual(
      kept({}),
      ["brighton-fringe/stream 2026-05-02", "brighton-fringe/hall 2026-05-02", "edinburgh-book-festival/both 2026-08-15,2026-08-16"],
      "online shows are kept unless left out"
    );
    assert.deepEqual(
      kept({ onlineOut: true }),
      ["brighton-fringe/hall 2026-05-02", "edinburgh-book-festival/both 2026-08-15"],
      "left out: the streamed show goes, and the hybrid show keeps only its hall"
    );
  },
};
