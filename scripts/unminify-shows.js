#!/usr/bin/env node
/**
 * Restore minified shows data back to full format (inverse of dehydrate).
 */

const fs = require('fs');

const minifiedFile = process.argv[2] || '/tmp/minified-shows.json';

const minified = JSON.parse(fs.readFileSync(minifiedFile, 'utf8'));
const meta = minified.__meta;

// Create reverse lookup maps
const statusMap = meta.status.map((s, i) => [i, s]).reduce((acc, [i, s]) => {
  acc[i] = s;
  return acc;
}, {});

const genreMap = meta.genre.map((g, i) => [i, g]).reduce((acc, [i, g]) => {
  acc[i] = g;
  return acc;
}, {});

const subgenreMap = meta.subgenres.map((sg, i) => [i, sg]).reduce((acc, [i, sg]) => {
  acc[i] = sg;
  return acc;
}, {});

const ageRestrictionMap = meta.ageRestriction.map((ar, i) => [i, ar]).reduce((acc, [i, ar]) => {
  acc[i] = ar;
  return acc;
}, {});

const roomMap = meta.rooms.map((r, i) => [i, r]).reduce((acc, [i, r]) => {
  acc[i] = r;
  return acc;
}, {});

// Venue base names is an array of [venueId, baseName]
const venueBaseNameMap = meta.venueBaseName.map((v, i) => [i, v]).reduce((acc, [i, [venueId, baseName]]) => {
  acc[i] = [venueId, baseName];
  return acc;
}, {});

// Rehydrate shows - reconstruct venueName from room and venue base name
const restored = minified.shows.map(show => {
  const room = show.rm !== undefined ? roomMap[show.rm] : null;
  let venueName = show.vn || null; // use stored venueName if available (fallback case)

  if (show.vbi !== undefined && room) {
    const [venueId, baseName] = venueBaseNameMap[show.vbi];
    venueName = `${room} at ${baseName}`;
  }

  return {
    id: show.i,
    title: show.t,
    slug: show.sl,
    genre: show.g !== undefined ? genreMap[show.g] : null,
    subgenres: (show.sg || []).map(i => subgenreMap[i]).filter(Boolean),
    company: show.c,
    duration: show.d,
    ageRestriction: show.ar !== undefined ? ageRestrictionMap[show.ar] : null,
    free: show.f === 1,
    image: show.im,
    smallImage: show.si,
    blurb: show.b,
    venue: show.v,
    venueName: venueName,
    room: room,
    performances: (show.p || []).map(perf => {
      const mmdd = String(perf.d).padStart(4, '0');
      const month = mmdd.substring(0, 2);
      const day = mmdd.substring(2, 4);
      return {
        date: `2026-${month}-${day}`,
        start: perf.st,
        soldOut: perf.so === 1,
        status: statusMap[perf.sa],
      };
    }),
  };
});

console.log(JSON.stringify(restored));
