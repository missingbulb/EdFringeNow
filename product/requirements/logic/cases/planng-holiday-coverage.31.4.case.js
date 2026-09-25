"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "..", "..", "..", "site", "holidays");

/* Read against the real clock on purpose: this is the reminder that the files
 * need extending, a year before the strip would run past them. */
module.exports = {
  description: "every country's holiday file covers the year the strip shows, today and a year from today",
  async verify(assert) {
    const { timelineSpan } = await import("../../../../site/planNG/lib/timeline.js");
    const today = new Date();
    const inAYear = new Date(today.getTime() + 365 * 86400000);
    const need = { from: timelineSpan(today.toISOString().slice(0, 10)).from, to: timelineSpan(inAYear.toISOString().slice(0, 10)).to };

    const files = fs.readdirSync(DIR).filter((f) => /^[A-Z]{2}\.json$/.test(f));
    assert.ok(files.length >= 100, `a file per country the package knows (found ${files.length})`);
    for (const file of files) {
      const { country, covers, holidays } = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
      assert.equal(`${country}.json`, file, "each file is named for its country");
      assert.ok(covers.from <= need.from && covers.to >= need.to, `${file} covers ${covers.from}..${covers.to}, needs ${need.from}..${need.to}`);
      assert.ok(holidays.every((h) => h.date >= covers.from && h.date <= covers.to), `${file}'s holidays fall inside what it covers`);
    }
  },
};
