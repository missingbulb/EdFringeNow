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

const NO_IDS = { opentableRef: "", trainlineCamref: "", awinAffiliateId: "", bookingAwinMid: "", gygPartnerId: "" };

test("every bookable kind gets a working plain link with no affiliate IDs configured", () => {
  const dining = partnerLink(eats, NO_IDS);
  assert.equal(dining.partner, "OpenTable");
  assert.match(dining.url, /^https:\/\/www\.opentable\.co\.uk\/s\?/);
  assert.match(dining.url, /term=Mother\+India's\+Cafe|term=Mother%20India/);
  assert.doesNotMatch(dining.url, /[?&]ref=/, "no empty ref param");
  assert.doesNotMatch(dining.url, /dateTime=/, "no dateTime without a committed time");

  // Waverley deep-links to its own Trainline page even untagged. The slug is
  // "edinburgh", not "edinburgh-waverley" — see TRAINLINE_STATION_SLUGS.
  assert.equal(partnerLink(train, NO_IDS).url, "https://www.thetrainline.com/stations/edinburgh");
  // A station whose Trainline slug we haven't verified falls back to the homepage.
  assert.equal(
    partnerLink({ ...train, label: "Haymarket" }, NO_IDS).url,
    "https://www.thetrainline.com/"
  );

  assert.match(partnerLink(hotel, NO_IDS).url, /^https:\/\/www\.booking\.com\/searchresults\.html\?ss=/);
  assert.doesNotMatch(partnerLink(hotel, NO_IDS).url, /checkin=/, "no dates without a committed time");
  assert.match(partnerLink(sight, NO_IDS).url, /^https:\/\/www\.getyourguide\.com\/s\/\?q=/);
  assert.doesNotMatch(partnerLink(sight, NO_IDS).url, /partner_id=/);
});

test("links carry the user's own selection: their table time, their hotel night", () => {
  const when = { dateISO: "2026-08-14", time: "18:25" };
  const dining = partnerLink(eats, NO_IDS, when).url;
  assert.match(dining, /dateTime=2026-08-14T18%3A25/, "OpenTable pre-fills the committed time");
  assert.match(dining, /covers=2/);

  const stay = partnerLink(hotel, NO_IDS, when).url;
  assert.match(stay, /checkin=2026-08-14/, "Booking.com pre-fills tonight");
  assert.match(stay, /checkout=2026-08-15/);

  // The night maths must survive a month boundary.
  const monthEnd = partnerLink(hotel, NO_IDS, { dateISO: "2026-08-31", time: "22:00" }).url;
  assert.match(monthEnd, /checkin=2026-08-31/);
  assert.match(monthEnd, /checkout=2026-09-01/);

  // A time-less note of a `when` adds nothing rather than a malformed param.
  const timeless = partnerLink(eats, NO_IDS, { dateISO: "2026-08-14", time: "" }).url;
  assert.doesNotMatch(timeless, /dateTime=/);
});

test("configured affiliate IDs tag every partner link through its real 2026 programme", () => {
  const ids = {
    opentableRef: "99999",
    trainlineCamref: "1101lAbCdEf", // Trainline's programme runs on Partnerize (camref links)
    awinAffiliateId: "123456", //       Booking.com's programme runs on Awin
    bookingAwinMid: "18119",
    gygPartnerId: "ABCDE",
  };
  assert.match(partnerLink(eats, ids).url, /[?&]ref=99999/);

  const t = partnerLink(train, ids).url;
  assert.match(t, /^https:\/\/prf\.hn\/click\/camref:1101lAbCdEf\/destination:/);
  assert.ok(
    t.endsWith(`destination:${encodeURIComponent("https://www.thetrainline.com/stations/edinburgh")}`),
    "the Partnerize wrapper still deep-links the station page"
  );

  const h = partnerLink(hotel, ids).url;
  assert.match(h, /^https:\/\/www\.awin1\.com\/cread\.php\?/);
  assert.match(h, /awinmid=18119/);
  assert.match(h, /awinaffid=123456/);
  assert.match(h, /ued=https%3A%2F%2Fwww\.booking\.com/);

  assert.match(partnerLink(sight, ids).url, /[?&]partner_id=ABCDE/);
});

test("a partial affiliate set-up tags only its own links", () => {
  // Awin joined, Partnerize not yet: hotel wraps, train stays a plain deep link.
  const ids = { ...NO_IDS, awinAffiliateId: "123456", bookingAwinMid: "18119" };
  assert.match(partnerLink(hotel, ids).url, /^https:\/\/www\.awin1\.com\/cread\.php\?/);
  assert.equal(partnerLink(train, ids).url, "https://www.thetrainline.com/stations/edinburgh");
  // Awin publisher ID alone (no merchant ID) must not produce a half-built wrap.
  const half = { ...NO_IDS, awinAffiliateId: "123456" };
  assert.match(partnerLink(hotel, half).url, /^https:\/\/www\.booking\.com\//);
});

test("non-bookable kinds get no link, and the shipped config defaults to untagged", () => {
  assert.equal(partnerLink({ ...eats, kind: "other" }), null);
  assert.equal(partnerLink({ ...eats, kind: "theatre" }), null, "a Fringe venue is a destination, not a booking");
  for (const [key, value] of Object.entries(AFFILIATES)) {
    assert.equal(value, "", `AFFILIATES.${key} ships empty — filled in when the owner joins the programme`);
  }
});
