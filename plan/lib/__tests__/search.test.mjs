// Tests for the catalogue search (plan/lib/search.js): facet filter semantics
// (including how unknown accessibility/price/age data is excluded once a
// filter on that facet is active), query ranking, and facet detection.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ageLimitYears,
  showPrice,
  catalogueFacets,
  catalogueVenues,
  hasActiveFilters,
  filterShows,
  matchFacets,
  searchShows,
} from "../search.js";

// Minimal show records — only the fields search.js reads.
function show(overrides) {
  return {
    slug: "s",
    title: "A Show",
    genre: "Comedy",
    subgenres: [],
    company: null,
    venueName: null,
    ageRestriction: "ZERO",
    free: false,
    ...overrides,
  };
}

// --- accessors -------------------------------------------------------------

test("ageLimitYears maps the enum, null for unknown", () => {
  assert.equal(ageLimitYears(show({ ageRestriction: "ZERO" })), 0);
  assert.equal(ageLimitYears(show({ ageRestriction: "EIGHTEEN" })), 18);
  assert.equal(ageLimitYears(show({ ageRestriction: null })), null);
  assert.equal(ageLimitYears(show({ ageRestriction: "MYSTERY" })), null);
});

test("showPrice reads numbers and £-strings, falls back to the free flag", () => {
  assert.equal(showPrice(show({ price: 12 })), 12);
  assert.equal(showPrice(show({ price: "£12.50" })), 12.5);
  assert.equal(showPrice(show({ price: "from £8" })), 8);
  assert.equal(showPrice(show({ free: true })), 0);
  assert.equal(showPrice(show({ price: 5, free: true })), 5); // explicit price wins
  assert.equal(showPrice(show({})), null);
});

// --- facet detection -------------------------------------------------------

test("catalogueFacets: accessibility union sorted; price only counts explicit data", () => {
  const shows = [
    show({ accessibility: ["CAPTIONED", "AUDIO_DESCRIPTION"] }),
    show({ accessibility: ["CAPTIONED"] }),
    show({ free: true }), // free flag alone is not price *data*
  ];
  assert.deepEqual(catalogueFacets(shows), {
    accessibility: ["AUDIO_DESCRIPTION", "CAPTIONED"],
    hasPrice: false,
  });
  assert.equal(catalogueFacets([show({ price: "£10" })]).hasPrice, true);
  assert.deepEqual(catalogueFacets([]), { accessibility: [], hasPrice: false });
});

// --- filters ---------------------------------------------------------------

test("genre and subgenre filter exactly", () => {
  const comedy = show({ slug: "c", genre: "Comedy", subgenres: ["Stand-up"] });
  const theatre = show({ slug: "t", genre: "Theatre", subgenres: ["Devised"] });
  assert.deepEqual(filterShows([comedy, theatre], { genre: "Comedy" }), [comedy]);
  assert.deepEqual(filterShows([comedy, theatre], { subgenre: "Devised" }), [theatre]);
  assert.deepEqual(filterShows([comedy, theatre], { genre: "Comedy", subgenre: "Devised" }), []);
});

test("a label facet takes several values, OR'd; facets are still AND'd", () => {
  const comedy = show({ slug: "c", genre: "Comedy", subgenres: ["Stand-up"] });
  const theatre = show({ slug: "t", genre: "Theatre", subgenres: ["Devised"] });
  const music = show({ slug: "m", genre: "Music", subgenres: ["Folk", "Stand-up"] });
  assert.deepEqual(filterShows([comedy, theatre, music], { genre: ["Comedy", "Music"] }), [
    comedy,
    music,
  ]);
  // Any one of the chosen subgenres is enough.
  assert.deepEqual(filterShows([comedy, theatre, music], { subgenre: ["Devised", "Folk"] }), [
    theatre,
    music,
  ]);
  // Different facets still narrow each other.
  assert.deepEqual(
    filterShows([comedy, theatre, music], { genre: ["Comedy", "Music"], subgenre: ["Stand-up"] }),
    [comedy, music]
  );
  assert.deepEqual(
    filterShows([comedy, theatre, music], { genre: ["Theatre"], subgenre: ["Stand-up"] }),
    []
  );
  assert.deepEqual(
    filterShows(
      [show({ slug: "a", accessibility: ["CAPTIONED"] }), show({ slug: "b", accessibility: ["SIGNED"] })],
      { accessibility: ["SIGNED", "AUDIO_DESCRIPTION"] }
    ).map((s) => s.slug),
    ["b"]
  );
});

