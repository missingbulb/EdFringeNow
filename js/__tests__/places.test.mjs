// Node tests for the non-show-place helpers the Now page uses ("Not a show?
// Type a place"). No dependencies — plain node:test + node:assert. Run from the
// repo root with:
//   node --test js/__tests__/places.test.mjs
//
// The fixtures under fixtures/nominatim/ are REAL Nominatim responses, captured
// from the live API on 2026-07-29 (via a throwaway GitHub Actions probe — the
// sandbox proxy can't reach nominatim.openstreetmap.org). Each file is the
// verbatim jsonv2 payload for the query it's named after, so these tests pin
// the parser against what the geocoder actually returns, not what its docs
// suggest. Notable live behaviours they encode:
//   - "Edinburgh Waverley" comes back FIVE times (station node, building
//     outline, roof, two platform stops) — the dedupe collapses them;
//   - "Camera Obscura" matches Germany, London and Moscow too — the Edinburgh
//     box filter drops those;
//   - "Waverley station" finds the pub/café/ATM inside the concourse but NOT
//     the station itself (that needs "Edinburgh Waverley") — which is also why
//     geocodeUrl deliberately doesn't send bounded=1: bounded restricts search
//     to amenity tags and misses the station entirely.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  EDINBURGH_VIEWBOX,
  inEdinburgh,
  geocodeUrl,
  placeKind,
  placeIcon,
  parsePlaces,
  partnerLink,
  AFFILIATES,
} from "../places.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", "nominatim", `${name}.json`), "utf8"));

/* ---------- geocodeUrl ---------- */

test("geocodeUrl targets Nominatim with the query and a viewbox, but never bounded=1", () => {
  const url = new URL(geocodeUrl("The Piemaker"));
  assert.equal(url.origin + url.pathname, "https://nominatim.openstreetmap.org/search");
  assert.equal(url.searchParams.get("q"), "The Piemaker");
  assert.equal(url.searchParams.get("format"), "jsonv2");
  assert.equal(url.searchParams.get("addressdetails"), "1");
  assert.equal(url.searchParams.get("bounded"), null, "bounded=1 misses stations — see header comment");

  const [lng1, lat1, lng2, lat2] = url.searchParams.get("viewbox").split(",").map(Number);
  const lats = [lat1, lat2].sort((a, b) => a - b);
  const lngs = [lng1, lng2].sort((a, b) => a - b);
  assert.ok(lats[0] <= 55.9486 && 55.9486 <= lats[1], "viewbox spans central Edinburgh (lat)");
  assert.ok(lngs[0] <= -3.1881 && -3.1881 <= lngs[1], "viewbox spans central Edinburgh (lng)");
});

test("the Edinburgh box covers the city and excludes the near-miss foreign hits", () => {
  assert.ok(inEdinburgh([55.9486, -3.1881]), "city centre");
  assert.ok(inEdinburgh([55.9778, -3.1686]), "Leith (Malmaison fixture)");
  assert.ok(inEdinburgh([55.9492, -3.3629]), "Ingliston (BrewDog fixture)");
  assert.ok(!inEdinburgh([55.7734, 37.6326]), "Moscow shares Edinburgh's latitude band");
  assert.ok(!inEdinburgh([51.4781, -0.0018]), "Greenwich");
  const { minLat, maxLat, minLng, maxLng } = EDINBURGH_VIEWBOX;
  assert.ok(minLat < maxLat && minLng < maxLng, "box corners are ordered");
});

/* ---------- parsePlaces on the captured responses ---------- */

test("Edinburgh Waverley's five same-named hits collapse into the one typed station", () => {
  const places = parsePlaces(fixture("edinburgh-waverley"));
  assert.equal(places.length, 1);
  assert.equal(places[0].label, "Edinburgh Waverley");
  assert.equal(places[0].kind, "train");
  assert.ok(Math.abs(places[0].lat - 55.9519) < 0.001);
});

test("Camera Obscura keeps only the Edinburgh hit, typed as an attraction", () => {
  const places = parsePlaces(fixture("camera-obscura"));
  assert.equal(places.length, 1, "German/London/Moscow hits are outside the box");
  assert.equal(places[0].label, "Camera Obscura & World of Illusions");
  assert.equal(places[0].kind, "attraction");
});

test("Malmaison offers both Edinburgh hotels as separate candidates", () => {
  const places = parsePlaces(fixture("malmaison"));
  assert.equal(places.length, 2);
  assert.deepEqual(places.map((p) => p.kind), ["hotel", "hotel"]);
  assert.deepEqual(
    places.map((p) => p.label),
    ["Malmaison Edinburgh City", "Malmaison"]
  );
  assert.equal(places[0].area, "St Andrew Square", "the street disambiguates the two");
});

test("Summerhall's arts centre takes the slot of the same-named street", () => {
  // Round-1 capture (bounded=1) — still a verbatim jsonv2 payload. The street
  // ranks above the arts centre, but a street can't be booked or pinned as a
  // venue: the typed duplicate must upgrade the kept untyped one.
  const places = parsePlaces(fixture("summerhall"));
  assert.deepEqual(
    places.map((p) => [p.label, p.kind]),
    [
      ["Summerhall", "theatre"],
      ["Artiscience Library", "other"],
    ]
  );
  assert.equal(places[0].area, "Sciennes", "the upgraded hit carries the arts centre's own street");
});

