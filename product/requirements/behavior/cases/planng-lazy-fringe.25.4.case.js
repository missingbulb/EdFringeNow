"use strict";
const { plannerReady } = require("../../shared/case-helpers");

// The Fringe's catalogue files, by the part of their path that names them.
const FRINGE_FILES = ["/data/normalized/", "/data/venues.json"];

/* A festival's programme is fetched only once a period reaches it: the three
 * Israeli festivals plan off their own small files, and the Fringe's catalogue
 * waits until the reader chooses Edinburgh. */
module.exports = {
  description: "choosing Haifa, Acco or Jerusalem never downloads the Fringe's programme; choosing the Fringe does",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    const fetched = [];
    page.on("request", (request) => {
      const { pathname } = new URL(request.url());
      if (FRINGE_FILES.some((f) => pathname.startsWith(f))) fetched.push(pathname);
    });

    await page.goto(`${origin}/planNG/?festival=haifa-iff`, { waitUntil: "load" });
    await plannerReady(page, "haifa-iff");
    for (const festival of ["acco", "jerusalem-comedy"]) {
      await page.click(`.tl-item[data-festival="${festival}"]`);
      await plannerReady(page, festival);
    }
    assert.deepEqual(fetched, [], "Haifa, Acco and Jerusalem planned without a byte of the Fringe");

    await page.click('.tl-item[data-festival="edfringe"]');
    await plannerReady(page, "edfringe");
    assert.deepEqual(
      [...new Set(fetched)].sort(),
      ["/data/normalized/availability.min.json", "/data/normalized/shows.min.json", "/data/venues.json"],
      "choosing the Fringe fetches its catalogue, its venues and its availability"
    );
  },
};