test("an empty value list means the facet isn't set", () => {
  const comedy = show({ slug: "c", genre: "Comedy" });
  const theatre = show({ slug: "t", genre: "Theatre" });
  assert.equal(hasActiveFilters({ genre: [], subgenre: [], accessibility: [] }), false);
  assert.deepEqual(filterShows([comedy, theatre], { genre: [], subgenre: [] }), [comedy, theatre]);
  assert.equal(hasActiveFilters({ genre: ["Comedy"] }), true);
  // …and an unset facet doesn't open the search on its own.
  assert.deepEqual(searchShows([comedy, theatre], "", { genre: [] }), { results: [], total: 0 });
});

test("maxAge keeps shows admitting that age: limit <= maxAge, unknown excluded", () => {
  const u = show({ slug: "u", ageRestriction: "ZERO" });
  const eight = show({ slug: "8", ageRestriction: "EIGHT" });
  const twelve = show({ slug: "12", ageRestriction: "TWELVE" });
  const unknown = show({ slug: "?", ageRestriction: null });
  assert.deepEqual(filterShows([u, eight, twelve, unknown], { maxAge: 8 }), [u, eight]);
  assert.deepEqual(filterShows([u, eight, twelve, unknown], { maxAge: 0 }), [u]);
  // No filter → unknown age passes through.
  assert.deepEqual(filterShows([unknown], {}), [unknown]);
});

test("accessibility filter requires the declared option; undeclared excluded", () => {
  const captioned = show({ slug: "c", accessibility: ["CAPTIONED"] });
  const none = show({ slug: "n" });
  assert.deepEqual(filterShows([captioned, none], { accessibility: "CAPTIONED" }), [captioned]);
  assert.deepEqual(filterShows([captioned, none], { accessibility: "SIGNED" }), []);
});

test("price 'free' and caps; unknown price excluded under any price filter", () => {
  const free = show({ slug: "f", free: true });
  const tenner = show({ slug: "10", price: "£10" });
  const twenty = show({ slug: "20", price: 20 });
  const unknown = show({ slug: "?" });
  assert.deepEqual(filterShows([free, tenner, twenty, unknown], { price: "free" }), [free]);
  assert.deepEqual(filterShows([free, tenner, twenty, unknown], { price: 15 }), [free, tenner]);
  assert.deepEqual(filterShows([free, tenner, twenty, unknown], { price: 20 }), [free, tenner, twenty]);
  // No filter → unknown price passes through.
  assert.deepEqual(filterShows([unknown], {}), [unknown]);
});

test("hasActiveFilters spots each facet, ignores empties", () => {
  assert.equal(hasActiveFilters({}), false);
  assert.equal(hasActiveFilters({ genre: "", subgenre: "" }), false);
  assert.equal(hasActiveFilters({ genre: "Comedy" }), true);
  assert.equal(hasActiveFilters({ venue: ["12"] }), true);
  assert.equal(hasActiveFilters({ maxAge: 0 }), true); // 0 is a real value, not "unset"
  assert.equal(hasActiveFilters({ price: "free" }), true);
  assert.equal(hasActiveFilters({ price: 15 }), true);
});

test("venue filter matches the venue code, so every room counts", () => {
  const above = show({ slug: "a", venue: 12, venueName: "Above at The Bar" });
  const below = show({ slug: "b", venue: "12", venueName: "Below at The Bar" });
  const other = show({ slug: "o", venue: 99, venueName: "Elsewhere" });
  assert.deepEqual(filterShows([above, below, other], { venue: "12" }), [above, below]);
  assert.deepEqual(filterShows([above, below, other], { venue: ["12", "99"] }), [above, below, other]);
  assert.deepEqual(filterShows([above, below, other], { venue: [] }), [above, below, other]);
});

// --- venue options ---------------------------------------------------------

