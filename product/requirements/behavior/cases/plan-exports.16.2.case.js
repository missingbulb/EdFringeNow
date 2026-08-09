"use strict";
const fs = require("node:fs");
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the ICS download: Europe/London TZID + VTIMEZONE, stable UIDs, calendar name, 30-min alarm",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector(".sch-show");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#importIcsBtn");
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "fringe-plan.ics");
    const raw = fs.readFileSync(await download.path(), "utf8");
    const ics = raw.replace(/\r\n[ \t]/g, ""); // unfold 75-octet continuations before matching
    assert.ok(ics.includes("BEGIN:VTIMEZONE"), "embedded VTIMEZONE");
    assert.ok(ics.includes("X-WR-TIMEZONE:Europe/London"));
    assert.ok(/DTSTART;TZID=Europe\/London:/.test(ics));
    assert.ok(ics.includes("X-WR-CALNAME:Fringe 2026"), "calendar name");
    assert.ok(/UID:[a-z0-9-]+-\d{8}T\d{6}@edfringenow\.com/.test(ics), "stable per-performance UID");
    assert.ok(/TRIGGER:-PT30M/.test(ics), "30-minute reminder");
  },
};
