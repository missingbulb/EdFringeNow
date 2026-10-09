/* The calendar is redrawn whole on every change, so without help a show that
 * leaves simply vanishes and one that arrives simply appears. This compares
 * what the calendar held before a redraw with what it holds after, and plays
 * the difference: a block still there slides from where it was, a new one
 * grows in, one that left is drawn once more where it stood and shrinks away,
 * and a day whose width changed eases to its new width.
 *
 * A block is known across redraws by what it is (a show's performance, a block
 * of the reader's own, a kept day's banner, the walk after a show), never by
 * its DOM node, which the redraw replaces.
 */

const MOVE_MS = 220;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

function keyOf(el) {
  if (el.classList.contains("sch-slot")) {
    const show = el.querySelector(".sch-show");
    return show ? `show:${show.dataset.slug}@${show.dataset.key}` : null;
  }
  if (el.classList.contains("sch-own")) return `own:${el.dataset.own || el.dataset.which}`;
  if (el.classList.contains("sch-keep")) return `keep:${el.dataset.keep}`;
  if (el.classList.contains("sch-leg")) return el.dataset.after ? `leg:${el.dataset.after}` : null;
  return null;
}

const BLOCKS = [".sch-slot", ".sch-own", ".sch-keep", ".sch-leg"].map((c) => `.sch-body > ${c}:not(.sch-ghost)`).join(", ");

/** Where everything on the calendar is now, to be played from after a redraw. */
export function snapshotCalendar(host) {
  const days = new Map();
  for (const col of host.querySelectorAll(".sch-day")) days.set(col.dataset.date, col.getBoundingClientRect());
  const blocks = new Map();
  for (const el of host.querySelectorAll(BLOCKS)) {
    const key = keyOf(el);
    if (!key) continue;
    const date = el.closest(".sch-day").dataset.date;
    blocks.set(key, { el, date, rect: el.getBoundingClientRect() });
  }
  return { days, blocks };
}

/** Play the calendar from `before` to what it holds now. */
export function animateCalendar(host, before) {
  if (!before || !before.blocks.size) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const timing = { duration: MOVE_MS, easing: EASE };

  // Everything is measured before anything is animated: a day easing to a new
  // width moves the layout, and a measure after it would force another.
  const dayNow = new Map();
  for (const col of host.querySelectorAll(".sch-day")) dayNow.set(col.dataset.date, { col, rect: col.getBoundingClientRect() });
  // A calendar of other days entirely (another trip) is a new calendar, not
  // this one changing: it is drawn, not played.
  if (![...dayNow.keys()].some((date) => before.days.has(date))) return;
  const now = [];
  for (const el of host.querySelectorAll(BLOCKS)) {
    const key = keyOf(el);
    if (key) now.push({ el, key, date: el.closest(".sch-day").dataset.date, rect: el.getBoundingClientRect() });
  }
  const bodies = new Map();
  for (const [date, { col }] of dayNow) {
    const body = col.querySelector(".sch-body");
    if (body) bodies.set(date, { body, rect: body.getBoundingClientRect() });
  }

  // A day whose width changed eases to it; a block's slide is measured
  // against its own day, so the day carries its blocks with it.
  for (const [date, { col, rect }] of dayNow) {
    const was = before.days.get(date);
    if (!was || Math.abs(was.width - rect.width) <= 0.5) continue;
    col.animate(
      [
        { flex: "0 0 auto", width: `${was.width}px`, minWidth: "0px", maxWidth: "none" },
        { flex: "0 0 auto", width: `${rect.width}px`, minWidth: "0px", maxWidth: "none" },
      ],
      timing
    );
  }

  const seen = new Set();
  for (const { el, key, date, rect } of now) {
    seen.add(key);
    const was = before.blocks.get(key);
    if (!was) {
      el.animate([{ opacity: 0, transform: "scale(0.85)" }, { opacity: 1, transform: "none" }], timing);
      continue;
    }
    // Within one day, against the day's own edge; across days, on the page.
    const sameDay = was.date === date && before.days.has(date);
    const dx = sameDay
      ? was.rect.left - before.days.get(date).left - (rect.left - dayNow.get(date).rect.left)
      : was.rect.left - rect.left;
    const dy = was.rect.top - rect.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], timing);
  }

  // What left is drawn once more, in the day it left, and shrinks away there.
  for (const [key, was] of before.blocks) {
    if (seen.has(key)) continue;
    const at = bodies.get(was.date);
    if (!at) continue;
    const ghost = was.el.cloneNode(true);
    ghost.classList.add("sch-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("tabindex");
    for (const focusable of ghost.querySelectorAll("[tabindex], a, button")) focusable.setAttribute("tabindex", "-1");
    ghost.style.inset = "auto";
    Object.assign(ghost.style, {
      top: `${was.rect.top - at.rect.top}px`,
      left: `${was.rect.left - at.rect.left}px`,
      width: `${was.rect.width}px`,
      height: `${was.rect.height}px`,
    });
    at.body.appendChild(ghost);
    const anim = ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.85)" }], timing);
    const gone = () => ghost.remove();
    anim.finished.then(gone, gone);
  }
}
