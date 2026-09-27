"use strict";

// The rows ARE the requirement: an online show asks for no journey. verify()
// drafts real-shaped shows through the shipped engine.
const TABLE = {
  columns: ["First show, ends 19:00", "Next show, starts 19:00", "Drafted"],
  rows: [
    ["at a venue", "online", "both"],
    ["online", "at a venue", "both"],
    ["at a venue", "at a venue across town", "not both: the journey needs time"],
  ],
};

const DAY = "2026-09-29";
const show = (slug, start, { online = false, venue = "hall" } = {}) => ({
  slug,
  title: slug,
  venue: online ? "stream" : venue,
  online,
  duration: 60,
  performances: [{ date: DAY, start, status: "TICKETS_AVAILABLE" }],
});
const COORDS = new Map([
  ["hall", { lat: 32.794044, lng: 34.989571 }],
  ["far", { lat: 32.82, lng: 35.02 }],
]);

module.exports = {
  description: "an online show needs no travel time before or after it",
  table: TABLE,
  async verify(assert) {
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");
    const count = (shows) =>
      draftCalendar(shows, {
        dateStart: DAY,
        dateEnd: DAY,
        windowStart: `${DAY}T00:00`,
        windowEnd: `${DAY}T23:59`,
        minGapDifferentVenue: 30,
        venueCoords: COORDS,
      }).days.flatMap((d) => d.slots).length;

    assert.equal(count([show("a", "18:00"), show("b", "19:00", { online: true })]), 2, "venue, then online");
    assert.equal(count([show("a", "18:00", { online: true }), show("b", "19:00")]), 2, "online, then venue");
    assert.equal(count([show("a", "18:00"), show("b", "19:00", { venue: "far" })]), 1, "two venues need the journey");
  },
};
