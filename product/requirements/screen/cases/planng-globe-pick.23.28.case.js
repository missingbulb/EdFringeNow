"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

/* The globe and the year it sits beside: Edinburgh's mark chosen, the globe
 * turns to Scotland and only the British festivals stay; chosen again, every
 * place is back. */
async function clickEdinburgh(page) {
  const at = await page.evaluate(async () => {
    const { project } = await import("/planNG/lib/globe.js");
    const canvas = document.getElementById("timelineGlobe");
    const [lng, lat] = canvas.dataset.view.split(",").map(Number);
    const p = project({ lng, lat }, -3.19, 55.95);
    const box = canvas.getBoundingClientRect();
    const r = box.width / 2 - 2;
    return { x: box.left + box.width / 2 + p.x * r, y: box.top + box.height / 2 + p.y * r };
  });
  await page.mouse.click(at.x, at.y);
  await page.mouse.move(0, 0);
  await settle(page);
}

module.exports = {
  description: "choosing a lit country on the globe narrows the year to it and turns the globe to face it; choosing it again shows every place",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const before = await t.element("#timeline");
    await clickEdinburgh(page);
    const picked = await t.element("#timeline");
    await clickEdinburgh(page);
    return t.animate([before, picked, await t.element("#timeline")]);
  },
};
