"use strict";

/* A first visit, with nothing chosen and nothing stored: the year is drawn
 * from the overview alone, no programme is fetched, and the page asks for a
 * festival. */
module.exports = {
  description: "opened with no festival chosen, the page downloads the overview and no programme, and asks for a festival",
  page: "/planNG/",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const fetched = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (pathname.startsWith("/data/")) fetched.push(pathname);
    });
    await page.goto(`${origin}/planNG/`, { waitUntil: "load" });
    await page.waitForSelector('.tl-item[data-festival="haifa-iff"]', { state: "attached", timeout: 20000 });
    await page.waitForFunction(() => {
      const pop = document.querySelector("#footerVersion .version-pop");
      return pop && pop.textContent.includes("v0.0.0-spec");
    }, { timeout: 20000 });

    assert.ok(await page.isVisible("#pickState"), "the page asks for a festival");
    assert.equal(await page.locator("#schedule .sch-day").count(), 0, "and plans nothing");
    assert.equal(await page.isVisible("#planPanel"), false, "with no calendar standing empty");
    assert.deepEqual(
      fetched,
      ["/data/festivals/index.json"],
      "the overview is the only festival data fetched"
    );
  },
};
