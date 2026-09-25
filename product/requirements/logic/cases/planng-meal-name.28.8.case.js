"use strict";

// The rows ARE the requirement: what a meal added at an hour is called.
const TABLE = {
  columns: ["Added at", "Called"],
  rows: [
    ["04:00 to 11:00", "breakfast"],
    ["11:00 to 16:00", "lunch"],
    ["16:00 to 22:00", "dinner"],
    ["22:00 to 04:00", "a late bite"],
    ["An hour whose meal the day already has", "a snack"],
  ],
};

const at = (h, m = 0) => h * 60 + m;

module.exports = {
  description: "a meal added is named for the time of day, and for what the day already has",
  table: TABLE,
  async verify(assert) {
    const { mealAt } = await import("../../../../site/planNG/lib/days.js");
    assert.equal(mealAt(at(8)), "breakfast");
    assert.equal(mealAt(at(10, 55)), "breakfast");
    assert.equal(mealAt(at(11)), "lunch");
    assert.equal(mealAt(at(15, 55)), "lunch");
    assert.equal(mealAt(at(16)), "dinner");
    assert.equal(mealAt(at(21, 55)), "dinner");
    assert.equal(mealAt(at(22)), "late");
    assert.equal(mealAt(at(25)), "late", "past midnight on the same night is still late");
    assert.equal(mealAt(at(13), ["lunch"]), "snack", "a second lunch is a snack");
    assert.equal(mealAt(at(13), ["dinner"]), "lunch", "another meal the day has does not matter");
  },
};
