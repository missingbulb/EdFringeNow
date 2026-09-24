"use strict";

// The rows are the requirement: how many options a filter panel lists for how
// many it has, and what happens to one the reader already chose. verify() runs
// each row through the shipped rule and its constant.
const TABLE = {
  columns: ["Options", "Chosen", "Listed", "Left for the search"],
  rows: [
    ["6", "none", "6", "0"],
    ["30", "none", "30", "0"],
    ["300", "none", "the busiest 30", "270"],
    ["300", "the 250th", "the busiest 30 and the 250th", "269"],
  ],
};

module.exports = {
  description: "a search filter lists at most a panel's worth of options, the busiest first, never hiding a chosen one",
  table: TABLE,
  async verify(assert) {
    const { capOptions, FACET_OPTIONS, RIVAL_ROWS } = await import("../../../../site/shared/limits.js");
    assert.equal(FACET_OPTIONS, 30, "a panel lists thirty options");
    assert.equal(RIVAL_ROWS, 8, "a contested hour names eight rivals");
    for (const [options, chosen, listed, left] of TABLE.rows) {
      // Ranked busiest first, as the page hands them over.
      const ranked = Array.from({ length: Number(options) }, (_, i) => i + 1);
      const pick = chosen === "none" ? null : Number(chosen.match(/\d+/)[0]);
      const { rows, more } = capOptions(ranked, (n) => n === pick, FACET_OPTIONS);
      const row = `${options} options, chosen ${chosen}`;
      const busiest = Math.min(Number(options), FACET_OPTIONS);
      assert.deepEqual(rows.slice(0, busiest), ranked.slice(0, busiest), `${row}: the busiest make the cut`);
      assert.equal(rows.length, busiest + (pick && pick > FACET_OPTIONS ? 1 : 0), `${row}: listed (${listed})`);
      if (pick) assert.ok(rows.includes(pick), `${row}: the chosen one is listed`);
      assert.equal(more, Number(left), `${row}: left for the search`);
    }
  },
};
