"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { jerusalemReady, jerusalemStarred } = require("../../shared/case-helpers");
const { VIEWPORTS } = require("../../shared/harness/browser");

const REPO = path.join(__dirname, "..", "..", "..", "..");
const FONTS_CSS = path.join(
  __dirname, "..", "..", "shared", "harness", "vendor", "fonts", "fonts.css"
);

/* A translation is measured where it renders: a probe carrying its slot's own
 * resolved typography, in the page that is actually on screen, under the
 * Chromium the goldens are rendered with. Nothing here converts a letter to a
 * number by a rule of its own — the browser that will draw the string is the
 * one that measures it. */
function measureInPage(page, items) {
  return page.evaluate((entries) => {
    const slots = new Map();
    for (const el of document.querySelectorAll("*")) {
      for (const [name, value] of Object.entries(el.dataset)) {
        if (name.startsWith("i18n") && !slots.has(value)) slots.set(value, el);
      }
    }
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;top:-9999px;left:-9999px;visibility:hidden;white-space:pre;width:auto";
    probe.lang = document.documentElement.lang;
    probe.dir = document.documentElement.dir;
    document.body.appendChild(probe);
    // Everything that changes how wide a run of text draws. Copied as resolved
    // values, so a slot inside a hidden panel measures the same as a visible one.
    const TYPOGRAPHY = [
      "font-family", "font-size", "font-weight", "font-style", "font-stretch",
      "font-variant", "font-feature-settings", "font-kerning", "letter-spacing",
      "word-spacing", "text-transform",
    ];
    const measured = [];
    for (const entry of entries) {
      const slot = slots.get(entry.key) || (entry.probe && document.querySelector(entry.probe));
      if (!slot) {
        measured.push({ key: entry.key, width: null });
        continue;
      }
      const computed = getComputedStyle(slot);
      for (const property of TYPOGRAPHY) probe.style.setProperty(property, computed.getPropertyValue(property));
      probe.textContent = entry.text;
      measured.push({ key: entry.key, width: probe.getBoundingClientRect().width });
    }
    probe.remove();
    return measured;
  }, items);
}

/** The code points the vendored Noto Sans JP chunks can actually draw. */
function vendoredJapaneseRanges() {
  const css = fs.readFileSync(FONTS_CSS, "utf8");
  const covered = new Set();
  for (const block of css.split("@font-face")) {
    if (!block.includes("'Noto Sans JP'")) continue;
    const range = /unicode-range: ([^;]+);/.exec(block);
    if (!range) continue;
    for (const part of range[1].split(",")) {
      const text = part.trim().replace(/^U\+/i, "");
      const [from, to] = text.split("-");
      for (let c = parseInt(from, 16); c <= parseInt(to || from, 16); c++) covered.add(c);
    }
  }
  return covered;
}

module.exports = {
  description:
    "every translated string fits the pixel budget its key declares, in all four languages and at both viewports",
  page: "/planJerusalem/",
  viewport: "desktop",
  localStorage: jerusalemStarred(),
  async verify(page, { origin, assert }) {
    const { STRINGS } = await import(path.join(REPO, "site/planJerusalem/i18n/translations.js"));
    const { PAGES: LOCALIZED_PAGES } = await import(path.join(REPO, "scripts/localize-pages.mjs"));
    const { format, argumentsOf } = await import(path.join(REPO, "site/planJerusalem/i18n/format.js"));

    // A string the harness cannot draw cannot be measured either: the font jail
    // carries no CJK, so Japanese is only real here while the vendored Noto
    // Sans JP chunks cover it.
    const covered = vendoredJapaneseRanges();
    const uncovered = [
      ...new Set(
        Object.values(STRINGS)
          .flatMap((entry) => [...entry.ja])
          .filter((c) => c.codePointAt(0) > 0x2e7f && !covered.has(c.codePointAt(0)))
      ),
    ];
    assert.deepEqual(uncovered, [], "Japanese characters no vendored Noto Sans JP chunk carries:");

    // The strings as a reader sees them: a count at its widest realistic value,
    // and text that came out of the programme left empty — its length is the
    // catalogue's to answer for, not the translator's.
    const budgeted = Object.entries(STRINGS).filter(([, entry]) => entry.maxWidthPx !== null);
    const forLocale = (code) =>
      budgeted.map(([key, entry]) => {
        const sample = entry.sample || {};
        const params = Object.fromEntries([...argumentsOf(entry[code])].map((a) => [a, sample[a] ?? 12]));
        return { key, probe: entry.probe || null, text: format(entry[code], params, code) };
      });

    const missing = [];
    const overflowing = [];
    for (const { code, url } of LOCALIZED_PAGES) {
      // A language is its own page now, so it is loaded rather than switched
      // into — at the wide viewport, which is the layout the page settles in
      // (the date window's overlay is only laid out there), and then measured
      // at each viewport by resizing it.
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto(`${origin}${url}`, { waitUntil: "load" });
      await jerusalemReady(page);

      for (const [name, size] of Object.entries(VIEWPORTS)) {
        await page.setViewportSize(size);
        await page.evaluate(() => document.fonts.ready);
        const items = forLocale(code);
        const widths = await measureInPage(page, items);
        widths.forEach(({ key, width }, i) => {
          const budget = STRINGS[key].maxWidthPx;
          if (width === null) missing.push(`${key} (no slot on the page, and no probe)`);
          else if (width > budget) {
            overflowing.push(
              `${key} / ${code} / ${name}: "${items[i].text}" measures ${width.toFixed(1)}px, ` +
                `budget ${budget}px`
            );
          }
        });
      }
    }
    assert.deepEqual([...new Set(missing)], [], "budgeted keys with nowhere to measure them:");
    assert.deepEqual(overflowing, [], "translations wider than their slot's budget:");
  },
};
