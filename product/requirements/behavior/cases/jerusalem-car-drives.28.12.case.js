"use strict";
const { jerusalemReady, routeFares, flightsSettled } = require("../../shared/case-helpers");

module.exports = {
  description: "hiring a car suggests driving between shows; a way you chose yourself stays yours",
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

    const travel = () =>
      page.evaluate(() => {
        const pref = document.querySelector(".pref[data-q='travel']");
        const prefs = JSON.parse(localStorage.getItem("planNG.prefs") || "{}");
        return { mode: prefs.mode, suggested: pref.classList.contains("is-suggested") };
      });
    const pick = async (ground) => {
      await page.click(".sch-own--out");
      await page.click(`#calMenu [data-ground="${ground}"]`);
    };

    await pick("car");
    assert.deepEqual(await travel(), { mode: "car", suggested: true }, "a hire car suggests driving");
    await pick("taxi");
    assert.deepEqual(await travel(), { mode: "walk", suggested: false }, "without the car the suggestion goes");

    await page.click("[data-open='travel']");
    await page.click("[data-pick='travel:bike']");
    await pick("car");
    assert.deepEqual(await travel(), { mode: "bike", suggested: false }, "a way you chose yourself stays yours");
  },
};
