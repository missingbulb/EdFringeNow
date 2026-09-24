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
 * An edition's `format` in the registry says which of two shapes its data takes:
 * a serving block ("block"), or the Edinburgh Fringe's own wire files
 * ("edfringe-wire"), which this module adapts to the same result so the pages
 * never learn there are two.
 *
 * Pure apart from the fetches.
 */

import { showUrl } from "./edfringe.js";
import { loadEdfringeWire } from "./edfringe-wire.js";

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
 * Fetch one edition, whatever its format, and adapt it.
 * @param {object} festivalEntry the registry's festival
 * @param {object} edition one of its editions, with a `dataUrl`
 * @param {{onNote?: (err: unknown, url: string) => void}} [opts]
 */
export async function loadEdition(festivalEntry, edition, { onNote } = {}) {
  if (edition.format === "block") return loadFestival(edition.dataUrl);
  if (edition.format === "edfringe-wire") {
    const { catalogue, lookups } = await loadEdfringeWire(
      { catalogue: edition.dataUrl, lookups: edition.wire.lookups, availability: edition.wire.availability },
      { year: Number(edition.id), onNote }
    );
    return adaptEdfringe({ catalogue, lookups }, festivalEntry, edition);
  }
  throw new Error(`${festivalEntry.id} ${edition.id}: no loader for format ${edition.format}`);
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

/**
 * The Edinburgh Fringe's rehydrated catalogue (../plan/lib/hydrate.js), in the
 * same shape adaptFestival returns — the pure half of loadEdition for it.
 *
 * Edinburgh's records already speak the engine's vocabulary (its statuses are
 * the box office's own), so what changes is only what the festival planner
 * reads that the Fringe planner never needed: a festival identity, a venue map,
 * and the kinds a show is filed under. A show's kind is its genre; its
 * sub-genres are too many to ask about.
 *
 * @param {{catalogue: object[], lookups: object}} wire rehydrated shows and venues.json
 * @param {object} festivalEntry the registry's festival
 * @param {object} edition the registry's edition
 */
export function adaptEdfringe({ catalogue, lookups }, festivalEntry, edition) {
  const venues = new Map();
  for (const [code, v] of Object.entries(lookups.venues || {})) {
    venues.set(code, {
      code,
      id: code,
      name: v.name,
      address: v.address ?? null,
      lat: v.lat ?? null,
      lng: v.lng ?? null,
      capacity: null,
      layout: null,
      rooms: [],
    });
  }
  const kinds = new Map();
  const shows = catalogue.map((show) => {
    const kind = show.genre ? kindSlug(show.genre) : null;
    if (kind && !kinds.has(kind)) kinds.set(kind, show.genre);
    const url = showUrl(show.slug) || null;
    return {
      slug: show.slug,
      title: show.title,
      url,
      genre: show.genre,
      genreSlug: kind,
      genreSlugs: kind ? [kind] : [],
      blurb: show.blurb,
      duration: show.duration,
      venue: show.venue,
      venueName: show.venueName,
      venueNames: show.venueName ? [show.venueName] : [],
      performances: show.performances.map((p) => ({
        date: p.date,
        start: p.start,
        status: p.status,
        soldOut: p.soldOut,
        ticketUrl: url,
        free: show.free,
        venue: show.venue,
      })),
    };
  });
  // A handful of shows name a venue the lookups do not list (they carry their
  // own venue name instead). Each still gets a venue to be filtered by, with no
  // position: an unknown place, never a guessed one.
  for (const show of shows) {
    if (show.venue != null && !venues.has(show.venue)) {
      venues.set(show.venue, {
        code: show.venue, id: show.venue, name: show.venueName, address: null,
        lat: null, lng: null, capacity: null, layout: null, rooms: [],
      });
    }
  }
  const festival = {
    id: festivalEntry.id,
    edition: edition.id,
    ordinal: edition.ordinal,
    name: festivalEntry.name,
    nameLocal: festivalEntry.nameLocal,
    city: festivalEntry.city,
    country: festivalEntry.country,
    lat: festivalEntry.lat,
    lng: festivalEntry.lng,
    timezone: festivalEntry.timezone,
    lang: festivalEntry.lang,
    dir: festivalEntry.dir,
    kind: festivalEntry.kind,
    defaultGenre: festivalEntry.defaultGenre,
    site: festivalEntry.site,
    firstDate: edition.firstDate,
    lastDate: edition.lastDate,
    ticketing: null,
  };
  const categories = [...kinds]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([slug, name]) => ({ slug, name }));
  return { festival, venues, shows, categories };
}

/* "Dance, Physical Theatre & Circus" -> "dance-physical-theatre-circus". */
export const kindSlug = (name) =>
  name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

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
