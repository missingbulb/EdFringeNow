"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

module.exports = {
  description: "a reader who said they come from the United Kingdom sees its bank holidays marked along the year",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { "planNG.origin": JSON.stringify({ kind: "abroad", country: "GB" }) },
  ready: jerusalemReady,
  capture: (page, t) => t.unionClip(["#timelineYear", "#holidayNote"]),
};
