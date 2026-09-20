"use strict";

// The rows ARE the requirement: for each verdict, what it does to the show's
// pool of nights and when the drafter places it. verify() proves every row by
// running the shipped drafter over a programme built to make that row's effect
// the only thing that could explain the answer — nothing here is a list this
// repo keeps by hand.
const TABLE = {
  columns: ["Verdict", "What it does to the show's nights", "When the show is placed"],
  rows: [
    ["Lock this night", "all stay; that one is taken, your day hours and all", "first, before anything else"],
    ["Favourite the show", "all stay", "after the locks, before the undecided rest"],
    ["Not this night", "that night leaves", "with the rest, from what is left"],
    ["Not this show", "every night leaves", "never — and no block offers it either"],
    ["No verdict", "all stay", "with the rest, scarcest first"],
  ],
};

const COORDS = { H: { lat: 31.7806, lng: 35.2226 } };
const NIGHTS = ["2026-10-18", "2026-10-19", "2026-10-20"];

const show = (slug, nights, start = "20:00") => ({
  slug,
  title: slug,
  duration: 60,
  venue: "H",
  venueName: "The Hall",
  performances: nights.map((date) => ({ date, start, status: "TICKETS_AVAILABLE", soldOut: false })),
});

module.exports = {
  description: "the draft's order of precedence: what each verdict does to a show's nights, and when it is placed",
  table: TABLE,
  async verify(assert) {
    const { draftCalendar, instanceKey } = await import("../../../../site/plan/lib/contention.js");

    const draft = (shows, extra = {}) =>
      draftCalendar(shows, {
        dateStart: NIGHTS[0],
        dateEnd: NIGHTS[NIGHTS.length - 1],
        dayStartMin: 9 * 60,
        dayEndMin: 25 * 60,
        maxPerDay: 3,
        minGapSameVenue: 0,
        minGapDifferentVenue: 30,
        travelMode: "walk",
        venueCoords: COORDS,
        ...extra,
      });

    // "often" plays all three nights, "rare" only the first: with no verdict at
    // all the scarcer one takes the contested hour, which is the last row.
    const often = show("often", NIGHTS);
    const rare = show("rare", [NIGHTS[0]]);
    const plain = draft([often, rare]);
    assert.equal(plain.picked.get("rare"), `${NIGHTS[0]}T20:00`, "no verdict: the scarcer show takes the hour");
    assert.equal(plain.pool.get("often").length, 3, "no verdict: every night stays in the pool");

    // Lock — one night in the pool, and placed before the scarcer contender.
    const locked = draft([often, rare], { locked: { often: `${NIGHTS[0]}T20:00` } });
    assert.equal(locked.pool.get("often").length, 3, "lock: the show's other nights are still its own");
    assert.equal(locked.picked.get("often"), `${NIGHTS[0]}T20:00`, "lock: placed on the night you named");
    assert.ok(!locked.picked.has("rare"), "lock: it takes the hour from the scarcer show");
    // …and that night is taken whatever the day hours say, which is the part of
    // the row no other verdict can claim.
    const shutOut = draft([show("late", [NIGHTS[0]], "23:30")], { dayEndMin: 22 * 60 });
    assert.equal(shutOut.picked.size, 0, "lock: without one, the day hours shut that night out");
    const pinned = draft([show("late", [NIGHTS[0]], "23:30")], {
      dayEndMin: 22 * 60,
      locked: { late: `${NIGHTS[0]}T23:30` },
    });
    assert.equal(pinned.picked.get("late"), `${NIGHTS[0]}T23:30`, "lock: with one, the day hours give way");

    // Favourite — the whole pool, placed ahead of the undecided rest but behind
    // a lock, which the two assertions below separate.
    const fav = draft([often, rare], { favourites: ["often"] });
    assert.equal(fav.pool.get("often").length, 3, "favourite: every night stays in the pool");
    assert.equal(fav.picked.get("often"), `${NIGHTS[0]}T20:00`, "favourite: placed before the draft");
    const favUnderLock = draft([often, rare], {
      favourites: ["often"],
      locked: { rare: `${NIGHTS[0]}T20:00` },
    });
    assert.equal(favUnderLock.picked.get("rare"), `${NIGHTS[0]}T20:00`, "favourite: a lock still outranks it");
    assert.equal(favUnderLock.picked.get("often"), `${NIGHTS[1]}T20:00`, "favourite: it takes another night instead");

    // Not this night — that night alone leaves the pool, and the show is
    // drafted from what is left like anything else.
    const noTime = draft([often, rare], {
      rejectedInstances: [instanceKey("often", `${NIGHTS[1]}T20:00`)],
    });
    assert.equal(noTime.pool.get("often").length, 2, "not this night: one night leaves the pool");
    assert.ok(
      !noTime.pool.get("often").some((s) => s.date === NIGHTS[1]),
      "not this night: it is that night that left"
    );
    assert.equal(noTime.picked.get("often"), `${NIGHTS[2]}T20:00`, "not this night: drafted from what is left");

    // Not this show — out of the programme, so it is neither drafted nor
    // offered as a contender anywhere.
    const noShow = draft([often, rare], { rejectedShows: ["often"] });
    assert.ok(!noShow.pool.has("often"), "not this show: no nights at all");
    assert.ok(!noShow.picked.has("often"), "not this show: never placed");
    assert.ok(
      !noShow.days.some((d) => d.slots.some((s) => s.contenders.some((c) => c.slug === "often"))),
      "not this show: not offered as a contender either"
    );

    assert.equal(TABLE.rows.length, 5, "every verdict the page can record has a row, plus the absence of one");
  },
};
