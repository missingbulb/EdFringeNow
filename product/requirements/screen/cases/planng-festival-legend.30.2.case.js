"use strict";
const { plannerReady } = require("../../shared/case-helpers");

module.exports = {
  description: "under the calendar, a legend names each festival with a show in view, in its colour",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  capture: "#festLegend",
};
