/* The year's festivals, drawn: the strip across the top of the page, with the
 * reader's trip banded across it and a handle at each end of the band.
 *
 * The layout rules are lib/timeline.js's; this draws them. Positions are
 * logical (inset-inline-start), so on a right-to-left page the year runs from
 * the right as the reader expects, with no maths of its own — only a dragged
 * handle has to read the pointer the other way round.
 */

import { dayFrac, fillRows, monthTicks, rankBars, timelineBars } from "./lib/timeline.js";
import { typeOfKind } from "./lib/festival-filter.js";
import { shiftDay } from "./lib/pool.js";
import { escapeHtml, t } from "./i18n/i18n.js";

// As many rows as stand level with the types and the globe beside the year.
const ROWS = 9;
const ROW_PX = 20;
const GAP_PX = 8;
const BAR_PX = 12;
const BAR_MIN_PX = 10;
const FILL = 0.7;
const NAMES_MAX = 10;
const LONG_DAYS = 7;
const FAINT_PX = 5;
const LEAVE_MS = 450;
// The lens: how far either side of the pointer it reaches, and how much it
// widens the weeks right under it.
const LENS_PX = 200;
const LENS_POWER = 4;
// A name inside a magnified bar is set a little smaller than beside one.
const MAGNIFIED_TEXT = 0.9;
// A holiday orb is sized for the eye, not the strip's scale: a one-day
// holiday is a dot, and a longer break grows more slowly than its days.
const ORB_PX = 10;
const ORB_GROWTH_PX = 6;
const orbPx = (days) => Math.round(ORB_PX + ORB_GROWTH_PX * Math.sqrt(days - 1));
const CHEER_MS = 1100;
let cheerUntil = 0;

/**
 * @param {HTMLElement} host
 * @param {object} o
 * @param {object} o.registry the festival registry
 * @param {object} o.span from timelineSpan()
 * @param {string} o.todayISO
 * @param {string|null} o.focusKey the focused edition's key
 * @param {{from: string, to: string}|null} o.period the trip
 * @param {(festival: object, edition: object) => string} o.label a festival's words
 * @param {(iso: string) => string} o.monthLabel
 * @param {(iso: string) => string} o.dayText a day as a handle announces it
 * @param {(days: number) => string} o.lengthText the trip's length, in words
 * @param {string} o.todayText the word on today's sign
 * @param {(festival: object, edition: object, hasData: boolean) => string} o.festivalCard
 *   the card a festival shows when pointed at, as HTML
 * @param {{html: string, settled: boolean, tip: string}|null} [o.travel] the
 *   picture beside each end of the trip saying how the reader gets there and
 *   back, or null where there is no journey to plan
 * @param {{from: string, to: string, days: number}[]} [o.breaks] the breaks the
 *   reader's public holidays make inside the span, an orb each on the months
 * @param {(brk: object) => string} [o.breakCard] the card an orb shows, as HTML
 * @param {string} [o.noneKey] what an empty strip says, as a translation key
 */
