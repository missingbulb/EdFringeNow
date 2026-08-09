"use strict";

module.exports = {
  description: "planner header: Plan active, festival hint, title, empty count line, footer",
  async capture(page, t) {
    return t.stitchV([
      await t.element(".site-header"),
      await t.element(".page-head"),
      await t.element(".site-footer"),
    ]);
  },
  page: "/plan/",
  viewport: "desktop",
};
