"use strict";

const show = (over) => ({
  slug: over.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  title: "",
  company: "",
  venueName: "",
  blurb: "",
  genre: "",
  subgenres: [],
  performances: [],
  ...over,
});

module.exports = {
  description: "search ranks title prefix > word boundary > in-title > performer/venue > description, accent-blind, all words required",
  async verify(assert) {
    const { searchShows } = await import("../../../../plan/lib/search.js");
    const shows = [
      show({ title: "Improv Allstars" }), // prefix
      show({ title: "Big Improv Night" }), // word boundary
      show({ title: "Reimprovised" }), // substring only
      show({ title: "Something Else", company: "The Improv Company" }), // company hit
      show({ title: "Quiet Show", blurb: "an improv marathon" }), // description-only
      show({ title: "No Match Here" }),
    ];
    const describe = (s) => s.blurb || "";
    const got = searchShows(shows, "improv", {}, { describe }).results.map((s) => s.title);
    assert.deepEqual(got, [
      "Improv Allstars",
      "Big Improv Night",
      "Reimprovised",
      "Something Else",
      "Quiet Show",
    ]);

    // Accent folding: "cafe" finds "Café".
    const accented = [show({ title: "Café Chaos" })];
    assert.equal(searchShows(accented, "cafe", {}, { describe }).results.length, 1);

    // Every word must land somewhere.
    const multi = [show({ title: "Improv Night" }), show({ title: "Improv Day" })];
    assert.deepEqual(
      searchShows(multi, "improv night", {}, { describe }).results.map((s) => s.title),
      ["Improv Night"]
    );
  },
};
