// Tests for the calendar drafter: who wins a contested hour, who is reported
// as having lost it, and how each of the four verdicts changes the answer.
//   node --test site/plan/lib/__tests__/contention.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { byScarcity, draftCalendar, instanceKey } from "../contention.js";

// One venue, so nothing here is ever decided by travel time — these tests are
// about scarcity, and a second venue would let a walk explain a result instead.
const COORDS = { H: { lat: 31.7806, lng: 35.2226 } };

const show = (slug, nights, { start = "20:00", duration = 60 } = {}) => ({
  slug,
  title: slug,
  duration,
  venue: "H",
  venueName: "The Hall",
  performances: nights.map((date) => ({
    date,
    start,
    status: "TICKETS_AVAILABLE",
    soldOut: false,
  })),
});

const draft = (shows, extra = {}) =>
  draftCalendar(shows, {
    dateStart: "2026-10-18",
    dateEnd: "2026-10-22",
    dayStartMin: 9 * 60,
    dayEndMin: 25 * 60,
    maxPerDay: 3,
    minGapSameVenue: 0,
    minGapDifferentVenue: 30,
    travelMode: "walk",
    venueCoords: COORDS,
    ...extra,
  });

/** The one slot drafted at a given date and time, or undefined. */
const at = (result, date, time) =>
  (result.days.find((d) => d.date === date) || { slots: [] }).slots.find((s) => s.startTime === time);

test("the scarcer show takes a contested hour", () => {
  const rare = show("rare", ["2026-10-18"]);
  const often = show("often", ["2026-10-18", "2026-10-19", "2026-10-20"]);
  const pick = at(draft([often, rare]), "2026-10-18", "20:00");
  assert.equal(pick.slug, "rare");
  assert.equal(pick.freedom, 1);
});

// A show is only a contender for an hour while it is in the calendar nowhere
// else, so a field of real contenders needs every challenger's OTHER nights
// taken too: a one-night show on each of them does that.
const CONTESTED_FIELD = [
  show("rare", ["2026-10-18"]),
  show("two", ["2026-10-18", "2026-10-19"]),
  show("three", ["2026-10-18", "2026-10-19", "2026-10-20"]),
  show("rare19", ["2026-10-19"]),
  show("rare20", ["2026-10-20"]),
];

test("the shows it beat are reported on the block, scarcest first", () => {
  const result = draft(CONTESTED_FIELD);
  // The scarcity rule decides all three nights, which is what leaves "two" and
  // "three" unplaced and therefore still on offer for the first of them.
  assert.equal(at(result, "2026-10-18", "20:00").slug, "rare");
  assert.equal(at(result, "2026-10-19", "20:00").slug, "rare19");
  assert.equal(at(result, "2026-10-20", "20:00").slug, "rare20");
  const pick = at(result, "2026-10-18", "20:00");
  assert.deepEqual(pick.contenders.map((c) => c.slug), ["two", "three"]);
  assert.deepEqual(pick.contenders.map((c) => c.freedom), [2, 3]);
});

test("a show already drafted on another night is not offered here", () => {
  const rare = show("rare", ["2026-10-18"]);
  const often = show("often", ["2026-10-18", "2026-10-19"]);
  const result = draft([rare, often]);
  assert.equal(at(result, "2026-10-18", "20:00").slug, "rare");
  assert.equal(result.picked.get("often"), "2026-10-19T20:00", "it took another night of its own");
  assert.deepEqual(
    at(result, "2026-10-18", "20:00").contenders.map((c) => c.slug),
    [],
    "offering it here would be offering to move it, which the picker does not do"
  );
});