export function renderTimeline(host, o) {
  const { registry, span, todayISO, focusKey, period, label, monthLabel, dayText, lengthText, todayText, festivalCard } = o;
  const { breaks = [], breakCard, travel = null, noneKey = "timeline.none" } = o;
  const cards = [];
  const card = (html) => cards.push(html) - 1;
  const bars = rankBars(timelineBars(registry, span), focusKey);
  const months = monthTicks(span)
    .map(
      (m, i) =>
        `<span class="tl-month${i === 0 ? " tl-month--first" : ""}" data-frac="${m.frac}" style="inset-inline-start:${pct(m.frac)}">` +
        `${escapeHtml(monthLabel(m.date))}</span>`
    )
    .join("");
  const shown = period && period.to >= span.from && period.from <= span.to;
  const band = shown
    ? `<span class="tl-period" aria-hidden="true" style="${bandStyle(span, period)}"></span>` +
      handle("from", "trip.from", period.from, tripEdges(span, period).start, dayText) +
      handle("to", "trip.to", period.to, tripEdges(span, period).end, dayText) +
      `<span class="tl-span" aria-hidden="true" style="${spanStyle(span, period)}">` +
      `<span class="tl-chip tl-day tl-day--from">${dayOfMonth(period.from)}</span>` +
      `<span class="tl-chip tl-length">${escapeHtml(lengthText(daysBetween(period)))}</span>` +
      `<span class="tl-chip tl-day tl-day--to">${dayOfMonth(period.to)}</span></span>` +
      (travel ? way("from", "out", tripEdges(span, period).start, travel) + way("to", "back", tripEdges(span, period).end, travel) : "")
    : "";
  // Today: a small figure standing on the months, holding up a sign.
  const today =
    `<span class="tl-today${Date.now() < cheerUntil ? " is-cheering" : ""}" style="inset-inline-start:${pct(dayFrac(span, todayISO) + 0.5 / span.days)}">` +
    `<span class="tl-sign" data-i18n-slot="timeline.today">${escapeHtml(todayText)}</span>` +
    `<svg class="tl-dude" viewBox="0 0 24 34" width="24" height="34" aria-hidden="true">` +
    `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">` +
    `<circle cx="10" cy="6" r="3.2" fill="var(--paper)"/>` +
    `<line x1="10" y1="9.2" x2="10" y2="21"/>` +
    `<line class="dude-arm" x1="10" y1="12" x2="5.5" y2="18"/>` +
    `<line x1="10" y1="12" x2="16" y2="11"/>` +
    `<line class="dude-leg" x1="10" y1="21" x2="6.5" y2="33"/>` +
    `<line x1="10" y1="21" x2="13.5" y2="33"/>` +
    `</g></svg></span>`;
  const orbs = breaks
    .map((brk) => {
      const px = orbPx(brk.days);
      const mid = (dayFrac(span, brk.from) + dayFrac(span, brk.to) + 1 / span.days) / 2;
      return (
        `<button type="button" class="tl-orb" data-from="${brk.from}" data-to="${brk.to}" data-days="${brk.days}"` +
        ` aria-label="${escapeHtml(brk.names.join(" · "))}" data-card="${card(breakCard(brk))}"` +
        ` style="inset-inline-start:${pct(mid)};width:${px}px;margin-inline-start:${-px / 2}px"></button>`
      );
    })
    .join("");
  // The rows outlive the redraw, so a festival still drawn moves to its new
  // place rather than being drawn afresh there (23.39).
  const rows = host.querySelector(".tl-rows") || document.createElement("div");
  rows.className = "tl-rows";
  host.innerHTML =
    `<div class="tl-months">${months}${orbs}${today}</div>` +
    `<div class="tl-track${shown ? " has-trip" : ""}" role="group" aria-label="${escapeHtml(t("timeline.label"))}">` +
    `${band}<div class="tl-rows-slot"></div></div>` +
    `<div class="tl-card" role="tooltip" hidden></div>`;
  host.querySelector(".tl-rows-slot").replaceWith(rows);
  host._cards = cards;
  const kept = new Map([...rows.querySelectorAll(".tl-item:not(.is-leaving)")].map((el) => [el.dataset.edition, el]));
  rows.querySelector(".tl-none")?.remove();
  const entering = [];
  host._order = bars.map((bar) => {
    const words = label(bar.festival, bar.edition);
    let el = kept.get(bar.key);
    kept.delete(bar.key);
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.innerHTML = `<span class="tl-bar" aria-hidden="true"></span><span class="tl-label"></span>`;
      el.classList.add("is-entering");
      entering.push(el);
      rows.append(el);
    }
    const focused = bar.key === focusKey;
    el.className = `tl-item${focused ? " is-focus" : ""}${bar.hasData ? "" : " is-empty"}${
      el.classList.contains("is-entering") ? " is-entering" : ""
    }`;
    Object.assign(el.dataset, {
      edition: bar.key,
      festival: bar.festival.id,
      type: typeOfKind(bar.festival.kind) || "",
      start: bar.start,
      end: bar.end,
      long: String(bar.end - bar.start >= LONG_DAYS / span.days),
      card: card(festivalCard(bar.festival, bar.edition, bar.hasData)),
    });
    el.setAttribute("aria-pressed", String(focused));
    el.setAttribute("aria-label", words.tip);
    el.querySelector(".tl-label").textContent = words.name;
    return el;
  });
  for (const el of kept.values()) leave(el);
  if (!bars.length) {
    rows.insertAdjacentHTML("beforeend", `<p class="tl-none" data-i18n-slot="${noneKey}">${escapeHtml(t(noneKey))}</p>`);
  }
  layoutRows(host);
  wireLens(host);
  if (entering.length) requestAnimationFrame(() => entering.forEach((el) => el.classList.remove("is-entering")));
}

