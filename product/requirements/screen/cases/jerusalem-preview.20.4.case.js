"use strict";
const { jerusalemAllDays, jerusalemReady, jerusalemStarred, openCard } = require("../../shared/case-helpers");

// A show with more than one night, so the nights list has something to say and
// the rarity pill reads "1 of 3" rather than "only night".
const FAVOURITE = '.sch-day[data-date="2026-10-19"] .sch-show.sch-show--fav';

module.exports = {
  description: "hovering a card opens how rare the show is, every night it plays, and the four verdicts",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  localStorage: { ...jerusalemStarred(["yolo"]), ...jerusalemAllDays() },
  ready: jerusalemReady,
  async capture(page, t) {
    await openCard(page, FAVOURITE);
    return t.unionClip([FAVOURITE, "#calPreview"], 8);
  },
};
