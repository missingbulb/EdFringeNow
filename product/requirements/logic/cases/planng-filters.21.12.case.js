"use strict";

// The rows ARE the requirement: which shows each filter keeps. verify() runs
// the shipped rule over three shows chosen so each row's answer can only come
// from the filter it names.
const TABLE = {
  columns: ["Filter", "Kept"],
  rows: [
    ["None", "every show"],
    ["A tag required", "only the shows filed under it"],
    ["Two tags required", "the shows filed under either"],
    ["A tag ruled out", "every show not filed under it"],
    ["A tag both required and ruled out on one show", "not that show: ruled out wins"],
    ["A festival left out", "none of that festival's shows"],
  ],
};

const SHOWS = [
  { slug: "haifa-iff/a", genreSlugs: ["haifa-iff/competition"] },
  { slug: "haifa-iff/b", genreSlugs: ["haifa-iff/panorama", "haifa-iff/family"] },
  { slug: "acco/c", genreSlugs: ["acco/premiere"] },
];

module.exports = {
  description: "a required tag keeps its shows, a ruled-out tag drops its shows, a festival left out drops all of them",
  table: TABLE,
  async verify(assert) {
    const { passesFilters } = await import("../../../../site/planNG/lib/filters.js");
    const kept = (filters) => SHOWS.filter((show) => passesFilters(show, filters)).map((s) => s.slug);

    assert.deepEqual(kept({}), ["haifa-iff/a", "haifa-iff/b", "acco/c"], "no filter keeps every show");
    assert.deepEqual(
      kept({ tags: new Map([["haifa-iff/competition", "only"]]) }),
      ["haifa-iff/a"],
      "a required tag keeps only its shows, whichever festival the rest are from"
    );
    assert.deepEqual(
      kept({ tags: new Map([["haifa-iff/competition", "only"], ["acco/premiere", "only"]]) }),
      ["haifa-iff/a", "acco/c"],
      "two required tags keep the shows under either"
    );
    assert.deepEqual(
      kept({ tags: new Map([["haifa-iff/family", "out"]]) }),
      ["haifa-iff/a", "acco/c"],
      "a ruled-out tag drops only its shows"
    );
    assert.deepEqual(
      kept({ tags: new Map([["haifa-iff/panorama", "only"], ["haifa-iff/family", "out"]]) }),
      [],
      "ruled out wins over required on the same show"
    );
    assert.deepEqual(
      kept({ festivalsOut: new Set(["acco"]) }),
      ["haifa-iff/a", "haifa-iff/b"],
      "a festival left out drops all its shows"
    );
  },
};
