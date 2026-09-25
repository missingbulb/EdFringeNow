"use strict";

// The rows ARE the requirement: what each answer to "who's coming?" suggests.
const TABLE = {
  columns: ["Who's coming", "A day", "Favoured", "Evening ends", "Eating"],
  rows: [
    ["Just me", "packed", "nothing in particular", "01:00", "sorted out yourself"],
    ["A couple", "steady", "nothing in particular", "01:00", "dinner"],
    ["Friends", "steady", "nothing in particular", "01:00", "sorted out yourself"],
    ["Family, youngest under 8", "easy", "family shows", "21:00", "three meals"],
    ["Family, youngest 8 to 11", "steady", "family shows", "22:00", "three meals"],
    ["Family, all 12 or over", "steady", "family shows", "01:00", "three meals"],
  ],
};

module.exports = {
  description: "who is coming suggests the pace, the kinds favoured, the evening's end and the meals",
  table: TABLE,
  async verify(assert) {
    const { suggestedAnswers } = await import("../../../../site/planNG/lib/party.js");
    const row = (party) => {
      const s = suggestedAnswers(party);
      return [s.pace, s.interests, s.dayEndMin, s.food];
    };
    assert.deepEqual(row({ type: "solo" }), ["packed", [], 25 * 60, "self"]);
    assert.deepEqual(row({ type: "couple" }), ["steady", [], 25 * 60, "dinner"]);
    assert.deepEqual(row({ type: "group" }), ["steady", [], 25 * 60, "self"]);
    assert.deepEqual(row({ type: "family", ages: [5, 12] }), ["easy", ["family"], 21 * 60, "regular"]);
    assert.deepEqual(row({ type: "family", ages: [9, 15] }), ["steady", ["family"], 22 * 60, "regular"]);
    assert.deepEqual(row({ type: "family", ages: [12] }), ["steady", ["family"], 25 * 60, "regular"]);
    assert.deepEqual(row({ type: "family", ages: [] }), ["steady", ["family"], 25 * 60, "regular"], "no ages given: old enough");
    assert.equal(suggestedAnswers(null), null, "nobody said yet suggests nothing");
  },
};
