/* Ticket prices, shared by both front-ends.
 *
 * Until the price scrape landed the site knew only "free" or "paid", because
 * that is all the listing API says. Real amounts now come from a separate
 * per-performance query, cached once into data/prices.json and folded into the
 * data files as `priceMin` / `priceMax` (pounds — see scraper/SCRAPING.md).
 *
 * Which forces one distinction on every consumer:
 *
 *   free      the show costs nothing        priceMin === 0
 *   priced    we know what it costs         priceMin is a number > 0
 *   unknown   we have no price for it       priceMin is null
 *
 * **Unknown is not free, and it is not "expensive" either.** The price cache is
 * fetched once and the festival keeps adding shows, so unknowns are normal and
 * permanent, not a bug to design around. A price filter therefore has to say
 * what it does with them, and both pages here make the same call: an active
 * price cap EXCLUDES unknown-price shows, because a filter must never claim a
 * show matches on data it doesn't have. Free is the one bucket that can't be
 * wrong — the listing's own flag says so.
 *
 * Both pages import this as `../shared/price.js`.
 */

/**
 * A show's cheapest ticket in pounds, or null when the price isn't known.
 *
 * Reads `priceMin` — the lowest band the show sells, which is what "can I see
 * something for under a tenner" actually asks about. Falls back to the `free`
 * flag so a catalogue cached before prices shipped (or a free show the price
 * pass skipped, having nothing to price) still answers £0 rather than unknown.
 *
 * @param {object} show a rehydrated catalogue show or an adapted day record
 * @returns {number|null} pounds, or null when unknown
 */
export function showPrice(show) {
  if (!show) return null;
  if (typeof show.priceMin === "number" && Number.isFinite(show.priceMin)) {
    return show.priceMin;
  }
  return show.free ? 0 : null;
}

/** The dearest band in pounds, or the cheapest when the show has only one. */
export function showPriceMax(show) {
  if (!show) return null;
  if (typeof show.priceMax === "number" && Number.isFinite(show.priceMax)) {
    return show.priceMax;
  }
  return showPrice(show);
}

/** Pounds as money: whole amounts lose the ".00" ("£12", not "£12.00"). */
export function formatPounds(pounds) {
  if (!Number.isFinite(pounds)) return "";
  return `£${Number.isInteger(pounds) ? pounds : pounds.toFixed(2)}`;
}

/**
 * What a show costs, as a card would say it: "Free", "£12", "£12–£18", or
 * "Price TBC" when we have nothing.
 *
 * The range is shown only when the show really has more than one band —
 * "£12–£12" is noise, and a single-band show is the common case.
 *
 * @param {object} show
 * @returns {string}
 */
export function priceLabel(show) {
  const min = showPrice(show);
  if (min === null) return "Price TBC";
  if (min === 0) return "Free";
  const max = showPriceMax(show);
  return max > min ? `${formatPounds(min)}–${formatPounds(max)}` : formatPounds(min);
}

/**
 * The price bands the filters offer, cheapest first.
 *
 * One ladder, used by the Now page's "$" chip and the planner's price facet, so
 * the two pages can't drift into offering different money. Each is a *cap*
 * ("£15 and under") rather than a slice, because that is the question a
 * Fringe-goer with a budget asks — and cumulative caps mean a wider budget can
 * only ever add shows, never swap them out.
 *
 * `free` is its own bucket rather than "≤ £0": free shows are the one group the
 * listing flag identifies perfectly, so that option is always trustworthy even
 * where the price cache has gaps.
 */
export const PRICE_CAPS = [10, 15, 20, 30];

/**
 * The `$` chip / facet options in display order: any, free, then each cap.
 *
 * Two labels each, because the two places these are rendered have very
 * different room. `label` is the unambiguous one ("Up to £15") — used wherever
 * it must stand alone: the chip's own value text, aria-labels, the planner's
 * facet list. `short` is for the compact segmented control, where six options
 * share one narrow dropdown and the surrounding "up to" is said once, by the
 * panel's own hint, instead of six times.
 *
 * "Up to", not "Under": the cap is inclusive, and a £10 ticket turning up under
 * "Under £10" is exactly the kind of small lie that loses trust.
 */
export const PRICE_OPTIONS = [
  { value: "any", label: "Any price", short: "Any" },
  { value: "free", label: "Free", short: "Free" },
  ...PRICE_CAPS.map((c) => ({ value: String(c), label: `Up to £${c}`, short: `£${c}` })),
];

/**
 * Does a show pass a price choice?
 *
 * @param {object} show
 * @param {string} choice one of PRICE_OPTIONS' values ("any" | "free" | "15")
 * @returns {boolean} unknown-price shows fail every choice but "any"
 */
export function matchesPrice(show, choice) {
  if (!choice || choice === "any") return true;
  const price = showPrice(show);
  if (price === null) return false;
  if (choice === "free") return price === 0;
  const cap = Number(choice);
  return Number.isFinite(cap) && price <= cap;
}
