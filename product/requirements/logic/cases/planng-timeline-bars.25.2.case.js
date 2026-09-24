"use strict";

// The rows are the requirement: a registry's editions, and the bars the
// timeline draws for them. A bar is drawn from the registry's dates alone —
// timelineBars() is never handed a programme — so an edition of sixty
// thousand performances costs the timeline what one of ten does.
const TABLE = {
  columns: ["Festival", "Edition", "Runs", "Programme", "Bars on the timeline"],
  rows: [
    ["Jerusalem Comedy Festival", "2026", "18 – 22 Oct 2026", "published", "1"],
    ["Haifa International Film Festival", "2026", "25 Sep – 3 Oct 2026", "not yet", "1"],
    ["A Fringe-sized festival", "2026", "7 – 31 Aug 2026", "published", "1"],
    ["A Fringe-sized festival", "2025", "1 – 25 Aug 2025", "published", "0 (before the year shown)"],
  ],
};

const REGISTRY = {
  festivals: [
    { id: "jerusalem-comedy", editions: [{ id: "2026", firstDate: "2026-10-18", lastDate: "2026-10-22", dataUrl: "/j" }] },
    { id: "haifa-iff", editions: [{ id: "2026", firstDate: "2026-09-25", lastDate: "2026-10-03", dataUrl: null }] },
    {
      id: "fringe-sized",
      editions: [
        { id: "2025", firstDate: "2025-08-01", lastDate: "2025-08-25", dataUrl: "/f25" },
        { id: "2026", firstDate: "2026-08-07", lastDate: "2026-08-31", dataUrl: "/f26" },
      ],
    },
  ],
};
const ID = {
  "Jerusalem Comedy Festival": "jerusalem-comedy",
  "Haifa International Film Festival": "haifa-iff",
  "A Fringe-sized festival": "fringe-sized",
};

module.exports = {
  description: "the timeline draws one bar per edition, however many performances the edition has",
  table: TABLE,
  async verify(assert) {
    const { timelineBars, timelineSpan, editionKey } = await import("../../../../site/planNG/lib/timeline.js");
    // The harness's pinned day: the year shown starts on 1 Jul 2026.
    const bars = timelineBars(REGISTRY, timelineSpan("2026-08-15"));
    for (const [festival, edition, , programme, drawn] of TABLE.rows) {
      const key = editionKey(ID[festival], edition);
      const entry = REGISTRY.festivals.find((f) => f.id === ID[festival]).editions.find((e) => e.id === edition);
      assert.equal(Boolean(entry.dataUrl), programme === "published", `${festival} ${edition}: programme`);
      assert.equal(
        bars.filter((b) => b.key === key).length,
        Number(drawn.split(" ")[0]),
        `${festival} ${edition}: bars`
      );
    }
    assert.equal(bars.length, 3, "nothing else is drawn");
  },
};
