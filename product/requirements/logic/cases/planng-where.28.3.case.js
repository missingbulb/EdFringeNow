"use strict";

module.exports = {
  description: "the site's where-from service answers the country the edge attaches to the request, and null when there is none",
  async verify(assert) {
    const { handleWhere } = await import("../../../../api/where.js");
    const ask = (cf) => Object.assign(new Request("https://www.edfringenow.com/api/where"), cf === undefined ? {} : { cf });

    const gb = handleWhere(ask({ country: "GB", city: "London", latitude: "51.5" }));
    assert.equal(gb.status, 200);
    assert.deepEqual(await gb.json(), { country: "GB" }, "the country and nothing else the edge knows");
    assert.equal(gb.headers.get("cache-control"), "private, no-store", "an answer about one visitor is never cached for another");

    for (const cf of [undefined, {}, { country: "T1" }, { country: "XX" }, { country: "gbr" }]) {
      assert.deepEqual(await handleWhere(ask(cf)).json(), { country: null }, `no country for ${JSON.stringify(cf)}`);
    }
  },
};
