"use strict";
const { jerusalemReady, openCard } = require("../../shared/case-helpers");

module.exports = {
  description: "until a first verdict, the popup says what its four buttons are for",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    await openCard(page, ".sch-show >> nth=0");
    return t.unionClip(["#calPreview .pop-verdicts", "#calPreview .pop-hint"], 8);
  },
};
