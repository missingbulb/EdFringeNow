// The frozen festival registry, read by the cases that need one festival's
// entry without driving a page.
"use strict";

const REGISTRY = require("./data/festivals/index.json");

function festival(id) {
  const entry = REGISTRY.festivals.find((f) => f.id === id);
  if (!entry) throw new Error(`no festival ${id} in the frozen registry`);
  return entry;
}

module.exports = { festival };
