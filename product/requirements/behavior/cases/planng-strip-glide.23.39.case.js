"use strict";
const { jerusalemReady, routeCrowdedYear, settle } = require("../../shared/case-helpers");

/* Goldens land every transition on its end state, so this reads what the
 * page does with the festivals it already drew: the same element moves to
 * its new place, one promoted from behind keeps its node and takes a row,
 * and those the filter drops or brings fade, by the stylesheet's own
 * transitions. */
const markAndWatch = (page) =>
  page.evaluate(() => {
    window.__seen = { leaving: new Set(), entering: new Set() };
    for (const el of document.querySelectorAll(".tl-item")) {
      el.__was = { faint: el.classList.contains("is-faint") };
    }
    new MutationObserver((records) => {
      for (const r of records) {
        for (const el of r.addedNodes) if (el.classList?.contains("is-entering")) window.__seen.entering.add(el.dataset.edition);
        if (r.type === "attributes" && r.target.classList?.contains("is-leaving")) window.__seen.leaving.add(r.target.dataset.edition);
      }
    }).observe(document.querySelector(".tl-year"), { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  });

module.exports = {
  description: "changing a filter moves the festivals already drawn, promotes ones from behind into the rows and fades the rest; with reduced motion they simply land",
  page: "/planNG/?festival=jerusalem-comedy",
  viewport: "desktop",
  async verify(page, { origin, assert }) {
    await routeCrowdedYear(page);
    await page.goto(`${origin}/planNG/?festival=jerusalem-comedy`, { waitUntil: "load" });
    await jerusalemReady(page);
    await markAndWatch(page);
    // The type with the most festivals waiting behind the rows.
    const type = await page.evaluate(() => {
      const behind = {};
      for (const el of document.querySelectorAll(".tl-item.is-faint")) behind[el.dataset.type] = (behind[el.dataset.type] || 0) + 1;
      return Object.entries(behind).sort((a, b) => b[1] - a[1])[0][0];
    });

    await page.click(`.tl-type[data-type="${type}"]`);
    await settle(page);
    const after = await page.evaluate(() => {
      const items = [...document.querySelectorAll(".tl-item")];
      return {
        kept: items.filter((el) => el.__was).length,
        fresh: items.filter((el) => !el.__was).length,
        promoted: items.filter((el) => el.__was && el.__was.faint && !el.classList.contains("is-faint")).length,
        types: [...new Set(items.map((el) => el.dataset.type))],
        leaving: window.__seen.leaving.size,
        transitions: getComputedStyle(items[0]).transitionProperty,
      };
    });
    assert.equal(after.fresh, 0, "no festival still drawn is drawn afresh");
    assert.ok(after.kept > 0, "the festivals still drawn keep the elements they had");
    assert.ok(after.promoted > 0, "a festival from behind takes a row");
    assert.ok(after.leaving > 0, "the festivals the filter drops fade out");
    for (const property of ["inset-inline-start", "top", "width", "height", "opacity"]) {
      assert.ok(after.transitions.includes(property), `a festival glides its ${property}`);
    }

    await page.click(`.tl-type[data-type="${type}"]`);
    await settle(page);
    assert.ok(await page.evaluate(() => window.__seen.entering.size > 0), "and those it brings back fade in");

    await page.emulateMedia({ reducedMotion: "reduce" });
    const landed = await page.evaluate(() => {
      const already = new Set(document.querySelectorAll(".tl-item.is-leaving"));
      document.querySelector('.tl-type:not([aria-pressed="true"])').click();
      return {
        leaving: [...document.querySelectorAll(".tl-item.is-leaving")].filter((el) => !already.has(el)).length,
        transition: getComputedStyle(document.querySelector(".tl-item")).transitionProperty,
      };
    });
    assert.equal(landed.leaving, 0, "reduced motion: a dropped festival goes at once");
    assert.equal(landed.transition, "none", "and nothing glides");
  },
};