test("a show the night's travel and rest shut out is not offered, and is counted instead", () => {
  // Two venues far enough apart that the walk plus the rest between shows
  // cannot be made in the gap the evening leaves.
  const FAR = { H: { lat: 31.7806, lng: 35.2226 }, X: { lat: 31.85, lng: 35.31 } };
  const early = show("early", ["2026-10-18"], { start: "19:00", duration: 60 });
  const rare = show("rare", ["2026-10-18"], { start: "20:30", duration: 60 });
  const stranded = { ...show("stranded", ["2026-10-18"], { start: "20:30", duration: 60 }), venue: "X", venueName: "Far" };

  // Locked, so the evening's 19:00 is a commitment the reader made: nothing
  // that cannot be reached from it is offered for 20:30.
  const committed = draft([early, rare, stranded], {
    venueCoords: FAR,
    locked: { early: "2026-10-18T19:00" },
  });
  assert.equal(at(committed, "2026-10-18", "20:30").slug, "rare");
  assert.deepEqual(
    at(committed, "2026-10-18", "20:30").contenders.map((c) => c.slug),
    [],
    "it shares the hour, but it cannot be reached from the show that is locked before it"
  );
  assert.deepEqual(committed.crowdedOut.map((s) => s.slug), ["stranded"]);

  // The same evening with nothing committed: the 19:00 show is the draft's own
  // guess and would simply move, so the offer stands.
  const guessed = draft([early, rare, stranded], { venueCoords: FAR });
  assert.deepEqual(
    at(guessed, "2026-10-18", "20:30").contenders.map((c) => c.slug),
    ["stranded"]
  );
});

test("equal scarcity is broken by start, then finish, then slug — the same draft every run", () => {
  const a = show("b-show", ["2026-10-18"]);
  const b = show("a-show", ["2026-10-18"]);
  const first = draft([a, b]);
  const second = draft([b, a]);
  assert.equal(at(first, "2026-10-18", "20:00").slug, "a-show");
  assert.deepEqual(
    first.days.map((d) => d.slots.map((s) => s.slug)),
    second.days.map((d) => d.slots.map((s) => s.slug))
  );
});

test("byScarcity ranks on the count before the clock", () => {
  const scarceButLate = { freedom: 1, start: 200, end: 260, slug: "z" };
  const commonButEarly = { freedom: 2, start: 100, end: 160, slug: "a" };
  assert.ok(byScarcity(scarceButLate, commonButEarly) < 0);
});

test("rejecting this instance frees the hour for the show it had beaten", () => {
  const twice = show("twice", ["2026-10-18", "2026-10-20"]);
  const rival = show("rival", ["2026-10-18"]);
  const base = draft([twice, rival]);
  assert.equal(at(base, "2026-10-18", "20:00").slug, "rival");

  const after = draft([twice, rival], {
    rejectedInstances: [instanceKey("rival", "2026-10-18T20:00")],
  });
  assert.equal(at(after, "2026-10-18", "20:00").slug, "twice");
  assert.ok(!after.picked.has("rival"));
});

test("a rejected instance shrinks the show's own pool, so it competes as scarcer", () => {
  const three = show("three", ["2026-10-18", "2026-10-19", "2026-10-20"]);
  assert.equal(draft([three]).pool.get("three").length, 3);
  const after = draft([three], { rejectedInstances: [instanceKey("three", "2026-10-18T20:00")] });
  assert.equal(after.pool.get("three").length, 2);
  assert.equal(at(after, "2026-10-19", "20:00").freedom, 2);
});

test("rejecting the show takes it out of the programme entirely", () => {
  const rare = show("rare", ["2026-10-18"]);
  const often = show("often", ["2026-10-18", "2026-10-19"]);
  const after = draft([rare, often], { rejectedShows: ["rare"] });
  assert.ok(!after.pool.has("rare"));
  assert.equal(at(after, "2026-10-18", "20:00").slug, "often");
  assert.ok(!after.days.some((d) => d.slots.some((s) => s.contenders.some((c) => c.slug === "rare"))));
});

