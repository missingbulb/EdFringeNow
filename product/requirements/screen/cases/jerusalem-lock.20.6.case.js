"use strict";
const { clickStackBand, jerusalemReady } = require("../../shared/case-helpers");

// Monday at 22:00: a one-night show took the hour from a free late-night that
// plays four evenings. Taking that one from the stack is a lock, and a lock is
// placed before the draft runs — so it seats the show the scarcity rule would
// never have picked, and the hour stops offering anyone.
const NIGHT = '.sch-day[data-date="2026-10-19"]';

module.exports = {
  description: "locking a night holds it, even against a scarcer contender",
  page: "/planJerusalem/",
  viewport: "desktop",
  ready: jerusalemReady,
  async capture(page, t) {
    const slot = page.locator(`${NIGHT} .sch-slot:has(.sch-stack)`).first();
    const frame = async () => t.clip(t.pad(await slot.boundingBox(), 8));
    const before = await frame();

    await clickStackBand(page, slot);
    await page.click("#calRivals .pop-rival");
    await page.waitForSelector(`${NIGHT} .sch-show--locked`);
    await page.waitForTimeout(250);

    const after = page.locator(`${NIGHT} .sch-slot:has(.sch-show--locked)`).first();
    return t.animate([before, await t.clip(t.pad(await after.boundingBox(), 8))]);
  },
};
