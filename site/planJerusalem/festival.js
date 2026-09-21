/* The festival this planner is pointed at.
 *
 * Everything that differs between one festival's planner and another's lives
 * here: the name, the city, the data file, the storage namespace, the partner
 * links and the theme class. The page code below it reads this descriptor and
 * names no festival of its own, so a third festival is a new descriptor, a new
 * theme block in the stylesheet, and its own scraped catalogue — not a third
 * copy of the page.
 *
 * Anything the reader reads is a translation KEY rather than a word, because
 * the chrome speaks four languages (./i18n/translations.js). The wordmark is
 * the exception: it is the festival's mark, not a sentence.
 *
 * Pure data plus two link builders: no DOM, no fetch.
 */

import { israelRailLink, israelTravelLink, stayLink } from "../shared/affiliates.js";

export const FESTIVAL = {
  id: "jerusalem-comedy",
  /* What the header renders. `wordmark` is split so the accent colour lands on
     the second half, the way EdFringe|Now does. */
  wordmark: ["Jerusalem", "Comedy"],
  navLabelKey: "festival.city",
  /* The programme's own language. Every string that comes out of the catalogue
     is tagged with it, so a browser lays Hebrew out right-to-left and picks a
     font that has the glyphs. */
  lang: "he",
  dir: "rtl",
  city: "Jerusalem",
  /* Who published the programme, named in the footer. */
  sourceName: "comedy-festival.co.il",
  sourceUrl: "https://comedy-festival.co.il/",
  /* The catalogue the scrape writes. Relative to this page, because the site is
     served from a subpath and a root-relative URL would resolve above it. */
  dataUrl: "../data/jerusalem/shows.json",
  /* The page's own corner of localStorage. Sharing the planner's code must
     never mean sharing its stored list, so every key this page writes starts
     here and the Edinburgh planner's keys are never touched. */
  storagePrefix: "jerusalemPlan.",
  /* A picture for each of the programme's own kinds, for the question that
     asks what the reader came for. The kinds are the festival's, so their
     pictures are too; a kind the scrape adds and this map has not caught up
     with falls back rather than renders nothing. */
  kindEmoji: {
    "stand-up": "\u{1F3A4}",
    "competition-plays": "\u{1F3AD}",
    movies: "\u{1F4F8}",
    shows: "\u{1F3AA}",
    "free-late-night": "\u{1F319}",
  },
  kindEmojiFallback: "\u{1F39F}",
  /* How the site's own home page and Edinburgh planner are reached from here. */
  siteNav: [
    { href: "../", labelKey: "nav.now" },
    { href: "../plan/", labelKey: "nav.plan" },
  ],
};

/* Somewhere to sleep for the nights of the trip — Booking.com's Hebrew edition,
 * in shekels, which is what "the local Booking.com" means for Jerusalem. */
export function festivalStayLink(checkinISO, checkoutISO) {
  return withLabel("trip.stay", stayLink({
    checkinISO,
    checkoutISO,
    city: FESTIVAL.city,
    locale: "he",
    currency: "ILS",
    label: "edfringenow-jerusalem-night",
  }));
}

/* Getting here. Two links, deliberately: the paid airport transfer, and the
 * train beside it — Israel Railways pays nothing and is still usually the right
 * answer from Ben Gurion, and a planner that hid it to protect a commission
 * would be worth less than one that didn't. */
export function festivalTravelLinks() {
  return [withLabel("trip.transfers", israelTravelLink()), withLabel("trip.rail", israelRailLink())];
}

/* An affiliate link ships the partner's own English label; the planner names it
 * in the reader's language instead, so each one carries the key to name it by. */
function withLabel(labelKey, link) {
  return { ...link, labelKey };
}
