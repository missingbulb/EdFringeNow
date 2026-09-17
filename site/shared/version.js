/* The released version, read out of the page's own markup.
 *
 * Every page that shows a version carries `title="version <n>"` on its footer
 * line. That attribute is GENERATED — the release bumps package.json and stamps
 * each published page from it in the same run, and a check fails the build if
 * the two ever disagree. So the page already knows its version by the time it
 * loads, and no page fetches a file to find out.
 *
 * All three front-ends need exactly this, which is why it lives here rather
 * than three times over.
 */

/* Read the stamp, and take the attribute with it.
 *
 * Removing it matters: `title` is painted by the browser, outside the page, and
 * this site deliberately replaced that tooltip with a styled popup it can
 * position, key-navigate and screenshot (see version-popup.js). Leaving the
 * attribute in the live DOM would put the native tooltip back alongside the
 * popup that replaced it. The committed markup keeps it — that is what the
 * release stamps and the check reads — and the page drops it on load.
 *
 * Returns null when the page carries no stamp, which is every page that does
 * not show a version; callers treat that as "nothing to show". */
export function readVersionStamp(root = document) {
  const el = root.querySelector('[title^="version "]');
  if (!el) return null;
  const version = el.getAttribute("title").slice("version ".length).trim();
  el.removeAttribute("title");
  return version || null;
}
