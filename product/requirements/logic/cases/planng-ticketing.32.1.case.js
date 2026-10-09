"use strict";

// The rows ARE the requirement: each way a festival sells its tickets, and what
// the checkout opens for the shows locked there.
const TABLE = {
  columns: ["How the festival sells tickets", "Checkout opens"],
  rows: [
    ["One box office for every show", "each show's own page on it"],
    ["Each show through its own seller", "each show's own seller"],
    ["One pass for the whole festival", "the pass, once"],
    ["Everything is free", "nothing"],
    ["Some other way", "the festival's ticketing page, once"],
    ["Not said, or a way the page does not know", "the festival's own site, once"],
    ["Any way, for a show that is free", "nothing for that show"],
  ],
};

const festival = (id, ticketing) => ({ id, site: `https://${id}.test`, ticketing });
const show = (slug, extra = {}) => ({
  slug: `f/${slug}`, festivalId: "f", title: slug, date: "2026-10-01", start: "20:00",
  ticketUrl: `https://seller.test/${slug}`, url: `https://f.test/${slug}`, free: false, ...extra,
});

module.exports = {
  description: "every festival says how its tickets are sold, and each way decides what the checkout opens",
  table: TABLE,
  async verify(assert) {
    const { checkoutPlan } = await import("../../../../site/planNG/lib/checkout.js");
    const opened = (ticketing, items) =>
      checkoutPlan(items, () => festival("f", ticketing)).destinations.map((d) => d.url);
    const two = [show("a"), show("b", { start: "22:00" })];

    assert.deepEqual(opened({ model: "central-box-office", url: "https://box.test" }, two),
      ["https://seller.test/a", "https://seller.test/b"]);
    assert.deepEqual(opened({ model: "per-event-seller", url: null }, two),
      ["https://seller.test/a", "https://seller.test/b"]);
    assert.deepEqual(opened({ model: "per-event-seller", url: null }, [show("a", { ticketUrl: null })]),
      ["https://f.test/a"], "a show with no ticket link is bought from its own page");
    assert.deepEqual(opened({ model: "festival-pass", url: "https://pass.test" }, two), ["https://pass.test"]);
    assert.deepEqual(opened({ model: "all-free", url: null }, two), []);
    assert.deepEqual(opened({ model: "other", url: "https://how.test" }, two), ["https://how.test"]);
    assert.deepEqual(opened({ model: null, url: null }, two), ["https://f.test"]);
    assert.deepEqual(opened({ model: "raffle", url: null }, two), ["https://f.test"], "an unknown way is the festival's site");
    assert.deepEqual(opened(null, two), ["https://f.test"]);
    assert.deepEqual(opened({ model: "central-box-office", url: null }, [show("a", { free: true }), show("b")]),
      ["https://seller.test/b"]);

    const shared = checkoutPlan(
      [show("a", { ticketUrl: "https://same.test" }), show("b", { ticketUrl: "https://same.test" })],
      () => festival("f", { model: "per-event-seller", url: null })
    );
    assert.deepEqual(shared.destinations, [{ url: "https://same.test", festivalId: "f", slugs: ["f/a", "f/b"] }],
      "shows sold on the same page share one tab");
  },
};
