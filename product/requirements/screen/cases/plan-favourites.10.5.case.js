"use strict";
const { planFavourites, uploadFile } = require("../../shared/case-helpers");

module.exports = {
  description: "a failed upload leaves an existing board untouched",
  page: "/plan/",
  viewport: "desktop",
  localStorage: planFavourites(),
  // Two frames that are meant to look identical: dropping last year's export
  // on a populated board changes nothing about it.
  async capture(page, t) {
    const before = await t.element("#calWrap");
    await uploadFile(
      page,
      "favourites-2025.csv",
      "Title,URL\r\nGone,https://www.edfringe.com/tickets/whats-on/not-this-year\r\n"
    );
    await page.waitForTimeout(600);
    return t.animate([before, await t.element("#calWrap")]);
  },
};
