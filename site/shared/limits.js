/* How much a planner page draws at once.
 *
 * A festival programme can run to hundreds of events and a planning period can
 * pool several festivals, so every list a page renders goes through
 * `listPage()` rather than drawing whatever it is handed. The numbers are the
 * product's, in one place, so a page never grows a cap of its own.
 *
 * Pure: no DOM.
 */

/* The most rows any one list draws before it offers "show more". */
export const LIST_PAGE_ROWS = 200;

/* Above this many items a list with no query asks for a search first instead
 * of drawing the first page of an alphabet nobody will scroll. */
export const SEARCH_FIRST_ABOVE = 100;

/* The most matches a search popover draws. */
export const SEARCH_RESULT_ROWS = 40;

/* The most options a search filter lists. The Fringe plays in some three
 * hundred venues; past this many a checkbox list is a scroll nobody finishes,
 * and the search itself already matches a venue by name. */
export const FACET_OPTIONS = 30;

/* The most rivals the "who else wanted this hour" popover names. A Fringe
 * evening can have fifty shows starting at the same minute. */
export const RIVAL_ROWS = 8;

/* The longest planning period, in days. The calendar draws a column per day,
 * and past a month it is a list of columns rather than a calendar. */
export const MAX_PERIOD_DAYS = 31;

/**
 * Which rows of a list to draw.
 * @param {Array} items every item the list could show, already filtered
 * @param {{query?: string, pages?: number}} opts `query` is whatever the reader
 *   typed (empty when nothing); `pages` how many pages they have asked for
 * @returns {{rows: Array, total: number, more: number, searchFirst: boolean}}
 *   `rows` to draw; `more` how many are held back behind "show more";
 *   `searchFirst` when nothing is drawn because the list is too long to browse
 */
export function listPage(items, { query = "", pages = 1 } = {}) {
  const total = items.length;
  if (!query && total > SEARCH_FIRST_ABOVE) {
    return { rows: [], total, more: total, searchFirst: true };
  }
  const rows = items.slice(0, LIST_PAGE_ROWS * Math.max(1, pages));
  return { rows, total, more: total - rows.length, searchFirst: false };
}

/**
 * The first `cap` of a ranked list of options, plus any beyond it that are
 * already chosen — a choice the reader made never disappears behind the cap.
 * @param {Array} ranked every option, most useful first
 * @param {(item) => boolean} isChosen
 * @param {number} cap
 * @returns {{rows: Array, more: number}} `more` how many are left unlisted
 */
export function capOptions(ranked, isChosen, cap) {
  const rows = ranked.filter((item, i) => i < cap || isChosen(item));
  return { rows, more: ranked.length - rows.length };
}
