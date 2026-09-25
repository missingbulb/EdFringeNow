"use strict";
const { plannerReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the footer crediting Haifa's photograph: its title, photographer and licence",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  capture: ".footer-copy",
};
