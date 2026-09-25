/* What the reader filters the pool by, as rules: the kinds every festival
 * shares, a festival's own tags required or ruled out, and festivals left out.
 *
 * The kinds are the data pipeline's genre vocabulary
 * (scraper/festivals/registry.py's GENRES), which every festival block's
 * events carry; Edinburgh's genres are mapped onto it here, since its wire
 * format predates the vocabulary. Tags are each festival's own categories, the
 * pool ids lib/pool.js gives them.
 *
 * Pure: no DOM, no storage.
 */

import { festivalOf } from "./pool.js";

/** The shared kinds, in the order the kinds chip offers them. */
export const GENRES = ["film", "comedy", "theatre", "dance", "music", "family", "talk", "other"];

export const GENRE_EMOJI = {
  film: "🎬",
  comedy: "😂",
  theatre: "🎭",
  dance: "💃",
  music: "🎵",
  family: "🧸",
  talk: "🗣️",
  other: "🎟️",
};

/* Edinburgh's genres, which its wire format names in full. */
const EDFRINGE_GENRE = {
  "Comedy": "comedy",
  "Theatre": "theatre",
  "Cabaret and Variety": "comedy",
  "Children's Shows": "family",
  "Dance, Physical Theatre & Circus": "dance",
  "Events": "other",
  "Exhibitions": "other",
  "Music": "music",
  "Musicals and Opera": "theatre",
  "Spoken Word": "talk",
};

/** A shared kind for anything a festival calls its genre; unknown is "other". */
export function sharedGenre(genre) {
  if (GENRES.includes(genre)) return genre;
  return EDFRINGE_GENRE[genre] || "other";
}

/**
 * Whether a show survives the reader's filters.
 * @param {{slug: string, genreSlugs?: string[]}} show a pool show
 * @param {{festivalsOut?: Set<string>, tags?: Map<string, "only"|"out">}} filters
 */
export function passesFilters(show, { festivalsOut = new Set(), tags = new Map() } = {}) {
  if (festivalsOut.has(festivalOf(show.slug))) return false;
  const filed = show.genreSlugs || [];
  if (filed.some((tag) => tags.get(tag) === "out")) return false;
  const required = [...tags].filter(([, mode]) => mode === "only").map(([tag]) => tag);
  return !required.length || filed.some((tag) => required.includes(tag));
}

/** A tag's next state when clicked: neutral → only → out → neutral. */
export function nextTagMode(mode) {
  return mode === "only" ? "out" : mode === "out" ? null : "only";
}
