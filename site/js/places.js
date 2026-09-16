/* Non-show places — the "Not a show? Type a place" commitment.
 *
 * Everything here is pure (no DOM, no fetch): js/app.js does the fetching and
 * rendering, and js/__tests__/places.test.mjs exercises this module directly.
 *
 * Two jobs:
 *   1. Geocoding — build the Nominatim (OpenStreetMap's geocoder) search URL,
 *      bounded to Edinburgh, and normalize its results. Nominatim needs no API
 *      key, matching the site's Leaflet + OSM setup; its usage policy asks for
 *      an identifying Referer (the browser sends one) and ≤1 request/second
 *      (we only search on an explicit button press).
 *   2. Partner links — a booking link for the kinds of place people type
 *      (a restaurant table, train tickets, a hotel, an attraction), which
 *      becomes a referral link once the affiliate IDs below are filled in.
 */

/* Bounding box for the geocoder: greater Edinburgh, Airport to Musselburgh.
 * Passed to Nominatim as a ranking bias and applied again client-side in
 * parsePlaces, so "Malmaison" can't resolve to the one in Newcastle.
 *
 * Deliberately NOT sent with `bounded=1`: probed against the live API
 * (2026-07-29), bounded restricts the search to amenity-tag matching inside
 * the box — "Waverley station" then returns the pub and café inside the
 * concourse but not Edinburgh Waverley itself, and "The Piemaker" returns
 * nothing. Unbounded search with the viewbox finds both; we drop any
 * out-of-box hits ourselves. */
export const EDINBURGH_VIEWBOX = { minLat: 55.87, maxLat: 56.0, minLng: -3.46, maxLng: -3.02 };

/* Is a [lat, lng] inside the Edinburgh box above? */
export function inEdinburgh([lat, lng]) {
  const { minLat, maxLat, minLng, maxLng } = EDINBURGH_VIEWBOX;
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/* ---------- Monetization: affiliate / referral IDs ----------
 *
 * These are NOT secrets — they ship in the client, like the analytics token in
 * js/analytics.js — and they are empty by default: every link below works as a
 * plain deep link, and starts tagging referrals the moment an ID is filled in.
 *
 * TO MONETIZE, join the partner programmes and paste the IDs here. Each
 * partner runs its programme where IT chooses (researched 2026-07-29; the
 * step-by-step sign-up checklist lives in issue #161):
 *   - OpenTable partner programme — opentableRef is the `ref` OpenTable
 *     assigns you.
 *   - Trainline runs on Partnerize — trainlineCamref is your campaign ref
 *     (`camref`) from the Partnerize dashboard.
 *   - Booking.com runs on Awin — awinAffiliateId is your Awin publisher ID,
 *     bookingAwinMid is Booking.com's advertiser ID shown in your Awin
 *     dashboard once accepted.
 *   - GetYourGuide partner programme — gygPartnerId.
 * A link whose programme IDs are unset simply stays untagged — partial set-up
 * is fine.
 */
export const AFFILIATES = {
  opentableRef: "",
  trainlineCamref: "",
  awinAffiliateId: "",
  bookingAwinMid: "",
  gygPartnerId: "",
};

/* Nominatim search URL for a free-text place query, bounded to Edinburgh.
 * jsonv2 gives each hit a `name`, a `category`/`type` pair (how we bucket the
 * place) and, with addressdetails, the street for the "which one?" line. */
export function geocodeUrl(query) {
  const { minLat, maxLat, minLng, maxLng } = EDINBURGH_VIEWBOX;
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "5",
    addressdetails: "1",
    // viewbox is two opposite lng,lat corners.
    viewbox: `${minLng},${maxLat},${maxLng},${minLat}`,
  });
  return `https://nominatim.openstreetmap.org/search?${params}`;
}

/* Bucket a Nominatim category/type pair into the kinds the app knows how to
 * present (icon) and monetize (partner link). Anything unrecognized — a street
 * address, a shop, a park — is "other": still a fine destination, just with a
 * plain pin and no booking link. */
