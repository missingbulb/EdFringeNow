"use strict";
const { nowStorage, nowReady, planFavourites, planReady } = require("../../shared/case-helpers");
const { newPage } = require("../../shared/harness/browser");

// The Now list's times and the planner's schedule, from one page.
async function bothPages(page, t, origin) {
  await page.goto(`${origin}/`, { waitUntil: "load" });
  await nowReady(page);
  const list = await t.clip({
    ...(await t.rectOf(".show-item")),
    height: 230,
  });
  await page.goto(`${origin}/plan/`, { waitUntil: "load" });
  await planReady(page);
  await page.waitForSelector(".sch-show");
  const day = await t.rectOf(".sch-day");
  const schedule = await t.clip({ x: (await t.rectOf("#schedule")).x, y: day.y, width: 300, height: 260 });
  return t.stitchV([list, schedule]);
}

module.exports = {
  description: "times are Edinburgh's, whatever the device's zone says",
  viewport: "desktop",
  localStorage: { ...nowStorage(), ...planFavourites() },
  // A context's zone is fixed when it is created, so the second zone needs a
  // second page. Both render the same two surfaces; every time must match.
  async capture(page, t, ctx) {
    const origin = page.url().split("/").slice(0, 3).join("/");
    const inLondon = await bothPages(page, t, origin);

    const away = await newPage({
      viewport: "desktop",
      localStorage: { ...nowStorage(), ...planFavourites() },
      timezone: "America/New_York",
    });
    try {
      const { makeTools } = require("../../shared/capture-tools");
      const inNewYork = await bothPages(away.page, makeTools(away.page), origin);
      return t.animate([inLondon, inNewYork]);
    } finally {
      await away.context.close();
    }
  },
};
