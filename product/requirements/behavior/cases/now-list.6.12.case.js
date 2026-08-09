"use strict";
const { nowStorage, nowSettings, nowReady } = require("../../shared/case-helpers");

module.exports = {
  description: "a show beyond the travel budget is absent; raising the budget reveals it",
  localStorage: { ...nowStorage(), ...nowSettings({ genres: [] }) },
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await nowReady(page);
    // The fixture's far show (~28 min walk) at the default 10-minute budget:
    const far = 'Queens of Swing';
    const listed = () => page.evaluate((t) => document.body.querySelector("#showsGrid").textContent.includes(t), far);
    // Reveal every page of the list before judging absence.
    while (await page.locator("#showMore").isVisible()) await page.click("#showMore");
    assert.ok(!(await listed()), "absent at a 10-minute budget");
    await page.click('[data-panel="travelPanel"]');
    await page.locator("#travelRange").fill("60");
    await page.waitForTimeout(400);
    while (await page.locator("#showMore").isVisible()) await page.click("#showMore");
    assert.ok(await listed(), "present at a 60-minute budget");
  },
};
