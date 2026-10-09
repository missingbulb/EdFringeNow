"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "the trip's two ends are lines across the strip with a grip at the middle, and under the rows a measure gives its first and last day and its length",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  capture: (page, t) => t.unionClip([".tl-handle--from", ".tl-handle--to", ".tl-span"], 24),
};
