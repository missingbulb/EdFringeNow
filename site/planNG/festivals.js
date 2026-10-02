/* How each festival looks and what it offers beyond its programme.
 *
 * The registry (site/data/festivals/index.json) says which festivals exist,
 * where and when; this map says how the page presents one: its wordmark, the
 * translation keys for its name and city, and the partner links a trip to it
 * needs. Keyed by the registry's festival id. A festival the registry has and this map does not still plans
 * — it is drawn under the house palette with its registry name — so adding a
 * festival's data waits on this file only for its city's photograph.
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
 * festival there leads the trip. Keyed by the registry's city name, so every
 * festival in a city shares its photograph and a festival never waits on this
 * file's presentation entry to get one. A festival out of town shows the
 * country around it. All from Wikimedia Commons, under the licence each names;
 * the footer credits the one on show, as those licences ask. The files are the
 * originals scaled to 1600 pixels wide and re-encoded, which is an adaptation:
 * the CC BY-SA ones are shared under their originals' licence.
 * `position` is where the photograph's subject sits, for `object-position`. */
const CC0 = { licence: "CC0", licenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/" };
const CC_BY_2 = { licence: "CC BY 2.0", licenceUrl: "https://creativecommons.org/licenses/by/2.0/" };
const CC_BY_4 = { licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/" };
const CC_BY_SA_2 = { licence: "CC BY-SA 2.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/2.0/" };
const CC_BY_SA_3 = { licence: "CC BY-SA 3.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/3.0/" };
const CC_BY_SA_4 = { licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/" };
export const CITY_PHOTOS = {
  "Jerusalem": {
    src: "/planNG/cities/jerusalem.webp",
    title: "Jerusalem from the Mount of Olives",
    author: "Mustang Joe",
    ...CC0,
    source: "https://commons.wikimedia.org/wiki/File:Jerusalem_from_the_Mount_of_Olives_(53714451089).jpg",
    position: "center 35%",
  },
  "Haifa": {
    src: "/planNG/cities/haifa.webp",
    title: "IPhO-2019 07-11 Haifa Bahai garden panorama",
    author: "Ipho19",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:IPhO-2019_07-11_Haifa_Bahai_garden_panorama.jpg",
    position: "center 55%",
  },
  "Akko": {
    src: "/planNG/cities/akko.webp",
    title: "The Old City of Acre, Israel",
    author: "Ray in Manila",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:The_Old_City_of_Acre,_Israel_(51890502128).jpg",
    position: "center 55%",
  },
  "Tel Aviv": {
    src: "/planNG/cities/tel-aviv.webp",
    title: "Israel Tel Aviv Skyline",
    author: "FLASHPACKER TRAVELGUIDE",
    ...CC_BY_SA_2,
    source: "https://commons.wikimedia.org/wiki/File:Israel_Tel_Aviv_Skyline_(34714425090).jpg",
    position: "center 45%",
  },
  "Abu Ghosh": {
    src: "/planNG/cities/abu-ghosh.webp",
    title: "View from Église Notre Dame de l'Arche d'Alliance, 2019",
    author: "Bahnfrend",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:View_from_%C3%89glise_Notre_Dame_de_l%27Arche_d%27Alliance,_2019_(01).jpg",
    position: "center 40%",
  },
  "Capernaum": {
    src: "/planNG/cities/capernaum.webp",
    title: "Sea of Galilee from Capernaum",
    author: "Eduard Marmet",
    ...CC_BY_SA_2,
    source: "https://commons.wikimedia.org/wiki/File:Sea_of_Galilee_from_Capernaum_(34552508191).jpg",
    position: "center 40%",
  },
  /* InDNegev's kibbutz has no photograph of its own on Commons; the western
     Negev around it stands in. */
  "Mitzpe Gvulot": {
    src: "/planNG/cities/negev.webp",
    title: "Negev Wüste bei Be'er Sheva",
    author: "Zairon",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Negev_W%C3%BCste_bei_Be%27er_Sheva_7.JPG",
    position: "center 45%",
  },
  "Ramat Gan": {
    src: "/planNG/cities/ramat-gan.webp",
    title: "Ramat Gan Diamond Exchange District",
    author: "Horizon206",
    ...CC_BY_4,
    source: "https://commons.wikimedia.org/wiki/File:Ramat_Gan_Diamond_Exchange_District.jpg",
    position: "center 40%",
  },
  "Eilat": {
    src: "/planNG/cities/eilat.webp",
    title: "Eilat Hotels 2013",
    author: "Oyoyoy",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:Eilat_Hotels_2013.jpg",
    position: "center 40%",
  },
  "Airport City": {
    src: "/planNG/cities/airport-city.webp",
    title: "Israel AirportCity FromAir",
    author: "Sharshar",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:Israel_AirportCity_FromAir.JPG",
    position: "center 50%",
  },
  "Kfar Blum": {
    src: "/planNG/cities/kfar-blum.webp",
    title: "Kfar Blum",
    author: "Nizzan Cohen",
    ...CC_BY_4,
    source: "https://commons.wikimedia.org/wiki/File:Kfar_Blum.jpg",
    position: "center 50%",
  },
  "Edinburgh": {
    src: "/planNG/cities/edinburgh.webp",
    title: "The City of Edinburgh",
    author: "Mike McBey",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:The_City_of_Edinburgh_(45072272641).jpg",
    position: "center 30%",
  },
  "North Berwick": {
    src: "/planNG/cities/north-berwick.webp",
    title: "North Berwick Harbour from the North Beach, East Lothian",
    author: "Rosser1954",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:North_Berwick_Harbour_from_the_North_Beach,_East_Lothian.jpg",
    position: "center 50%",
  },
  "Brighton": {
    src: "/planNG/cities/brighton.webp",
    title: "Brighton seafront from pier",
    author: "Harrz",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Brighton_seafront_from_pier.jpg",
    position: "center 45%",
  },
  "Leicester": {
    src: "/planNG/cities/leicester.webp",
    title: "Leicester Clock Tower wide view",
    author: "NotFromUtrecht",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:Leicester_Clock_Tower_wide_view.jpg",
    position: "center 40%",
  },
  "Melbourne": {
    src: "/planNG/cities/melbourne.webp",
    title: "Melbourne Yarra River",
    author: "Donaldytong",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:Melbourne_Yarra_River.jpg",
    position: "center 45%",
  },
  "Auckland": {
    src: "/planNG/cities/auckland.webp",
    title: "Skyline - Auckland, NZ",
    author: "Daderot",
    ...CC0,
    source: "https://commons.wikimedia.org/wiki/File:Skyline_-_Auckland,_NZ_-_DSC07092.jpg",
    position: "center 40%",
  },
  "New Orleans": {
    src: "/planNG/cities/new-orleans.webp",
    title: "New Orleans skyline, March 2015",
    author: "pasa47",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:New_Orleans_skyline,_March_2015.jpg",
    position: "center 40%",
  },
  "Singapore": {
    src: "/planNG/cities/singapore.webp",
    title: "Skyline, Marina Bay, Singapur, 2023-08-17, DD 20",
    author: "Diego Delso",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Skyline,_Marina_Bay,_Singapur,_2023-08-17,_DD_20.jpg",
    position: "center 45%",
  },
  "Wichita": {
    src: "/planNG/cities/wichita.webp",
    title: "Wichita, Kansas skyline",
    author: "Quintin Soloviev",
    ...CC_BY_4,
    source: "https://commons.wikimedia.org/wiki/File:Wichita,_Kansas_skyline.jpg",
    position: "center 50%",
  },
  "Tryon": {
    src: "/planNG/cities/tryon.webp",
    title: "Tryon Peak",
    author: "Huntsmanleader",
    ...CC0,
    source: "https://commons.wikimedia.org/wiki/File:2023-03-14_Tryon_Peak.jpg",
    position: "center 40%",
  },
  "Santa Ana": {
    src: "/planNG/cities/santa-ana.webp",
    title: "Downtown Santa Ana",
    author: "Paul Sableman",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:Downtown_Santa_Ana_(22296752201).jpg",
    position: "center 40%",
  },
  "Santa Fe": {
    src: "/planNG/cities/santa-fe.webp",
    title: "Monument - Santa Fe Plaza",
    author: "Larry Lamsa",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:Monument_-_Santa_Fe_Plaza_(5518229907).jpg",
    position: "center 45%",
  },
  "Fort Lauderdale": {
    src: "/planNG/cities/fort-lauderdale.webp",
    title: "Fort Lauderdale skyline and harbor",
    author: "Kolossos",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:Fort_Lauderdale-skyline-harbor.jpg",
    position: "center 45%",
  },
  "San Jose": {
    src: "/planNG/cities/san-jose.webp",
    title: "San Jose, California",
    author: "Adam Schultz",
    ...CC_BY_2,
    source: "https://commons.wikimedia.org/wiki/File:SAN_JOSE_CALIFORNIA_BAYAREA01_(cropped).jpg",
    position: "center 45%",
  },
  "London": {
    src: "/planNG/cities/london.webp",
    title: "London Skyline from Waterloo Bridge, London, UK",
    author: "Diliff",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:London_Skyline_from_Waterloo_Bridge,_London,_UK_-_Diliff.jpg",
    position: "center 45%",
  },
  "San Francisco": {
    src: "/planNG/cities/san-francisco.webp",
    title: "San Francisco skyline of April 2017 seen from Treasure Island",
    author: "Dllu",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:San_Francisco_skyline_of_April_2017_seen_from_Treasure_Island.jpg",
    position: "center 55%",
  },
  "Luxembourg": {
    src: "/planNG/cities/luxembourg.webp",
    title: "Luxembourg (LU), Grund und Église Saint-Jean",
    author: "Dietmar Rabich",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Luxembourg_(LU),_Grund_und_%C3%89glise_Saint-Jean_--_2023_--_8133.jpg",
    position: "center 45%",
  },
  "Rapperswil": {
    src: "/planNG/cities/rapperswil.webp",
    title: "Rapperswil - Altstadt - Hafen",
    author: "Roland zh",
    ...CC_BY_SA_3,
    source: "https://commons.wikimedia.org/wiki/File:Rapperswil_-_Altstadt_-_Hafen_IMG_3080.JPG",
    position: "center 40%",
  },
  "Malmö": {
    src: "/planNG/cities/malmo.webp",
    title: "Turning Torso in Malmö, Sweden, near Öresund",
    author: "OleNeitzel",
    ...CC_BY_4,
    source: "https://commons.wikimedia.org/wiki/File:Turning_Torso_in_Malm%C3%B6,_Sweden,_near_%C3%96resund.jpg",
    position: "center 50%",
  },
  "Berlin": {
    src: "/planNG/cities/berlin.webp",
    title: "Berlin Mitte June 2023",
    author: "ArildV",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Berlin_Mitte_June_2023_01.jpg",
    position: "center 45%",
  },
  "Amsterdam": {
    src: "/planNG/cities/amsterdam.webp",
    title: "Colorful canal houses at golden hour in Damrak avenue Amsterdam the Netherlands",
    author: "Basile Morin",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:Colorful_canal_houses_at_golden_hour_in_Damrak_avenue_Amsterdam_the_Netherlands.jpg",
    position: "center 40%",
  },
  "Athens": {
    src: "/planNG/cities/athens.webp",
    title: "The city of Athens from the Acropolis on May 19, 2020",
    author: "George E. Koronaios",
    ...CC_BY_SA_4,
    source: "https://commons.wikimedia.org/wiki/File:The_city_of_Athens_from_the_Acropolis_on_May_19,_2020.jpg",
    position: "center 45%",
  },
};

/** The photograph of the festival's city, or null when there is none. */
export function cityPhotoOf(festival) {
  return CITY_PHOTOS[festival.city] || null;
}

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
  },
  "haifa-iff": {
    wordmark: ["Haifa", "Film"],
    nameKey: "fest.haifa-iff.name",
    cityKey: "fest.haifa-iff.city",
    region: ISRAEL,
    stayCity: "Haifa",
  },
  "edfringe": {
    wordmark: ["Edinburgh", "Fringe"],
    nameKey: "fest.edfringe.name",
    cityKey: "fest.edfringe.city",
    region: UK,
    stayCity: "Edinburgh",
  },
  "acco": {
    wordmark: ["Acco", "Theatre"],
    nameKey: "fest.acco.name",
    cityKey: "fest.acco.city",
    region: ISRAEL,
    stayCity: "Akko",
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