export function placeKind(category, type) {
  if (category === "railway") {
    // "stop" nodes are platforms of the same station (probed: Edinburgh
    // Waverley returns station + stop entries side by side).
    return type === "station" || type === "halt" || type === "stop" ? "train" : "other";
  }
  // Waverley's building outline is category "building", type "train_station".
  if (category === "building") {
    return type === "train_station" ? "train" : "other";
  }
  if (category === "amenity") {
    if (type === "restaurant" || type === "food_court" || type === "biergarten") return "restaurant";
    if (type === "cafe" || type === "fast_food" || type === "ice_cream") return "cafe";
    if (type === "pub" || type === "bar" || type === "nightclub") return "pub";
    // Arts centres (e.g. Summerhall) are Fringe venues in all but name.
    if (type === "theatre" || type === "arts_centre") return "theatre";
    // OSM types Camera Obscura — the attraction — as its own amenity.
    if (type === "camera_obscura" || type === "planetarium") return "attraction";
    return "other";
  }
  if (category === "tourism") {
    if (type === "hotel" || type === "hostel" || type === "guest_house" || type === "apartment")
      return "hotel";
    if (
      type === "museum" ||
      type === "attraction" ||
      type === "gallery" ||
      type === "viewpoint" ||
      type === "zoo" ||
      type === "theme_park"
    )
      return "attraction";
    return "other";
  }
  if (category === "historic") return "attraction";
  return "other";
}

const PLACE_ICONS = {
  restaurant: "🍽️",
  cafe: "☕",
  pub: "🍺",
  train: "🚆",
  hotel: "🛏️",
  attraction: "🏛️",
  theatre: "🎭",
  other: "📍",
};

export function placeIcon(kind) {
  return PLACE_ICONS[kind] || PLACE_ICONS.other;
}

/* One OSM landmark often geocodes as several same-named hits a few dozen
 * metres apart (probed: Edinburgh Waverley = station node + building outline +
 * two platform stops). Treat same label within roughly a city block as one
 * place — and when the kept hit is an untyped "other" (a street, a roof), let
 * a typed duplicate (the station, the arts centre) take its slot. */
const NEARBY_LAT = 0.004; // ~440 m
const NEARBY_LNG = 0.006; // ~370 m at Edinburgh's latitude

/* Normalize a Nominatim jsonv2 response into the places the app works with:
 * { label, area, lat, lng, kind }. Hits without usable coordinates or a name
 * are dropped rather than guessed at, and — since the search is deliberately
 * unbounded (see EDINBURGH_VIEWBOX) — so is anything outside Edinburgh. */