/* A festival the filters no longer draw fades out where it stands, then goes. */
function leave(el) {
  el.classList.add("is-leaving");
  el.tabIndex = -1;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) el.remove();
  else setTimeout(() => el.remove(), LEAVE_MS);
}

const pct = (f) => `${(f * 100).toFixed(3)}%`;

/* Where the trip's band starts and ends along the span, 0..1: the start of its
 * first day and the end of its last. */
function tripEdges(span, trip) {
  return {
    start: Math.max(0, dayFrac(span, trip.from)),
    end: Math.min(1, dayFrac(span, trip.to) + 1 / span.days),
  };
}

/* A trip's end names only its day: the months are already written above it. */
const dayOfMonth = (iso) => String(Number(iso.slice(8, 10)));

const daysBetween = (trip) => Math.round((Date.parse(trip.to) - Date.parse(trip.from)) / 86400000) + 1;

/* The trip measured under the rows: centred on the band and at least as wide,
 * its first day at one end, its last at the other and its length between. */
function spanStyle(span, trip) {
  const { start, end } = tripEdges(span, trip);
  return `inset-inline-start:${pct((start + end) / 2)};min-width:${pct(end - start)}`;
}

function bandStyle(span, trip) {
  const { start, end } = tripEdges(span, trip);
  return `inset-inline-start:${pct(start)};width:${pct(end - start)}`;
}

/* The way there beside the trip's first day, and home beside its last: one
 * button each, both asking the same two-way question. */
function way(end, flight, frac, travel) {
  return (
    `<button type="button" class="tl-way tl-way--${end}${travel.settled ? "" : " is-unsettled"}"` +
    ` data-origin="${travel.settled ? "card" : "ask"}" data-flight="${flight}"` +
    ` aria-label="${escapeHtml(travel.tip)}" data-tip="${escapeHtml(travel.tip)}"` +
    ` style="inset-inline-start:${pct(frac)}">${travel.html}</button>`
  );
}

/* One end of the band: a slider a pointer drags and the arrow keys step. */
function handle(end, labelKey, iso, frac, dayText) {
  return (
    `<span class="tl-handle tl-handle--${end}" role="slider" tabindex="0" data-end="${end}" data-date="${iso}"` +
    ` aria-label="${escapeHtml(t(labelKey))}" aria-valuetext="${escapeHtml(dayText(iso))}"` +
    ` style="inset-inline-start:${pct(frac)}"><span class="tl-grip" aria-hidden="true"></span></span>`
  );
}

/** Move the band and its handles to a trip still being dragged, in place. */
export function previewTrip(host, span, trip) {
  const band = host.querySelector(".tl-period");
  if (!band) return;
  band.setAttribute("style", bandStyle(span, trip));
  const { start, end } = tripEdges(span, trip);
  host.querySelector(".tl-handle--from").style.insetInlineStart = pct(start);
  host.querySelector(".tl-handle--to").style.insetInlineStart = pct(end);
  const measure = host.querySelector(".tl-span");
  if (measure) measure.setAttribute("style", spanStyle(span, trip));
  for (const [which, frac] of [["from", start], ["to", end]]) {
    const day = host.querySelector(`.tl-day--${which}`);
    if (day) day.textContent = dayOfMonth(trip[which]);
    const icon = host.querySelector(`.tl-way--${which}`);
    if (icon) icon.style.insetInlineStart = pct(frac);
  }
  fitWays(host);
}

/* A picture with no room between its end of the trip and the strip's edge is
 * left out rather than squeezed or pushed off: the other end still asks. */
function fitWays(host) {
  const track = host.querySelector(".tl-track");
  if (!track) return;
  const box = track.getBoundingClientRect();
  for (const icon of track.querySelectorAll(".tl-way")) {
    icon.hidden = false;
    const r = icon.getBoundingClientRect();
    icon.hidden = r.left < box.left || r.right > box.right;
  }
  // The trip's measure slides back inside the strip rather than run off it.
  const measure = track.querySelector(".tl-span");
  if (measure) {
    measure.style.translate = "";
    const r = measure.getBoundingClientRect();
    const shift = r.left < box.left ? box.left - r.left : r.right > box.right ? box.right - r.right : 0;
    if (shift) measure.style.translate = `${shift}px 0`;
  }
}

