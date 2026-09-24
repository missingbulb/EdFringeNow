"use strict";
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");

module.exports = {
  description: "the whole page in Hebrew: the chrome translated and the layout mirrored right to left",
  // Whole page on purpose, and the one leaf in Part V that takes one: what is
  // being asserted is that everything still lands where it should once the
  // inline direction flips, which no crop can show.
  page: "/planNG/he/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  ready: jerusalemReady,
};
