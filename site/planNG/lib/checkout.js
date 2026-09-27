/* The checkout: the shows the reader locked, gathered by festival, and the
 * places that sell them.
 *
 * The planner sells nothing itself. Each festival's registry entry says how its
 * tickets are sold (`ticketing.model`, one of scraper/festivals/registry.py's
 * TICKETING_MODELS), and that decides where checking out sends the reader: each
 * show's own page, one pass for the lot, or nowhere at all.
 *
 * Pure: no DOM, no fetch.
 */

/* What each way of selling asks the checkout to open. `perShow`: every show
 * that is not free is bought on its own page. Otherwise one page, the
 * festival's ticketing url, covers the festival, unless nothing is sold. */
export const TICKETING_MODELS = {
  "central-box-office": { perShow: true, sellsTickets: true },
  "per-event-seller": { perShow: true, sellsTickets: true },
  "festival-pass": { perShow: false, sellsTickets: true },
  "all-free": { perShow: false, sellsTickets: false },
  "other": { perShow: false, sellsTickets: true },
};

/* A festival that has not said, or names a way this page does not know yet,
 * is sent to its own site: the page can always say that much truthfully. */
const UNKNOWN = { perShow: false, sellsTickets: true };

/** How a festival's registry entry sells its tickets; `model` is null where it
 * has not said or names a way this page does not know. */
export function ticketingOf(festival) {
  const model = festival && festival.ticketing ? festival.ticketing.model : null;
  return { model: TICKETING_MODELS[model] ? model : null, ...(TICKETING_MODELS[model] || UNKNOWN) };
}

/**
 * The checkout for a set of locked shows.
 * @param {{slug, festivalId, title, date, start, ticketUrl, url, free}[]} items
 *   one per locked show, at its locked performance
 * @param {(id: string) => object|null} festivalById the registry entry for a festival id
 * @returns {{groups: {festivalId, model, items: {…, destination: string|null}[]}[],
 *   destinations: {url: string, festivalId: string, slugs: string[]}[]}}
 *   `destination` is where that show is bought, null when it needs no ticket
 *   or the festival's one page covers it; `destinations` is every place to
 *   open, once each, in the order the shows play.
 */
export function checkoutPlan(items, festivalById) {
  const sorted = [...items].sort(
    (a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`) || a.slug.localeCompare(b.slug)
  );
  const groups = new Map();
  const destinations = new Map();
  const open = (url, festivalId, slug) => {
    if (!destinations.has(url)) destinations.set(url, { url, festivalId, slugs: [] });
    destinations.get(url).slugs.push(slug);
  };
  for (const item of sorted) {
    const festival = festivalById(item.festivalId);
    const how = ticketingOf(festival);
    if (!groups.has(item.festivalId)) {
      groups.set(item.festivalId, { festivalId: item.festivalId, model: how.model, items: [] });
    }
    const home = (festival && festival.ticketing && festival.ticketing.url) || (festival && festival.site) || null;
    let destination = null;
    if (how.sellsTickets && item.free !== true) {
      destination = how.perShow ? item.ticketUrl || item.url || home : null;
      const url = destination || home;
      if (url) open(url, item.festivalId, item.slug);
    }
    groups.get(item.festivalId).items.push({ ...item, destination });
  }
  return { groups: [...groups.values()], destinations: [...destinations.values()] };
}
