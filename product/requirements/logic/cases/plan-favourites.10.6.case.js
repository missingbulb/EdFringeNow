"use strict";

module.exports = {
  description: "the favourites parser reads real CSV exports and falls back to plain URL/slug lists",
  async verify(assert) {
    const { parseFavourites, slugFromUrl } = await import("../../../../plan/lib/favourites.js");

    assert.equal(slugFromUrl("https://www.edfringe.com/tickets/whats-on/some-show"), "some-show");
    assert.equal(slugFromUrl("http://edfringe.com/tickets/whats-on/other-show"), "other-show");
    assert.equal(slugFromUrl("https://elsewhere.com/tickets/whats-on/nope"), "nope"); // non-edfringe: last-segment fallback

    // RFC-4180: quoted cells, "" escapes, CRLF, BOM; every cell scanned;
    // de-duplicated in first-seen order.
    const csv =
      '﻿"Title","Link"\r\n' +
      '"A ""quoted"" show",https://www.edfringe.com/tickets/whats-on/show-a\r\n' +
      '"Twice",https://www.edfringe.com/tickets/whats-on/show-a\r\n' +
      '"B, with comma","see https://www.edfringe.com/tickets/whats-on/show-b today"\r\n';
    assert.deepEqual(parseFavourites(csv), ["show-a", "show-b"]);

    // Fallback (only when the CSV scan finds no URLs): a plain list of bare
    // slugs, "#" comments and blanks ignored.
    const plain = "# my list\nshow-d\n\nshow-e\n";
    assert.deepEqual(parseFavourites(plain), ["show-d", "show-e"]);
  },
};
