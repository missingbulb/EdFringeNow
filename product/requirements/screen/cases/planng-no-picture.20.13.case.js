"use strict";
const { plannerReady, settle } = require("../../shared/case-helpers");

// The first Haifa show the draft holds: Haifa publishes no pictures.
const HAIFA = '.sch-show[data-festival-colour="haifa-iff"]';

module.exports = {
  description: "a show with no picture leads its popup with its kind's emoji on its festival's colour",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const block = page.locator(HAIFA).first();
    await block.scrollIntoViewIfNeeded();
    await block.hover();
    await settle(page);
    return t.clip(t.pad(await t.rectOf("#calPreview"), 8));
  },
};
