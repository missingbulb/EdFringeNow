#!/usr/bin/env node
/**
 * Minify shows.json by applying aggressive enum mapping and field shortening.
 * Reduces file size by ~60-70%.
 */

const fs = require('fs');

const showsFile = '/home/user/EdFringeNow/data/normalized/shows.json';
const data = JSON.parse(fs.readFileSync(showsFile, 'utf8'));

// Build enum mappings by scanning data
const enums = {
  status: [],
  genre: [],
  subgenres: [],
  ageRestriction: [],
  rooms: [],
  venues: [],
};

const enumerations = {
  status: new Set(),
  genre: new Set(),
  subgenres: new Set(),
  ageRestriction: new Set(),
  rooms: new Set(),
  venueBaseName: new Map(), // venueId -> base name (without room)
};

// Scan all shows to extract unique values and build venue base names
data.forEach(show => {
  if (show.genre) enumerations.genre.add(show.genre);
  (show.subgenres || []).forEach(sg => enumerations.subgenres.add(sg));
  if (show.ageRestriction) enumerations.ageRestriction.add(show.ageRestriction);
  if (show.room) enumerations.rooms.add(show.room);

  // Extract venue base name from venueName by removing room prefix
  if (show.venue && show.venueName && show.room) {
    const escapedRoom = show.room.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const venueBase = show.venueName.replace(new RegExp(`^${escapedRoom}\\s+at\\s+`), '');
    enumerations.venueBaseName.set(show.venue, venueBase);
  }

  (show.performances || []).forEach(perf => {
    if (perf.status) enumerations.status.add(perf.status);
  });
});

// Convert to sorted arrays for consistent indexing
enums.status = Array.from(enumerations.status).sort();
enums.genre = Array.from(enumerations.genre).sort();
enums.subgenres = Array.from(enumerations.subgenres).sort();
enums.ageRestriction = Array.from(enumerations.ageRestriction).sort();
enums.rooms = Array.from(enumerations.rooms).sort();
enums.venueBaseName = Array.from(enumerations.venueBaseName.entries())
  .sort((a, b) => (a[0] || '').localeCompare(b[0] || ''))
  .map(([id, name]) => [id, name]);

// Create lookup maps for encoding
const statusMap = new Map(enums.status.map((s, i) => [s, i]));
const genreMap = new Map(enums.genre.map((g, i) => [g, i]));
const subgenreMap = new Map(enums.subgenres.map((sg, i) => [sg, i]));
const ageRestrictionMap = new Map(enums.ageRestriction.map((ar, i) => [ar, i]));
const roomMap = new Map(enums.rooms.map((r, i) => [r, i]));
const venueBaseNameMap = new Map(enums.venueBaseName.map((v, i) => [v[0], i]));

// Minify shows
const minified = data.map(show => ({
  i: show.id,
  t: show.title,
  sl: show.slug,
  g: genreMap.get(show.genre),
  sg: (show.subgenres || []).map(sg => subgenreMap.get(sg)).filter(x => x !== undefined),
  c: show.company,
  d: show.duration,
  ar: ageRestrictionMap.get(show.ageRestriction),
  f: show.free ? 1 : 0,
  im: show.image,
  si: show.smallImage,
  b: show.blurb,
  v: show.venue,
  vbi: show.venue && show.room ? venueBaseNameMap.get(show.venue) : undefined, // venue base name index
  rm: roomMap.get(show.room),
  vn: !show.room && show.venueName ? show.venueName : undefined, // fallback: store full venueName if no room
  p: (show.performances || []).map(perf => {
    const [year, month, day] = perf.date.split('-');
    return {
      d: parseInt(month + day, 10), // MMDD format (e.g., 0824 for Aug 24)
      st: perf.start,
      so: perf.soldOut ? 1 : 0,
      sa: statusMap.get(perf.status),
    };
  }),
}));

// Build output with metadata
const output = {
  __meta: {
    status: enums.status,
    genre: enums.genre,
    subgenres: enums.subgenres,
    ageRestriction: enums.ageRestriction,
    rooms: enums.rooms,
    venueBaseName: enums.venueBaseName, // [venueId, baseName]
  },
  shows: minified,
};

console.log(JSON.stringify(output));
