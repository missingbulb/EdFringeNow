// Tests for the catalogue search (plan/lib/search.js): facet filter semantics
// (including how unknown accessibility/price/age data is excluded once a
// filter on that facet is active), query ranking, and facet detection.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ageLimitYears,
  showPrice,
  catalogueFacets,
  hasActiveFilters,
  filterShows,
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
  assert.equal(hasActiveFilters({ maxAge: 0 }), true); // 0 is a real value, not "unset"
  assert.equal(hasActiveFilters({ price: "free" }), true);
  assert.equal(hasActiveFilters({ price: 15 }), true);
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
