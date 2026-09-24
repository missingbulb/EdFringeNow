"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { jerusalemReady } = require("../../shared/case-helpers");

const REGISTRY = path.join(__dirname, "..", "..", "shared", "fixtures", "data", "festivals", "index.json");

// A festival 4,000 km away running in the middle of Jerusalem's: it carries a
// real programme (Jerusalem's own block, so it has shows to leak), and none of
// them may reach the calendar. The registry is the fixture's plus this one, and
// nothing else about the page is touched.
const FAR = {
  id: "far-away",
  name: "Far Away Festival",
  nameLocal: null,
  city: "Edinburgh",
  country: "GB",
  lat: 55.9533,
  lng: -3.1883,
  timezone: "Europe/London",
  lang: "en",
  dir: "ltr",
  kind: "comedy",
  site: "https://example.org",
  editions: [
    { id: "2026", ordinal: null, firstDate: "2026-10-19", lastDate: "2026-10-21", dataUrl: "/data/festivals/jerusalem-comedy/2026.json" },
  ],
};

module.exports = {
  description: "a festival too far to reach during the focused one is named on the page, and none of its shows is planned",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
    registry.festivals.push(FAR);
    await page.route("**/data/festivals/index.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(registry) })
    );

    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    const out = await page.locator(".pool-line--out").allTextContents();
    assert.equal(out.length, 1, "one festival is left out");
    assert.match(out[0], /Far Away Festival/, "by name");
    assert.match(out[0], /4,000 km/, "with how far it is");

    const planned = await page.$$eval("#schedule .sch-show", (els) => els.map((e) => e.dataset.slug));
    assert.ok(planned.length > 0, "the focused festival is still planned");
    assert.deepEqual(
      planned.filter((slug) => slug.startsWith("far-away/")),
      [],
      "nothing of the far festival's reaches the calendar"
    );
    assert.equal(
      await page.locator('.tl-item[data-festival="far-away"]').count(),
      1,
      "it is still on the timeline, to be chosen on its own"
    );
  },
};
