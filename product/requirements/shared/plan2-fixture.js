// The one trip every /plan2 screen case renders: a family of four from
// London, four thrifty and packed August nights in Edinburgh, Fringe plus the
// International Festival, with the one-night Chineke! concert starred so the
// draft carries both a repeating show and a one-off. Cases seed it into
// storage at the step they show.
"use strict";

const STORE_KEY = "edfringe.plan2.v1";

const ANSWERS = {
  cityId: "edinburgh",
  festivalIds: ["fringe", "eif"],
  from: "2026-08-13",
  to: "2026-08-17",
  party: { type: "family", ages: [5, 9] },
  cost: "thrifty",
  pace: "packed",
  focus: "mix",
  originId: "london",
  mode: "train",
  sleep: ["cost", "location"],
};

const STARRED = ["chineke"];

function plan2Storage(step, overrides = {}) {
  return { [STORE_KEY]: JSON.stringify({ v: 1, step, answers: { ...ANSWERS, ...(overrides.answers || {}) }, rules: overrides.rules || {}, starred: overrides.starred || STARRED }) };
}

module.exports = { plan2Storage, ANSWERS, STARRED, STORE_KEY };
