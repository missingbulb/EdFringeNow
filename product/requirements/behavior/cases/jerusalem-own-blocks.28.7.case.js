"use strict";
const { calendarDays, jerusalemReady, settle } = require("../../shared/case-helpers");

/* Lunch added on an empty hour, dragged onto a drafted show's hour on another
 * day, stretched, then removed: the show makes way and comes back. */
module.exports = {
  description: "an empty hour offers a meal or personal time; what is added is drafted around, dragged, stretched and removed",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const days = await calendarDays(page);
    const drafted = async () => page.$$eval(".sch-show", (els) => els.map((el) => el.dataset.key + " " + el.dataset.slug));
    const open = [];
    for (const d of days) {
      if (await page.locator(`.sch-day[data-date="${d}"]:not(.sch-day--kept) .sch-show`).count()) open.push(d);
    }
    const [addOn, dropOn] = open;

    // An empty hour: the top of the column, above everything drafted.
    await page.locator(`.sch-day[data-date="${addOn}"] .sch-body`).evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => scrollBy(0, -120));
    const body = await page.locator(`.sch-day[data-date="${addOn}"] .sch-body`).boundingBox();
    await page.mouse.click(body.x + body.width / 2, body.y + 30);
    assert.equal(await page.isVisible("#calMenu [data-add='meal']"), true, "an empty hour offers a meal");
    assert.equal(await page.isVisible("#calMenu [data-add='personal']"), true, "and personal time");
    await page.click("#calMenu [data-add='meal']");
    await settle(page);
    const meal = page.locator(`.sch-day[data-date="${addOn}"] .sch-own--meal`);
    assert.equal(await meal.count(), 1, "the meal is on that day");

    // Dragged onto the first show drafted on another day.
    const before = await drafted();
    const show = page.locator(`.sch-day[data-date="${dropOn}"] .sch-show`).first();
    const showKey = (await show.getAttribute("data-key")) + " " + (await show.getAttribute("data-slug"));
    // Near the top of the screen, clear of the site's sticky header, so the
    // evening show it is dragged to is on screen below it.
    await meal.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await page.evaluate(() => scrollBy(0, -280));
    const target = await show.boundingBox();
    const from = await meal.boundingBox();
    // Held low on the block: its top can sit under the day-start line's grip.
    await page.mouse.move(from.x + from.width / 2, from.y + from.height - 12);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + from.height - 12, { steps: 10 });
    await page.mouse.up();
    await settle(page);
    const moved = page.locator(`.sch-day[data-date="${dropOn}"] .sch-own--meal`);
    assert.equal(await moved.count(), 1, "the meal moved to the day it was dragged to");
    assert.equal(await page.locator(`.sch-day[data-date="${addOn}"] .sch-own--meal`).count(), 0, "and left the day it was on");
    assert.ok(!(await drafted()).includes(showKey), "the show whose hour it took is no longer drafted there");

    const end = Number(await moved.getAttribute("data-end"));
    await moved.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const edge = await moved.locator(".own-resize").boundingBox();
    await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
    await page.mouse.down();
    await page.mouse.move(edge.x + edge.width / 2, edge.y + 60, { steps: 6 });
    await page.mouse.up();
    await settle(page);
    assert.ok(Number(await moved.getAttribute("data-end")) > end, "stretching its lower edge makes it longer");

    await moved.click();
    await page.click("#calMenu [data-own-remove]");
    await settle(page);
    assert.equal(await page.locator(".sch-own--meal").count(), 0, "removed from its menu");
    assert.deepEqual(await drafted(), before, "and the draft is what it was before the meal came");
  },
};
