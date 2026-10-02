"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { plannerReady } = require("../../shared/case-helpers");

const REGISTRY = path.join(__dirname, "..", "..", "..", "..", "site", "data", "festivals", "index.json");

// The rows are the requirement: what each city's drawer may hold at most.
const TABLE = {
  columns: ["List", "Holds at most"],
  rows: [
    ["Places to stay", "8"],
    ["Places to eat", "8"],
    ["Sights", "6"],
    ["Day trips", "6"],
  ],
};
const CAPS = { stay: 8, eat: 8, see: 6, trips: 6 };

/** One festival with a programme per host city, from the real registry. */
function cityFestivals() {
  const byCity = new Map();
  for (const festival of JSON.parse(fs.readFileSync(REGISTRY, "utf8")).festivals) {
    if (!festival.editions.some((e) => e.dataUrl)) continue;
    if (!byCity.has(festival.city)) byCity.set(festival.city, festival.id);
  }
  return [...byCity];
}

module.exports = {
  description: "every city hosting a festival with a programme has its drawer, within each list's cap",
  table: TABLE,
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const cities = cityFestivals();
    assert.ok(cities.length > 0, "the registry serves some festival");
    for (const [city, festival] of cities) {
      await page.goto(`${origin}/planNG/?festival=${festival}`, { waitUntil: "load" });
      await plannerReady(page, festival);
      await page.waitForSelector("#cityGuide[data-state]", { state: "attached", timeout: 20000 });
      const state = await page.getAttribute("#cityGuide", "data-state");
      assert.equal(state, "shown", `${city} (${festival}) has its drawer`);
      const counts = await page.$$eval("#cityGuide [data-guide-list]", (lists) =>
        Object.fromEntries(lists.map((l) => [l.dataset.guideList, l.querySelectorAll("li").length]))
      );
      for (const [list, cap] of Object.entries(CAPS)) {
        assert.ok((counts[list] || 0) <= cap, `${city}: ${list} holds ${counts[list]}, at most ${cap}`);
      }
      assert.ok(counts.stay > 0 && counts.eat > 0, `${city} offers somewhere to stay and to eat (${JSON.stringify(counts)})`);
    }
  },
};
