"use strict";
const { jerusalemReady, settle } = require("../../shared/case-helpers");

module.exports = {
  description: "the footer crediting the city's lists: OpenStreetMap under the ODbL and Wikivoyage under CC BY-SA",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async ready(page) {
    await jerusalemReady(page);
    await page.waitForSelector('#cityGuide[data-state="shown"]', { state: "attached", timeout: 20000 });
    await settle(page);
  },
  capture: ".footer-copy",
};
