// Travel-time estimation between Fringe venues.
//
// Pure — no DOM, no fetch. Ported from the home site's js/app.js (the haversine
// `distanceKm` and the `TRAVEL_SPEEDS_KMH` table) so the planner estimates
// travel between two shows the same way the "Now" map does. The scheduling
// engine uses this to size the gap it requires between back-to-back shows at
// different venues, and the schedule graphic uses it to label the travel leg
// drawn between two shows less than an hour apart.

// The three ways the planner lets you get between venues. Short, stable keys —
// the UI maps them to labels/emoji (🚶 🚲 🚗). Matches the home site's three
// modes (there is no bus mode: we can't give honest headway-aware bus times).
export const TRAVEL_MODES = ["walk", "bike", "car"];

// Rough door-to-door speeds (km/h) used to turn crow-flies distance into a
// travel estimate.
export const TRAVEL_SPEED_KMH = {
  // Walking is dialled down to ~2/3 of a brisk 5 km/h — Edinburgh's closes,
  // hills, stairs and festival crowds make real walking slower than the map
  // distance suggests. (Same figure as js/app.js.)
  walk: (5 * 2) / 3, // ≈ 3.33 km/h
  bike: 15,
  // A car in the congested August city centre is only a little quicker than a
  // bike once you count one-way systems, closures and parking.
  car: 22,
};

export const DEFAULT_TRAVEL_MODE = "walk";

/** Normalize a coordinate given as {lat,lng} or [lat,lng] to [lat,lng], or
 *  null when either component is missing (unknown / online venue). */
function coordPair(c) {
  if (!c) return null;
  let lat, lng;
  if (Array.isArray(c)) {
    [lat, lng] = c;
  } else {
    lat = c.lat;
    lng = c.lng;
  }
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return [Number(lat), Number(lng)];
}

/**
 * Great-circle distance in kilometres between two points (haversine). Accepts
 * either {lat,lng} objects or [lat,lng] pairs. Returns null if either point has
 * no usable coordinates.
 * @param {{lat:number,lng:number}|[number,number]} a
 * @param {{lat:number,lng:number}|[number,number]} b
 * @returns {number|null}
 */
export function distanceKm(a, b) {
  const pa = coordPair(a);
  const pb = coordPair(b);
  if (!pa || !pb) return null;
  const [lat1, lng1] = pa;
  const [lat2, lng2] = pb;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Estimated travel time in minutes between two venues by the given mode.
 * Returns null when the distance can't be computed (an online venue or a venue
 * we have no coordinates for) so the caller can fall back to a flat buffer.
 * @param {{lat:number,lng:number}|[number,number]} a
 * @param {{lat:number,lng:number}|[number,number]} b
 * @param {"walk"|"bike"|"car"} [mode]
 * @returns {number|null}
 */
export function travelMinutes(a, b, mode = DEFAULT_TRAVEL_MODE) {
  const km = distanceKm(a, b);
  if (km == null) return null;
  const speed = TRAVEL_SPEED_KMH[mode] ?? TRAVEL_SPEED_KMH[DEFAULT_TRAVEL_MODE];
  return (km / speed) * 60;
}
