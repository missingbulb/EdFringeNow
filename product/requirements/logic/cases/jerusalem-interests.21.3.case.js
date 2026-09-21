"use strict";

// The rows ARE the requirement: what naming a kind does to the draft, and what
// it does not do. verify() proves each row by running the shipped drafter over
// a programme built so that the row's effect is the only thing that could
// explain the answer.
const TABLE = {
  columns: ["What you said", "Which shows are drafted first", "How many a night from outside it"],
  rows: [
    ["Nothing — every kind", "the scarcest, whatever kind it is", "no limit: a night takes what fits"],
    ["Some kinds", "the scarcest of those kinds", "one, then the night is full of them"],
    ["Some kinds, and a favourite outside them", "locks, then the favourite, then those kinds", "the favourite is placed anyway, and is the one"],
  ],
};

const COORDS = { H: { lat: 31.7806, lng: 35.2226 } };
const NIGHT = "2026-10-18";

const show = (slug, kind, start, nights = [NIGHT]) => ({
  slug,
  title: slug,
  duration: 60,
  venue: "H",
  venueName: "The Hall",
  genreSlug: kind,
  genreSlugs: [kind],
  performances: nights.map((date) => ({ date, start, status: "TICKETS_AVAILABLE", soldOut: false })),
});

// Four free hours on one night and four shows, one of the reader's kind.
const PROGRAMME = [
  show("wanted", "stand-up", "18:00"),
  show("other-a", "movies", "20:00"),
  show("other-b", "movies", "22:00"),
  show("other-c", "movies", "24:00"),
];

module.exports = {
  description:
    "a kind you are here for outranks one you are not, and a night takes at most one show from outside them",
  table: TABLE,
  async verify(assert) {
    const { draftCalendar } = await import("../../../../site/plan/lib/contention.js");

    const draft = (extra = {}, shows = PROGRAMME) =>
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
        // The page's own cap, and the whole of what the variety question will
        // one day decide.
        maxUnpreferredPerDay: 1,
        ...extra,
      });

    const slugsOf = (result) => (result.days[0] ? result.days[0].slots.map((s) => s.slug) : []);

    // Row 1 — nothing said. The cap is a limit on nothing, so the night takes
    // every show that fits, in time order.
    assert.deepEqual(
      slugsOf(draft()).sort(),
      ["other-a", "other-b", "other-c", "wanted"],
      "no kind named: every show that fits is drafted"
    );

    // Row 2 — a kind named. The night still fills, but only one show from
    // outside it gets in.
    const named = slugsOf(draft({ preferred: ["wanted"] }));
    assert.ok(named.includes("wanted"), "a kind named: a show of that kind is drafted");
    assert.equal(
      named.filter((slug) => slug !== "wanted").length,
      1,
      "a kind named: exactly one show from outside it"
    );

    // And it is a ranking, not a filter: a contested hour goes to the named
    // kind over an equally scarce show of a kind nobody asked about. The two
    // are named so that the one NOT wanted wins the drafter's own tie-break,
    // which leaves the stated taste as the only thing that can explain the
    // answer.
    const contested = [show("a-theirs", "movies", "20:00"), show("z-ours", "stand-up", "20:00")];
    assert.equal(
      slugsOf(draft({ preferred: [] }, contested))[0],
      "a-theirs",
      "with no taste stated the tie-break decides"
    );
    assert.equal(
      slugsOf(draft({ preferred: ["z-ours"] }, contested))[0],
      "z-ours",
      "a kind named: it takes a contested hour from an equally scarce show"
    );

    // Row 3 — a favourite outside the named kinds is placed whatever the cap
    // says, and then spends it, exactly as it spends the night's length.
    const favoured = slugsOf(draft({ preferred: ["wanted"], favourites: ["other-c"] }));
    assert.ok(favoured.includes("other-c"), "a favourite outside the kinds named is drafted");
    assert.equal(
      favoured.filter((slug) => slug !== "wanted").length,
      1,
      "and it is the one show from outside them the night takes"
    );
  },
};