/** Today's figure cheers: a choice was just made somewhere on the page. */
export function cheer(host) {
  cheerUntil = Date.now() + CHEER_MS;
  const figure = host.querySelector(".tl-today");
  if (!figure) return;
  // Restarted rather than left running, so every choice gets its own cheer.
  figure.classList.remove("is-cheering");
  void figure.offsetWidth;
  figure.classList.add("is-cheering");
  setTimeout(() => {
    if (Date.now() >= cheerUntil) host.querySelector(".tl-today")?.classList.remove("is-cheering");
  }, CHEER_MS);
}

/**
 * The cards the strip's festivals and holiday orbs show: one card, filled and
 * placed beneath whatever the pointer or the keyboard is on.
 * @param {HTMLElement} host
 */
export function wireTimelineCards(host) {
  const show = (el) => {
    const box = host.querySelector(".tl-card");
    const html = host._cards && host._cards[Number(el.dataset.card)];
    if (!box || html == null) return;
    box.innerHTML = html;
    box.hidden = false;
    const outer = host.getBoundingClientRect();
    const at = el.getBoundingClientRect();
    const target = el.classList.contains("tl-item") ? el.querySelector(".tl-bar").getBoundingClientRect() : at;
    const width = box.offsetWidth;
    const left = Math.min(Math.max(0, target.left + target.width / 2 - outer.left - width / 2), outer.width - width);
    box.style.left = `${left}px`;
    box.style.top = `${at.bottom - outer.top + 6}px`;
  };
  const hide = () => {
    const box = host.querySelector(".tl-card");
    if (box) box.hidden = true;
  };
  host.addEventListener("pointerover", (e) => {
    const el = e.target.closest("[data-card]");
    if (el) show(el);
  });
  host.addEventListener("pointerout", (e) => {
    const el = e.target.closest("[data-card]");
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  host.addEventListener("focusin", (e) => {
    const el = e.target.closest("[data-card]");
    if (el) show(el);
  });
  host.addEventListener("focusout", hide);
}

/* How far a press must travel along the band before it is a drag, not a click. */
const DRAG_PX = 4;

/**
 * Let the reader move either end of the trip: drag a handle along the year,
 * or step it a day with the arrow keys; or drag the band itself to move the
 * whole trip, its length kept. A drag previews in place and commits once, on
 * release; a key commits at once. A press on the band that never travels is
 * left to be the click it was, on whatever festival it landed.
 * @param {HTMLElement} host
 * @param {object} o
 * @param {() => object} o.span
 * @param {() => {from: string, to: string}} o.trip the trip as it stands
 * @param {(trip: object) => {from: string, to: string}} o.normalize what the
 *   page would make of a trip, so the preview shows what the release commits
 * @param {(trip: object, moved: "from"|"to"|null) => void} o.commit `moved`
 *   is null when the whole band moved
 */
export function wireTripHandles(host, { span, trip, normalize, commit }) {
  let drag = null;
  const dayAt = (clientX, end) => {
    const track = host.querySelector(".tl-track").getBoundingClientRect();
    const rtl = getComputedStyle(host).direction === "rtl";
    const frac = Math.min(1, Math.max(0, (rtl ? track.right - clientX : clientX - track.left) / track.width));
    const s = span();
    // A handle sits on a day's edge: the first day starts at it, the last
    // day ends at it.
    const edge = Math.round(frac * s.days);
    return end === "from" ? shiftDay(s.from, Math.min(edge, s.days - 1)) : shiftDay(s.from, Math.max(edge, 1) - 1);
  };
  // Along the track from its start, in days, whichever way the page runs.
  const daysAlong = (clientX) => {
    const track = host.querySelector(".tl-track").getBoundingClientRect();
    const rtl = getComputedStyle(host).direction === "rtl";
    return ((rtl ? track.right - clientX : clientX - track.left) / track.width) * span().days;
  };
  const onBand = (e) => {
    const band = host.querySelector(".tl-period");
    if (!band || !e.target.closest(".tl-track") || e.target.closest(".tl-handle")) return false;
    const box = band.getBoundingClientRect();
    return e.clientX >= box.left && e.clientX <= box.right;
  };
  // The band moved by a whole number of days, held inside the year shown.
  const shifted = (from, days) => {
    const s = span();
    const last = Math.round((Date.parse(s.to) - Date.parse(from.to)) / 86400000);
    const first = Math.round((Date.parse(s.from) - Date.parse(from.from)) / 86400000);
    const by = Math.min(last, Math.max(first, days));
    return { from: shiftDay(from.from, by), to: shiftDay(from.to, by) };
  };
  host.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".tl-handle");
    if (h) {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      drag = { end: h.dataset.end, pointerId: e.pointerId, trip: { ...trip() } };
      return;
    }
    if (e.button !== 0 || !onBand(e)) return;
    drag = { end: null, pointerId: e.pointerId, x: e.clientX, at: daysAlong(e.clientX), start: { ...trip() }, trip: { ...trip() }, moving: false };
  });
  host.addEventListener("pointermove", (e) => {
    const track = host.querySelector(".tl-track");
    if (!drag) {
      if (track) track.classList.toggle("is-grab", e.pointerType === "mouse" && onBand(e));
      return;
    }
    if (e.pointerId !== drag.pointerId) return;
    if (drag.end) {
      drag.trip = normalize({ ...trip(), [drag.end]: dayAt(e.clientX, drag.end) }, drag.end);
    } else {
      if (!drag.moving) {
        if (Math.abs(e.clientX - drag.x) < DRAG_PX) return;
        drag.moving = true;
        track.setPointerCapture(e.pointerId);
        track.classList.add("is-dragging");
      }
      drag.trip = shifted(drag.start, Math.round(daysAlong(e.clientX) - drag.at));
    }
    previewTrip(host, span(), drag.trip);
  });
  // A band that was dragged is not also a click on the festival it started on.
  const swallowClick = () => {
    const stop = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    host.addEventListener("click", stop, { capture: true, once: true });
    setTimeout(() => host.removeEventListener("click", stop, { capture: true }), 0);
  };
  const release = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { end, trip: next, moving } = drag;
    drag = null;
    host.querySelector(".tl-track")?.classList.remove("is-dragging");
    if (!end && !moving) return;
    if (!end) swallowClick();
    const now = trip();
    if (next.from !== now.from || next.to !== now.to) commit(next, end);
  };
  host.addEventListener("pointerup", release);
  host.addEventListener("pointercancel", release);
  host.addEventListener("keydown", (e) => {
    const h = e.target.closest(".tl-handle");
    if (!h) return;
    const rtl = getComputedStyle(host).direction === "rtl";
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const end = h.dataset.end;
    const by = e.key === "ArrowRight" || e.key === "ArrowLeft" ? (rtl ? -step : step) : step;
    const now = trip();
    commit(normalize({ ...now, [end]: shiftDay(now[end], by) }, end), end);
  });
}

