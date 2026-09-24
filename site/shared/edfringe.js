// Links out to edfringe.com, the official Fringe site.
//
// Both front-ends send people there — the Now page to read what a show actually
// is (and to buy a ticket), the planner to open a favourite — so the URL shape
// lives here rather than being spelled out on each page.

/**
 * The canonical page for one show: its blurb, images, reviews and box office.
 * Returns "" when the show carries no slug, so callers can test the result and
 * render no link at all rather than a link to nowhere.
 * @param {string} slug
 * @returns {string}
 */
export function showUrl(slug) {
  return slug ? `https://www.edfringe.com/tickets/whats-on/${encodeURIComponent(slug)}` : "";
}

/* The Fringe's ten headline genres, each with the small picture both planners
 * draw beside a show of that genre; anything else falls back to a ticket. */
export const GENRE_EMOJI = {
  "Comedy": "😂",
  "Theatre": "🎭",
  "Cabaret and Variety": "🎪",
  "Children's Shows": "🧸",
  "Dance, Physical Theatre & Circus": "💃",
  "Events": "✨",
  "Exhibitions": "🖼️",
  "Music": "🎵",
  "Musicals and Opera": "🎶",
  "Spoken Word": "🗣️",
};

export function genreEmoji(genre) {
  return GENRE_EMOJI[genre] || "🎟️";
}
