"use strict";

const fs = require("node:fs");
const path = require("node:path");

// The partner's answer for London → Tel Aviv on one day, hand-written from the
// partner's documented response shape: no account exists yet to capture a real
// one (product/requirements.md, section 27). Its third fare omits its length,
// which must come through as unknown rather than as a zero.
const PARTNER_ANSWER = path.join(__dirname, "..", "..", "shared", "fixtures", "fares", "partner-lon-tlv.json");

module.exports = {
  description: "the fare service answers from the partner's cached one-way fares, cheapest first, and never hands the page the partner's token",
  async verify(assert) {
    const { handleFares, PARTNER_URL } = await import("../../../../api/fares.js");
    const answer = fs.readFileSync(PARTNER_ANSWER, "utf8");
    const ask = (query) => new Request(`https://www.edfringenow.com/api/fares?${query}`);
    const TOKEN = "partner-secret-token";

    const calls = [];
    const partner = async (url, init) => {
      calls.push({ url, init });
      return new Response(answer, { status: 200, headers: { "content-type": "application/json" } });
    };
    const res = await handleFares(ask("from=lon&to=TLV&date=2026-10-17&currency=gbp"), { TRAVELPAYOUTS_TOKEN: TOKEN }, partner);
    assert.equal(res.status, 200);
    const text = await res.text();
    const { fares } = JSON.parse(text);

    assert.equal(calls.length, 1, "one question to the partner");
    const sent = new URL(calls[0].url);
    assert.equal(`${sent.origin}${sent.pathname}`, PARTNER_URL);
    assert.equal(sent.searchParams.get("origin"), "LON", "the route, as IATA codes");
    assert.equal(sent.searchParams.get("destination"), "TLV");
    assert.equal(sent.searchParams.get("departure_at"), "2026-10-17", "that one day");
    assert.equal(sent.searchParams.get("one_way"), "true", "one way: out and home are two blocks");
    assert.equal(sent.searchParams.get("currency"), "gbp");
    assert.equal(calls[0].init.headers["X-Access-Token"], TOKEN, "the token goes to the partner in a header");
    assert.ok(!calls[0].url.includes(TOKEN), "and not on the URL, where logs keep it");
    assert.ok(!text.includes(TOKEN), "the page never sees it");

    assert.deepEqual(
      fares.map((f) => [f.price, f.departAt, f.durationMin, f.stops, f.airline]),
      [
        [128, "2026-10-17T07:40:00+01:00", 290, 0, "LY"],
        [141, "2026-10-17T22:05:00+01:00", null, 0, "U2"],
        [164, "2026-10-17T10:15:00+01:00", 410, 1, "W6"],
      ],
      "cheapest first; a length the partner left out stays unknown"
    );
    assert.ok(fares.every((f) => f.currency === "gbp" && f.link.startsWith("/search/LON1710TLV1?")), "each fare keeps its own page");
    assert.match(res.headers.get("cache-control"), /max-age=3600/, "a browser may keep the answer for an hour");

    // With no token configured: an empty list, not an error, and no partner call.
    const quiet = [];
    const none = await handleFares(ask("from=LON&to=TLV&date=2026-10-17"), {}, async (u) => quiet.push(u));
    assert.equal(none.status, 200);
    assert.deepEqual((await none.json()).fares, []);
    assert.equal(quiet.length, 0, "nothing is asked of the partner without a token");

    // The partner failing is no fares, marked as a failure for the logs.
    const down = await handleFares(ask("from=LON&to=TLV&date=2026-10-17"), { TRAVELPAYOUTS_TOKEN: TOKEN }, async () => new Response("", { status: 503 }));
    assert.equal(down.status, 502);
    assert.deepEqual((await down.json()).fares, []);
    const unreachable = await handleFares(ask("from=LON&to=TLV&date=2026-10-17"), { TRAVELPAYOUTS_TOKEN: TOKEN }, async () => {
      throw new TypeError("fetch failed");
    });
    assert.deepEqual((await unreachable.json()).fares, []);

    // A malformed question is refused before anything is asked.
    for (const bad of ["from=LONDON&to=TLV&date=2026-10-17", "from=LON&to=TLV&date=17/10/2026", "to=TLV&date=2026-10-17"]) {
      assert.equal((await handleFares(ask(bad), { TRAVELPAYOUTS_TOKEN: TOKEN }, partner)).status, 400, bad);
    }
    assert.equal(calls.length, 1, "no partner call for a refused question");
  },
};
