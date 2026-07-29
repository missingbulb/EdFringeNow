// Node test for the partner-link builders. No dependencies — plain node:test +
// node:assert. Run from the repo root with:
//   node --test shared/__tests__/affiliates.test.mjs
//
// What matters here is what ships in an href: the trip's real dates, the
// affiliate tag once an ID exists (and *no* tag while the IDs are empty, so an
// unjoined programme never leaks a half-formed link), and a network click
// wrapper that survives URL-encoding. Every assertion below was mutation-checked
// against the implementation before being trusted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { AFFILIATES, nextDayISO, stayLink, travelLink } from "../affiliates.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..", "..");

/** The query of a built link, as a URLSearchParams. */
function query(url) {
  return new URL(url).searchParams;
}

test("the shipped IDs are empty, so a link is a plain untagged deep link", () => {
  for (const [key, value] of Object.entries(AFFILIATES)) {
    assert.equal(value, "", `AFFILIATES.${key} must ship empty — fill it in when the programme is joined`);
  }
  const stay = stayLink({ checkinISO: "2026-08-07", checkoutISO: "2026-08-24" });
  assert.ok(stay.url.startsWith("https://www.booking.com/searchresults.html?"), stay.url);
  assert.equal(query(stay.url).get("aid"), null, "no affiliate ID while unset");
  assert.equal(query(stay.url).get("label"), null, "no label without an ID to attach it to");
  assert.equal(travelLink().url, "https://www.omio.com/travel/edinburgh");
});

test("a stay carries the trip's own window as check-in / check-out", () => {
  const params = query(stayLink({ checkinISO: "2026-08-07", checkoutISO: "2026-08-24" }).url);
  assert.equal(params.get("ss"), "Edinburgh");
  assert.equal(params.get("checkin"), "2026-08-07");
  assert.equal(params.get("checkout"), "2026-08-24");
});

test("a one-day window books the night, not a zero-night stay", () => {
  // Booking.com returns nothing for checkout === checkin, so the same-day case
  // has to become "that night".
  const same = query(stayLink({ checkinISO: "2026-08-12", checkoutISO: "2026-08-12" }).url);
  assert.equal(same.get("checkin"), "2026-08-12");
  assert.equal(same.get("checkout"), "2026-08-13");
  // A backwards window (checkout before check-in) gets the same treatment.
  const backwards = query(stayLink({ checkinISO: "2026-08-12", checkoutISO: "2026-08-09" }).url);
  assert.equal(backwards.get("checkout"), "2026-08-13");
});

test("no dates at all still gives a working Edinburgh search", () => {
  const params = query(stayLink().url);
  assert.equal(params.get("ss"), "Edinburgh");
  assert.equal(params.get("checkin"), null);
  assert.equal(params.get("checkout"), null);
});

test("nextDayISO crosses month and year boundaries", () => {
  assert.equal(nextDayISO("2026-08-31"), "2026-09-01");
  assert.equal(nextDayISO("2026-12-31"), "2027-01-01");
  assert.equal(nextDayISO("2028-02-28"), "2028-02-29", "2028 is a leap year");
});

test("a filled-in Booking ID tags the link, with a label naming the placement", () => {
  const params = query(
    stayLink({ checkinISO: "2026-08-07", checkoutISO: "2026-08-24" }, { ...AFFILIATES, bookingAid: "1234567" }).url
  );
  assert.equal(params.get("aid"), "1234567");
  assert.equal(params.get("label"), "edfringenow-plan-night");
  assert.equal(params.get("checkin"), "2026-08-07", "tagging must not disturb the dates");
});

test("a network click template wraps the destination, URL-encoded", () => {
  const template = "https://prf.hn/click/camref:abc123/destination:{deep}";
  const { url } = travelLink({ ...AFFILIATES, omioClickTemplate: template });
  assert.equal(url, "https://prf.hn/click/camref:abc123/destination:https%3A%2F%2Fwww.omio.com%2Ftravel%2Fedinburgh");

  // Booking's own params must end up *inside* the wrapped destination, not
  // stranded on the wrapper — otherwise the network sends an untagged click on.
  const wrapped = stayLink(
    { checkinISO: "2026-08-07", checkoutISO: "2026-08-24" },
    { ...AFFILIATES, bookingAid: "1234567", bookingClickTemplate: "https://www.awin1.com/cread.php?awinmid=9&ued={deep}" }
  ).url;
  const inner = new URL(decodeURIComponent(query(wrapped).get("ued")));
  assert.equal(inner.host, "www.booking.com");
  assert.equal(inner.searchParams.get("aid"), "1234567");
  assert.equal(inner.searchParams.get("checkout"), "2026-08-24");
});

test("each link names its partner for the pill the planner renders", () => {
  const stay = stayLink({ checkinISO: "2026-08-07" });
  assert.equal(stay.partner, "Booking.com");
  assert.ok(stay.text.length > 0, "the pill needs a call to action");
  const travel = travelLink();
  assert.equal(travel.partner, "Omio");
  assert.ok(travel.text.length > 0);
});

// The planner must spend the shared IDs rather than growing its own copy — the
// same regression shared/geo.js exists to prevent.
test("the planner imports the links instead of declaring its own", () => {
  const src = readFileSync(path.join(REPO, "plan", "plan.js"), "utf8");
  assert.match(src, /from\s+["']\.\.\/shared\/affiliates\.js["']/, "plan.js must import from shared/affiliates.js");
  assert.doesNotMatch(
    src,
    /(?:const|let|var)\s+AFFILIATES\s*=/,
    "plan.js declares its own AFFILIATES — import them from shared/affiliates.js instead"
  );
  assert.doesNotMatch(src, /booking\.com/i, "no hand-built Booking.com URL in plan.js — use stayLink()");
  assert.doesNotMatch(src, /omio\.com/i, "no hand-built Omio URL in plan.js — use travelLink()");
});
