"use strict";

// Two ways a contender is no offer at all, proved against the shipped drafter
// on a programme built so that each disqualification is the only thing that
// could explain the answer.
const COORDS = { H: { lat: 31.7806, lng: 35.2226 }, FAR: { lat: 31.85, lng: 35.31 } };

const show = (slug, nights, { start = "20:00", duration = 60, venue = "H" } = {}) => ({
  slug,
  title: slug,
  duration,
  venue,
  venueName: venue,
  performances: nights.map((date) => ({ date, start, status: "TICKETS_AVAILABLE", soldOut: false })),
});

module.exports = {
  description: "an hour is only offered to a show that could really take it",
  async verify(assert) {
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");
    const draft = (shows, extra = {}) =>
      draftCalendar(shows, {
        dateStart: "2026-10-18",
        dateEnd: "2026-10-20",
        dayStartMin: 9 * 60,
        dayEndMin: 25 * 60,
        maxPerDay: 3,
        minGapSameVenue: 0,
        minGapDifferentVenue: 30,
        travelMode: "walk",
        venueCoords: COORDS,
        ...extra,
      });
    const at = (result, date, time) =>
      (result.days.find((d) => d.date === date) || { slots: [] }).slots.find((s) => s.startTime === time);
    const offeredAt = (result, date, time) =>
      (at(result, date, time) || { contenders: [] }).contenders.map((c) => c.slug);

    // 1. Already in the calendar on another night. Offering it here would be
    //    offering to move it, which is not what the picker says it does — and
    //    the reader would lose a show without being told which.
    const rare = show("rare", ["2026-10-18"]);
    const elsewhere = show("elsewhere", ["2026-10-18", "2026-10-19"]);
    const moved = draft([rare, elsewhere]);
    assert.equal(at(moved, "2026-10-18", "20:00").slug, "rare", "the scarcer show takes the hour");
    assert.equal(moved.picked.get("elsewhere"), "2026-10-19T20:00", "the other one took a night of its own");
    assert.deepEqual(offeredAt(moved, "2026-10-18", "20:00"), [], "so it is not also offered here");

    // 2. Unreachable from what the reader has committed to that night. The walk
    //    between the venues plus the rest asked for between shows is the same
    //    constraint the draft obeys, so an offer that ignored it would be an
    //    offer to break the evening.
    const locked = show("locked", ["2026-10-18"], { start: "19:00" });
    const winner = show("winner", ["2026-10-18"], { start: "20:30" });
    const far = show("far", ["2026-10-18"], { start: "20:30", venue: "FAR" });
    const committed = draft([locked, winner, far], { locked: { locked: "2026-10-18T19:00" } });
    assert.equal(at(committed, "2026-10-18", "20:30").slug, "winner");
    assert.deepEqual(
      offeredAt(committed, "2026-10-18", "20:30"),
      [],
      "it cannot be reached from the show locked before it"
    );
    assert.deepEqual(
      committed.crowdedOut.map((s) => s.slug),
      ["far"],
      "a show nothing drafts and no stack offers is counted rather than lost"
    );

    // …and the same evening with nothing committed still offers it: the 19:00
    // show is the draft's own guess, and a guess moves out of the way.
    assert.deepEqual(offeredAt(draft([locked, winner, far]), "2026-10-18", "20:30"), ["far"]);

    // 3. A settled hour offers nobody: the reader has already answered it.
    const settled = draft([rare, show("other", ["2026-10-18"])], {
      locked: { rare: "2026-10-18T20:00" },
    });
    assert.equal(at(settled, "2026-10-18", "20:00").verdict, "locked");
    assert.deepEqual(offeredAt(settled, "2026-10-18", "20:00"), []);
  },
};
