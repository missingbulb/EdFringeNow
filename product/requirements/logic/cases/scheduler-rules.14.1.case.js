"use strict";

module.exports = {
  description: "sold-out/off-sale/cancelled/blank statuses are unavailable; offer statuses stay bookable",
  async verify(assert) {
    const { isAvailable, UNAVAILABLE_STATUSES } = await import("../../../../plan/lib/availability.js");

    for (const s of [
      "SOLD_OUT",
      "OFF_SALE",
      "NOT_ON_SALE",
      "CANCELLED",
      "POSTPONED",
      "SUSPENDED",
      "NO_ALLOCATION_CONTACT_VENUE",
    ]) {
      assert.ok(UNAVAILABLE_STATUSES.has(s), `${s} in the unavailable set`);
      assert.ok(!isAvailable({ status: s }), `${s} is unavailable`);
    }
    // Blank/unknown is unavailable too — never assume a ticket exists.
    assert.ok(!isAvailable({ status: "" }));
    assert.ok(!isAvailable({}));
    // The soldOut flag alone kills an otherwise-open status.
    assert.ok(!isAvailable({ status: "TICKETS_AVAILABLE", soldOut: true }));
    // Open and offer statuses are bookable.
    assert.ok(isAvailable({ status: "TICKETS_AVAILABLE" }));
    assert.ok(isAvailable({ status: "TWO_FOR_ONE" }));
    assert.ok(isAvailable({ status: "PAY_WHAT_YOU_WANT" }));
  },
};
