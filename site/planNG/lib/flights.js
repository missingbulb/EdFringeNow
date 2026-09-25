/* The flights either side of a trip, as rules: which airport a reader flies
 * from, which currency to quote them, and the one call to the site's own fare
 * service (api/fares.js), which is the only thing that talks to the partner.
 *
 * No DOM. `fetchFares` takes its fetch as an argument so the rule for what a
 * failure means is testable without a network.
 */

/* The main airport — or the city code that covers all of a city's airports —
 * for each country the origin question names. A reader can overwrite it; a
 * country not listed leaves it for them to type. */
export const COUNTRY_AIRPORTS = {
  GB: "LON",
  US: "NYC",
  FR: "PAR",
  DE: "BER",
  RU: "MOW",
  UA: "KBP",
  IT: "ROM",
  ES: "MAD",
  NL: "AMS",
  PL: "WAW",
  JP: "TYO",
  CA: "YTO",
  AU: "SYD",
  IL: "TLV",
};

const COUNTRY_CURRENCIES = { GB: "gbp", US: "usd", JP: "jpy", CA: "cad", AU: "aud", PL: "pln", RU: "rub", UA: "uah", IL: "ils" };
const DEFAULT_CURRENCY = "eur";

/** An IATA airport or city code as the reader typed it, or null. */
export function airportCode(text) {
  const code = String(text || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

/** The airport a reader flies from: the one they typed, else their country's. */
export function originAirport(origin) {
  if (!origin) return null;
  return airportCode(origin.airport) || (origin.country && COUNTRY_AIRPORTS[origin.country]) || null;
}

/** The currency to quote a reader in, lower-case as the fare service takes it. */
export function fareCurrency(origin) {
  return (origin && origin.country && COUNTRY_CURRENCIES[origin.country]) || DEFAULT_CURRENCY;
}

/** The fare service's address for one day's flights on one route. */
export function faresUrl({ from, to, dateISO, currency }) {
  const q = new URLSearchParams({ from, to, date: dateISO, currency });
  return `/api/fares?${q}`;
}

/**
 * The cheapest flights for one day, or an empty list. An answer that is not a
 * list of fares — a failed request, a service that isn't there, a body that
 * doesn't parse — is the same to the reader as no fares: nothing claims a
 * price, and the block offers the search instead.
 * @returns {Promise<{departAt: string, durationMin: number|null, stops: number|null,
 *   price: number, currency: string, airline: string|null, link: string}[]>}
 */
export async function fetchFares(fetchImpl, params) {
  try {
    const res = await fetchImpl(faresUrl(params));
    if (!res.ok) return [];
    const body = await res.json();
    const fares = body && Array.isArray(body.fares) ? body.fares : [];
    return fares.filter((f) => f && typeof f.departAt === "string" && Number.isFinite(f.price) && typeof f.link === "string");
  } catch {
    return [];
  }
}
