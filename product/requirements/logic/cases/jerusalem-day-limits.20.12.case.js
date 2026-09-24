"use strict";

// The rows ARE the requirement: for each verdict, which of the reader's answers
// can keep the show off a night. verify() proves every cell by running the
// shipped drafter over a programme built so that the one answer in that column
// is the only thing that could explain the result.
const TABLE = {
  columns: ["Verdict", "How full a day", "Your day hours", "What you are here for"],
  rows: [
    ["Lock this night", "placed anyway", "placed anyway", "placed anyway"],
    ["Favourite the show", "held to it", "held to it", "placed anyway"],
    ["No verdict", "held to it", "held to it", "held to it"],
  ],
};

const COORDS = { H: { lat: 31.7806, lng: 35.2226 } };
const NIGHT = "2026-10-18";

const show = (slug, start, kind = "movies") => ({
  slug,
  title: slug,
  duration: 60,
  venue: "H",
  venueName: "The Hall",
  genreSlug: kind,
  genreSlugs: [kind],
  performances: [{ date: NIGHT, start, status: "TICKETS_AVAILABLE", soldOut: false }],
});

// Three shows on one night, two hours apart, none of the reader's kind unless
// a case says so.
const THREE = [show("a", "16:00"), show("b", "18:00"), show("c", "20:00")];

module.exports = {
  description:
    "only a lock overrides how full a day and your day hours; a favourite is held to both, though not to what you are here for",
  table: TABLE,
  async verify(assert) {
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");

    const draft = (shows, extra = {}) =>
      draftCalendar(shows, {
        dateStart: NIGHT,
        dateEnd: NIGHT,
        dayStartMin: 9 * 60,
        dayEndMin: 25 * 60,
        maxPerDay: 8,
        minGapSameVenue: 0,
        minGapDifferentVenue: 30,
        travelMode: "walk",
        venueCoords: COORDS,
        maxUnpreferredPerDay: 1,
        ...extra,
      });

    const count = (result) => (result.days[0] ? result.days[0].slots.length : 0);
    const allThree = { a: `${NIGHT}T16:00`, b: `${NIGHT}T18:00`, c: `${NIGHT}T20:00` };

    // How full a day — one show a night, three contenders.
    const oneADay = { maxPerDay: 1 };
    assert.equal(count(draft(THREE, oneADay)), 1, "no verdict: a night takes one show when you asked for one");
    assert.equal(
      count(draft(THREE, { ...oneADay, favourites: ["a", "b", "c"] })),
      1,
      "favourite: three starred shows on a one-show night leave one on it"
    );
    assert.equal(
      count(draft(THREE, { ...oneADay, locked: allThree })),
      3,
      "lock: every locked night is kept, however full the day"
    );

    // Your day hours — the night ends at 22:00 and the show starts at 23:30.
    const late = [show("late", "23:30")];
    const shortDay = { dayEndMin: 22 * 60 };
    assert.equal(count(draft(late, shortDay)), 0, "no verdict: a show past the day's end is not drafted");
    assert.equal(
      count(draft(late, { ...shortDay, favourites: ["late"] })),
      0,
      "favourite: a starred show past the day's end is not drafted either"
    );
    assert.equal(
      count(draft(late, { ...shortDay, locked: { late: `${NIGHT}T23:30` } })),
      1,
      "lock: the locked night is kept past the day's end"
    );

    // What you are here for — a kind named, so a night takes one show from
    // outside it, and all three of these are outside it.
    const tasteOnly = [...THREE, show("ours", "12:00", "stand-up")];
    const named = { preferred: ["ours"] };
    const outside = (result) => result.days[0].slots.filter((s) => s.slug !== "ours").length;
    assert.equal(outside(draft(tasteOnly, named)), 1, "no verdict: one show a night from outside your kinds");
    assert.equal(
      outside(draft(tasteOnly, { ...named, favourites: ["a", "b", "c"] })),
      3,
      "favourite: every starred show is placed, whatever kind it is"
    );
    assert.equal(
      outside(draft(tasteOnly, { ...named, locked: allThree })),
      3,
      "lock: every locked show is placed, whatever kind it is"
    );
  },
};
