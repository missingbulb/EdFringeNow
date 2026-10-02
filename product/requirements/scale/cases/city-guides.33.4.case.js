"use strict";
const fs = require("node:fs");
const path = require("node:path");

const DATA = path.join(__dirname, "..", "..", "..", "..", "site", "data");
const read = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), "utf8"));

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

/** Every host city of a festival with a programme, and those festivals, from the real registry. */
function hostCities() {
  const byCity = new Map();
  for (const festival of read("festivals/index.json").festivals) {
    if (!festival.editions.some((e) => e.dataUrl)) continue;
    byCity.set(festival.city, [...(byCity.get(festival.city) || []), festival.id]);
  }
  return byCity;
}

module.exports = {
  description: "every city hosting a festival with a programme has its drawer, within each list's cap",
  table: TABLE,
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const hosts = hostCities();
    assert.ok(hosts.size > 0, "the registry serves some festival");

    // Every host city has its lists, whether or not its festival can be
    // opened today: a festival whose run is behind the year strip still has a
    // city a trip there would want.
    const cities = read("cities/index.json").cities;
    for (const city of hosts.keys()) {
      const entry = cities.find((c) => c.name === city);
      assert.ok(entry && entry.dataUrl, `${city} has lists`);
      const lists = read(entry.dataUrl.replace(/^\/data\//, ""));
      assert.ok(lists.stay.length > 0 && lists.eat.length > 0, `${city} offers somewhere to stay and to eat`);
      assert.ok(lists.stay.length <= CAPS.stay && lists.eat.length <= CAPS.eat && lists.trips.length <= CAPS.trips,
        `${city}'s lists are within their caps`);
    }

    // On the page: the drawer of each host city whose festival the planner
    // opens on (one whose run is on the year strip), within its caps.
    let opened = 0;
    for (const [city, festivals] of hosts) {
      for (const festival of festivals) {
        await page.goto(`${origin}/planNG/?festival=${festival}`, { waitUntil: "load" });
        await page.waitForSelector("#cityGuide[data-state]", { state: "attached", timeout: 20000 });
        if ((await page.getAttribute("html", "data-festival")) !== festival) continue;
        assert.equal(await page.getAttribute("#cityGuide", "data-state"), "shown", `${city} (${festival}) has its drawer`);
        const counts = await page.$$eval("#cityGuide [data-guide-list]", (lists) =>
          Object.fromEntries(lists.map((l) => [l.dataset.guideList, l.querySelectorAll("li").length]))
        );
        for (const [list, cap] of Object.entries(CAPS)) {
          assert.ok((counts[list] || 0) <= cap, `${city}: ${list} holds ${counts[list]}, at most ${cap}`);
        }
        assert.ok(counts.stay > 0 && counts.eat > 0, `${city} draws somewhere to stay and to eat (${JSON.stringify(counts)})`);
        opened++;
        break;
      }
    }
    assert.ok(opened > 0, "some host city's festival opens on the page");
  },
};
