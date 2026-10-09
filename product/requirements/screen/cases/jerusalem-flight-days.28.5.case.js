"use strict";
const { calendarDays, jerusalemReady, routeFares, flightsSettled, answerTravel } = require("../../shared/case-helpers");

/* Coming from London: the trip's first day beside its last, each with the
 * hours its flight takes. */
module.exports = {
  description: "flying in takes the first day until landing and the trip from the airport; flying home takes the last from when you leave for it",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  ready: jerusalemReady,
  async drive(page) {
    await routeFares(page);
    await answerTravel(page, { home: "GB", way: "fly" });
    await flightsSettled(page);
    await page.waitForFunction(() => document.querySelectorAll(".sch-own--flight").length === 2, null, { timeout: 20000 });
    await jerusalemReady(page);
  },
  async capture(page, t) {
    const days = await calendarDays(page);
    const day = async (iso) => t.clip(t.pad(await t.rectOf(`.sch-day[data-date="${iso}"]`), 2));
    return t.stitchH([await day(days[0]), await day(days[days.length - 1])]);
  },
};
