"use strict";

// Two slots off the real committed catalogue's shape: one with a published
// running time, one without. `start`/`end` are minutes-since-epoch counted with
// Date.UTC — the wall-clock count the engine produces (see availability.js).
const at = (iso, hhmm) => Date.parse(`${iso}T${hhmm}:00Z`) / 60000;

const TIMED = {
  slug: "salakh",
  title: "סלאח שבתי",
  genre: "סרטים",
  date: "2026-10-18",
  realDate: "2026-10-18",
  startTime: "20:00",
  start: at("2026-10-18", "20:00"),
  end: at("2026-10-18", "21:45"),
  duration: 105,
  venueCode: "קולנוע-סם-שפיגל",
  venueName: "קולנוע סם שפיגל",
  venueLat: 31.779724,
  venueLng: 35.212583,
  url: "https://comedy-festival.co.il/events/salakh/",
};

// "קריוקי רייב" publishes no running time. Four of the festival's shows don't.
const UNTIMED = {
  ...TIMED,
  slug: "karaoke-rave",
  title: "קריוקי רייב",
  date: "2026-10-21",
  realDate: "2026-10-21",
  startTime: "22:00",
  start: at("2026-10-21", "22:00"),
  end: at("2026-10-21", "22:00"),
  duration: null,
};

module.exports = {
  description: "the ICS is Jerusalem wall clock; a show with no running time exports as an instant",
  async verify(assert) {
    const { toIcs } = await import("../../../../site/plan/lib/itinerary.js");
    const ics = toIcs([TIMED, UNTIMED], { timezone: "Asia/Jerusalem", now: new Date(Date.UTC(2026, 9, 1)) });

    // The zone's own rules ride along, so a calendar in another country still
    // shows the hour the audience will be in the room.
    assert.match(ics, /X-WR-TIMEZONE:Asia\/Jerusalem/);
    assert.match(ics, /TZID:Asia\/Jerusalem/);
    // Israel leaves standard time on the FRIDAY before the last Sunday in
    // March, which is what this BYMONTHDAY range expresses.
    assert.match(ics, /RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=FR;BYMONTHDAY=23,24,25,26,27,28,29/);
    assert.match(ics, /TZOFFSETTO:\+0300/);
    // No UTC instants anywhere: every time is zoned wall clock.
    assert.doesNotMatch(ics, /^DTSTART.*Z$/m);

    assert.ok(ics.includes("DTSTART;TZID=Asia/Jerusalem:20261018T200000"), ics);
    assert.ok(ics.includes("DTEND;TZID=Asia/Jerusalem:20261018T214500"), ics);

    // Unknown stays unknown: no published length means end === start, never a
    // guessed hour.
    assert.ok(ics.includes("DTSTART;TZID=Asia/Jerusalem:20261021T220000"), ics);
    assert.ok(ics.includes("DTEND;TZID=Asia/Jerusalem:20261021T220000"), ics);

    // Hebrew survives the encoder untransliterated.
    assert.ok(ics.includes("SUMMARY:סלאח שבתי"), ics);
  },
};
