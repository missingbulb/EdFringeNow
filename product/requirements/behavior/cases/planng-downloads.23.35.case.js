"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { chooseOnStrip, plannerReady } = require("../../shared/case-helpers");

const REGISTRY = path.join(__dirname, "..", "..", "shared", "fixtures", "data", "festivals", "index.json");

// A festival just over a border from Haifa, running through Haifa's own run:
// a day-trip away, but in another country. Its programme points at Acco's
// block, so a fetch of it would show as a second fetch of that file.
const ACROSS = {
  id: "across-the-border",
  name: "Across the Border Festival",
  nameLocal: null,
  city: "Beirut",
  country: "LB",
  lat: 33.8938,
  lng: 35.5018,
  timezone: "Asia/Beirut",
  lang: "en",
  dir: "ltr",
  kind: "theatre",
  site: "https://example.org",
  editions: [
    { id: "2026", ordinal: null, firstDate: "2026-09-26", lastDate: "2026-10-02", dataUrl: "/data/festivals/across-the-border/2026.json" },
  ],
};

/* Choosing Haifa fetches Haifa's programme and Acco's, which runs inside the
 * trip in the same country, and neither Jerusalem's (same country, another
 * month) nor the festival across the border, nor the Fringe's. */
module.exports = {
  description: "choosing a festival downloads its programme and those of same-country festivals the trip overlaps, and no other",
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
    registry.festivals.push(ACROSS);
    await page.route("**/data/festivals/index.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(registry) })
    );
    const fetched = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith("/data/")) fetched.push(pathname);
    });

    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await page.waitForSelector('.tl-item[data-festival="haifa-iff"]', { state: "attached", timeout: 20000 });
    await chooseOnStrip(page, "haifa-iff");
    await plannerReady(page, "haifa-iff");

    assert.deepEqual(
      [...new Set(fetched)].sort(),
      ["/data/festivals/acco/2026.json", "/data/festivals/haifa-iff/2026.json", "/data/festivals/index.json"],
      "the chosen festival's programme and its same-country neighbour's, besides the overview"
    );
    const out = await page.$$eval("#panel-festivals .fest-row--out", (rows) => rows.map((r) => r.textContent));
    assert.equal(out.length, 1, "the festival across the border is still named");
    assert.match(out[0], /Across the Border Festival/);
    assert.match(out[0], /another country/, "as in another country");
  },
};
