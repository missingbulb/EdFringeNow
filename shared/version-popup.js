/* The version popup both pages hang off their footer copyright line.
 *
 * The version used to ride in a native `title` tooltip. The browser paints
 * those itself, outside the page, so nothing in the product could style them,
 * position them, or show them to a reviewer — a screenshot of the page cannot
 * contain one. This is a real element instead: styled with the site, reachable
 * by keyboard, and visible in the requirements gallery like everything else.
 *
 * One module for both front-ends (the Now page and the planner) so the two can
 * never drift apart; each page ships its own `.version-pop` rules, since a
 * stylesheet can't be imported the way a module can.
 */

/* Attach the popup to `trigger`, carrying `text`. Safe to call again with a
 * new string — a second call updates the text rather than stacking popups. */
export function attachVersionPopup(trigger, text) {
  if (!trigger || !text) return null;

  let pop = trigger.querySelector(".version-pop");
  if (pop) {
    pop.textContent = text;
    return pop;
  }

  pop = document.createElement("span");
  pop.className = "version-pop";
  pop.id = "versionPop";
  pop.setAttribute("role", "tooltip");
  pop.hidden = true;
  pop.textContent = text;
  trigger.appendChild(pop);

  /* Focusable, and described by the popup, so the version is reachable without
   * a pointer — the whole point of the affordance. */
  trigger.tabIndex = 0;
  trigger.setAttribute("aria-describedby", pop.id);

  const open = () => {
    pop.hidden = false;
    trigger.classList.add("is-open");
  };
  const close = () => {
    pop.hidden = true;
    trigger.classList.remove("is-open");
  };

  trigger.addEventListener("mouseenter", open);
  trigger.addEventListener("mouseleave", close);
  trigger.addEventListener("focus", open);
  trigger.addEventListener("blur", close);
  /* A tap opens it — the path a touch device has, where there is no hover. It
   * never toggles: on a pointer device the hover has already opened the popup
   * by the time the click lands, so toggling would read as "clicking it closes
   * it". Escape, a click elsewhere, or the pointer leaving all close it. */
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    open();
  });
  document.addEventListener("click", (e) => {
    if (!trigger.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  return pop;
}
