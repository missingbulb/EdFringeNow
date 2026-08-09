"use strict";
const { uploadFile, FIXTURE_CSV, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "failed catalogue load: 'We couldn't load the show data.' + reason + Try again",
  page: "/plan/",
  viewport: "desktop",
  failData: ["normalized/shows.min.json"],
  // The page stays quiet about the outage until someone needs the data — the
  // error panel appears when an upload lands while the catalogue is down.
  async ready(page) {
    await page.waitForSelector("#dropzone");
    await settle(page);
  },
  async drive(page) {
    await uploadFile(page, "favourites.csv", FIXTURE_CSV());
    await page.waitForSelector("#errorState:not([hidden])", { timeout: 20000 });
    await page.waitForTimeout(200);
  },
};
