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

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const nextDay = (iso, by) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

/**
 * The breaks the holidays make: each run of days off around a holiday, the
 * country's weekend included, carried over any single work day that has days
 * off on both sides. Only breaks that reach into the span are kept.
 * @param {{weekend?: string[], holidays: {date: string, name: object}[]}} doc
 * @param {{from: string, to: string}} span
 * @param {string} locale the page's language
 * @returns {{from: string, to: string, days: number, workdays: number, weekend: boolean, names: string[]}[]}
 */
export function holidayBreaks(doc, span, locale) {
  const weekend = new Set(doc.weekend || ["sat", "sun"]);
  const named = new Map();
  for (const h of doc.holidays) {
    const name = h.name[locale] || h.name.en || Object.values(h.name)[0];
    named.set(h.date, [...(named.get(h.date) || []), name]);
  }
  const isWeekend = (iso) => weekend.has(DAY_NAMES[new Date(`${iso}T12:00:00Z`).getUTCDay()]);
  const off = (iso) => named.has(iso) || isWeekend(iso);
  // One step outwards: the next day off, or the day beyond a lone work day.
  const reach = (iso, dir) => {
    if (off(nextDay(iso, dir))) return { to: nextDay(iso, dir), bridged: 0 };
    if (off(nextDay(iso, 2 * dir))) return { to: nextDay(iso, 2 * dir), bridged: 1 };
    return null;
  };
  const breaks = [];
  let covered = "";
  for (const date of [...named.keys()].sort()) {
    if (date <= covered) continue;
    let from = date;
    let to = date;
    let workdays = 0;
    for (let step; (step = reach(from, -1)); from = step.to) workdays += step.bridged;
    for (let step; (step = reach(to, 1)); to = step.to) workdays += step.bridged;
    covered = to;
    if (to < span.from || from > span.to) continue;
    const days = [];
    for (let d = from; d <= to; d = nextDay(d, 1)) days.push(d);
    breaks.push({
      from,
      to,
      days: days.length,
      workdays,
      weekend: days.some(isWeekend),
      names: withoutRepeats([...new Set(days.flatMap((d) => named.get(d) || []))]),
    });
  }
  return breaks;
}

/* A holiday moved off a weekend is listed twice, once as "(observed)"; in one
 * break the reader needs its name only once. */
const withoutRepeats = (names) => names.filter((n) => !/ \(observed\)$/.test(n) || !names.includes(n.replace(/ \(observed\)$/, "")));

/** The file for a country's holidays. */
export const holidaysUrl = (country) => `/holidays/${country}.json`;
