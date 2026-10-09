"use strict";
const { checkoutLocks, plannerReady } = require("../../shared/case-helpers");

/* The page cannot buy anything, so the button's whole consequence is which
 * page it opens: window.open is recorded rather than followed. */
module.exports = {
  description: "checkout opens the next place to buy in a new tab on each press, counting down what is left",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  localStorage: checkoutLocks(),
  async verify(page, { origin, assert }) {
    await page.addInitScript(() => {
      window.__opened = [];
      window.open = (url, target) => {
        window.__opened.push([url, target]);
        return null;
      };
    });
    await page.goto(`${origin}/planNG/?festival=haifa-iff`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    const label = () => page.textContent("#checkoutGo");
    const opened = () => page.evaluate(() => window.__opened);

    assert.equal(await label(), "Check out · open 3 pages", "two Haifa films and an Acco play; the free concert needs none");
    await page.click("#checkoutGo");
    await page.click("#checkoutGo");
    assert.equal(await label(), "Open the next · 1 of 3 left");
    await page.click("#checkoutGo");
    assert.deepEqual(
      await opened(),
      [
        ["https://www.haifaff.co.il/eng/Basket/27985", "_blank"],
        ["https://www.haifaff.co.il/eng/Basket/28016", "_blank"],
        ["https://www.eventer.co.il/accofestivalhaemet3", "_blank"],
      ],
      "one tab per press, in the order the shows play"
    );
    assert.equal(await label(), "All opened · start again");

    await page.click("#checkoutGo");
    assert.equal(await label(), "Check out · open 3 pages", "starting again forgets what was opened");
    assert.equal((await opened()).length, 3, "and opens nothing by itself");
  },
};
