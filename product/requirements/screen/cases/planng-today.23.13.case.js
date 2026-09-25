"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "today is a small figure standing on the months, holding up a sign",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  capture: (page, t) => t.unionClip([".tl-dude", ".tl-sign"], 16),
};
