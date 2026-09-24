/* A festival edition's serving block, turned into what the planning engine plans.
 *
 * `site/data/festivals/<festival>/<edition>.json` is festival-oblivious: every
 * festival's block has the same fields (the contract is scraper/festivals/README.md,
 * enforced by scraper/convert/schema.py). The engine in plan/lib/ speaks the
 * Edinburgh catalogue's vocabulary; this module is the one place the two meet,
 * so a page never sees a serving record and the engine never learns a second
 * shape. The registry `site/data/festivals/index.json` says which festivals and
 * editions exist and where each block lives.
 *
 * Pure apart from the two fetches.
 */

export const SCHEMA_VERSION = 1;
export const INDEX_URL = "/data/festivals/index.json";

/* Engine statuses. The engine reads `status` through the Edinburgh denylist, so
 * only a sold-out performance is marked with one that stops it scheduling. A
 * performance no availability source speaks for is "unknown", and unknown
 * means available — the same rule the Edinburgh pages keep — so it is marked
 * on sale, or free to attend when the source says it is free. */
const ENGINE_STATUS = { soldOut: "SOLD_OUT", onSale: "TICKETS_AVAILABLE", free: "FREE_NON_TICKETED" };

/** Fetch the festival registry. */
export async function loadFestivalIndex(url = INDEX_URL) {
  return checkVersion(await getJson(url), url);
}

/** Fetch one edition's block and adapt it. */
export async function loadFestival(url) {
  return adaptFestival(await getJson(url));
}

/**
 * The edition a reader most likely means on `todayISO`: the one running, else
 * the next to start, else the most recent. Only editions with data count.
 * @returns the edition entry from the registry, or null
 */
export function currentEdition(festivalEntry, todayISO) {
  const loadable = festivalEntry.editions.filter((e) => e.dataUrl);
  if (!loadable.length) return null;
  const running = loadable.find((e) => e.firstDate <= todayISO && todayISO <= e.lastDate);
  if (running) return running;
  const upcoming = loadable.filter((e) => e.firstDate > todayISO).sort((a, b) => a.firstDate.localeCompare(b.firstDate));
  if (upcoming.length) return upcoming[0];
  return [...loadable].sort((a, b) => b.lastDate.localeCompare(a.lastDate))[0];
}

/**
 * The pure half of loadFestival.
 * @returns {{festival: object, venues: Map<string, object>, shows: object[], categories: {slug, name}[]}}
 */
export function adaptFestival(block) {
  checkVersion(block, "festival block");
  const venues = new Map();
  for (const venue of block.venues) {
    // `code` is the key the engine and the pages already look venues up by.
    venues.set(venue.id, { code: venue.id, ...venue });
  }
  const categoryName = new Map(block.categories.map((c) => [c.id, c.name]));

  const performancesByEvent = new Map();
  for (const p of block.performances) {
    if (!performancesByEvent.has(p.eventId)) performancesByEvent.set(p.eventId, []);
    performancesByEvent.get(p.eventId).push(p);
  }

  const shows = block.events.map((event) => {
    const performances = performancesByEvent.get(event.id) || [];
    const venueCodes = [...new Set(performances.map((p) => p.venueId).filter(Boolean))];
    // The engine plans one venue per show; a show playing several is given its
    // first and the lane names all of them.
    const venueCode = venueCodes[0] || null;
    const venue = venueCode ? venues.get(venueCode) : null;
    return {
      slug: event.id,
      title: event.title,
      url: event.url,
      // The engine draws a genre emoji and the CSV exports a Genre column; the
      // festival's own categories are what it has to say there.
      genre: event.categories.length ? categoryName.get(event.categories[0]) : null,
      genreSlug: event.categories[0] || null,
      // Every kind the show is filed under: the question that asks what the
      // reader came for matches against all of them.
      genreSlugs: event.categories,
      blurb: event.blurb,
      // Null stays null: the scheduler reads it to decide whether two shows
      // clash, and a guessed length would invent a clash or hide one.
      duration: event.durationMin,
      venue: venueCode,
      venueName: venue ? venue.name : null,
      venueNames: venueCodes.map((code) => (venues.get(code) || {}).name).filter(Boolean),
      performances: performances.map((p) => ({
        date: p.date,
        start: p.start,
        status: engineStatus(p),
        soldOut: p.status === "sold-out",
        ticketUrl: p.ticketUrl,
        free: p.free,
        venue: p.venueId,
      })),
      // The title in the festival's own language, present only when the block
      // has one: most festivals' `title` already is that language.
      ...(event.titleLocal != null ? { titleLocal: event.titleLocal } : {}),
    };
  });

  return {
    festival: block.festival,
    venues,
    shows,
    categories: block.categories.map((c) => ({ slug: c.id, name: c.name })),
  };
}

function engineStatus(performance) {
  if (performance.status === "sold-out") return ENGINE_STATUS.soldOut;
  return performance.free ? ENGINE_STATUS.free : ENGINE_STATUS.onSale;
}

/** Every night the programme uses, ascending — the grid's columns. */
export function festivalDates(shows) {
  return [...new Set(shows.flatMap((s) => s.performances.map((p) => p.date)))].sort();
}

/** `Map(venueCode -> {lat, lng})`, the lookup the engine's travel maths wants. */
export function venueCoords(venues) {
  const coords = new Map();
  for (const [code, venue] of venues) {
    if (venue.lat != null && venue.lng != null) coords.set(code, { lat: venue.lat, lng: venue.lng });
  }
  return coords;
}

async function getJson(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

/* A block from a newer converter is refused rather than half-read: a field this
 * loader does not know would otherwise decode as missing, i.e. as unknown. */
function checkVersion(doc, what) {
  if (!doc || doc.v !== SCHEMA_VERSION) {
    throw new Error(`${what}: schema v${doc && doc.v}, this page reads v${SCHEMA_VERSION}`);
  }
  return doc;
}
