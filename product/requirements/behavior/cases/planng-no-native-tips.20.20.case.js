"use strict";
const { jerusalemReady, openCard, reachableLeg } = require("../../shared/case-helpers");

/* Every element that is ever given a `title`, however briefly, from the first
 * byte of the page on. The footer's release stamp is the one exception: the
 * page reads it and takes the attribute away on load. */
const WATCH = `
  window.__titles = [];
  const name = (el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).join(".") : "");
  const note = (el) => {
    if (el.nodeType !== 1) return;
    for (const hit of [el, ...el.querySelectorAll("[title]")]) {
      if (hit.hasAttribute("title") && !/^version /.test(hit.getAttribute("title"))) window.__titles.push(name(hit));
    }
  };
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes" && r.oldValue === null && r.target.hasAttribute("title")) note(r.target);
      for (const n of r.addedNodes || []) note(n);
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"], attributeOldValue: true });
`;

module.exports = {
  description: "nothing on the planner carries a browser tooltip",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await page.addInitScript(WATCH);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);

    // Everything the page draws on demand: each question's panel, a show's
    // popup, the night's fold, a travel leg's card.
    for (const chip of await page.locator(".pref-chip").all()) {
      await chip.click();
      await chip.click();
    }
    await openCard(page, ".sch-show >> nth=0");
    await page.click("[data-night]");
    await page.hover(await reachableLeg(page));
    await page.waitForTimeout(700);

    const titled = await page.evaluate(() => [
      ...window.__titles,
      ...[...document.querySelectorAll("[title], [data-i18n-title]")].map((el) => el.tagName.toLowerCase()),
    ]);
    assert.deepEqual([...new Set(titled)], [], "elements given a browser tooltip");
  },
};
