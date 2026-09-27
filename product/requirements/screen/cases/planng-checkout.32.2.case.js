"use strict";
const { checkoutLocks, plannerReady } = require("../../shared/case-helpers");

module.exports = {
  description: "under the calendar, a checkout gathers every locked show by festival, saying how each festival sells tickets",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  localStorage: checkoutLocks(),
  ready: (page) => plannerReady(page, "haifa-iff"),
  capture: "#checkout",
};
