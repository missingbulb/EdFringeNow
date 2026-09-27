/* Which of the registry's festivals the year strip draws, as the three menus
 * above it narrow them: a place, a type and a subtype.
 *
 * A menu's value is "" for "any". A place is a country code ("IL") or a city
 * within one ("IL/Haifa"); a type is the registry's `kind`; a subtype is one
 * of a festival's `subtypes`, which label the festival, never its events.
 *
 * Pure: no DOM, no fetch.
 */

export const NO_FILTER = Object.freeze({ place: "", kind: "", subtype: "" });

/** A place menu's value for a festival's city. */
export function cityPlace(festival) {
  return `${festival.country}/${festival.city}`;
}

function matchesPlace(festival, place) {
  if (!place) return true;
  return place.includes("/") ? cityPlace(festival) === place : festival.country === place;
}

function subtypesOf(festival) {
  return Array.isArray(festival.subtypes) ? festival.subtypes : [];
}

/** Whether a festival matches every menu. */
export function festivalMatches(festival, filter) {
  return (
    matchesPlace(festival, filter.place) &&
    (!filter.kind || festival.kind === filter.kind) &&
    (!filter.subtype || subtypesOf(festival).includes(filter.subtype))
  );
}

/**
 * The registry the strip draws: the festivals the menus keep, and always the
 * one leading the trip, so the reader's trip never loses its festival.
 * @param {{festivals: object[]}} registry
 * @param {{place: string, kind: string, subtype: string}} filter
 * @param {string|null} keepId the festival leading the trip
 */
export function filterRegistry(registry, filter, keepId = null) {
  const festivals = registry.festivals.filter((f) => f.id === keepId || festivalMatches(f, filter));
  return { ...registry, festivals };
}

/**
 * What each menu can offer, from what the registry holds: every country with
 * its cities, every type, and the subtypes the chosen place and type leave.
 * @returns {{places: {country: string, cities: string[]}[], kinds: string[], subtypes: string[]}}
 */
export function filterOptions(registry, filter) {
  const countries = new Map();
  const kinds = new Set();
  const subtypes = new Set();
  for (const f of registry.festivals) {
    if (!countries.has(f.country)) countries.set(f.country, new Set());
    countries.get(f.country).add(f.city);
    kinds.add(f.kind);
    if (matchesPlace(f, filter.place) && (!filter.kind || f.kind === filter.kind)) {
      for (const s of subtypesOf(f)) subtypes.add(s);
    }
  }
  return {
    places: [...countries].map(([country, cities]) => ({ country, cities: [...cities].sort() })),
    kinds: [...kinds].sort(),
    subtypes: [...subtypes].sort(),
  };
}
