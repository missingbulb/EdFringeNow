"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

const CARD = ".sch-show >> nth=0";
const shown = (page) => page.$eval("#calPreview", (el) => !el.hidden);

/** Park the pointer on the hour labels: inside the calendar, on no card. */
async function toEmpty(page) {
  const box = await page.locator("#schedule .sch-gutter-body").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
}

module.exports = {
  description: "the popup opens only once the pointer rests on a card, and closes once it leaves the card and the popup",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.locator(CARD).scrollIntoViewIfNeeded();

    // Crossing a card on the way somewhere else opens nothing.
    await page.hover(CARD);
    await page.waitForTimeout(150);
    assert.equal(await shown(page), false, "not the instant the pointer arrives");
    await toEmpty(page);
    await page.waitForTimeout(700);
    assert.equal(await shown(page), false, "nor later, once the pointer has moved on");

    // Resting on it opens it.
    await page.hover(CARD);
    await page.waitForSelector("#calPreview:not([hidden])", { timeout: 2000 });

    // The trip from the card into the popup keeps it open.
    const pop = await page.locator("#calPreview").boundingBox();
    await page.mouse.move(pop.x + pop.width / 2, pop.y + 12, { steps: 6 });
    await page.waitForTimeout(500);
    assert.equal(await shown(page), true, "the popup survives the pointer travelling into it");

    // Leaving for empty calendar closes it, without leaving the calendar.
    await toEmpty(page);
    await page.waitForSelector("#calPreview", { state: "hidden", timeout: 2000 });
  },
};
