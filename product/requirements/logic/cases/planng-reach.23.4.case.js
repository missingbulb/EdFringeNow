"use strict";

// The rows are the requirement: which nights of another festival join the
// pool, judged from the focused festival's city. verify() runs every row
// through the shipped rule.
const CITY = {
  Jerusalem: { country: "IL", lat: 31.7683, lng: 35.2137 },
  Haifa: { country: "IL", lat: 32.794044, lng: 34.989571 },
  Acco: { country: "IL", lat: 32.9236, lng: 35.0705 },
  Brighton: { country: "GB", lat: 50.8225, lng: -0.1372 },
  Edinburgh: { country: "GB", lat: 55.9533, lng: -3.1883 },
};

const TABLE = {
  columns: ["Focused on", "Other festival", "Distance", "Nights that join the pool"],
  rows: [
    ["Haifa, 25 Sep – 3 Oct", "Acco, 27 Sep – 1 Oct", "16 km", "all: 27 Sep – 1 Oct"],
    ["Haifa, 25 Sep – 3 Oct", "Jerusalem, 18 – 22 Oct", "116 km", "all: 18 – 22 Oct"],
    ["Brighton, 18 – 22 Oct", "Edinburgh, 10 – 30 Oct", "605 km", "10 – 16 Oct and 24 – 30 Oct"],
    ["Brighton, 18 – 22 Oct", "Edinburgh, 19 – 21 Oct", "605 km", "none"],
    ["Jerusalem, 18 – 22 Oct", "Edinburgh, 10 – 30 Oct", "4000 km", "none: another country"],
  ],
};

const MONTHS = { Sep: "09", Oct: "10" };
const iso = (day, month) => `2026-${MONTHS[month]}-${String(day).padStart(2, "0")}`;
// "Haifa, 25 Sep – 3 Oct" / "Jerusalem, 18 – 22 Oct"
function festivalOf(cell) {
  const [city, run] = cell.split(", ");
  const m = /^(\d+)(?: (\w+))? – (\d+) (\w+)$/.exec(run);
  return { festivalId: city, ...CITY[city], firstDate: iso(m[1], m[2] || m[4]), lastDate: iso(m[3], m[4]) };
}
function rangesOf(cell) {
  if (cell.startsWith("none")) return [];
  return cell
    .replace(/^all: /, "")
    .split(" and ")
    .map((part) => {
      const m = /^(\d+)(?: (\w+))? – (\d+) (\w+)$/.exec(part);
      return { from: iso(m[1], m[2] || m[4]), to: iso(m[3], m[4]) };
    });
}

module.exports = {
  description: "a festival in another country never joins the pool; one in the same country joins whole when a day-trip away, and a far one only on nights you could travel to it",
  table: TABLE,
  async verify(assert) {
    const { poolReach } = await import("../../../../site/shared/feasibility.js");
    for (const [focusCell, otherCell, distance, nights] of TABLE.rows) {
      const focus = festivalOf(focusCell);
      const other = festivalOf(otherCell);
      // A period wide enough to hold both runs, so only reach decides.
      const period = {
        from: focus.firstDate < other.firstDate ? focus.firstDate : other.firstDate,
        to: focus.lastDate > other.lastDate ? focus.lastDate : other.lastDate,
      };
      const [entry] = poolReach(focus, [other], period);
      const row = `${focusCell} → ${otherCell}`;
      assert.equal(`${Math.round(entry.km)} km`, distance, `${row}: distance`);
      assert.deepEqual(entry.nights, rangesOf(nights), `${row}: nights`);
      assert.equal(
        entry.verdict,
        nights === "none: another country"
          ? "abroad"
          : nights === "none"
            ? "out"
            : nights.startsWith("all")
              ? "day-trip"
              : "partly",
        `${row}: verdict`
      );
    }
  },
};
