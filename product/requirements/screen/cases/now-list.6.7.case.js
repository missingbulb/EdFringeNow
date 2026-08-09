"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "empty, no commitment: 'Nothing reachable in the next couple of hours…'",
  capture: "#showsGrid .show-meta",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [], maxTravelMinutes: 1 }) },
};
