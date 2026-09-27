"use strict";

// The rows ARE the requirement: which festivals of a small registry the year's
// three menus keep. verify() feeds each row's menus to the shipped filter.
const FESTIVALS = [
  { id: "haifa-iff", country: "IL", city: "Haifa", kind: "film", subtypes: ["film-international"] },
  { id: "docaviv", country: "IL", city: "Tel Aviv", kind: "film", subtypes: ["film-documentary"] },
  { id: "jerusalem-comedy", country: "IL", city: "Jerusalem", kind: "comedy", subtypes: [] },
  { id: "eiff", country: "GB", city: "Edinburgh", kind: "film", subtypes: ["film-international"] },
  { id: "edfringe", country: "GB", city: "Edinburgh", kind: "fringe", subtypes: [] },
];

const TABLE = {
  columns: ["Place", "Type", "Subtype", "Leading the trip", "Drawn"],
  rows: [
    ["anywhere", "any", "any", "Jerusalem Comedy", "all five"],
    ["Israel", "any", "any", "Jerusalem Comedy", "haifa-iff, docaviv, jerusalem-comedy"],
    ["Edinburgh", "any", "any", "Jerusalem Comedy", "jerusalem-comedy, eiff, edfringe"],
    ["anywhere", "film", "any", "none", "haifa-iff, docaviv, eiff"],
    ["anywhere", "film", "film-international", "none", "haifa-iff, eiff"],
    ["Israel", "film", "film-documentary", "none", "docaviv"],
    ["Tel Aviv", "comedy", "any", "none", "nothing"],
    ["Tel Aviv", "comedy", "any", "Jerusalem Comedy", "jerusalem-comedy"],
  ],
};

const PLACE = { anywhere: "", Israel: "IL", Edinburgh: "GB/Edinburgh", "Tel Aviv": "IL/Tel Aviv" };
const LEAD = { "Jerusalem Comedy": "jerusalem-comedy", none: null };
const DRAWN = { "all five": FESTIVALS.map((f) => f.id).join(", "), nothing: "" };

module.exports = {
  description: "the year's menus keep a festival matching place, type and subtype, and always the one leading the trip",
  table: TABLE,
  async verify(assert) {
    const { filterRegistry } = await import("../../../../site/planNG/lib/festival-filter.js");
    const registry = { v: 1, festivals: FESTIVALS };
    for (const [place, kind, subtype, lead, drawn] of TABLE.rows) {
      const menus = { place: PLACE[place], kind: kind === "any" ? "" : kind, subtype: subtype === "any" ? "" : subtype };
      const kept = filterRegistry(registry, menus, LEAD[lead]).festivals.map((f) => f.id).join(", ");
      assert.equal(kept, DRAWN[drawn] ?? drawn, `${place} / ${kind} / ${subtype}, led by ${lead}`);
    }
  },
};
