"use strict";
const { jerusalemReady, openCard } = require("../../shared/case-helpers");

const hints = (page) => page.locator("#calPreview .pop-hint").count();

async function awayAndBack(page, block) {
  await page.mouse.move(2, 2);
  await page.waitForSelector("#calPreview", { state: "hidden" });
  await openCard(page, block);
}

module.exports = {
  description: "giving any verdict drops the popup's hint for good",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    await openCard(page, ".sch-show >> nth=0");
    assert.equal(await hints(page), 1, "a first visit's popup carries the hint");
    await page.click('#calPreview [data-verdict="favourite"]');
    await awayAndBack(page, ".sch-show >> nth=1");
    assert.equal(await hints(page), 0, "gone from the next popup");

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    await openCard(page, ".sch-show >> nth=0");
    assert.equal(await hints(page), 0, "and after a reload");

    // A reader whose verdicts predate the hint has already found the buttons.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) if (/prefs/i.test(key)) localStorage.removeItem(key);
    });
    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    await openCard(page, ".sch-show >> nth=0");
    assert.equal(await hints(page), 0, "a reader with verdicts never sees it");
  },
};
