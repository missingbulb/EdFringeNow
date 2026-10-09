"use strict";

// The rows ARE the requirement: a show its festival gives no venue is reckoned
// at the festival's own location. verify() adapts two real-shaped festival
// blocks, pools them and drafts them, so the fallback is the shipped path's.
const TABLE = {
  columns: ["First show", "Then, by car", "Drafted"],
  rows: [
    ["Haifa, a venue in the city, 18:00–19:00", "Acco, no venue, 19:40", "not both: Acco is a 45′ drive away"],
    ["Haifa, a venue in the city, 18:00–19:00", "Acco, no venue, 19:50", "both"],
    ["Acco, no venue, 18:00–19:00", "Acco, no venue, 19:40", "both: the same town"],
  ],
};

const DAY = "2026-09-29";

function block(id, lat, lng, shows) {
  return {
    v: 1,
    festival: { id, name: id, city: id, country: "IL", lat, lng },
    categories: [],
    venues: [{ id: "hall", name: "Hall", lat: 32.794044, lng: 34.989571, online: false }],
    events: shows.map((s) => ({ id: s.id, title: s.id, categories: [], durationMin: 60 })),
    performances: shows.map((s) => ({
      id: `${s.id}/p`, eventId: s.id, venueId: s.venue, date: DAY, start: s.start, status: "on-sale", free: null,
    })),
  };
}

module.exports = {
  description: "a show with no venue is placed at its festival's location for travel",
  table: TABLE,
  async verify(assert) {
    const { adaptFestival, venueCoords } = await import("../../../../site/shared/festival-catalogue.js");
    const { buildPool } = await import("../../../../site/planNG/lib/pool.js");
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");
    const reach = { verdict: "focus", nights: [{ from: DAY, to: DAY }] };

    const drafted = (haifaShows, accoShows) => {
      const pool = buildPool([
        { catalogue: adaptFestival(block("haifa", 32.794044, 34.989571, haifaShows)), reach },
        { catalogue: adaptFestival(block("acco", 32.9236, 35.0705, accoShows)), reach },
      ]);
      const draft = draftCalendar(pool.shows, {
        dateStart: DAY,
        dateEnd: DAY,
        windowStart: `${DAY}T00:00`,
        windowEnd: `${DAY}T23:59`,
        travelMode: "car",
        minGapDifferentVenue: 30,
        venueCoords: venueCoords(pool.venues),
      });
      return draft.days.flatMap((d) => d.slots).map((s) => s.slug).sort();
    };

    assert.deepEqual(
      drafted([{ id: "a", venue: "hall", start: "18:00" }], [{ id: "b", venue: null, start: "19:40" }]).length,
      1,
      "40 minutes is not the drive from Haifa to Acco"
    );
    assert.deepEqual(
      drafted([{ id: "a", venue: "hall", start: "18:00" }], [{ id: "b", venue: null, start: "19:50" }]),
      ["acco/b", "haifa/a"],
      "50 minutes is"
    );
    assert.deepEqual(
      drafted([], [{ id: "a", venue: null, start: "18:00" }, { id: "b", venue: null, start: "19:40" }]),
      ["acco/a", "acco/b"],
      "two shows in the same town keep only the flat gap"
    );
  },
};
