"use strict";

// The rows are the requirement; the gallery renders them into the spec and
// verify() proves each against the shipped formatter.
const TABLE = {
  columns: ["What is known", "Reads"],
  rows: [
    ["nothing", "Price TBC"],
    ["£0", "Free"],
    ["one band, £12", "£12"],
    ["one band, £8.50", "£8.50"],
    ["£12 to £18", "£12–£18"],
  ],
};

const SHOWS = {
  "nothing": { priceMin: null, free: false },
  "£0": { priceMin: 0, free: true },
  "one band, £12": { priceMin: 12, priceMax: 12 },
  "one band, £8.50": { priceMin: 8.5, priceMax: 8.5 },
  "£12 to £18": { priceMin: 12, priceMax: 18 },
};

module.exports = {
  description: "prices are written the same way everywhere",
  table: TABLE,
  async verify(assert) {
    const { priceLabel } = await import("../../../../shared/price.js");
    for (const [known, expected] of TABLE.rows) {
      assert.equal(priceLabel(SHOWS[known]), expected, known);
    }
  },
};