test("a locked instance holds its hour against a scarcer contender, and stops offering it", () => {
  const rare = show("rare", ["2026-10-18"]);
  const often = show("often", ["2026-10-18", "2026-10-19", "2026-10-20"]);
  const locked = draft([rare, often], { locked: { often: "2026-10-18T20:00" } });
  const pick = at(locked, "2026-10-18", "20:00");
  assert.equal(pick.slug, "often");
  assert.equal(pick.verdict, "locked");
  // The reader settled this hour, so the shows that wanted it are no longer an
  // offer — they are counted as shut out instead.
  assert.deepEqual(pick.contenders.map((c) => c.slug), []);
  assert.deepEqual(locked.crowdedOut.map((s) => s.slug), ["rare"]);
  // Unlocking brings them back.
  assert.deepEqual(
    at(draft([rare, often]), "2026-10-18", "20:00").contenders.map((c) => c.slug),
    [],
    "…though here the loser is the one that takes another night"
  );
});

test("a locked instance overrides the day-hours window", () => {
  const late = show("late", ["2026-10-18"], { start: "23:30" });
  assert.equal(draft([late], { dayEndMin: 22 * 60 }).picked.size, 0);
  const pinned = draft([late], { dayEndMin: 22 * 60, locked: { late: "2026-10-18T23:30" } });
  assert.equal(pinned.picked.get("late"), "2026-10-18T23:30");
});

test("a favourite is placed before the undecided rest, but does not outrank a lock", () => {
  const rare = show("rare", ["2026-10-18"]);
  const often = show("often", ["2026-10-18", "2026-10-19"]);
  const fav = at(draft([rare, often], { favourites: ["often"] }), "2026-10-18", "20:00");
  assert.equal(fav.slug, "often");
  assert.equal(fav.verdict, "favourite");

  const both = draft([rare, often], { favourites: ["often"], locked: { rare: "2026-10-18T20:00" } });
  assert.equal(at(both, "2026-10-18", "20:00").slug, "rare");
  // The favourite is not dropped — it takes the night its lost hour left it.
  assert.equal(both.picked.get("often"), "2026-10-19T20:00");
});

test("a favourite is held to the per-day cap, and takes its place ahead of the undecided rest", () => {
  const night = ["2026-10-18"];
  const fillers = ["a", "b", "c"].map((slug, i) => show(slug, night, { start: `1${i}:00`, duration: 30 }));
  const wanted = show("wanted", night, { start: "21:00", duration: 30 });
  const capped = draft([...fillers, wanted], { maxPerDay: 3 });
  assert.equal(capped.days[0].slots.length, 3);
  assert.ok(!capped.picked.has("wanted"));
  // Starred, it takes one of the three places rather than a fourth.
  const starred = draft([...fillers, wanted], { maxPerDay: 3, favourites: ["wanted"] });
  assert.equal(starred.days[0].slots.length, 3);
  assert.ok(starred.picked.has("wanted"));
});

test("starred shows beyond the per-day cap move to their other nights, or wait", () => {
  const fav = [
    show("one", ["2026-10-18"], { start: "16:00" }),
    show("two", ["2026-10-18"], { start: "18:00" }),
    show("three", ["2026-10-18", "2026-10-19"], { start: "20:00" }),
  ];
  const result = draft(fav, { maxPerDay: 1, favourites: ["one", "two", "three"] });
  assert.deepEqual(result.days.map((d) => d.slots.length), [1, 1]);
  assert.equal(result.picked.get("three"), "2026-10-19T20:00");
  assert.equal(result.picked.size, 2);
});

test("a lock ignores the per-day cap", () => {
  const night = ["2026-10-18"];
  const shows = ["a", "b", "c"].map((slug, i) => show(slug, night, { start: `1${i}:00`, duration: 30 }));
  const locked = Object.fromEntries(shows.map((s, i) => [s.slug, `2026-10-18T1${i}:00`]));
  assert.equal(draft(shows, { maxPerDay: 1, locked }).days[0].slots.length, 3);
});

