/* Which of the registry's festivals the year strip draws, as the filters
 * beside it narrow them: a place, a type and a subtype.
 *
 * A filter's value is "" for "any". A place is a country code ("IL") or a city
 * within one ("IL/Haifa"); a type is one of TYPES, each holding one or more of
 * the registry's `kind`s; a subtype is one of a festival's `subtypes`, which
 * label the festival, never its events.
 *
 * Pure: no DOM, no fetch.
 */

export const NO_FILTER = Object.freeze({ place: "", type: "", subtype: "" });

/* The nine types the grid offers, in its order, and the registry kinds each
 * holds. Every kind the registry allows (scraper/festivals/registry.py's
 * KINDS) belongs to exactly one. */
export const TYPES = Object.freeze([
  { id: "music", kinds: ["music"] },
  { id: "film", kinds: ["film"] },
  { id: "theatre", kinds: ["theatre"] },
  { id: "dance", kinds: ["dance"] },
  { id: "comedy", kinds: ["comedy"] },
  { id: "art", kinds: ["art", "literature"] },
  { id: "mixed", kinds: ["fringe", "multi"] },
  { id: "sports", kinds: ["sports"] },
  { id: "academic", kinds: ["academic"] },
]);

/** The type a registry kind belongs to, or null for a kind no type holds. */
export function typeOfKind(kind) {
  const type = TYPES.find((t) => t.kinds.includes(kind));
  return type ? type.id : null;
}

/** A place filter's value for a festival's city. */
export function cityPlace(festival) {
  return `${festival.country}/${festival.city}`;
}

function matchesPlace(festival, place) {
  if (!place) return true;
  return place.includes("/") ? cityPlace(festival) === place : festival.country === place;
}

function matchesType(festival, type) {
  return !type || typeOfKind(festival.kind) === type;
}

function subtypesOf(festival) {
  return Array.isArray(festival.subtypes) ? festival.subtypes : [];
}

/** Whether a festival matches every filter. */
export function festivalMatches(festival, filter) {
  return (
    matchesPlace(festival, filter.place) &&
    matchesType(festival, filter.type) &&
    (!filter.subtype || subtypesOf(festival).includes(filter.subtype))
  );
}

/**
 * The registry the strip draws: the festivals the filters keep, and always
 * the one leading the trip, so the reader's trip never loses its festival.
 * @param {{festivals: object[]}} registry
 * @param {{place: string, type: string, subtype: string}} filter
 * @param {string|null} keepId the festival leading the trip
 */
export function filterRegistry(registry, filter, keepId = null) {
  const festivals = registry.festivals.filter((f) => f.id === keepId || festivalMatches(f, filter));
  return { ...registry, festivals };
}

/**
 * What each filter can offer, from what the registry holds: every country with
 * its cities, every type with how many festivals the chosen place holds of it,
 * and the subtypes the chosen place and type leave.
 * @returns {{places: {country: string, cities: string[]}[], types: {id: string, count: number}[], subtypes: string[]}}
 */
export function filterOptions(registry, filter) {
  const countries = new Map();
  const counts = new Map(TYPES.map((t) => [t.id, 0]));
  const subtypes = new Set();
  for (const f of registry.festivals) {
    if (!countries.has(f.country)) countries.set(f.country, new Set());
    countries.get(f.country).add(f.city);
    if (!matchesPlace(f, filter.place)) continue;
    const type = typeOfKind(f.kind);
    if (counts.has(type)) counts.set(type, counts.get(type) + 1);
    if (matchesType(f, filter.type)) {
      for (const s of subtypesOf(f)) subtypes.add(s);
    }
  }
  return {
    places: [...countries].map(([country, cities]) => ({ country, cities: [...cities].sort() })),
    types: TYPES.map((t) => ({ id: t.id, count: counts.get(t.id) })),
    subtypes: [...subtypes].sort(),
  };
}

/** The filter after one of them changes: a subtype the new place and type no
 * longer leave is dropped with them. */
export function withFilter(registry, filter, name, value) {
  const next = { ...filter, [name]: value };
  if (name !== "subtype" && next.subtype && !filterOptions(registry, next).subtypes.includes(next.subtype)) {
    next.subtype = "";
  }
  return next;
}