/* Where a faint festival sits across the strip's height: anywhere, but always
 * the same place for the same festival. */
function faintTop(key) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % (ROWS * ROW_PX - FAINT_PX);
}

/* A festival's box on the strip, along the year from its start. */
function place(el, x, w, y, h) {
  el.style.insetInlineStart = `${x}px`;
  el.style.width = `${w}px`;
  el.style.top = `${y}px`;
  el.style.height = `${h}px`;
}

/**
 * Put the festivals on the rows: by name while the year draws few enough
 * that every name fits, else the most searched as bars alone until the rows
 * are full enough, every other one faint behind them (23.37, 23.38).
 */
export function layoutRows(host) {
  const track = host.querySelector(".tl-track");
  if (!track) return;
  const width = track.getBoundingClientRect().width;
  if (!width) return;
  const items = (host._order || []).filter((el) => el.isConnected);
  // A name's own width, read while it stands beside its bar.
  for (const el of items) el.classList.remove("is-magnified");
  for (const el of items) el.dataset.lw = el.querySelector(".tl-label").scrollWidth;
  const geo = items.map((el) => {
    const x = Number(el.dataset.start) * width;
    return { x, w: Math.max(BAR_MIN_PX, (Number(el.dataset.end) - Number(el.dataset.start)) * width) };
  });
  let rows = null;
  const late = geo.map(() => false);
  if (items.length <= NAMES_MAX) {
    // A name runs after its bar, or before it where it would run off the end.
    const extents = items.map((el, i) => {
      const { x, w } = geo[i];
      const name = Number(el.dataset.lw) + 6;
      late[i] = x + w + name > width && x - name >= 0;
      return late[i] ? { from: x - name, to: x + w } : { from: x, to: x + w + name };
    });
    rows = fillRows(extents, { rows: ROWS, width, gap: GAP_PX, fill: Infinity });
    if (rows.some((row) => row < 0)) rows = null;
  }
  const named = Boolean(rows);
  rows ||= fillRows(
    geo.map(({ x, w }, i) => ({ from: x, to: x + w, long: items[i].dataset.long === "true" })),
    { rows: ROWS, width, gap: GAP_PX, fill: FILL }
  );
  track.classList.toggle("is-named", named);
  items.forEach((el, i) => {
    const faint = rows[i] < 0;
    el.classList.toggle("is-faint", faint);
    el.classList.toggle("tl-item--late", named && late[i]);
    el.tabIndex = faint ? -1 : 0;
    if (faint) el.setAttribute("aria-hidden", "true");
    else el.removeAttribute("aria-hidden");
    const h = faint ? FAINT_PX : BAR_PX;
    const y = faint ? faintTop(el.dataset.edition) : rows[i] * ROW_PX + (ROW_PX - BAR_PX) / 2;
    Object.assign(el.dataset, { x: geo[i].x, w: geo[i].w, y, h });
    place(el, geo[i].x, geo[i].w, y, h);
  });
  host.querySelector(".tl-rows").style.height = `${ROWS * ROW_PX}px`;
  host._lensWidth = width;
  fitWays(host);
}


