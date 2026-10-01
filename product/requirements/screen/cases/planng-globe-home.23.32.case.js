"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

/* A reader who said they come from the United Kingdom: a little house stands
 * on it, beside the British Isles' badge. */
module.exports = {
  description: "a reader who said they come from the United Kingdom sees a little house on it on the globe",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { "planNG.origin": JSON.stringify({ kind: "abroad", country: "GB", arrive: "fly" }) },
  ready: jerusalemReady,
  capture: (page, t) => t.element(".tl-lens"),
};
