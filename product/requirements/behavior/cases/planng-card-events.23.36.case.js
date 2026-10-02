"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { jerusalemReady } = require("../../shared/case-helpers");

const REGISTRY = path.join(__dirname, "..", "..", "shared", "fixtures", "data", "festivals", "index.json");

/* The overview counts each edition's events; the card a festival shows on the
 * strip says the count. The frozen registry predates the count, so it is
 * served here with one. */
module.exports = {
  description: "a festival's card on the strip says how many events its programme holds",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const registry = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
    const fringe = registry.festivals.find((f) => f.id === "edfringe");
    fringe.editions[0].events = 3456;
    await page.route("**/data/festivals/index.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(registry) })
    );

    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await page.hover('.tl-item[data-festival="edfringe"] .tl-bar');
    await page.waitForSelector(".tl-card:not([hidden])");
    assert.match(await page.textContent(".tl-card"), /3,456 events in the programme/);

    // Reached with the keyboard: the trip's handles lie over its own bar.
    await page.mouse.move(0, 0);
    await page.focus('.tl-item[data-festival="jerusalem-comedy"]');
    await page.waitForSelector(".tl-card:not([hidden])");
    assert.match(
      await page.textContent(".tl-card"),
      /Programme published/,
      "an edition the overview does not count still says its programme is out"
    );
  },
};