test("catalogueVenues lists only venues with shows, A→Z, code + name + tally", () => {
  const map = { 12: { name: "Zoo Southside" }, 7: { name: "Assembly" }, 99: { name: "Never Used" } };
  const shows = [show({ venue: 12 }), show({ venue: "12" }), show({ venue: 7 }), show({ venue: null })];
  assert.deepEqual(catalogueVenues(shows, map), [
    { value: "7", label: "Assembly", count: 1 },
    { value: "12", label: "Zoo Southside", count: 2 },
  ]);
  // A venue the lookup map doesn't name can't be offered as an option.
  assert.deepEqual(catalogueVenues([show({ venue: 404 })], map), []);
});

// --- facet suggestions -----------------------------------------------------

const FACET_CATALOGUE = {
  genres: ["Comedy", "Cabaret and Variety"],
  subgenres: ["Stand-up", "Sketch comedy"],
  venues: [
    { value: "1", label: "Pleasance Courtyard" },
    { value: "2", label: "The Stand Comedy Club" },
  ],
};

test("matchFacets ranks prefix > word start > substring, broader facet first on a tie", () => {
  // "comedy" starts a genre, starts a word in a subgenre and a venue, and sits
  // mid-word in nothing — so the genre leads and the tie below it goes to the
  // subgenre before the venue.
  assert.deepEqual(matchFacets("comedy", FACET_CATALOGUE), [
    { kind: "genre", value: "Comedy", label: "Comedy" },
    { kind: "subgenre", value: "Sketch comedy", label: "Sketch comedy" },
    { kind: "venue", value: "2", label: "The Stand Comedy Club" },
  ]);
  assert.deepEqual(matchFacets("pleasance", FACET_CATALOGUE), [
    { kind: "venue", value: "1", label: "Pleasance Courtyard" },
  ]);
});

test("matchFacets breaks a tie between equal matches on the bigger venue", () => {
  const venues = [
    { value: "1", label: "Pleasance at EICC", count: 4 },
    { value: "2", label: "Pleasance Courtyard", count: 90 },
  ];
  assert.deepEqual(matchFacets("pleasance", { venues }).map((f) => f.label), [
    "Pleasance Courtyard",
    "Pleasance at EICC",
  ]);
  // No counts to compare → A→Z, so the order is still deterministic.
  assert.deepEqual(
    matchFacets("pleasance", { venues: venues.map(({ value, label }) => ({ value, label })) })
      .map((f) => f.label),
    ["Pleasance at EICC", "Pleasance Courtyard"]
  );
});

test("matchFacets folds case/accents, needs two characters, and caps its list", () => {
  assert.deepEqual(matchFacets("CABARET", FACET_CATALOGUE), [
    { kind: "genre", value: "Cabaret and Variety", label: "Cabaret and Variety" },
  ]);
  assert.deepEqual(matchFacets("c", FACET_CATALOGUE), []); // one letter matches half the programme
  assert.deepEqual(matchFacets("  ", FACET_CATALOGUE), []);
  assert.deepEqual(matchFacets("zzz", FACET_CATALOGUE), []);
  assert.equal(matchFacets("co", FACET_CATALOGUE, { limit: 2 }).length, 2);
  assert.deepEqual(matchFacets("comedy", {}), []); // nothing to suggest from
});

// --- search ----------------------------------------------------------------

test("empty query: nothing without filters, the filtered list A→Z with them", () => {
  const b = show({ slug: "b", title: "Bravo", genre: "Comedy" });
  const a = show({ slug: "a", title: "Alpha", genre: "Comedy" });
  const t = show({ slug: "t", title: "Middle", genre: "Theatre" });
  assert.deepEqual(searchShows([b, a, t], "", {}), { results: [], total: 0 });
  assert.deepEqual(searchShows([b, a, t], "  ", { genre: "Comedy" }), { results: [a, b], total: 2 });
});

test("ranking: title prefix > title word start > title substring > company/venue", () => {
  const prefix = show({ slug: "p", title: "Magic Hour" });
  const wordStart = show({ slug: "w", title: "Midnight Magic" });
  const substring = show({ slug: "s", title: "Tragicomic Magical" }); // "magic" mid-word only
  const company = show({ slug: "c", title: "An Evening Out", company: "Magic Collective" });
  const miss = show({ slug: "x", title: "Something Else" });
  const { results, total } = searchShows([miss, company, substring, wordStart, prefix], "magic", {});
  assert.deepEqual(results.map((s) => s.slug), ["p", "w", "s", "c"]);
  assert.equal(total, 4);
});

