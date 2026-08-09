"use strict";

module.exports = {
  description: "one shared price ladder: Any / Free / up to £10 / £15 / £20 / £30",
  async verify(assert) {
    const { PRICE_OPTIONS, PRICE_CAPS } = await import("../../../../shared/price.js");
    assert.deepEqual(PRICE_CAPS, [10, 15, 20, 30]);
    assert.deepEqual(
      PRICE_OPTIONS.map((o) => o.value),
      ["any", "free", "10", "15", "20", "30"]
    );
    assert.deepEqual(
      PRICE_OPTIONS.map((o) => o.label),
      ["Any price", "Free", "Up to £10", "Up to £15", "Up to £20", "Up to £30"]
    );
  },
};
