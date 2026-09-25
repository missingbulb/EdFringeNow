"use strict";
const path = require("node:path");
const { plannerReady, settle } = require("../../shared/case-helpers");

const LIMITS = path.join(__dirname, "..", "..", "..", "..", "site", "shared", "limits.js");
const FILTERS = path.join(__dirname, "..", "..", "..", "..", "site", "planNG", "lib", "filters.js");

// The rows are the requirement: every list the page can draw, and the most it
// may draw with the whole Fringe pooled. verify() measures each on the page.
const TABLE = {
  columns: ["List", "Draws at most"],
  rows: [
    ["The drawer's programme list", "nothing: it asks for a search"],
    ["A one-letter search's results", "SEARCH_RESULT_ROWS (40)"],
    ["The kinds filter's options", "FACET_OPTIONS (30)"],
    ["The venues filter's options", "FACET_OPTIONS (30), and a line for the rest"],
    ["The kinds question's answers", "the eight shared kinds"],
    ["The kinds question's tags", "FACET_OPTIONS (30)"],
    ["The rivals of the most contested hour", "RIVAL_ROWS (8), and a line for the rest"],
    ["The drawer's grid", "a lane per show ruled on: none yet"],
  ],
};

module.exports = {
  description: "focused on the whole Fringe, no list draws more than its cap",
  table: TABLE,
  page: "/planNG/?festival=edfringe",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const { SEARCH_RESULT_ROWS, FACET_OPTIONS, RIVAL_ROWS } = await import(LIMITS);
    const { GENRES } = await import(FILTERS);
    await page.goto(`${origin}/planNG/?festival=edfringe`, { waitUntil: "load" });
    await plannerReady(page, "edfringe");
    const count = (selector) => page.locator(selector).count();

    const shows = await page.evaluate(() => document.getElementById("browseLine1").textContent);
    assert.match(shows, /\d,\d{3}/, `the whole programme is pooled (${shows})`);

    // The drawer's list: too long to browse, so nothing is drawn.
    await page.evaluate(() => (document.getElementById("boardDrawer").open = true));
    assert.equal(await count("#browseList li"), 0, "the programme list draws no rows");
    assert.equal(await count("#browseMore .browse-search-first"), 1, "and asks for a search");
    assert.equal(await count("#lanes .lane"), 0, "no lanes before anything is ruled on");

    await page.fill("#ssInput", "a");
    await page.waitForSelector("#ssResults li");
    const results = await count("#ssResults li");
    assert.ok(results > 0 && results <= SEARCH_RESULT_ROWS, `a search draws ${results}, at most ${SEARCH_RESULT_ROWS}`);

    const kinds = await count("#ssfGenreOptions label");
    assert.ok(kinds > 0 && kinds <= FACET_OPTIONS, `the kinds filter lists ${kinds}`);
    const venues = await count("#ssfVenueOptions label");
    assert.equal(venues, FACET_OPTIONS, "the venues filter lists exactly a panel's worth");
    assert.equal(await count("#ssfVenueOptions .panel-more"), 1, "and says how many it left out");

    const answers = await count('#prefs [data-pick^="interest:"]:not([data-pick="interest:*"])');
    assert.equal(answers, GENRES.length, "the kinds question offers the shared kinds");
    const tags = await count("#prefs .pref-tag");
    assert.ok(tags > 0 && tags <= FACET_OPTIONS, `the kinds question lists ${tags} tags`);

    // The most contested hour on the calendar, by the count its card names.
    const stacks = await page.$$eval(".sch-others", (els) =>
      els.map((el, i) => ({ i, n: Number((el.getAttribute("aria-label").match(/\d+/) || ["0"])[0]) }))
    );
    assert.ok(stacks.length > 0, "some hour is contested");
    const busiest = stacks.reduce((a, b) => (b.n > a.n ? b : a));
    await page.locator(".sch-others").nth(busiest.i).evaluate((el) => el.click());
    await settle(page);
    const rivals = await count("#calRivals .pop-rival");
    assert.equal(rivals, Math.min(busiest.n, RIVAL_ROWS), `the busiest hour (${busiest.n} rivals) names ${rivals}`);
    assert.equal(await count("#calRivals .pop-more"), busiest.n > RIVAL_ROWS ? 1 : 0, "and a line for the rest");
  },
};
