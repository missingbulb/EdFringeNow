"use strict";
const { festival } = require("../../shared/fixtures/registry");

module.exports = {
  description: "getting here from abroad: the paid airport transfer, and the train offered beside it",
  async verify(assert) {
    const { tripLinks } = await import("../../../../site/planNG/festivals.js");
    const [, transfer, train] = tripLinks(festival("jerusalem-comedy"), "abroad", "2026-10-17", "2026-10-23");

    assert.deepEqual([transfer.partner, train.partner], ["Kiwitaxi", "Israel Railways"]);
    assert.equal(transfer.url, "https://kiwitaxi.com/en/israel/ben-gurion-airport");
    // Untagged, and it must stay that way: Israel Railways runs no referral
    // programme, and the train is offered anyway because it is usually the
    // right answer from the airport.
    assert.equal(train.url, "https://www.rail.co.il/en");
  },
};
