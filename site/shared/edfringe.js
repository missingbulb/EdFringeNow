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
