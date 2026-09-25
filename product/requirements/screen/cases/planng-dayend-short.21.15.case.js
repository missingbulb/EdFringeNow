"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The Haifa trip's day at Acco, with the day ending at 20:55 and days full
 * enough to take the twenty-minute street show at 20:15: its block stops at
 * the day's end line instead of being drawn past it. */
module.exports = {
  description: "a short show at the end of the day is drawn no further than the day's end",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  localStorage: {
    "planNG.prefs": JSON.stringify({ dayEndMin: 20 * 60 + 55, maxPerDay: 8, minGap: 15, answered: ["dayEnd", "pace"] }),
  },
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const col = await t.rectOf(".sch-day--festival");
    const line = await t.rectOf(".sch-dayline--end");
    return t.clip(t.pad({ x: col.x, y: line.y - 150, width: col.width, height: 190 }, 4));
  },
};
