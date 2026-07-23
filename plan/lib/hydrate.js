// Rehydrate the compact planner catalogue (data/normalized/shows.min.json) back
// into the full show records the engine consumes, using the shared venues.json
// lookups. This is the exact inverse of scraper/minify_master() in
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
 * Rebuild the full show catalogue from the compact wire records + venues.json
 * lookups. Lossless: the records returned match the master shows.json, with
 * image/smallImage resolved to absolute https urls (the intended client form).
 *
 * @param {object[]} wire   parsed shows.min.json
 * @param {object}   lookups parsed venues.json ({venues, rooms, genres,
 *                           subgenres, ticketStatuses, ageRestrictions})
 * @param {number}   year    festival year the MMDD dates belong to
 * @returns {object[]} full show records
 */
export function rehydrateShows(wire, lookups, year = 2026) {
  const { venues = {}, rooms = [], genres = [], subgenres = [],
          ticketStatuses = [], ageRestrictions = [] } = lookups || {};
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
      performances: (r.p || []).map((p) => ({
        date: mmddToDate(p.d, year),
        start: p.s,
        soldOut: p.o === 1,
        status: at(ticketStatuses, p.t),
      })),
    };
  });
}
