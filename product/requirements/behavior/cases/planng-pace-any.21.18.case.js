"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* "How full a day" typed past the old top of eight, then down to nothing. */
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("planNG.prefs") || "{}").maxPerDay);

async function setPerDay(page, n) {
  const input = page.locator("[data-num='maxPerDay']");
  await input.fill(String(n));
  await input.dispatchEvent("change");
}

module.exports = {
  description: "how full a day takes any whole number of shows from zero up",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=haifa-iff`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    await page.click("[data-open='pace']");
    const input = page.locator("[data-num='maxPerDay']");
    assert.equal(await input.getAttribute("min"), "0", "the count starts at zero");
    assert.equal(await input.getAttribute("max"), null, "and has no top");

    await setPerDay(page, 12);
    assert.equal(await stored(page), 12, "twelve a day is kept as twelve");

    await setPerDay(page, 0);
    assert.equal(await stored(page), 0, "none a day is kept as none");
    assert.equal(await page.locator("#schedule .sch-show").count(), 0, "and drafts no shows");

    await page.reload({ waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    await page.click("[data-open='pace']");
    assert.equal(await page.locator("[data-num='maxPerDay']").inputValue(), "0", "none survives a reload");
  },
};