test("a show that lost every night to a clash rather than a shared hour is counted, not lost", () => {
  // 20:00 for two hours, against a 20:30 show: the second can never be placed,
  // and shares its hour with nothing, so no block would otherwise name it.
  const long = show("long", ["2026-10-18"], { start: "20:00", duration: 120 });
  const shadowed = show("shadowed", ["2026-10-18"], { start: "20:30", duration: 60 });
  const result = draft([long, shadowed]);
  assert.equal(at(result, "2026-10-18", "20:00").slug, "long");
  assert.deepEqual(result.crowdedOut.map((s) => s.slug), ["shadowed"]);
});

test("a contender offered on a block is not also counted as crowded out", () => {
  const result = draft(CONTESTED_FIELD);
  assert.deepEqual(at(result, "2026-10-18", "20:00").contenders.map((c) => c.slug), ["two", "three"]);
  assert.deepEqual(result.crowdedOut, []);
});

test("counts report the field, the contested hours and what was drafted", () => {
  const counts = draft(CONTESTED_FIELD).counts;
  assert.equal(counts.shows, 5);
  assert.equal(counts.candidates, 1 + 2 + 3 + 1 + 1);
  assert.equal(counts.picked, 3, "one hour a night, and three nights");
  // "two" and "three" lost every night they play and are placed nowhere, so
  // each of the three nights still has them to offer.
  assert.equal(counts.contested, 3);
});

// --- a stated taste -------------------------------------------------------

test("a preferred show takes a contested hour from an equally scarce one", () => {
  const wanted = show("wanted", ["2026-10-18"]);
  const other = show("other", ["2026-10-18"]);
  // Equal scarcity and the same hour, so without a taste the tie-break is the
  // slug: "other" sorts first and would win.
  assert.equal(at(draft([wanted, other]), "2026-10-18", "20:00").slug, "other");
  assert.equal(
    at(draft([wanted, other], { preferred: ["wanted"] }), "2026-10-18", "20:00").slug,
    "wanted"
  );
});

test("a day takes only as many unpreferred shows as the cap allows", () => {
  // Three free hours on one night, one preferred show and two that are not.
  const shows = [
    show("wanted", ["2026-10-18"], { start: "18:00" }),
    show("a", ["2026-10-18"], { start: "20:00" }),
    show("b", ["2026-10-18"], { start: "22:00" }),
  ];
  const open = draft(shows, { preferred: ["wanted"] });
  assert.equal(open.days[0].slots.length, 3);

  const capped = draft(shows, { preferred: ["wanted"], maxUnpreferredPerDay: 1 });
  assert.deepEqual(
    capped.days[0].slots.map((s) => s.slug),
    ["wanted", "a"]
  );
});

test("the cap is a limit on nothing when no taste was stated", () => {
  const shows = [
    show("a", ["2026-10-18"], { start: "18:00" }),
    show("b", ["2026-10-18"], { start: "20:00" }),
    show("c", ["2026-10-18"], { start: "22:00" }),
  ];
  assert.equal(draft(shows, { maxUnpreferredPerDay: 1 }).days[0].slots.length, 3);
});

// A favourite is placed whatever the cap says, and then counts against it —
// the same way it counts against the day's length. The cap is a statement
// about how much of a day comes from outside the reader's taste, and a
// favourite they asked for by name is still a show from outside it.
test("a favourite outside the stated taste is placed, and spends the cap", () => {
  const shows = [
    show("wanted", ["2026-10-18"], { start: "18:00" }),
    show("a", ["2026-10-18"], { start: "20:00" }),
    show("loved", ["2026-10-18"], { start: "22:00" }),
  ];
  const result = draft(shows, {
    preferred: ["wanted"],
    maxUnpreferredPerDay: 1,
    favourites: ["loved"],
  });
  assert.deepEqual(result.days[0].slots.map((s) => s.slug), ["wanted", "loved"]);
});
