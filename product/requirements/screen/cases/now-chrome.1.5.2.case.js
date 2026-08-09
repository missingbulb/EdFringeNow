"use strict";
const { nowStorage, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "in the UK the header carries no debug pill",
  capture: ".site-header",
  localStorage: nowStorage(),
  // The default fake fix is central Edinburgh; nowReady also waits for the
  // reference day, which only lands once that in-UK fix is adopted.
  async ready(page) {
    await nowReady(page);
  },
};
