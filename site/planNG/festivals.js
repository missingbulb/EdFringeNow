/* How each festival looks and what it offers beyond its programme.
 *
 * The registry (site/data/festivals/index.json) says which festivals exist,
 * where and when; this map says how the page presents one: its wordmark, a
 * picture for each of its own kinds, the translation keys for its name and
 * city, and the partner links a trip to it needs. Keyed by the registry's
 * festival id. A festival the registry has and this map does not still plans
 * — it is drawn under the house palette with its registry name — so adding a
 * festival's data never waits on this file.
 *
 * The palette itself is CSS, selected by `data-festival` (planNG.css).
 *
 * Pure data plus link builders: no DOM, no fetch.
 */

import { israelRailLink, israelTravelLink, stayLink } from "../shared/affiliates.js";

/* The page's own address, and the path every one of its languages hangs off. */
export const PAGE_ROOT = "/planNG/";

/* The page's corner of localStorage. Every key this page writes starts here, so
 * the Edinburgh planner's stored list is never touched. */
export const STORAGE_PREFIX = "planNG.";

/* Where the page lived before it planned more than one festival, and the
 * prefix its stored lists were kept under — read once, by lib/migrate.js. */
export const LEGACY_STORAGE_PREFIX = "jerusalemPlan.";
export const LEGACY_FESTIVAL_ID = "jerusalem-comedy";
export const LEGACY_EDITION_ID = "2026";

/* How the site's own home page and Edinburgh planner are reached from here. */
export const SITE_NAV = [
  { href: "/", labelKey: "nav.now" },
  { href: "/plan/", labelKey: "nav.plan" },
];

/* A kind no presentation names falls back to this rather than to nothing. */
export const KIND_EMOJI_FALLBACK = "\u{1F39F}";

const ISRAEL = {
  country: "IL",
  /* Booking.com's Hebrew edition, in shekels — "the local Booking.com". */
  stay: { locale: "he", currency: "ILS" },
  /* Getting here from abroad: the paid airport transfer, and the train beside
     it — Israel Railways pays nothing and is still usually the right answer
     from Ben Gurion, and a planner that hid it to protect a commission would
     be worth less than one that didn't. */
  airport: () => withLabel("trip.transfers", israelTravelLink()),
  rail: () => withLabel("trip.rail", israelRailLink()),
};

/* Every string the reader reads is a translation KEY, spelled out so the
 * catalogue's own gate finds it in the page's source. The wordmark is the
 * exception: it is the festival's mark, not a sentence. */
export const PRESENTATION = {
  "jerusalem-comedy": {
    wordmark: ["Jerusalem", "Comedy"],
    nameKey: "fest.jerusalem-comedy.name",
    cityKey: "fest.jerusalem-comedy.city",
    region: ISRAEL,
    stayCity: "Jerusalem",
    kindEmoji: {
      "stand-up": "\u{1F3A4}",
      "competition-plays": "\u{1F3AD}",
      movies: "\u{1F4F8}",
      shows: "\u{1F3AA}",
      "free-late-night": "\u{1F319}",
    },
  },
  "haifa-iff": {
    wordmark: ["Haifa", "Film"],
    nameKey: "fest.haifa-iff.name",
    cityKey: "fest.haifa-iff.city",
    region: ISRAEL,
    stayCity: "Haifa",
    kindEmoji: {},
    kindEmojiDefault: "\u{1F3AC}",
  },
  "acco": {
    wordmark: ["Acco", "Theatre"],
    nameKey: "fest.acco.name",
    cityKey: "fest.acco.city",
    region: ISRAEL,
    stayCity: "Akko",
    kindEmoji: {},
    kindEmojiDefault: "\u{1F3AD}",
  },
};

/** The presentation for a festival, or null when the page has none of its own. */
export function presentationOf(festivalId) {
  return PRESENTATION[festivalId] || null;
}

/** A picture for one of a festival's own kinds. */
export function kindEmoji(festivalId, kindId) {
  const p = presentationOf(festivalId);
  if (!p) return KIND_EMOJI_FALLBACK;
  return p.kindEmoji[kindId] || p.kindEmojiDefault || KIND_EMOJI_FALLBACK;
}

/**
 * The trip links a reader needs for a festival, by how far they come from.
 * @param {object} festival the registry entry
 * @param {"local"|"domestic"|"abroad"|null} reach from shared/feasibility.js;
 *   null while the reader has not said, which is treated as abroad — offering
 *   the airport to someone who lives there costs a line, hiding it from someone
 *   who needs it costs them the trip
 * @returns {{labelKey, text, partner, url}[]} empty when nothing is needed
 */
export function tripLinks(festival, reach, checkinISO, checkoutISO) {
  if (reach === "local") return [];
  const p = presentationOf(festival.id);
  const stay = withLabel(
    "trip.stay",
    stayLink({
      checkinISO,
      checkoutISO,
      city: (p && p.stayCity) || festival.city,
      locale: p ? p.region.stay.locale : "en-gb",
      currency: p ? p.region.stay.currency : undefined,
      label: `edfringenow-${festival.id}-night`,
    })
  );
  if (!p) return [stay];
  if (reach === "domestic") return [stay, p.region.rail()];
  return [stay, p.region.airport(), p.region.rail()];
}

/* An affiliate link ships the partner's own English label; the planner names it
 * in the reader's language instead, so each one carries the key to name it by. */
function withLabel(labelKey, link) {
  return { ...link, labelKey };
}
