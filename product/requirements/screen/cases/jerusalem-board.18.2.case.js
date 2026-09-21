"use strict";
const { jerusalemReady, openDrawer } = require("../../shared/case-helpers");

module.exports = {
  description: "the empty board: the whole programme offered for browsing, with the search bar under it",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    await openDrawer(page);
    return t.element("#board");
  },
};
