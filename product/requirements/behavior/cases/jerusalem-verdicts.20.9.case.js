"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

const EDINBURGH_KEYS = ["edfringe.plan.favourites.v1", "edfringe.plan.prefs.v1"];

/** Which show is drafted at a given night and hour, or null. */
function draftedAt(page, date, time) {
  return page.evaluate(
    ([d, t]) => {
      const block = [...document.querySelectorAll(`.sch-day[data-date="${d}"] .sch-show`)].find(
        (b) => b.dataset.key.endsWith(`T${t}`)
      );
      return block ? block.dataset.slug : null;
    },
    [date, time]
  );
}

module.exports = {
  description: "the four verdicts survive a reload, under the festival's own storage prefix",
  page: "/planJerusalem/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/planJerusalem/`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Two verdicts that pull in opposite directions, so a reload that dropped
    // either would be visible: one show refused outright, and a contender
    // locked into the hour the draft had given to someone else.
    const refusedNight = "2026-10-20";
    const refused = await draftedAt(page, refusedNight, "20:00");
    assert.ok(refused, "the programme drafts something into the contested hour");
    await page.click(`.sch-day[data-date="${refusedNight}"] .sch-show [data-verdict="noShow"]`);
    await page.waitForFunction(
      ([d, slug]) =>
        ![...document.querySelectorAll(`.sch-day[data-date="${d}"] .sch-show`)].some(
          (b) => b.dataset.slug === slug
        ),
      [refusedNight, refused]
    );
    const replacement = await draftedAt(page, refusedNight, "20:00");
    assert.ok(replacement && replacement !== refused, "the hour goes to the next contender");

    const lockedNight = "2026-10-19";
    const lockedBlock = page.locator(`.sch-day[data-date="${lockedNight}"] .sch-show`).last();
    await lockedBlock.locator(".sch-rivals-btn").click();
    await page.click("#calRivals .pop-rival");
    await page.waitForSelector(`.sch-day[data-date="${lockedNight}"] .sch-show--locked`);
    const locked = await page
      .locator(`.sch-day[data-date="${lockedNight}"] .sch-show--locked`)
      .getAttribute("data-slug");

    await page.reload({ waitUntil: "load" });
    await jerusalemReady(page);

    assert.equal(
      await draftedAt(page, refusedNight, "20:00"),
      replacement,
      "the refused show is still refused after a reload"
    );
    assert.equal(
      await page.locator(`.sch-day[data-date="${lockedNight}"] .sch-show--locked`).getAttribute("data-slug"),
      locked,
      "the locked night is still locked after a reload"
    );

    // The two planners share code, never state.
    const leaked = await page.evaluate(
      (keys) => keys.filter((k) => localStorage.getItem(k) !== null),
      EDINBURGH_KEYS
    );
    assert.deepEqual(leaked, [], "the Fringe planner's keys must stay untouched");
    const owned = await page.evaluate(() => Object.keys(localStorage));
    assert.deepEqual(
      owned.filter((k) => !k.startsWith("jerusalemPlan.")),
      [],
      "everything this page stores lives under its own prefix"
    );
  },
};
