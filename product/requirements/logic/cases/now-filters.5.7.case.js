"use strict";

module.exports = {
  description: "price caps are inclusive, Free means exactly £0, unknown prices match no cap",
  async verify(assert) {
    const { matchesPrice, showPrice } = await import("../../../../shared/price.js");
    const priced = (n) => ({ priceMin: n, free: false });
    const unknown = { priceMin: null, free: false };
    const free = { priceMin: 0, free: true };

    assert.equal(showPrice(unknown), null);
    assert.equal(showPrice(free), 0);

    // any: everything matches, unknown included.
    assert.ok(matchesPrice(unknown, "any"));
    // caps are inclusive…
    assert.ok(matchesPrice(priced(10), "10"));
    assert.ok(!matchesPrice(priced(10.01), "10"));
    // …and an unknown price never sneaks under one.
    assert.ok(!matchesPrice(unknown, "30"));
    // free is exactly £0 — a £1 show isn't, an unknown isn't.
    assert.ok(matchesPrice(free, "free"));
    assert.ok(!matchesPrice(priced(1), "free"));
    assert.ok(!matchesPrice(unknown, "free"));
    // a free show also fits under any cap (0 ≤ cap).
    assert.ok(matchesPrice(free, "10"));
  },
};
