import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expandPerfs, perfsBetween, walkMinutes, addDays, dayOfWeek } from "../world.js";
import { draftTrip, pickStay } from "../draft.js";

const world = JSON.parse(readFileSync(new URL("../../data/world.json", import.meta.url), "utf8"));
const show = (id) => world.shows.find((s) => s.id === id);

const family = { cityId: "edinburgh", festivalIds: ["fringe", "eif", "book"], from: "2026-08-13", to: "2026-08-17", party: { type: "family", ages: [6, 9] }, cost: "thrifty", pace: "packed", focus: "mix", originId: "london", mode: "train", sleep: ["cost", "location"] };

test("a daily rule expands to every day of the run minus exceptions", () => {
  const perfs = expandPerfs(show("shakespeare-breakfast"));
  assert.equal(perfs.length, 25 - 2);
  assert.ok(!perfs.some((p) => p.date === "2026-08-17"));
  assert.equal(perfs[0].time, "10:00");
});

test("skipDays drops that weekday, weekly keeps only the named ones", () => {
  assert.ok(!expandPerfs(show("tattoo-show")).some((p) => dayOfWeek(p.date) === "Sun"));
  assert.ok(expandPerfs(show("brighton-kids-magic")).every((p) => ["Sat", "Sun"].includes(dayOfWeek(p.date))));
});

test("the world carries both many-night runs and one-offs inside a window", () => {
  assert.equal(perfsBetween(show("chineke"), "2026-08-13", "2026-08-17").length, 1);
  assert.ok(perfsBetween(show("potted-panto"), "2026-08-13", "2026-08-17").length >= 4);
});

test("date helpers stay on calendar days", () => {
  assert.equal(addDays("2026-08-31", 1), "2026-09-01");
  assert.equal(dayOfWeek("2026-08-15"), "Sat");
  assert.ok(walkMinutes([55.9483, -3.1817], [55.9436, -3.1889]) > 5);
});

test("the draft is deterministic and honours the family's constraints", () => {
  const a = draftTrip(world, family);
  const b = draftTrip(world, family);
  assert.deepEqual(a, b);
  assert.equal(a.days.length, 5);
  const shows = a.days.flatMap((d) => d.items).filter((i) => i.kind === "show");
  assert.ok(shows.length >= 8, `expected a packed trip, got ${shows.length} shows`);
  assert.ok(shows.every((s) => world.shows.find((x) => x.id === s.id).ages <= 6), "every show suits a six-year-old");
  assert.ok(shows.every((s) => s.unit <= 14), "thrifty caps the ticket price");
  assert.ok(shows.every((s) => s.start <= 19 * 60 + 30), "small kids: nothing starts after 19:30");
  assert.equal(a.days[0].items[0].kind, "travel");
  assert.equal(a.days[4].items.at(-1).kind, "travel");
  assert.ok(a.days.some((d) => d.items.some((i) => i.kind === "out")), "a mixed focus gets one day out");
  assert.equal(a.stay.id, pickStay(world.cities[0], family).id);
});

test("corrections remove exactly what they name", () => {
  const base = draftTrip(world, family);
  const firstShow = base.days.flatMap((d) => d.items).find((i) => i.kind === "show");
  const noShow = draftTrip(world, family, { notShow: [firstShow.id] });
  assert.ok(!noShow.days.flatMap((d) => d.items).some((i) => i.id === firstShow.id));
  const noGenre = draftTrip(world, family, { notGenre: [firstShow.genre] });
  assert.ok(!noGenre.days.flatMap((d) => d.items).some((i) => i.genre === firstShow.genre));
  const noVenue = draftTrip(world, family, { notVenue: [firstShow.venueId] });
  assert.ok(!noVenue.days.flatMap((d) => d.items).some((i) => i.venueId === firstShow.venueId));
  const notTime = draftTrip(world, family, { notTime: [firstShow.perf] });
  assert.ok(!notTime.days.flatMap((d) => d.items).some((i) => i.perf === firstShow.perf));
});

test("a starred show is in the plan whatever the filters say", () => {
  const couple = { ...family, party: { type: "couple" }, cost: "thrifty" };
  const withStar = draftTrip(world, couple, {}, ["six-concert"]);
  assert.ok(withStar.days.flatMap((d) => d.items).some((i) => i.id === "six-concert" && i.starred));
});

test("a stay is chosen by the two dimensions the traveller kept", () => {
  const city = world.cities[0];
  assert.equal(pickStay(city, { ...family, sleep: ["comfort", "location"] }).id, "southside");
  assert.equal(pickStay(city, { ...family, party: { type: "solo" }, sleep: ["cost", "location"] }).id, "grassmarket-hostel");
  assert.equal(pickStay(city, { ...family, sleep: ["cost", "comfort"] }).id, "murrayfield-bnb");
});