/* Where a point along the strip lands under the lens: the weeks right under
 * the pointer spread wide and those at the lens's rim close up, so nothing
 * outside it moves. */
function underLens(x, at) {
  const d = x - at;
  const far = Math.abs(d) / LENS_PX;
  if (far >= 1) return x;
  return at + Math.sign(d) * LENS_PX * (((LENS_POWER + 1) * far) / (LENS_POWER * far + 1));
}

/**
 * Pointing along the year magnifies the weeks under the pointer, as a dock
 * does: the festivals and the months there spread out, the bars nearest grow,
 * and a bar grown wide enough shows its name (23.40).
 */
function wireLens(host) {
  if (host._lens) return;
  host._lens = true;
  const lensAt = (e) => {
    const track = host.querySelector(".tl-track");
    if (!track || e.pointerType !== "mouse" || track.classList.contains("is-dragging")) return null;
    const box = track.getBoundingClientRect();
    if (e.clientY < box.top || e.clientY > box.bottom) return null;
    return getComputedStyle(track).direction === "rtl" ? box.right - e.clientX : e.clientX - box.left;
  };
  host.addEventListener("pointermove", (e) => {
    const at = lensAt(e);
    if (at == null) return clearLens(host);
    host.querySelector(".tl-track").classList.add("is-lens");
    for (const el of host._order || []) {
      if (!el.isConnected || el.classList.contains("is-leaving")) continue;
      const x = Number(el.dataset.x);
      const w = Number(el.dataset.w);
      const left = underLens(x, at);
      const right = underLens(x + w, at);
      const near = Math.max(0, 1 - Math.abs(x + w / 2 - at) / LENS_PX);
      const faint = el.classList.contains("is-faint");
      const h = Number(el.dataset.h) + (faint ? 0 : Math.round(8 * near));
      place(el, left, Math.max(BAR_MIN_PX, right - left), Number(el.dataset.y) - (h - Number(el.dataset.h)) / 2, h);
      el.classList.toggle("is-magnified", !faint && near > 0 && right - left >= Number(el.dataset.lw) * MAGNIFIED_TEXT + 14);
    }
    const width = host._lensWidth || 0;
    for (const m of host.querySelectorAll(".tl-month")) m.style.insetInlineStart = `${underLens(Number(m.dataset.frac) * width, at)}px`;
  });
  host.addEventListener("pointerleave", () => clearLens(host));
}

function clearLens(host) {
  const track = host.querySelector(".tl-track");
  if (!track || !track.classList.contains("is-lens")) return;
  track.classList.remove("is-lens");
  for (const el of host._order || []) {
    el.classList.remove("is-magnified");
    if (el.isConnected && el.dataset.x) place(el, Number(el.dataset.x), Number(el.dataset.w), Number(el.dataset.y), Number(el.dataset.h));
  }
  for (const m of host.querySelectorAll(".tl-month")) m.style.insetInlineStart = pct(Number(m.dataset.frac));
}
