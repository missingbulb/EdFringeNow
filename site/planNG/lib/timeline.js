/* The year across the top of the page, as layout maths.
 *
 * Which twelve months it spans, where each month and each festival edition
 * falls along it, and which row an edition's bar sits on so that no bar or
 * label hides another. The renderer in ../planNG.js turns fractions into
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

/** The one spelling of "this edition of this festival" the page keys on. */
export function editionKey(festivalId, editionId) {
  return `${festivalId}@${editionId}`;
}

/**
 * Rows for the bars, so no two overlap. Each bar claims the stretch its bar
 * and its label cover together; a bar goes on the first row whose last claim
 * ended before this one starts.
 * @param {{from: number, to: number}[]} extents in any unit, one per bar, in
 *   the bars' order
 * @param {number} gap the space two claims on one row must keep between them
 * @returns {number[]} the row of each bar
 */
export function stackRows(extents, gap = 0) {
  const rowEnds = [];
  return extents.map(({ from, to }) => {
    let row = rowEnds.findIndex((end) => end + gap <= from);
    if (row === -1) {
      row = rowEnds.length;
      rowEnds.push(to);
    } else {
      rowEnds[row] = to;
    }
    return row;
  });
}
