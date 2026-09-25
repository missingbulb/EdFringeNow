"use strict";
const { plannerReady } = require("../../shared/case-helpers");

/* The Haifa trip with two days in a row given to Acco, and the day either
 * side of them. */
const ACCO = { kind: "festival", festival: "acco" };

module.exports = {
  description: "days in a row kept for the same thing join into one stretch under one title",
  page: "/planNG/?festival=haifa-iff",
  viewport: "desktop",
  localStorage: {
    "planNG.days": JSON.stringify({ kept: { "2026-09-29": ACCO, "2026-09-30": ACCO } }),
  },
  ready: (page) => plannerReady(page, "haifa-iff"),
  async capture(page, t) {
    const heads = await Promise.all(
      ["2026-09-28", "2026-10-01"].map((d) => t.rectOf(`.sch-day[data-date="${d}"] .sch-day-head`))
    );
    const title = await t.rectOf(".sch-keep-title");
    return t.clip(t.pad(t.union([...heads, { ...title, height: title.height + 40 }]), 4));
  },
};
