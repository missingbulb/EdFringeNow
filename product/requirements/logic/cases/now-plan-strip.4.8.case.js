"use strict";

module.exports = {
  description: "durations read as prose: minutes, hours-and-minutes, about-N½-hours",
  async verify(assert) {
    const { friendlyDuration } = await import("../../../../shared/duration.js");
    assert.equal(friendlyDuration(45), "45 minutes");
    assert.equal(friendlyDuration(1), "1 minute");
    assert.equal(friendlyDuration(60), "1 hour");
    assert.equal(friendlyDuration(80), "1 hour and 20 minutes");
    assert.equal(friendlyDuration(120), "2 hours");
    assert.equal(friendlyDuration(150), "about 2½ hours");
    assert.equal(friendlyDuration(-5), "");
    assert.equal(friendlyDuration(NaN), "");
  },
};
