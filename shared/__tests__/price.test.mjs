// Tests for shared/price.js — the ticket-price vocabulary both front-ends use.
//
// The distinction under test throughout is free (£0) vs priced vs UNKNOWN.
// Conflating unknown with either one is the failure mode that matters: it
// either hides shows a budget could afford or promises a price we never
// scraped.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PRICE_CAPS,
  PRICE_OPTIONS,
  formatPounds,
  matchesPrice,
  priceLabel,
  showPrice,
  showPriceMax,
} from "../price.js";

test("showPrice reads the cheapest band, and null when unknown", () => {
  assert.equal(showPrice({ priceMin: 22.5, priceMax: 29.5 }), 22.5);
  assert.equal(showPrice({ priceMin: 0, free: true }), 0);
  // Not in the price cache and not flagged free → unknown, not £0.
  assert.equal(showPrice({ priceMin: null, free: false }), null);
  assert.equal(showPrice({}), null);
  assert.equal(showPrice(null), null);
  // A catalogue cached before prices shipped still knows free shows are £0.
  assert.equal(showPrice({ free: true }), 0);
});

test("showPriceMax falls back to the cheapest band for a single-band show", () => {
  assert.equal(showPriceMax({ priceMin: 22.5, priceMax: 29.5 }), 29.5);
  assert.equal(showPriceMax({ priceMin: 12 }), 12);
  assert.equal(showPriceMax({ free: true }), 0);
  assert.equal(showPriceMax({}), null);
});

test("formatPounds drops a pointless .00", () => {
  assert.equal(formatPounds(12), "£12");
  assert.equal(formatPounds(22.5), "£22.50");
  assert.equal(formatPounds(0), "£0");
  assert.equal(formatPounds(NaN), "");
});

test("priceLabel says Free, one price, a range, or admits it doesn't know", () => {
  assert.equal(priceLabel({ free: true, priceMin: 0, priceMax: 0 }), "Free");
  assert.equal(priceLabel({ priceMin: 12, priceMax: 12 }), "£12");
  assert.equal(priceLabel({ priceMin: 22.5, priceMax: 29.5 }), "£22.50–£29.50");
  assert.equal(priceLabel({ priceMin: null }), "Price TBC");
});

test("a price cap is inclusive and excludes unknown-price shows", () => {
  const tenner = { priceMin: 10 };
  // "Up to £10" must include a £10 ticket — the label promises it.
  assert.equal(matchesPrice(tenner, "10"), true);
  assert.equal(matchesPrice({ priceMin: 10.5 }, "10"), false);
  assert.equal(matchesPrice({ priceMin: 10.5 }, "15"), true);
  // Unknown fails every cap, and "free" too: a filter must not claim a match
  // on data we don't have.
  const unknown = { priceMin: null, free: false };
  assert.equal(matchesPrice(unknown, "30"), false);
  assert.equal(matchesPrice(unknown, "free"), false);
  // ...but "any" is not a claim about price, so it keeps everything.
  assert.equal(matchesPrice(unknown, "any"), true);
  assert.equal(matchesPrice(unknown, ""), true);
});

test("free is its own bucket, and free shows also clear every cap", () => {
  const free = { free: true, priceMin: 0 };
  assert.equal(matchesPrice(free, "free"), true);
  assert.equal(matchesPrice(free, "10"), true);
  assert.equal(matchesPrice({ priceMin: 12 }, "free"), false);
});

test("the offered options are one cumulative ladder, cheapest first", () => {
  assert.deepEqual(PRICE_OPTIONS.map((o) => o.value),
    ["any", "free", ...PRICE_CAPS.map(String)]);
  assert.deepEqual(PRICE_CAPS, [...PRICE_CAPS].sort((a, b) => a - b));
  // Every option carries both labels: the compact control renders `short`, and
  // anything that must stand alone renders `label`.
  for (const o of PRICE_OPTIONS) {
    assert.ok(o.label && o.short, `${o.value} needs both labels`);
  }
  assert.deepEqual(PRICE_OPTIONS.at(-1), { value: "30", label: "Up to £30", short: "£30" });
  // Cumulative: widening the budget can only ever add shows, never swap them.
  const shows = [{ priceMin: 8 }, { priceMin: 12 }, { priceMin: 18 }, { priceMin: 40 }];
  let previous = [];
  for (const cap of PRICE_CAPS) {
    const matched = shows.filter((s) => matchesPrice(s, String(cap)));
    for (const s of previous) assert.ok(matched.includes(s), `£${cap} dropped a show`);
    previous = matched;
  }
});
