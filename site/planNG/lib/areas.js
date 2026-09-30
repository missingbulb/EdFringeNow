/* The areas the globe offers before any country: a handful of regions a
 * reader thinks in, each a set of countries. They are chosen for choosing,
 * not for geography: the British Isles stand apart from the rest of Europe
 * because so many festivals are there.
 *
 * Pure: no DOM, no fetch.
 */

export const AREAS = Object.freeze([
  { id: "british-isles", countries: ["GB", "IE", "IM", "JE", "GG"] },
  {
    id: "europe",
    countries: [
      "AD", "AL", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FO", "FR",
      "GI", "GR", "HR", "HU", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK", "MT", "NL", "NO", "PL",
      "PT", "RO", "RS", "SE", "SI", "SK", "SM", "UA", "VA", "XK",
    ],
  },
  {
    id: "middle-east",
    countries: ["AE", "BH", "EG", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "TR", "YE"],
  },
  { id: "russia-central-asia", countries: ["AM", "AZ", "GE", "KG", "KZ", "RU", "TJ", "TM", "UZ"] },
  { id: "south-asia", countries: ["AF", "BD", "BT", "IN", "LK", "MV", "NP", "PK"] },
  {
    id: "east-asia",
    countries: ["BN", "CN", "HK", "ID", "JP", "KH", "KP", "KR", "LA", "MM", "MN", "MO", "MY", "PH", "SG", "TH", "TL", "TW", "VN"],
  },
  { id: "oceania", countries: ["AU", "FJ", "NC", "NZ", "PG", "SB", "TO", "VU", "WS"] },
  { id: "north-america", countries: ["CA", "GL", "MX", "US"] },
  {
    id: "latin-america",
    countries: [
      "AR", "BB", "BO", "BR", "BS", "BZ", "CL", "CO", "CR", "CU", "DO", "EC", "FK", "GF", "GT", "GY", "HN", "HT",
      "JM", "NI", "PA", "PE", "PR", "PY", "SR", "SV", "TT", "UY", "VE",
    ],
  },
  {
    id: "africa",
    countries: [
      "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "EH", "ER", "ET", "GA", "GH",
      "GM", "GN", "GQ", "GW", "KE", "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW", "MZ", "NA", "NE",
      "NG", "RW", "SC", "SD", "SL", "SN", "SO", "SS", "ST", "SZ", "TD", "TG", "TN", "TZ", "UG", "ZA", "ZM", "ZW",
    ],
  },
]);

const AREA_OF = new Map(AREAS.flatMap((a) => a.countries.map((c) => [c, a.id])));

/** The area a country belongs to, or null for one no area lists. */
export function areaOf(country) {
  return AREA_OF.get(country) || null;
}
