"use strict";
const { jerusalemReady, routeFares, flightsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "the way between airport and town covers both ends of the trip and survives a reload",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await routeFares(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.click('.flight--out [data-origin="ask"]');
    await page.selectOption("#originCountry", "GB");
    await flightsSettled(page);
    await page.waitForFunction(() => document.querySelectorAll(".sch-own--flight").length === 2, null, { timeout: 20000 });

    await page.click(".sch-own--out");
    const links = await page.$$eval("#calMenu a[data-ground-book]", (as) => as.map((a) => [a.dataset.groundBook, a.href]));
    assert.deepEqual(
      links.map(([g]) => g),
      ["taxi", "train", "car"],
      "each way offers where to book it"
    );
    assert.ok(links.find(([g]) => g === "car")[1].startsWith("https://www.google.com/maps/search/?api=1&query="), "a hire car opens a map search");
    await page.click('#calMenu [data-ground="train"]');

    const named = () =>
      page.$$eval(".sch-own--flight", (els) => els.map((el) => el.dataset.ground || null));
    assert.deepEqual(await named(), ["train", "train"], "both flight blocks name the train");

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    await flightsSettled(page);
    await page.waitForFunction(() => document.querySelectorAll(".sch-own--flight").length === 2, null, { timeout: 20000 });
    assert.deepEqual(await named(), ["train", "train"], "the answer survives a reload");
  },
};
