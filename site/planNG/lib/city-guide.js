/* A city's short lists for the trip: where to stay and eat, what to see, where
 * to go for a day. The data is a city's serving file (`/data/cities/<id>.json`,
 * documented in scraper/cities/to_serving.py), found through the cities'
 * registry by the festival's own `city`; this module only chooses and shapes
 * what the drawer draws. Pure: no DOM, no fetch.
 */

import { GUIDE_SIGHTS } from "../../shared/limits.js";

export const CITIES_URL = "/data/cities/index.json";

/** The registry entry for the city a festival is held in, or null. */
export function cityEntryFor(registry, festival) {
  if (!registry || !festival) return null;
  return registry.cities.find((c) => c.name === festival.city && c.dataUrl) || null;
}

const OSM = "https://www.openstreetmap.org/";

/** Where a place's name links: its own site, else its OpenStreetMap entry. */
export function placeUrl(place) {
  if (place.website && /^https?:\/\//.test(place.website)) return place.website;
  const [type, id] = place.id.replace(/^osm:/, "").split("/");
  return `${OSM}${type}/${id}`;
}

/* The language a city's places are named in, where it is not English. */
const LOCAL_LANGUAGE = { IL: "he" };

/** Whether a reader in `locale` reads the city's own names rather than the English ones. */
export function readsLocalNames(country, locale) {
  return (LOCAL_LANGUAGE[country] || "en") === locale;
}

/** A place's name in the reader's language: the local name for a reader of
 * the city's own language, the English one mapped beside it for everyone else. */
export function placeName(place, { localReader }) {
  return localReader ? place.name : place.nameEn || place.name;
}

/** The four lists, each item with what the drawer shows of it. */
export function guideLists(city, { localReader = false } = {}) {
  const named = (p) => ({ ...p, title: placeName(p, { localReader }), url: placeUrl(p) });
  const sights = city.places
    .filter((p) => p.highlight)
    .slice(0, GUIDE_SIGHTS)
    .map((p) => ({
      ...named(p),
      url:
        p.website && /^https?:\/\//.test(p.website)
          ? p.website
          : p.wikipedia
            ? wikipediaUrl(p.wikipedia)
            : placeUrl(p),
    }));
  return {
    stay: (city.stay || []).map(named),
    eat: (city.eat || []).map(named),
    see: sights,
    trips: (city.trips || []).map((t) => ({ ...t, title: t.name })),
  };
}

/** "en:Edinburgh Castle" -> its article. */
export function wikipediaUrl(tag) {
  const [lang, ...title] = tag.split(":");
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.join(":").replace(/ /g, "_"))}`;
}

/** A cuisine as OSM writes it ("middle_eastern") as words ("Middle eastern"). */
export function cuisineWords(cuisine) {
  if (!cuisine || !cuisine.length) return null;
  return cuisine
    .slice(0, 2)
    .map((c) => c.replace(/_/g, " "))
    .map((c) => c.charAt(0).toUpperCase() + c.slice(1))
    .join(", ");
}

/** A distance in metres, rounded as a reader would say it: to ten metres
 * under a kilometre, to a tenth of a kilometre past it. */
export function roundedDistance(metres) {
  if (metres < 1000) return { value: Math.max(10, Math.round(metres / 10) * 10), unit: "meter" };
  return { value: Math.round(metres / 100) / 10, unit: "kilometer" };
}
