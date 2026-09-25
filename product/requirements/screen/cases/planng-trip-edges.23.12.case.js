"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the trip's two ends are lines across the strip with a grip at the middle, and its length is written above",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  capture: (page, t) => t.unionClip([".tl-handle--from", ".tl-handle--to", ".tl-length"], 24),
};
