/* Human-friendly durations, shared by both front-ends.
 *
 * A spare-time figure is a number the user has to *feel*, not audit. "You have
 * 287 min to spare" is arithmetically perfect and useless — nobody converts
 * that to "most of an afternoon" while standing on a street corner. So the
 * phrasing changes with the size of the gap, and precision is deliberately
 * traded away as the number grows:
 *
 *   under an hour   exact minutes          "45 minutes"
 *   one to two hrs  hours and minutes      "1 hour and 20 minutes"
 *   over two hours  nearest half hour      "about 2½ hours"
 *
 * The last band is the point of the whole module: past two hours the minutes
 * are noise, and rounding to the nearest half hour with an explicit "about"
 * is more honest about what the estimate is worth than a to-the-minute figure.
 *
 * Both pages import this as `../shared/duration.js` (which resolves to
 * `/shared/duration.js` from either).
 */

/* The band boundaries, in minutes. Exactly 60 and exactly 120 read as whole
 * hours ("1 hour" / "2 hours") rather than falling to a minutes-only or an
 * "about" phrasing — a round number should look round. */
const AN_HOUR = 60;
const TWO_HOURS = 120;

/** Pluralize a whole-number count: `unitize(1, "hour")` -> "1 hour". */
function unitize(n, unit) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/**
 * A duration in minutes, phrased the way a person would say it (see the bands
 * at the top of this file).
 *
 * Negative and non-finite inputs return an empty string: this formats a
 * quantity of spare time, and "minus 20 minutes to spare" is not a sentence.
 * Callers that need to express a deficit (arriving late) say so themselves and
 * pass the absolute value.
 *
 * @param {number} mins duration in minutes
 * @returns {string} e.g. "45 minutes", "1 hour and 20 minutes", "about 2½ hours"
 */
export function friendlyDuration(mins) {
  if (!Number.isFinite(mins) || mins < 0) return "";
  const m = Math.round(mins);

  if (m < AN_HOUR) return unitize(m, "minute");

  if (m <= TWO_HOURS) {
    const hours = Math.floor(m / AN_HOUR);
    const rest = m - hours * AN_HOUR;
    // 120 floors to 2 hours with nothing left over, so exactly two hours reads
    // as "2 hours" and never reaches the "about" band below.
    if (rest === 0) return unitize(hours, "hour");
    return `${unitize(hours, "hour")} and ${unitize(rest, "minute")}`;
  }

  // Past two hours: round to the nearest half hour and admit the imprecision.
  const halves = Math.round(m / 30);
  const hours = Math.floor(halves / 2);
  const half = halves % 2 === 1;
  const label = half ? `${hours}½ hours` : unitize(hours, "hour");
  return `about ${label}`;
}
