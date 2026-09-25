/* How each festival looks and what it offers beyond its programme.
 *
 * The registry (site/data/festivals/index.json) says which festivals exist,
 * where and when; this map says how the page presents one: its wordmark, the
 * translation keys for its name and city, and the partner links a trip to it
 * needs. Keyed by the registry's festival id. A festival the registry has and this map does not still plans
 * — it is drawn under the house palette with its registry name — so adding a
 * festival's data never waits on this file.
 *
 * The palette itself is CSS, selected by `data-festival` (planNG.css).
 *
 * Pure data plus link builders: no DOM, no fetch.
 */

import { israelRailLink, israelTravelLink, stayLink, travelLink } from "../shared/affiliates.js";

/* The page's own address, and the path every one of its languages hangs off. */
export const PAGE_ROOT = "/planNG/";

/* The page's corner of localStorage. Every key this page writes starts here, so
 * the Edinburgh planner's stored list is never touched. */
export const STORAGE_PREFIX = "planNG.";

/* Where the page lived before it planned more than one festival, and the
 * prefix its stored lists were kept under — read once, by lib/migrate.js. */
export const LEGACY_STORAGE_PREFIX = "jerusalemPlan.";
export const LEGACY_FESTIVAL_ID = "jerusalem-comedy";
export const LEGACY_EDITION_ID = "2026";

/* How the site's own home page and Edinburgh planner are reached from here. */
export const SITE_NAV = [
  { href: "/", labelKey: "nav.now" },
  { href: "/plan/", labelKey: "nav.plan" },
];

const ISRAEL = {
  country: "IL",
  /* Where a flight from abroad lands: Ben Gurion, whichever of the country's
     festivals the trip is for. */
  flyTo: "TLV",
  /* Booking.com's Hebrew edition, in shekels — "the local Booking.com". */
  stay: { locale: "he", currency: "ILS" },
  /* Getting here from abroad: the paid airport transfer, and the train beside
     it — Israel Railways pays nothing and is still usually the right answer
     from Ben Gurion, and a planner that hid it to protect a commission would
     be worth less than one that didn't. */
  airport: () => withLabel("trip.transfers", israelTravelLink()),
  rail: () => withLabel("trip.rail", israelRailLink()),
};

const UK = {
  country: "GB",
  flyTo: "EDI",
  /* Booking.com's own default edition, in pounds. */
  stay: { locale: "en-gb", currency: "GBP" },
  /* Omio's Edinburgh page covers train, coach and flight in one search, so it
     is the one way in whether the reader comes from Glasgow or from abroad. */
  airport: () => withLabel("trip.travel", travelLink()),
  rail: () => withLabel("trip.travel", travelLink()),
};

/* Each host city's photograph, drawn faded behind the top of the page while a
 * festival there leads the trip. All from Wikimedia Commons, under the licence
 * each names; the footer credits the one on show, as those licences ask. The
 * files are the originals scaled to 1600 pixels wide and re-encoded, which is
 * an adaptation: Haifa's is shared under its CC BY-SA 4.0 like the original.
 * `position` is where the photograph's subject sits, for `object-position`. */
const CC_BY_2 = { licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/" };
export const CITY_PHOTOS = {
  jerusalem: {
    src: "/planNG/cities/jerusalem.webp",
    title: "Jerusalem from the Mount of Olives",
    author: "Mustang Joe",
    licence: "CC0",
    licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    source: "https://commons.wikimedia.org/wiki/File:Jerusalem_from_the_Mount_of_Olives_(53714451089).jpg",
    position: "center 35%",
  },
  haifa: {
    src: "/planNG/cities/haifa.webp",
    title: "IPhO-2019 07-11 Haifa Bahai garden panorama",
    author: "Ipho19",
    licence: "CC BY-SA 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source: "https://commons.wikimedia.org/wiki/File:IPhO-2019_07-11_Haifa_Bahai_garden_panorama.jpg",
    position: "center 55%",
  },
  akko: {
    src: "/planNG/cities/akko.webp",
    title: "The Old City of Acre, Israel",
    author: "Ray in Manila",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:The_Old_City_of_Acre,_Israel_(51890502128).jpg",
    position: "center 55%",
  },
  edinburgh: {
    src: "/planNG/cities/edinburgh.webp",
    title: "The City of Edinburgh",
    author: "Mike McBey",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:The_City_of_Edinburgh_(45072272641).jpg",
    position: "center 30%",
  },
};

/* Every string the reader reads is a translation KEY, spelled out so the
 * catalogue's own gate finds it in the page's source. The wordmark is the
 * exception: it is the festival's mark, not a sentence. */
export const PRESENTATION = {
  "jerusalem-comedy": {
    wordmark: ["Jerusalem", "Comedy"],
    nameKey: "fest.jerusalem-comedy.name",
    cityKey: "fest.jerusalem-comedy.city",
    region: ISRAEL,
    stayCity: "Jerusalem",
    photo: CITY_PHOTOS.jerusalem,
  },
  "haifa-iff": {
    wordmark: ["Haifa", "Film"],
    nameKey: "fest.haifa-iff.name",
    cityKey: "fest.haifa-iff.city",
    region: ISRAEL,
    stayCity: "Haifa",
    photo: CITY_PHOTOS.haifa,
  },
  "edfringe": {
    wordmark: ["Edinburgh", "Fringe"],
    nameKey: "fest.edfringe.name",
    cityKey: "fest.edfringe.city",
    region: UK,
    stayCity: "Edinburgh",
    photo: CITY_PHOTOS.edinburgh,
  },
  "acco": {
    wordmark: ["Acco", "Theatre"],
    nameKey: "fest.acco.name",
    cityKey: "fest.acco.city",
    region: ISRAEL,
    stayCity: "Akko",
    photo: CITY_PHOTOS.akko,
  },
};

/** The presentation for a festival, or null when the page has none of its own. */
export function presentationOf(festivalId) {
  return PRESENTATION[festivalId] || null;
}

/**
 * The trip links a reader needs for a festival, by how far they come from.
 * @param {object} festival the registry entry
 * @param {"local"|"domestic"|"abroad"|null} reach from shared/feasibility.js;
 *   null while the reader has not said, which is treated as abroad — offering
 *   the airport to someone who lives there costs a line, hiding it from someone
 *   who needs it costs them the trip
 * @returns {{labelKey, text, partner, url}[]} empty when nothing is needed
 */
export function tripLinks(festival, reach, checkinISO, checkoutISO) {
  if (reach === "local") return [];
  const p = presentationOf(festival.id);
  const stay = withLabel(
    "trip.stay",
    stayLink({
      checkinISO,
      checkoutISO,
      city: (p && p.stayCity) || festival.city,
      locale: p ? p.region.stay.locale : "en-gb",
      currency: p ? p.region.stay.currency : undefined,
      label: `edfringenow-${festival.id}-night`,
    })
  );
  if (!p) return [stay];
  const links = reach === "domestic" ? [stay, p.region.rail()] : [stay, p.region.airport(), p.region.rail()];
  // A region whose one partner covers both the flight and the train offers it once.
  return links.filter((link, i) => links.findIndex((other) => other.url === link.url) === i);
}

/* An affiliate link ships the partner's own English label; the planner names it
 * in the reader's language instead, so each one carries the key to name it by. */
function withLabel(labelKey, link) {
  return { ...link, labelKey };
}
