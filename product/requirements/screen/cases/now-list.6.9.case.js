"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "the list pages by twelve: 'Show k more · m left'",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
};
