"use strict";

// The rows are the requirement: the gallery renders them into the spec as a
// table, and verify() proves each one against the shipped formatter — so the
// table a reader sees is generated evidence rather than a hand-typed claim.
const TABLE = {
  columns: ["Minutes", "Reads"],
  rows: [
    [1, "1 minute"],
    [45, "45 minutes"],
    [60, "1 hour"],
    [80, "1 hour and 20 minutes"],
    [120, "2 hours"],
    [150, "about 2½ hours"],
    [200, "about 3½ hours"],
    [-5, "(nothing)"],
  ],
};

module.exports = {
  description: "durations read as prose",
  table: TABLE,
  async verify(assert) {
    const { friendlyDuration } = await import("../../../../shared/duration.js");
    for (const [mins, expected] of TABLE.rows) {
      const got = friendlyDuration(mins);
      assert.equal(got === "" ? "(nothing)" : got, expected, `friendlyDuration(${mins})`);
    }
    assert.equal(friendlyDuration(NaN), "", "a non-finite duration reads as nothing");
  },
};
