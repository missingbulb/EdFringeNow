"use strict";

// A programme dense enough that the old earliest-first tie-break would fill a
// short day from the morning alone: a show every ninety minutes from 10:00 to
// 22:00, every night of the window.
const START_TIMES = ["10:00", "11:30", "13:00", "14:30", "16:00", "17:30", "19:00", "20:30", "22:00"];
const NIGHTS = ["2026-10-18", "2026-10-19", "2026-10-20"];

const show = (slug, nights, start) => ({
  slug,
  title: slug,
  duration: 60,
  venue: "H",
  venueName: "H",
  performances: nights.map((date) => ({ date, start, status: "TICKETS_AVAILABLE", soldOut: false })),
});

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

module.exports = {
  description: "a day with room for few shows spreads them across its hours",
  async verify(assert) {
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");
    const programme = [];
    START_TIMES.forEach((start, i) => {
      for (let n = 0; n < 4; n++) programme.push(show(`s${i}-${n}`, NIGHTS, start));
    });
    const draft = (shows, extra = {}) =>
      draftCalendar(shows, {
        dateStart: NIGHTS[0],
        dateEnd: NIGHTS[NIGHTS.length - 1],
        dayStartMin: 9 * 60,
        dayEndMin: 25 * 60,
        minGapSameVenue: 0,
        minGapDifferentVenue: 30,
        travelMode: "walk",
        venueCoords: { H: { lat: 31.7806, lng: 35.2226 } },
        ...extra,
      });
    const startsOn = (result, date) =>
      (result.days.find((d) => d.date === date) || { slots: [] }).slots.map((s) => toMin(s.startTime));

    // Two a day: one in each half of the programme's hours, not both before noon.
    const two = draft(programme, { maxPerDay: 2 });
    for (const date of NIGHTS) {
      const starts = startsOn(two, date);
      assert.equal(starts.length, 2, `${date} still takes two shows`);
      assert.ok(starts[0] < toMin("16:00") && starts[1] >= toMin("16:00"), `${date} spreads its two: ${starts}`);
    }

    // Three a day: one in each third.
    const three = draft(programme, { maxPerDay: 3 });
    for (const date of NIGHTS) {
      const starts = startsOn(three, date);
      assert.equal(starts.length, 3, `${date} still takes three shows`);
      const thirds = starts.map((m) => Math.min(2, Math.floor(((m - toMin("10:00")) * 3) / (toMin("22:00") - toMin("10:00") + 1))));
      assert.deepEqual(thirds, [0, 1, 2], `${date} has one show in each third: ${starts}`);
    }

    // An early end is the reader's to set, and the spread works within it.
    const early = draft(programme, { maxPerDay: 2, dayEndMin: 15 * 60 + 30 });
    for (const date of NIGHTS) {
      const starts = startsOn(early, date);
      assert.equal(starts.length, 2);
      assert.ok(starts.every((m) => m + 60 <= 15 * 60 + 30), `${date} ends by the reader's day end: ${starts}`);
    }

    // Scarcity still comes first: two one-night shows in the same morning both
    // take their hours, and the spread only chooses among the rest.
    const rareA = show("rare-a", [NIGHTS[0]], "10:00");
    const rareB = show("rare-b", [NIGHTS[0]], "11:30");
    const withRare = draft([rareA, rareB, ...programme], { maxPerDay: 3 });
    assert.equal(withRare.picked.get("rare-a"), `${NIGHTS[0]}T10:00`);
    assert.equal(withRare.picked.get("rare-b"), `${NIGHTS[0]}T11:30`);
    const rest = startsOn(withRare, NIGHTS[0]).filter((m) => m > toMin("11:30"));
    assert.equal(rest.length, 1, "the day's third show comes from the rest");
    assert.ok(rest[0] >= toMin("14:00"), `and it goes to a part of the day nothing holds yet: ${rest}`);

    // A programme with only a morning still fills the day to its cap.
    const morning = programme.filter((s) => toMin(s.performances[0].start) < toMin("13:00"));
    const onlyMorning = draft(morning, { maxPerDay: 2 });
    for (const date of NIGHTS) assert.equal(startsOn(onlyMorning, date).length, 2);
  },
};
