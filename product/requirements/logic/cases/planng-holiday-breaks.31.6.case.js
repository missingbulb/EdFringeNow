"use strict";

// The rows ARE the requirement: a holiday or two in October 2026, and the break
// the shipped rule makes of them. verify() runs holidayBreaks on each row.
const TABLE = {
  columns: ["Holidays", "Weekend", "The break", "Days off", "Work days in the middle"],
  rows: [
    ["Wed 14 Oct", "Sat and Sun", "Wed 14", "1", "0"],
    ["Fri 16 Oct", "Sat and Sun", "Fri 16 to Sun 18", "3", "0"],
    ["Wed 7 and Thu 8 Oct", "Sat and Sun", "Wed 7 to Sun 11", "5", "1"],
    ["Tue 13 Oct", "Sat and Sun", "Sat 10 to Tue 13", "4", "1"],
    ["Thu 15 Oct", "Fri and Sat", "Thu 15 to Sat 17", "3", "0"],
    ["Tue 13 and Thu 15 Oct", "Sat and Sun", "Sat 10 to Sun 18", "9", "3"],
  ],
};

const iso = (d) => `2026-10-${String(d).padStart(2, "0")}`;
const INPUT = [
  [[14], null],
  [[16], null],
  [[7, 8], null],
  [[13], null],
  [[15], ["fri", "sat"]],
  [[13, 15], null],
];
const EXPECTED = [
  [14, 14],
  [16, 18],
  [7, 11],
  [10, 13],
  [15, 17],
  [10, 18],
];

module.exports = {
  description: "a break is the run of days off around a holiday, the weekend included, bridged over one work day",
  table: TABLE,
  async verify(assert) {
    const { holidayBreaks } = await import("../../../../site/planNG/lib/holidays.js");
    assert.equal(INPUT.length, TABLE.rows.length);
    TABLE.rows.forEach((row, i) => {
      const [dates, weekend] = INPUT[i];
      const doc = { ...(weekend ? { weekend } : {}), holidays: dates.map((d) => ({ date: iso(d), name: { en: `H${d}` } })) };
      const breaks = holidayBreaks(doc, { from: "2026-01-01", to: "2026-12-31" }, "en");
      assert.equal(breaks.length, 1, row[0]);
      const [b] = breaks;
      assert.deepEqual([b.from, b.to], EXPECTED[i].map(iso), `${row[0]}: ${row[2]}`);
      assert.equal(String(b.days), row[3], `${row[0]}: days off`);
      assert.equal(String(b.workdays), row[4], `${row[0]}: work days in the middle`);
    });
  },
};
