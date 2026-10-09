/* The page's one tooltip, for everything that explains itself on a rest of the
 * pointer or a keyboard's focus: any element carrying `data-tip`.
 *
 * It replaces the browser's `title` tooltip, which the browser paints outside
 * the page: it can't be styled, opens late, never shows on a keyboard's focus
 * or a touch, and a screenshot of the page cannot contain it.
 */

const REST_MS = 300;

let tip = null;
let owner = null;
let timer = null;
let pending = null;

function tipEl() {
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "tip";
    tip.className = "tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  return tip;
}

/* Above the element when there is room, below it when not, and never past the
 * window's edges. Fixed to the window, so no scroller can clip it. */
function show(el) {
  const text = el.dataset.tip;
  if (!text) return;
  const box = tipEl();
  box.textContent = text;
  box.hidden = false;
  const at = el.getBoundingClientRect();
  const size = box.getBoundingClientRect();
  const left = Math.min(Math.max(at.left + at.width / 2 - size.width / 2, 6), window.innerWidth - size.width - 6);
  const above = at.top - size.height - 6 >= 6;
  box.style.left = `${Math.round(left)}px`;
  box.style.top = `${Math.round(above ? at.top - size.height - 6 : at.bottom + 6)}px`;
  owner = el;
  el.setAttribute("aria-describedby", "tip");
}

export function hideTip() {
  clearTimeout(timer);
  pending = null;
  if (tip) tip.hidden = true;
  if (owner) owner.removeAttribute("aria-describedby");
  owner = null;
}

/** Listen once, on the document, for every `[data-tip]` the page ever draws. */
export function wireTips() {
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const el = e.target.closest("[data-tip]");
    if (el && (el === owner || el === pending)) return;
    hideTip();
    if (!el) return;
    pending = el;
    timer = setTimeout(() => show(el), REST_MS);
  });
  document.addEventListener("pointerout", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el && !el.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-tip]");
    if (el && e.target.matches(":focus-visible")) show(el);
  });
  document.addEventListener("focusout", hideTip);
  document.addEventListener("pointerdown", hideTip);
  document.addEventListener("scroll", hideTip, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideTip();
  });
}
