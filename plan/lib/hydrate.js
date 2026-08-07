// Rehydrate the compact planner catalogue (data/normalized/shows.min.json) back
// into the full show records the engine consumes, using the shared venues.json
// lookups and the availability sidecar (data/normalized/availability.min.json).
// This is the exact inverse of scraper/minify_master() + build_availability() in
// scraper/normalize.py — keep the two in step.
//
// Pure: no DOM, no fetch. plan.js wires it to the network; the unit tests in
// __tests__/hydrate.test.mjs round-trip the real committed files through it.

// Every listing image is one GUID served from this host; the wire form stores
// only the GUID (scraper/normalize.py strips the prefix) and it is re-attached
// here, over https so it isn't blocked as mixed content. A value that already
// carries a scheme is treated as an absolute url and only upgraded to https.
export const IMAGE_HOST_PREFIX = "https://registration.edfringe.com/resource/image/";

export function imageUrl(ref) {
  if (!ref) return null;
  if (/^https?:\/\//i.test(ref)) return ref.replace(/^http:\/\//i, "https://");
  return IMAGE_HOST_PREFIX + ref;
}

/** MMDD int back to an ISO date in the festival year: (807, 2026) -> "2026-08-07". */
export function mmddToDate(mmdd, year) {
  const s = String(mmdd).padStart(4, "0");
  return `${year}-${s.slice(0, 2)}-${s.slice(2)}`;
}

/**
 * Name each of a show's wire performances, matching scraper/normalize.py's
 * performance_keys: ["807|21:15", "807|21:15#1", ...].
 *
 * The catalogue and the availability sidecar are cached on different clocks —
 * days for the catalogue, a day for availability — so they are routinely joined
 * across generations. Naming a performance by its date and start time (rather
 * than by its position in the array) means a show that gained or lost a date
 * since the cached catalogue was written simply finds no status for the
 * performances that moved, instead of quietly picking up its neighbour's.
 *
 * The exception is the handful of shows that list the same date and start twice
 * with different statuses (a preview and a regular sitting): those get a "#n"
 * suffix by position, because nothing in the data distinguishes them.
 *
 * @param {{d: number, s: string}[]} performances the wire form's `p` array
 * @returns {string[]} one key per performance, in the same order
 */
export function performanceKeys(performances) {
  const seen = new Map();
  return (performances || []).map((p) => {
    const base = `${p.d}|${p.s}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}

/**
 * Read one performance's availability out of the sidecar.
 *
 * A missing show, a missing key, or no sidecar at all all mean the same thing:
 * we don't know. `status: null` is exactly how the catalogue used to represent
 * an absent status, so every consumer already handles it.
 *
 * @param {object|null} availability parsed availability.min.json ({v, ts, a, o})
 * @param {string} showId
 * @param {string} key one of performanceKeys(show.p)
 * @returns {{status: string|null, soldOut: boolean}}
 */
export function performanceAvailability(availability, showId, key) {
  if (!availability) return { status: null, soldOut: false };
  const statuses = availability.ts || [];
  const ix = (availability.a || {})[showId];
  const at = ix ? ix[key] : undefined;
  const soldKeys = (availability.o || {})[showId];
  return {
    status: typeof at === "number" ? statuses[at] ?? null : null,
    soldOut: Array.isArray(soldKeys) && soldKeys.includes(key),
  };
}

/**
 * Rebuild the full show catalogue from the compact wire records + venues.json
 * lookups. Lossless: the records returned match the master shows.json, with
 * image/smallImage resolved to absolute https urls (the intended client form).
 *
 * Ticket status and soldOut do NOT come from the catalogue — they are the two
 * fields that move through the day, so they ship in their own sidecar
 * (availability.min.json) and are joined back on here. Without it every
 * performance is simply status-unknown, which is a state the engine and the
 * grid already draw: the planner stays usable if that fetch fails.
 *
 * @param {object[]} wire   parsed shows.min.json
 * @param {object}   lookups parsed venues.json ({venues, rooms, genres,
 *                           subgenres, ticketStatuses, ageRestrictions})
 * @param {number}   year    festival year the MMDD dates belong to
 * @param {object|null} availability parsed availability.min.json, or null
 * @returns {object[]} full show records
 */
export function rehydrateShows(wire, lookups, year = 2026, availability = null) {
  const { venues = {}, rooms = [], genres = [], subgenres = [],
          ageRestrictions = [] } = lookups || {};
  const at = (list, i) => (i >= 0 ? list[i] : null);
  return (wire || []).map((r) => {
    const room = at(rooms, r.rm);
    // venueName was dropped when it rebuilds from the venue code + room; the wire
    // form only carries `vn` for shows whose name can't be reconstructed.
    let venueName;
    if ("vn" in r) {
      venueName = r.vn;
    } else {
      const name = venues[r.v] ? venues[r.v].name : null;
      venueName = room ? `${room} at ${name}` : name;
    }
    const image = imageUrl(r.im);
    const perfKeys = performanceKeys(r.p);
    return {
      id: r.i,
      title: r.t,
      slug: r.sl,
      genre: at(genres, r.g),
      subgenres: (r.sg || []).map((i) => subgenres[i]),
      company: r.c ?? null,
      duration: r.d ?? null,
      ageRestriction: at(ageRestrictions, r.ar),
      free: r.f === 1,
      image,
      // smallImage is dropped when identical to image; the client mirrors it.
      smallImage: "si" in r ? imageUrl(r.si) : image,
      blurb: r.b ?? "",
      venue: r.v ?? null,
      venueName,
      room,
      performances: (r.p || []).map((p, i) => {
        const { status, soldOut } = performanceAvailability(availability, r.i, perfKeys[i]);
        return { date: mmddToDate(p.d, year), start: p.s, soldOut, status };
      }),
      // Real ticket prices in pounds, or null when the price cache doesn't
      // know this show. null is NOT £0 — only `free` means free. `px` is
      // dropped when the show has a single band, so max mirrors min.
      priceMin: r.pm ?? null,
      priceMax: r.px ?? r.pm ?? null,
    };
  });
}
