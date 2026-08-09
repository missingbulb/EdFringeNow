"use strict";

const SLOT = {
  slug: "a-show",
  title: 'A "Quoted, Show"',
  genre: "Comedy",
  date: "2026-08-15",
  realDate: "2026-08-15",
  startTime: "19:45",
  startMinuteOfDay: 1185,
  endMinuteOfDay: 1245,
  duration: 60,
  venueCode: "39",
  venueName: "Venue, With Comma",
  room: "Main Hall",
  venueLat: 55.9486,
  venueLng: -3.1881,
  url: "https://www.edfringe.com/tickets/whats-on/a-show",
  freeNonTicketed: false,
  blurb: "x".repeat(400),
};

module.exports = {
  description: "CSV cells are RFC-4180 escaped; ICS lines fold at 75 octets",
  async verify(assert) {
    const { toCsv, toIcs } = await import("../../../../plan/lib/itinerary.js");

    const csv = toCsv([SLOT]);
    const [header, row] = csv.split("\r\n");
    assert.equal(header, "Date,Day,Start,End,Show,Genre,Venue,Room,Status,Tickets");
    assert.ok(row.includes('"A ""Quoted, Show"""'), "quotes doubled, cell quoted");
    assert.ok(row.includes('"Venue, With Comma"'), "comma cell quoted");

    const ics = toIcs([SLOT], { calendarName: "Fringe 2026 · 7–24 Aug" });
    for (const line of ics.split("\r\n")) {
      assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line over 75 octets: ${line.length}`);
    }
    // Folded continuations start with a space; the long blurb must have folded.
    assert.ok(ics.split("\r\n").some((l) => l.startsWith(" ")), "no folded continuation lines");
  },
};
