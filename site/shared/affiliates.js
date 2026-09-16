/* Partner (affiliate) links — the site's monetization plumbing.
 *
 * Pure: no DOM, no fetch. Each front-end renders the returned link itself
 * (the planner's schedule-board nags in plan/plan.js), and
 * shared/__tests__/affiliates.test.mjs exercises this module directly.
 *
 * Lives in shared/ rather than plan/ because a partner ID is a property of the
 * *site*, not of one page: the planner's "need a place to sleep?" nag and the
 * Now page's bookable-place pills both spend the same Booking.com ID, and both
 * pages must tag a click the same way or the referral is lost.
 *
 * Two things a caller needs:
 *   1. AFFILIATES — the ID block, empty until the programmes are joined.
 *   2. stayLink() / travelLink() / israelTravelLink() — the links a planner
 *      offers, each returning { text, partner, url } so the caller renders
 *      "text · partner". A planner page passes its own destination; nothing
 *      here assumes one festival.
 */

/* ---------- Monetization: affiliate / referral IDs ----------
 *
 * These are NOT secrets — they ship in the client, like the analytics token in
 * js/analytics.js — and they are empty by default: every link below works as a
 * plain deep link, and starts tagging referrals the moment an ID is filled in.
 * A partner whose IDs are unset simply stays untagged, so partial set-up is
 * fine (join accommodation first, transport later).
 *
 * TO MONETIZE, join the programmes and paste the IDs here. Which programme, at
 * what rate, and the sign-up checklist live in the tracking issue; the short
 * version (researched 2026-07-29):
 *   - Accommodation → Booking.com. `bookingAid` is the affiliate ID (Booking's
 *     own `aid` URL parameter), issued whether you join Booking.com's partner
 *     programme direct or through a network (Awin / CJ / Travelpayouts).
 *   - Transport → Omio (train + coach + flight in one search, which is what
 *     "how do I get to the Fringe?" actually needs). Omio's tracking is issued
 *     by whichever network accepts you, so it arrives as a *click wrapper*
 *     rather than a query parameter — see CLICK TEMPLATES below.
 *   - Transport within Israel → Kiwitaxi, which sells Ben Gurion → Jerusalem
 *     transfers and pays a referral (its programme runs through Travelpayouts,
 *     so its tracking is a click wrapper too). Omio does not cover Israel. The
 *     unpaid alternative, Israel Railways, is what `israelRailLink` offers
 *     beside it — no programme exists, so it ships untagged and always will.
 */
export const AFFILIATES = {
  // Booking.com's `aid`, plus the `label` we send with it (see stayLink) so the
  // dashboard can tell this placement's earnings from any other.
  bookingAid: "",
  /* CLICK TEMPLATES — a network credits a click by routing it through its own
   * domain (awin1.com/cread.php?…&ued=, prf.hn/click/camref:…/destination:,
   * tp.media/click?…&deep_link=). The shapes differ per network and the real
   * one comes from the dashboard once accepted, so rather than guess a network
   * we take its link verbatim with `{deep}` marking where the destination URL
   * goes, URL-encoded. Empty template → the plain deep link, untagged. */
  bookingClickTemplate: "",
  omioClickTemplate: "",
  kiwitaxiClickTemplate: "",
};

/* Route a destination URL through a network's click wrapper. */
function wrapClick(template, url) {
  if (!template) return url;
  return template.replace("{deep}", encodeURIComponent(url));
}

/* The day after an ISO date, for the checkout of a stay that ends on the last
 * night. Pure calendar maths (UTC noon dodges DST edges), so month and year
 * boundaries just work. */
export function nextDayISO(dateISO) {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* Somewhere to sleep for the nights of a festival trip: a Booking.com search
 * for the festival's own city with the trip's dates pre-filled.
 *
 * `checkinISO`/`checkoutISO` are the planner's date window. A one-day window
 * would ask Booking.com for a zero-night stay (it returns nothing), so a
 * checkout that isn't after the check-in becomes the next morning — the honest
 * reading of "I'm here on the 12th and need a bed that night".
 *
 * `city`, `locale` and `currency` are what make this reusable across festivals.
 * Booking.com puts the language in the *path* (`searchresults.he.html`), not in
 * a parameter, so a caller that wants the local edition gets the local edition
 * rather than an English page with a Hebrew query string.
 */
export function stayLink(
  { checkinISO, checkoutISO, city = "Edinburgh", locale = "en-gb", currency, label = "edfringenow-plan-night" } = {},
  affiliates = AFFILIATES
) {
  const params = new URLSearchParams({ ss: city });
  if (checkinISO) {
    const checkout = checkoutISO && checkoutISO > checkinISO ? checkoutISO : nextDayISO(checkinISO);
    params.set("checkin", checkinISO);
    params.set("checkout", checkout);
  }
  if (currency) params.set("selected_currency", currency);
  if (affiliates.bookingAid) {
    params.set("aid", affiliates.bookingAid);
    // Booking.com's own per-link tag, so this nag's earnings are attributable.
    params.set("label", label);
  }
  // "en-gb" is Booking.com's default edition and has no path suffix of its own.
  const page = locale && locale !== "en-gb" ? `searchresults.${locale}.html` : "searchresults.html";
  const url = `https://www.booking.com/${page}?${params}`;
  return {
    text: "Find a bed",
    partner: "Booking.com",
    url: wrapClick(affiliates.bookingClickTemplate, url),
  };
}

/* Getting to or out of Edinburgh. Omio's Edinburgh page covers train, coach and
 * flight in one search, which is the point: a last-minute Fringe-goer knows
 * they need to *get there*, not which mode is cheapest today.
 *
 * No origin and no date go on the URL. We don't know where the traveller starts
 * from (the planner only ever knows Edinburgh), and Omio's route pages key off
 * an origin slug, so a guessed one would 404 where the destination page always
 * works.
 */
export function travelLink(affiliates = AFFILIATES) {
  const url = "https://www.omio.com/travel/edinburgh";
  return {
    text: "Trains, coaches & flights",
    partner: "Omio",
    url: wrapClick(affiliates.omioClickTemplate, url),
  };
}

/* Getting to Jerusalem. Omio does not sell Israel, so the paid partner here is
 * Kiwitaxi, whose Ben Gurion page is the honest entry point: nearly everyone
 * arriving for the festival lands at the airport and needs the hour to
 * Jerusalem, and Kiwitaxi's route pages key off the airport rather than the
 * city.
 *
 * As with Omio, no origin and no date go on the URL — the planner only ever
 * knows the destination.
 */
export function israelTravelLink(affiliates = AFFILIATES) {
  const url = "https://kiwitaxi.com/en/israel/ben-gurion-airport";
  return {
    text: "Airport transfers",
    partner: "Kiwitaxi",
    url: wrapClick(affiliates.kiwitaxiClickTemplate, url),
  };
}

/* The train, offered beside the paid transfer. Israel Railways runs no referral
 * programme, so this link is untagged by design rather than by omission — it is
 * here because it is the cheapest way in from the airport and a planner that
 * hid it to protect a commission would be worth less than one that didn't.
 */
export function israelRailLink() {
  return {
    text: "Trains",
    partner: "Israel Railways",
    url: "https://www.rail.co.il/en",
  };
}
