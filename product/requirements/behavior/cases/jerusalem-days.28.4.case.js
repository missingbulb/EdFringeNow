"use strict";
const { calendarDays, jerusalemReady, settle } = require("../../shared/case-helpers");

/* The seeded rest day, an excursion chosen from a day's head, the rest day
 * dragged onto another day, the excursion cleared from its own block's menu,
 * and a reload. */
module.exports = {
  description: "a day's head offers what the day is for; a kept day's block changes, clears or moves it",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const kept = () =>
      page.$$eval(".sch-day--kept", (cols) =>
        Object.fromEntries(cols.map((c) => [c.dataset.date, c.querySelector(".sch-keep").dataset.kind]))
      );
    const shows = (iso) => page.locator(`.sch-day[data-date="${iso}"] .sch-show`).count();
    const days = await calendarDays(page);

    const seeded = await kept();
    assert.equal(Object.keys(seeded).length, 1, "a first draft keeps one day");
    const [rest] = Object.keys(seeded);
    assert.equal(seeded[rest], "rest", "for rest, the trip reaching no other festival");
    assert.equal(await shows(rest), 0, "nothing is drafted on it");

    // Two days with shows, neither the rest day: one becomes an excursion, the
    // other is where the rest day is dragged to.
    const open = [];
    for (const d of days) if (d !== rest && (await shows(d)) > 0) open.push(d);
    const [trip, to] = open;

    await page.click(`[data-day-head="${trip}"]`);
    await page.click(`#calMenu [data-keep="excursion"]`);
    await settle(page);
    assert.deepEqual(await kept(), { [rest]: "rest", [trip]: "excursion" }, "the day chosen is an excursion day");
    assert.equal(await shows(trip), 0, "and nothing is drafted on it");

    const from = await page.locator(`.sch-keep[data-keep="${rest}"]`).boundingBox();
    const target = await page.locator(`.sch-day[data-date="${to}"] .sch-body`).boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + 120);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, from.y + 120, { steps: 8 });
    await page.mouse.up();
    await settle(page);
    assert.deepEqual(await kept(), { [to]: "rest", [trip]: "excursion" }, "the rest day moved where it was dragged");
    assert.ok((await shows(rest)) > 0, "the day it left drafts shows again");

    await page.click(`.sch-keep[data-keep="${trip}"]`);
    await page.click(`#calMenu [data-keep="shows"]`);
    await settle(page);
    assert.deepEqual(await kept(), { [to]: "rest" }, "the excursion is cleared from its own block");
    assert.ok((await shows(trip)) > 0, "and that day drafts shows again");

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);
    assert.deepEqual(await kept(), { [to]: "rest" }, "what the reader chose comes back, and nothing is seeded again");
  },
};
