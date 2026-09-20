"use strict";
const { jerusalemReady } = require("../../shared/case-helpers");

// Monday at 22:00: a one-night show took the hour from a free late-night that
// plays four evenings. Taking that contender is a lock, and a lock is placed
// before the draft runs — so it seats the show the scarcity rule would never
// have picked.
const NIGHT = '.sch-day[data-date="2026-10-19"]';
const HOUR = `${NIGHT} .sch-show:last-of-type`;

module.exports = {
  description: "locking a night holds it, even against a scarcer contender",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const before = await t.element(HOUR);
    await page.click(`${HOUR} .sch-rivals-btn`);
    await page.waitForTimeout(150);
    await page.click("#calRivals .pop-rival");
    await page.waitForTimeout(350);
    return t.animate([before, await t.element(HOUR)]);
  },
};
