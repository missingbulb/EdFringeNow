/* The year across the top of the page, as layout maths.
 *
 * Which twelve months it spans, where each month and each festival edition
 * falls along it, and which festivals take the rows, in what order and on
 * which row. The renderer in ../planNG.js turns fractions into
 * pixels; nothing here touches the DOM, so the rules are testable as rules.
 *
 * One bar per edition, always: an edition is drawn from the registry's dates,
 * never from its programme, so a festival of ten thousand performances costs
 * the timeline exactly what a festival of ten does.
 */

const DAY_MS = 86400000;
const ms = (iso) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t) => new Date(t).toISOString().slice(0, 10);

/**
 * Twelve whole months, starting with the month before today's — so a festival
 * that has just finished is still on screen, and next year's is too.
 * @returns {{from: string, to: string, days: number}} inclusive ISO dates
 */
export function timelineSpan(todayISO) {
  const [y, m] = todayISO.split("-").map(Number);
  const start = Date.UTC(y, m - 2, 1);
  const end = Date.UTC(y, m + 10, 1) - DAY_MS;
  return { from: iso(start), to: iso(end), days: Math.round((end - start) / DAY_MS) + 1 };
}

/** Where a day's start falls along the span, 0..1. */
export function dayFrac(span, dateISO) {
  return (ms(dateISO) - ms(span.from)) / (span.days * DAY_MS);
}

/** The first day of each month in the span, with where it falls. */
export function monthTicks(span) {
  const ticks = [];
  const [y, m] = span.from.split("-").map(Number);
  for (let i = 0; i < 12; i++) {
    const at = iso(Date.UTC(y, m - 1 + i, 1));
    ticks.push({ date: at, frac: dayFrac(span, at) });
  }
  return ticks;
}

/**
 * One bar per edition that overlaps the span.
 * @param {{festivals: object[]}} registry site/data/festivals/index.json
 * @returns {{key, festival, edition, start, end, hasData}[]} `start`/`end` are
 *   fractions of the span, clipped to it; `end` covers the last day whole
 */
export function timelineBars(registry, span) {
  const bars = [];
  for (const festival of registry.festivals) {
    for (const edition of festival.editions) {
      if (edition.lastDate < span.from || edition.firstDate > span.to) continue;
      const start = Math.max(0, dayFrac(span, edition.firstDate));
      const end = Math.min(1, dayFrac(span, edition.lastDate) + 1 / span.days);
      bars.push({
        key: editionKey(festival.id, edition.id),
        festival,
        edition,
        start,
        end,
        hasData: Boolean(edition.dataUrl),
      });
    }
  }
  return bars.sort((a, b) => a.start - b.start || a.festival.id.localeCompare(b.festival.id));
}

/* How searched a festival is: what the festival finder measured, else the
 * events its programme holds; unknown ranks below every known count. */
function searchedOf(bar) {
  const measured = bar.festival.popularity ?? bar.edition.events;
  return measured == null ? -1 : measured;
}

/**
 * The bars in the order the year's rows take them: the festival leading the
 * trip first, then the most searched, a longer run first among equals.
 * @param {object[]} bars from timelineBars()
 * @param {string|null} focusKey
 * @returns {object[]} a sorted copy
 */
export function rankBars(bars, focusKey) {
  return [...bars].sort(
    (a, b) =>
      Number(b.key === focusKey) - Number(a.key === focusKey) ||
      searchedOf(b) - searchedOf(a) ||
      b.end - b.start - (a.end - a.start) ||
      a.start - b.start
  );
}

/**
 * Which row each festival takes, in the order given, until the rows are
 * `fill` full. A festival keeps `gap` clear of its neighbours on its row; a
 * long one goes to the free row holding the fewest long ones, any other to
 * the first free row; one that fits no row is passed over.
 * @param {{from: number, to: number, long?: boolean}[]} extents in rank order
 * @param {{rows: number, width: number, gap: number, fill: number}} o
 * @returns {number[]} each festival's row, or -1 for one left off the rows
 */
export function fillRows(extents, { rows, width, gap, fill }) {
  const taken = Array.from({ length: rows }, () => []);
  const longs = new Array(rows).fill(0);
  let used = 0;
  return extents.map(({ from, to, long }) => {
    if (used >= fill * rows * width) return -1;
    const free = taken.flatMap((claims, row) => (claims.every(([a, b]) => to + gap <= a || from >= b + gap) ? [row] : []));
    if (!free.length) return -1;
    const row = long ? free.reduce((best, r) => (longs[r] < longs[best] ? r : best), free[0]) : free[0];
    taken[row].push([from, to]);
    if (long) longs[row]++;
    used += to - from + gap;
    return row;
  });
}

/** The one spelling of "this edition of this festival" the page keys on. */
export function editionKey(festivalId, editionId) {
  return `${festivalId}@${editionId}`;
}