export function parsePlaces(json) {
  if (!Array.isArray(json)) return [];
  const hits = json
    .map((hit) => {
      const lat = parseFloat(hit.lat);
      const lng = parseFloat(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (!inEdinburgh([lat, lng])) return null;
      const label = hit.name || String(hit.display_name || "").split(",")[0].trim();
      if (!label) return null;
      const addr = hit.address || {};
      // A short "which one?" disambiguator — the street beats the suburb.
      const area = addr.road || addr.neighbourhood || addr.suburb || "";
      return { label, area, lat, lng, kind: placeKind(hit.category, hit.type) };
    })
    .filter(Boolean);

  const out = [];
  for (const hit of hits) {
    const dup = out.find(
      (kept) =>
        kept.label === hit.label &&
        Math.abs(kept.lat - hit.lat) <= NEARBY_LAT &&
        Math.abs(kept.lng - hit.lng) <= NEARBY_LNG
    );
    if (!dup) out.push(hit);
    else if (dup.kind === "other" && hit.kind !== "other") Object.assign(dup, hit);
  }
  return out;
}

/* Awin deep-link wrapper (Booking.com's programme): routes a merchant URL
 * through the affiliate network so the click is credited. Only meaningful once
 * both IDs are set. */
function awinWrap(merchantId, affiliateId, url) {
  return (
    "https://www.awin1.com/cread.php" +
    `?awinmid=${encodeURIComponent(merchantId)}` +
    `&awinaffid=${encodeURIComponent(affiliateId)}` +
    `&ued=${encodeURIComponent(url)}`
  );
}

/* Partnerize click wrapper (Trainline's programme): prf.hn is Partnerize's
 * link domain; `destination:` keeps the deep link. */
function partnerizeWrap(camref, url) {
  return `https://prf.hn/click/camref:${encodeURIComponent(camref)}/destination:${encodeURIComponent(url)}`;
}

/* Trainline station pages we've verified the slug for (they don't follow a
 * guessable rule — Waverley's page is /stations/edinburgh, not
 * /stations/edinburgh-waverley). Keyed by the lowercased OSM station name;
 * any station not listed links to the Trainline homepage instead of a
 * guessed-and-possibly-404 page. Extend only with slugs checked against the
 * live site. */
const TRAINLINE_STATION_SLUGS = { "edinburgh waverley": "edinburgh" };

/* The day after an ISO date, for a one-night hotel stay. Pure calendar maths
 * (UTC noon dodges DST edges), so month/year boundaries just work. */
function nextDayISO(dateISO) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* The booking link for a place, or null for kinds with nothing sensible to
 * book. Returns { text, partner, url } — the caller renders "text · partner".
 * `affiliates` is injectable for tests; callers pass the shipped config.
 * `when` ({ dateISO, time }) is the commitment the user picked — given, the
 * link pre-fills their actual slot: the table booked for that time, the hotel
 * for that night. */
export function partnerLink(place, affiliates = AFFILIATES, when = null) {
  const { label, lat, lng, kind } = place;

  if (kind === "restaurant" || kind === "cafe" || kind === "pub") {
    let url =
      "https://www.opentable.co.uk/s" +
      `?term=${encodeURIComponent(label)}` +
      `&latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}`;
    if (when && when.dateISO && when.time)
      url += `&covers=2&dateTime=${encodeURIComponent(`${when.dateISO}T${when.time}`)}`;
    if (affiliates.opentableRef) url += `&ref=${encodeURIComponent(affiliates.opentableRef)}`;
    return { text: "Book a table", partner: "OpenTable", url };
  }

  if (kind === "train") {
    const slug = TRAINLINE_STATION_SLUGS[label.toLowerCase()];
    const url = slug ? `https://www.thetrainline.com/stations/${slug}` : "https://www.thetrainline.com/";
    const wrapped = affiliates.trainlineCamref ? partnerizeWrap(affiliates.trainlineCamref, url) : url;
    return { text: "Train times & tickets", partner: "Trainline", url: wrapped };
  }

  if (kind === "hotel") {
    let url =
      "https://www.booking.com/searchresults.html" +
      `?ss=${encodeURIComponent(`${label}, Edinburgh`)}`;
    if (when && when.dateISO)
      url += `&checkin=${encodeURIComponent(when.dateISO)}&checkout=${encodeURIComponent(nextDayISO(when.dateISO))}`;
    const wrapped =
      affiliates.awinAffiliateId && affiliates.bookingAwinMid
        ? awinWrap(affiliates.bookingAwinMid, affiliates.awinAffiliateId, url)
        : url;
    return { text: "Check availability", partner: "Booking.com", url: wrapped };
  }

  if (kind === "attraction") {
    let url = `https://www.getyourguide.com/s/?q=${encodeURIComponent(`${label} Edinburgh`)}`;
    if (affiliates.gygPartnerId) url += `&partner_id=${encodeURIComponent(affiliates.gygPartnerId)}`;
    return { text: "Book tickets & tours", partner: "GetYourGuide", url };
  }

  return null; // "theatre" and "other": a destination, not a booking
}
