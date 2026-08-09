"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "the list pages by twelve: 'Show k more · m left'",
  capture: "#showMore",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
};