test("multi-word queries need every word, across title+company+venue", () => {
  const both = show({ slug: "b", title: "Kids Magic Hour" });
  const split = show({ slug: "s", title: "Magic Show", venueName: "Kids Corner" });
  const one = show({ slug: "o", title: "Magic Show" });
  const { results } = searchShows([both, split, one], "magic kids", {});
  assert.deepEqual(new Set(results.map((s) => s.slug)), new Set(["b", "s"]));
});

test("matching folds case and accents", () => {
  const cafe = show({ slug: "c", title: "Café Chansons" });
  assert.equal(searchShows([cafe], "CAFE", {}).results.length, 1);
  assert.equal(searchShows([cafe], "café", {}).results.length, 1);
});

test("filters and query compose; limit caps results but total counts all", () => {
  const shows = [];
  for (let i = 0; i < 40; i++) {
    shows.push(show({ slug: `s${i}`, title: `Magic ${String(i).padStart(2, "0")}`, genre: i % 2 ? "Comedy" : "Theatre" }));
  }
  const { results, total } = searchShows(shows, "magic", { genre: "Comedy" }, { limit: 5 });
  assert.equal(total, 20);
  assert.equal(results.length, 5);
  assert.ok(results.every((s) => s.genre === "Comedy"));
});

// --- description search ----------------------------------------------------
//
// A query that matches nothing in a show's name, company or venue used to score
// 0 and vanish. It now falls through to the description — the catalogue's own
// blurb by default, or whatever `describe` supplies once the fuller
// descriptions sidecar has downloaded. These pin both the reach and the rank:
// a description-only hit must never displace a named match.

test("a query found only in the blurb still matches", () => {
  const named = show({ slug: "n", title: "Puppet Hour" });
  const buried = show({ slug: "b", title: "The Long Afternoon", blurb: "An hour of anarchic puppetry." });
  const miss = show({ slug: "m", title: "Something Else", blurb: "Nothing like it." });
  const { results, total } = searchShows([miss, buried, named], "puppet", {});
  // Named match first; the blurb-only hit trails it.
  assert.deepEqual(results.map((s) => s.slug), ["n", "b"]);
  assert.equal(total, 2);
});

test("a description-only hit ranks below every company/venue hit", () => {
  // Titles chosen so the alphabetical tie-break would put the description hit
  // FIRST: the expected order can only come from the venue hit outscoring it.
  const venue = show({ slug: "v", title: "Zebra Night", venueName: "Puppet Lab" });
  const blurb = show({ slug: "b", title: "Anarchic Afternoon", blurb: "An hour of puppetry." });
  const { results } = searchShows([blurb, venue], "puppet", {});
  assert.deepEqual(results.map((s) => s.slug), ["v", "b"]);
});

test("multi-word queries may span the name and the description", () => {
  const spans = show({ slug: "s", title: "Anarchic Hour", blurb: "A puppet show for grown-ups." });
  const partial = show({ slug: "p", title: "Anarchic Evening", blurb: "No marionettes here." });
  const { results } = searchShows([spans, partial], "anarchic puppet", {});
  assert.deepEqual(results.map((s) => s.slug), ["s"]);
});

test("a supplied describe() searches text the catalogue doesn't carry", () => {
  const s = show({ slug: "s", title: "The Long Afternoon", blurb: "" });
  const sidecar = new Map([["s", "A meditation on beekeeping in Fife."]]);
  const describe = (sh) => sidecar.get(sh.slug) || sh.blurb || "";
  // Without the sidecar text there is nothing to find…
  assert.deepEqual(searchShows([s], "beekeeping", {}).results, []);
  // …and with it, the same query lands.
  assert.deepEqual(searchShows([s], "beekeeping", {}, { describe }).results.map((x) => x.slug), ["s"]);
});

test("a show with no description text at all is simply skipped", () => {
  const s = show({ slug: "s", title: "The Long Afternoon" });
  assert.deepEqual(searchShows([s], "beekeeping", {}), { results: [], total: 0 });
});
