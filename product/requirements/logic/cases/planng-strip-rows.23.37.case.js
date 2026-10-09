"use strict";

// The rows are the requirement: which festivals the year's rows carry, and on
// which row, on a strip 100 days wide whose festivals keep 2 days apart.
// verify() runs every row through the shipped ranking and filling.
const TABLE = {
  columns: ["Festivals (how searched)", "Rows", "Leading the trip", "Drawn on the rows"],
  rows: [
    ["Fringe 0–40 (900), Acco 10–20 (50), Haifa 50–55 (300)", "2", "none", "1: Fringe, Haifa · 2: Acco"],
    ["Fringe 0–30 (900), Haifa 40–70 (300), Acco 80–84 (50)", "2", "none", "1: Fringe, Acco · 2: Haifa"],
    ["Fringe 0–30 (900), Haifa 35–72 (300), Acco 75–80 (50)", "1", "none", "1: Fringe, Haifa"],
    ["Fringe 0–50 (900), Acco 20–30 (300), Haifa 60–65 (50)", "1", "none", "1: Fringe, Haifa"],
    ["Fringe 0–50 (900), Acco 20–30 (300), Haifa 60–65 (50)", "1", "Acco", "1: Acco, Haifa"],
    ["Fringe 0–10 (unknown), Acco 20–40 (unknown), Haifa 50–55 (40)", "1", "none", "1: Haifa, Acco, Fringe"],
  ],
};

function festivalsOf(cell) {
  return cell.split(", ").map((part) => {
    const [, name, from, to, searched] = /^(\w+) (\d+)–(\d+) \((\w+)\)$/.exec(part);
    return {
      key: name,
      start: Number(from) / 100,
      end: Number(to) / 100,
      festival: { id: name.toLowerCase(), popularity: searched === "unknown" ? null : Number(searched) },
      edition: { events: null },
    };
  });
}

function drawn(bars, rows) {
  const lines = [];
  bars.forEach((bar, i) => {
    if (rows[i] < 0) return;
    (lines[rows[i]] ||= []).push(bar.key);
  });
  return lines.map((names, row) => `${row + 1}: ${names.join(", ")}`).join(" · ");
}

module.exports = {
  description: "the year's rows take the most searched festivals first, a long one on the row with fewest long ones, until they are 70% full",
  table: TABLE,
  async verify(assert) {
    const { rankBars, fillRows } = await import("../../../../site/planNG/lib/timeline.js");
    for (const [festivals, rowCount, leading, expected] of TABLE.rows) {
      const ranked = rankBars(festivalsOf(festivals), leading === "none" ? null : leading);
      const rows = fillRows(
        ranked.map((bar) => ({ from: bar.start * 100, to: bar.end * 100, long: bar.end - bar.start >= 0.07 })),
        { rows: Number(rowCount), width: 100, gap: 2, fill: 0.7 }
      );
      assert.equal(drawn(ranked, rows), expected, festivals);
    }
  },
};
