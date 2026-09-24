/* Carry what a reader saved under /planJerusalem/ over to this page, once.
 *
 * That page kept its lists under its own prefix and named shows by the
 * festival's own ids; this one pools several festivals, so it names them
 * `<festival>/<id>` (lib/pool.js) and keeps its date window as dates rather
 * than as positions in one festival's run. Each legacy key is translated,
 * written under the new name unless the reader already has one there, and
 * removed — so the move happens on the first visit and never again.
 *
 * Pure apart from the storage it is handed (localStorage in the page, a Map
 * in a test).
 */

import { poolId } from "./pool.js";

/**
 * @param {{getItem, setItem, removeItem}} store
 * @param {object} o
 * @param {string} o.from the legacy prefix ("jerusalemPlan.")
 * @param {string} o.to this page's prefix ("planNG.")
 * @param {string} o.festivalId whose ids the legacy lists hold
 * @param {string} o.editionKey the edition the legacy date window belonged to
 * @param {string[]} o.nights that edition's nights, which the legacy window
 *   counted positions in
 * @returns {string[]} the legacy keys that were carried over
 */
export function migrateLegacy(store, { from, to, festivalId, editionKey, nights }) {
  const moved = [];
  const id = (slug) => poolId(festivalId, slug);
  const take = (name, translate) => {
    let raw;
    try {
      raw = store.getItem(from + name);
    } catch {
      return;
    }
    if (raw == null) return;
    let value = null;
    try {
      value = translate(name === "theme" ? raw : JSON.parse(raw));
    } catch {
      // A value the old page could not have written is dropped, not carried.
    }
    try {
      if (value != null && store.getItem(to + value.key) == null) {
        store.setItem(to + value.key, typeof value.value === "string" ? value.value : JSON.stringify(value.value));
      }
      store.removeItem(from + name);
      moved.push(from + name);
    } catch {
      /* a store that refuses writes keeps the legacy key for next time */
    }
  };

  take("starred", (slugs) => ({ key: "starred", value: slugs.map(id) }));
  take("verdicts", (v) => ({
    key: "verdicts",
    value: {
      locked: Object.fromEntries(Object.entries(v.locked || {}).map(([slug, k]) => [id(slug), k])),
      noTime: (v.noTime || []).map((k) => id(k)),
      noShow: (v.noShow || []).map(id),
    },
  }));
  take("prefs", (p) => {
    const { d0, d1, interests, ...rest } = p;
    const value = { ...rest, interests: (interests || []).map(id) };
    const winFrom = nights[(Number(d0) || 1) - 1];
    const winTo = nights[(Number(d1) || nights.length) - 1];
    if (winFrom && winTo) value.windows = { [editionKey]: { from: winFrom, to: winTo } };
    return { key: "prefs", value };
  });
  take("theme", (theme) => ({ key: "theme", value: theme }));
  return moved;
}
