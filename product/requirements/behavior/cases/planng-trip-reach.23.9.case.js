"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { jerusalemReady, calendarSpans } = require("../../shared/case-helpers");

const FIXTURES = path.join(__dirname, "..", "..", "shared", "fixtures", "data", "festivals");

// A festival an hour from Jerusalem, starting three days after Jerusalem's
// ends and running a day longer: Jerusalem's own programme moved on a week,
// so it has shows of its own to plan. The registry is the fixture's plus this
// one.
const NEAR = {
  id: "near-by",
  name: "Near By Festival",
  nameLocal: null,
  city: "Tel Aviv",
  country: "IL",
  lat: 32.0853,
  lng: 34.7818,
  timezone: "Asia/Jerusalem",
  lang: "he",
  dir: "rtl",
  kind: "comedy",
  site: "https://example.org",
  editions: [{ id: "2026", ordinal: null, firstDate: "2026-10-25", lastDate: "2026-10-30", format: "block", dataUrl: "/data/festivals/near-by/2026.json" }],
};

function weekLater(text) {
  return text.replace(/2026-10-(1[89]|2[0-2])/g, (_, d) => `2026-10-${Number(d) + 7}`).replace(/"jerusalem-comedy"/g, '"near-by"');
}

module.exports = {
  description: "a trip past one festival's run plans every festival its dates reach, led by the one chosen while the trip reaches it, else the one it covers most",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const registry = JSON.parse(fs.readFileSync(path.join(FIXTURES, "index.json"), "utf8"));
    registry.festivals.push(NEAR);
    await page.route("**/data/festivals/index.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(registry) })
    );
    const programme = weekLater(fs.readFileSync(path.join(FIXTURES, "jerusalem-comedy", "2026.json"), "utf8"));
    await page.route("**/data/festivals/near-by/2026.json", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: programme })
    );
    const planned = () => page.$$eval("#schedule .sch-show", (els) => els.map((e) => e.dataset.slug));
    const theme = () => page.getAttribute("html", "data-festival");

    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    assert.deepEqual((await planned()).filter((s) => s.startsWith("near-by/")), [], "Jerusalem's own trip plans Jerusalem alone");

    // Stretched over the neighbour's run: both are planned, and Jerusalem,
    // chosen, leads on its five days against the neighbour's six.
    await page.fill("#tripTo", "2026-10-31");
    await calendarSpans(page, "2026-10-17", "2026-10-31");
    const both = await planned();
    assert.ok(both.some((s) => s.startsWith("near-by/")), "the neighbour's shows join the calendar");
    assert.ok(both.some((s) => s.startsWith("jerusalem-comedy/")), "beside Jerusalem's");
    assert.equal(await theme(), "jerusalem-comedy", "the festival chosen leads while the trip reaches it");
    assert.equal(new URL(page.url()).searchParams.get("festival"), "jerusalem-comedy", "and the address says so");

    // Moved off Jerusalem's run, the neighbour leads.
    await page.fill("#tripFrom", "2026-10-24");
    await calendarSpans(page, "2026-10-24", "2026-10-31");
    assert.equal(await theme(), "near-by", "off the chosen festival's run, the one the trip covers most leads");
    assert.equal(new URL(page.url()).searchParams.get("festival"), null, "and the address names no festival");
    assert.deepEqual((await planned()).filter((s) => s.startsWith("jerusalem-comedy/")), [], "and nothing is planned outside the trip");
  },
};
