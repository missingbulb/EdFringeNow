// Node tests for the fringe day — the 06:00 → 06:00 boundary every part of the
// site cuts its days at (shared/fringe-day.js). Plain node:test + node:assert.
// Run from the repo root with:
//   node --test shared/__tests__/fringe-day.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DAY_MINUTES,
  FRINGE_DAY_END_MINUTES,
  FRINGE_DAY_START_MINUTES,
  clockHHMM,
  clockLabel,
  fringeMoment,
  hourLabel,
  isAfterMidnight,
  minutesToTime,
  realMoment,
  shiftDate,
  timeToMinutes,
} from "../fringe-day.js";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/* An Edinburgh wall-clock reading, in the (date, minutes) pair fringeMoment
 * takes — the shape js/clock.js's festivalNow hands the app. */
const edinburgh = (y, m, d, hh, mm) => [
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  hh * 60 + mm,
];

test("the day is 24 hours long and hinges on 06:00", () => {
  assert.equal(FRINGE_DAY_START_MINUTES, 6 * 60);
  assert.equal(FRINGE_DAY_END_MINUTES - FRINGE_DAY_START_MINUTES, DAY_MINUTES);
  assert.equal(FRINGE_DAY_END_MINUTES, 30 * 60);
});

test("the small hours belong to the night before", () => {
  // The case the whole thing exists for: it's 00:30 on the 15th and you are
  // still out on the 14th's evening.
  assert.deepEqual(fringeMoment("2026-08-15", 30), { date: "2026-08-14", minutes: 1470 });
  assert.deepEqual(fringeMoment("2026-08-15", 5 * 60 + 59), {
    date: "2026-08-14",
    minutes: 1799,
  });
});

test("06:00 starts its own day — a breakfast show is not a late one", () => {
  assert.deepEqual(fringeMoment("2026-08-15", 6 * 60), { date: "2026-08-15", minutes: 360 });
  assert.deepEqual(fringeMoment("2026-08-15", 23 * 60), { date: "2026-08-15", minutes: 1380 });
});

test("crossing midnight does not change which day you are in", () => {
  // Fed the way the app feeds it: an Edinburgh reading from festivalNow.
  const before = fringeMoment(...edinburgh(2026, 8, 14, 23, 55));
  const after = fringeMoment(...edinburgh(2026, 8, 15, 0, 5));
  assert.equal(before.date, after.date, "same fringe day either side of midnight");
  assert.ok(after.minutes > before.minutes, "and time keeps moving forwards");
  assert.equal(after.minutes, 24 * 60 + 5);
});

test("06:00 is where the page turns over", () => {
  assert.equal(fringeMoment(...edinburgh(2026, 8, 15, 5, 59)).date, "2026-08-14");
  assert.equal(fringeMoment(...edinburgh(2026, 8, 15, 6, 0)).date, "2026-08-15");
});

test("extended times keep their string order; labels wrap for the eye", () => {
  assert.equal(timeToMinutes("24:30"), 1470);
  assert.equal(minutesToTime(1470), "24:30");
  assert.equal(clockHHMM(1470), "00:30");
  assert.equal(clockLabel("24:30"), "00:30");
  assert.equal(clockLabel("22:00"), "22:00");
  assert.equal(hourLabel("25"), "01");
  assert.equal(hourLabel("22"), "22");
  assert.ok(isAfterMidnight(1440) && !isAfterMidnight(1439));
  // The reason for the extension: a plain sort must put the late show last.
  assert.deepEqual(["24:30", "09:00", "22:00"].sort(), ["09:00", "22:00", "24:30"]);
});

test("a real calendar moment can be recovered from a fringe one", () => {
  assert.deepEqual(realMoment("2026-08-14", "24:30"), { date: "2026-08-15", time: "00:30" });
  assert.deepEqual(realMoment("2026-08-14", "22:00"), { date: "2026-08-14", time: "22:00" });
  assert.deepEqual(realMoment("2026-08-14", 1470), { date: "2026-08-15", time: "00:30" });
  // Round trip: every minute of a fringe day maps back to the moment it came from.
  for (let m = FRINGE_DAY_START_MINUTES; m < FRINGE_DAY_END_MINUTES; m += 13) {
    const real = realMoment("2026-08-14", m);
    assert.deepEqual(fringeMoment(real.date, timeToMinutes(real.time)), {
      date: "2026-08-14",
      minutes: m,
    });
  }
});

test("date arithmetic crosses month ends without a clock", () => {
  assert.equal(shiftDate("2026-09-01", -1), "2026-08-31");
  assert.equal(shiftDate("2026-08-31", 1), "2026-09-01");
  assert.equal(shiftDate("2026-08-01", -1), "2026-07-31");
});

// The one number that CANNOT be imported: the scraper is Python, and it buckets
// performances into day files by its own copy of the boundary. If the two ever
// disagreed, the page would ask for shows the files don't hold (or hold shows it
// never shows), so the copies are pinned to each other here.
test("the scraper cuts its day files at the same 06:00", () => {
  const py = readFileSync(path.join(REPO, "scraper", "normalize.py"), "utf8");
  const start = py.match(/^FRINGE_DAY_START = "(\d{2}:\d{2})"$/m);
  const startMin = py.match(/^FRINGE_DAY_START_MIN = (.+)$/m);
  assert.ok(start && startMin, "normalize.py must define FRINGE_DAY_START(_MIN)");
  assert.equal(
    timeToMinutes(start[1]),
    FRINGE_DAY_START_MINUTES,
    "scraper/normalize.py cuts its day files at a different hour from the site"
  );
  // Both spellings in the Python have to agree with each other too.
  const product = startMin[1].split("*").map(Number);
  assert.ok(product.every(Number.isFinite), `unparseable FRINGE_DAY_START_MIN: ${startMin[1]}`);
  assert.equal(product.reduce((a, b) => a * b, 1), FRINGE_DAY_START_MINUTES);
});
