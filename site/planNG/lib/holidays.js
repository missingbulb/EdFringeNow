/* The reader's own public holidays, as rules: whose they are, and which of
 * them the year strip shows.
 *
 * The files are site/holidays/<CC>.json (scripts/build-holidays.py).
 * Pure: no DOM, no fetch.
 */

/**
 * Whose holidays to show: the country the reader said they come from, else the
 * one their connection comes from, flagged as a guess. An answer that names no
 * country (their device's position, "somewhere else abroad", "not now") leaves
 * the guess standing.
 * @param {object|null} origin the stored origin answer
 * @param {string|null} guess the connection's country
 * @returns {{country: string, guessed: boolean}|null}
 */
export function homeCountry(origin, guess) {
  const said = origin && origin.kind !== "skipped" && origin.kind !== "position" ? origin.country : null;
  if (said) return { country: said, guessed: false };
  return guess ? { country: guess, guessed: true } : null;
}

/**
 * The holidays inside the strip's span, named in the page's language where
 * the file carries it and in English otherwise.
 * @param {{holidays: {date: string, name: object}[]}} doc
 * @param {{from: string, to: string}} span
 * @param {string} locale the page's language
 */
export function holidaysIn(doc, span, locale) {
  return doc.holidays
    .filter((h) => h.date >= span.from && h.date <= span.to)
    .map((h) => ({ date: h.date, name: h.name[locale] || h.name.en || Object.values(h.name)[0] }));
}

/** The file for a country's holidays. */
export const holidaysUrl = (country) => `/holidays/${country}.json`;
