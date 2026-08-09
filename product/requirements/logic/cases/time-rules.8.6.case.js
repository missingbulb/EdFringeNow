"use strict";

module.exports = {
  description: "price copy: unknown → Price TBC, £0 → Free, real range → £12–£18, single band → £12, no trailing .00",
  async verify(assert) {
    const { priceLabel, formatPounds } = await import("../../../../shared/price.js");
    assert.equal(priceLabel({ priceMin: null, free: false }), "Price TBC");
    assert.equal(priceLabel({ priceMin: 0, free: true }), "Free");
    assert.equal(priceLabel({ priceMin: 12, priceMax: 18 }), "£12–£18");
    assert.equal(priceLabel({ priceMin: 12, priceMax: 12 }), "£12");
    assert.equal(priceLabel({ priceMin: 8.5, priceMax: 8.5 }), "£8.50");
    assert.equal(formatPounds(12), "£12");
    assert.equal(formatPounds(8.5), "£8.50");
  },
};
