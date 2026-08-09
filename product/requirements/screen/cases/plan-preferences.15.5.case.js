"use strict";
const { planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "'⚠ Prevents N' beside the setting that shuts shows out",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
};
