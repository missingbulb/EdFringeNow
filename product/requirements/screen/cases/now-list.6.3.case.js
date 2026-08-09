"use strict";
const { nowStorage, nowSettings } = require("../../shared/case-helpers");

module.exports = {
  description: "Soonest re-orders the list under HH:MM group headings",
  async capture(page, t) {
    const heads = page.locator(".shows-group-head");
    const r1 = await heads.nth(0).boundingBox();
    const r2 = await heads.nth(1).boundingBox();
    const card2 = await page.locator(".shows-group-head >> nth=1 >> xpath=following-sibling::article[1]").boundingBox();
    return t.stitchV([
      await t.clip(t.pad(t.union([r1, (await page.locator(".show-item").first().boundingBox())]))),
      await t.clip(t.pad(t.union([r2, card2]))),
    ]);
  },
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async drive(page) {
    await page.click('.view-btn[data-mode="soonest"]');
    await page.waitForSelector(".shows-group-head");
    await page.waitForTimeout(300);
  },
};
