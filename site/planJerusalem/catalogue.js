/* The Jerusalem catalogue, adapted to the shape the planning engine consumes.
 *
 * `data/jerusalem/shows.json` is the scrape's own file (see
 * scraper/jerusalem/); the engine in plan/lib/ speaks the Edinburgh catalogue's
 * vocabulary. This module is the one place the two meet, so the page below it
 * never sees a raw scrape record and the engine never learns a second shape.
 *
 * Pure apart from the fetch: everything else is a rename.
 */

/* Availability semantics for a festival that publishes none.
 *
 * This programme has no live ticket feed, no sold-out signal and no
 * cancellations — the source simply says a performance exists. The engine reads
 * `status` through the Edinburgh denylist, so a performance is marked with the
 * status that means what is actually true here: it is on sale, or it is free to
 * attend. Neither is in the denylist, so both schedule. Inventing a
 * "TICKETS_AVAILABLE" for a free late-night with no ticket at all would be a
 * claim the source never made.
 */
const ON_SALE = "TICKETS_AVAILABLE";
const FREE = "FREE_NON_TICKETED";

/**
 * Fetch and adapt the festival catalogue.
 * @param {string} url the catalogue's URL, relative to the page
 * @returns {Promise<{festival: object, venues: Map, shows: object[], categories: Array}>}
 */
export async function loadCatalogue(url) {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return adaptCatalogue(await response.json());
}

/** The pure half of loadCatalogue, so it can be exercised without a network. */
export function adaptCatalogue(raw) {
  const venues = new Map();
  for (const venue of raw.venues || []) {
    venues.set(venue.code, venue);
  }

  const shows = (raw.shows || []).map((show) => {
    const venueCodes = [...new Set(show.performances.map((p) => p.venue).filter(Boolean))];
    // Every show in this programme plays one venue, but the shape allows more,
    // so the engine is given the first and the lane names all of them.
    const venueCode = venueCodes[0] || null;
    const venue = venueCode ? venues.get(venueCode) : null;
    return {
      slug: show.slug,
      title: show.title,
      url: show.url,
      // The engine draws a genre emoji and the CSV exports a Genre column; the
      // festival's own categories are what it has to say there.
      genre: show.categoryNames[0] || null,
      genreSlug: show.categories[0] || null,
      // Every kind the show is filed under, not just the first: the question
      // that asks what the reader came for matches against all of them.
      genreSlugs: show.categories || [],
      blurb: show.description || null,
      // Four shows publish no running time. Left null, never defaulted: the
      // scheduler reads it to decide whether two shows clash, and a guessed
      // length would invent a clash or hide one.
      duration: show.duration,
      venue: venueCode,
      venueName: venue ? venue.name : null,
      venueNames: venueCodes.map((code) => (venues.get(code) || {}).name).filter(Boolean),
      performances: show.performances.map((p) => ({
        date: p.date,
        start: p.start,
        status: p.free ? FREE : ON_SALE,
        soldOut: false,
        ticketUrl: p.ticketUrl,
        free: p.free,
        venue: p.venue,
      })),
    };
  });

  return {
    festival: raw.festival,
    venues,
    shows,
    categories: (raw.categories || []).map(([slug, name]) => ({ slug, name })),
  };
}

/** Every night the programme uses, ascending — the grid's columns. */
export function festivalDates(shows) {
  return [...new Set(shows.flatMap((s) => s.performances.map((p) => p.date)))].sort();
}

/** `{ [venueCode]: {lat, lng} }`, the lookup the engine's travel maths wants. */
export function venueCoords(venues) {
  const coords = new Map();
  for (const [code, venue] of venues) {
    if (venue.lat != null && venue.lng != null) coords.set(code, { lat: venue.lat, lng: venue.lng });
  }
  return coords;
}
