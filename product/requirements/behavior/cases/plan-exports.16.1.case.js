"use strict";
const fs = require("node:fs");
const { planReady, planFavourites } = require("../../shared/case-helpers");

module.exports = {
  description: "the CSV download: fringe-itinerary.csv, BOM, exact headers, CRLF rows",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  async verify(page, { origin, assert }) {
    await page.goto(`${origin}/plan/`, { waitUntil: "load" });
    await planReady(page);
    await page.waitForSelector(".sch-show");
    const downloadPromise = page.waitForEvent("download");
    await page.click("#downloadCsvBtn");
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "fringe-itinerary.csv");
    const text = fs.readFileSync(await download.path(), "utf8");
    assert.ok(text.startsWith("\uFEFF"), "UTF-8 BOM");
    const lines = text.slice(1).split("\r\n");
    assert.equal(lines[0], "Date,Day,Start,End,Show,Genre,Venue,Room,Status,Tickets");
    assert.ok(lines.length > 2, "one row per planned show");
    assert.match(lines[1], /^2026-08-\d\d,[A-Z][a-z][a-z],\d\d:\d\d,/);
  },
};