test("BrewDog keeps all four distinct pubs — same names far apart are not duplicates", () => {
  const places = parsePlaces(fixture("brewdog"));
  assert.equal(places.length, 4);
  assert.ok(places.every((p) => p.kind === "pub"));
});

test("the concourse amenities parse with their kinds (pub, other, cafe)", () => {
  const places = parsePlaces(fixture("waverley-station"));
  assert.deepEqual(
    places.map((p) => [p.label, p.kind]),
    [
      ["BrewDog", "pub"],
      ["RBS", "other"], // an ATM books nothing
      ["Costa", "cafe"],
    ]
  );
});

test("an empty response and junk input both parse to no places", () => {
  assert.deepEqual(parsePlaces(fixture("zzzqqqxyzzy")), []);
  assert.deepEqual(parsePlaces(null), []);
  assert.deepEqual(parsePlaces({ error: "rate limited" }), []);
  assert.deepEqual(parsePlaces([{ name: "No coords" }]), []);
});

/* ---------- kind buckets ---------- */

test("place kinds bucket the categories the partners can serve", () => {
  assert.equal(placeKind("railway", "station"), "train");
  assert.equal(placeKind("building", "train_station"), "train");
  assert.equal(placeKind("amenity", "restaurant"), "restaurant");
  assert.equal(placeKind("amenity", "cafe"), "cafe");
  assert.equal(placeKind("amenity", "pub"), "pub");
  assert.equal(placeKind("amenity", "arts_centre"), "theatre");
  assert.equal(placeKind("tourism", "hotel"), "hotel");
  assert.equal(placeKind("tourism", "museum"), "attraction");
  assert.equal(placeKind("historic", "castle"), "attraction");
  assert.equal(placeKind("shop", "gift"), "other");
  assert.equal(placeKind(undefined, undefined), "other");
  assert.ok(placeIcon("train") !== placeIcon("other"), "kinds are visually distinct");
});

/* ---------- partner links (the monetization) ---------- */

const eats = { label: "Mother India's Cafe", area: "", lat: 55.9469, lng: -3.1852, kind: "restaurant" };
const train = { label: "Edinburgh Waverley", area: "", lat: 55.9519, lng: -3.1904, kind: "train" };
const hotel = { label: "Malmaison", area: "", lat: 55.9778, lng: -3.1686, kind: "hotel" };
const sight = { label: "Camera Obscura & World of Illusions", area: "", lat: 55.949, lng: -3.1956, kind: "attraction" };

test("every bookable kind gets a working plain link with no affiliate IDs configured", () => {
  const none = { awinAffiliateId: "", trainlineAwinMid: "", opentableRef: "", bookingAid: "", gygPartnerId: "" };
  const dining = partnerLink(eats, none);
  assert.equal(dining.partner, "OpenTable");
  assert.match(dining.url, /^https:\/\/www\.opentable\.co\.uk\/s\?/);
  assert.match(dining.url, /term=Mother\+India's\+Cafe|term=Mother%20India/);
  assert.doesNotMatch(dining.url, /[?&]ref=/, "no empty ref param");

  assert.equal(partnerLink(train, none).url, "https://www.thetrainline.com/");
  assert.match(partnerLink(hotel, none).url, /^https:\/\/www\.booking\.com\/searchresults\.html\?ss=/);
  assert.doesNotMatch(partnerLink(hotel, none).url, /[?&]aid=/);
  assert.match(partnerLink(sight, none).url, /^https:\/\/www\.getyourguide\.com\/s\/\?q=/);
  assert.doesNotMatch(partnerLink(sight, none).url, /partner_id=/);
});

test("configured affiliate IDs tag every partner link", () => {
  const ids = {
    awinAffiliateId: "123456",
    trainlineAwinMid: "2586",
    opentableRef: "99999",
    bookingAid: "304142",
    gygPartnerId: "ABCDE",
  };
  assert.match(partnerLink(eats, ids).url, /[?&]ref=99999/);
  const t = partnerLink(train, ids).url;
  assert.match(t, /^https:\/\/www\.awin1\.com\/cread\.php\?/);
  assert.match(t, /awinmid=2586/);
  assert.match(t, /awinaffid=123456/);
  assert.match(t, /ued=https%3A%2F%2Fwww\.thetrainline\.com%2F/);
  assert.match(partnerLink(hotel, ids).url, /[?&]aid=304142/);
  assert.match(partnerLink(sight, ids).url, /[?&]partner_id=ABCDE/);
});

test("non-bookable kinds get no link, and the shipped config defaults to untagged", () => {
  assert.equal(partnerLink({ ...eats, kind: "other" }), null);
  assert.equal(partnerLink({ ...eats, kind: "theatre" }), null, "a Fringe venue is a destination, not a booking");
  for (const [key, value] of Object.entries(AFFILIATES)) {
    assert.equal(value, "", `AFFILIATES.${key} ships empty — filled in when the owner joins the programme`);
  }
});
