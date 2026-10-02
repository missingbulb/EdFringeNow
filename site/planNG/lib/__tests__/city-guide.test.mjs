import { test } from "node:test";
import assert from "node:assert/strict";
import { cityEntryFor, cuisineWords, guideLists, placeName, placeUrl, readsLocalNames, roundedDistance, wikipediaUrl } from "../city-guide.js";
import { GUIDE_SIGHTS } from "../../../shared/limits.js";

const REGISTRY = {
  cities: [
    { id: "jerusalem", name: "Jerusalem", dataUrl: "/data/cities/jerusalem.json" },
    { id: "nowhere", name: "Nowhere", dataUrl: null },
  ],
};

test("a festival finds its city by the registry's own city name, and only one with data", () => {
  assert.equal(cityEntryFor(REGISTRY, { city: "Jerusalem" }).id, "jerusalem");
  assert.equal(cityEntryFor(REGISTRY, { city: "Nowhere" }), null);
  assert.equal(cityEntryFor(REGISTRY, { city: "Haifa" }), null);
  assert.equal(cityEntryFor(null, { city: "Jerusalem" }), null);
});

test("a place links to its own site, else to its OpenStreetMap entry", () => {
  assert.equal(placeUrl({ id: "osm:node/1", website: "https://inn.example" }), "https://inn.example");
  assert.equal(placeUrl({ id: "osm:way/22", website: "inn.example" }), "https://www.openstreetmap.org/way/22");
  assert.equal(placeUrl({ id: "osm:relation/3", website: null }), "https://www.openstreetmap.org/relation/3");
});

test("a reader reads a city's own names in the city's own language only", () => {
  assert.equal(readsLocalNames("IL", "he"), true);
  assert.equal(readsLocalNames("IL", "ru"), false);
  assert.equal(readsLocalNames("GB", "en"), true);
  assert.equal(readsLocalNames("GB", "he"), false);
});

test("the local name for a reader of the city's language, the English one for everyone else", () => {
  const p = { name: "מלון המלך דוד", nameEn: "King David Hotel" };
  assert.equal(placeName(p, { localReader: true }), "מלון המלך דוד");
  assert.equal(placeName(p, { localReader: false }), "King David Hotel");
  assert.equal(placeName({ name: "Balmoral", nameEn: null }, { localReader: false }), "Balmoral");
});

test("sights are the city's highlights, at most GUIDE_SIGHTS of them, linked to their site or article", () => {
  const places = Array.from({ length: GUIDE_SIGHTS + 3 }, (_, i) => ({
    id: `osm:node/${i}`, name: `S${i}`, nameEn: null, highlight: i !== 1, website: null,
    wikipedia: i === 0 ? "en:Tower of David" : null,
  }));
  const { see, stay, eat, trips } = guideLists({ places });
  assert.equal(see.length, GUIDE_SIGHTS);
  assert.ok(!see.some((s) => s.title === "S1"), "a place that is not a highlight is not suggested");
  assert.equal(see[0].url, "https://en.wikipedia.org/wiki/Tower_of_David");
  assert.equal(see[1].url, "https://www.openstreetmap.org/node/2");
  assert.deepEqual([stay, eat, trips], [[], [], []], "lists a city has none of are empty, not missing");
});

test("cuisines and distances read as a person says them", () => {
  assert.equal(cuisineWords(["middle_eastern", "falafel", "vegan"]), "Middle eastern, Falafel");
  assert.equal(cuisineWords(null), null);
  assert.deepEqual(roundedDistance(4), { value: 10, unit: "meter" });
  assert.deepEqual(roundedDistance(347), { value: 350, unit: "meter" });
  assert.deepEqual(roundedDistance(1260), { value: 1.3, unit: "kilometer" });
  assert.equal(wikipediaUrl("he:הכותל המערבי"), "https://he.wikipedia.org/wiki/%D7%94%D7%9B%D7%95%D7%AA%D7%9C_%D7%94%D7%9E%D7%A2%D7%A8%D7%91%D7%99");
});
