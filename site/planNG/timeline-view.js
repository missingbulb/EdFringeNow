/* The year's festivals, drawn: the strip across the top of the page, with the
 * reader's trip banded across it and a handle at each end of the band.
 *
 * The layout rules are lib/timeline.js's; this draws them. Positions are
 * logical (inset-inline-start), so on a right-to-left page the year runs from
 * the right as the reader expects, with no maths of its own — only a dragged
 * handle has to read the pointer the other way round.
 */

import { dayFrac, monthTicks, stackRows, timelineBunches } from "./lib/timeline.js";
import { shiftDay } from "./lib/pool.js";
import { escapeHtml, t } from "./i18n/i18n.js";

const ROW_PX = 30;
const LABEL_GAP_PX = 10;
const LATE_FRAC = 0.72;
const BAR_MIN_PX = 32;
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
 * @param {(festival: object, edition: object) => string} o.label a lone festival's words
 * @param {(bunch: object) => {name: string, tip: string}} o.bunchLabel a city's
 *   pill's words, when it holds more than one festival
 * @param {(country: string) => string} o.flag a country's flag, as HTML
 * @param {(iso: string) => string} o.monthLabel
 * @param {(iso: string) => string} o.dayText a day as a handle announces it
 * @param {(days: number) => string} o.lengthText the trip's length, in words
 * @param {string} o.todayText the word on today's sign
 * @param {(festival: object, edition: object, hasData: boolean) => string} o.festivalCard
 *   the card a festival shows when pointed at, as HTML
 * @param {{html: string, settled: boolean, tip: string}|null} [o.travel] the
 *   picture beside each end of the trip saying how the reader gets there and
 *   back, or null where there is no journey to plan
 * @param {(bunch: object) => string} o.bunchCard the card a city's pill of
 *   several festivals shows, as HTML
 * @param {{from: string, to: string, days: number}[]} [o.breaks] the breaks the
 *   reader's public holidays make inside the span, an orb each on the months
 * @param {(brk: object) => string} [o.breakCard] the card an orb shows, as HTML
 */
export function renderTimeline(host, o) {
  const { registry, span, todayISO, focusKey, period, label, monthLabel, dayText, lengthText, todayText, festivalCard } = o;
  const { breaks = [], breakCard, bunchLabel, bunchCard, flag, travel = null } = o;
  const cards = [];
  const card = (html) => cards.push(html) - 1;
  const bunches = timelineBunches(registry, span);
  const months = monthTicks(span)
    .map(
      (m, i) =>
        `<span class="tl-month${i === 0 ? " tl-month--first" : ""}" style="inset-inline-start:${pct(m.frac)}">` +
        `${escapeHtml(monthLabel(m.date))}</span>`
    )
    .join("");
  const shown = period && period.to >= span.from && period.from <= span.to;
  const band = shown
    ? `<span class="tl-period" aria-hidden="true" style="${bandStyle(span, period)}"></span>` +
      handle("from", "trip.from", period.from, tripEdges(span, period).start, dayText) +
      handle("to", "trip.to", period.to, tripEdges(span, period).end, dayText) +
      `<span class="tl-day tl-day--from" aria-hidden="true" style="inset-inline-start:${pct(tripEdges(span, period).start)}">${dayOfMonth(period.from)}</span>` +
      `<span class="tl-day tl-day--to" aria-hidden="true" style="inset-inline-start:${pct(tripEdges(span, period).end)}">${dayOfMonth(period.to)}</span>` +
      `<span class="tl-length" style="${lengthStyle(span, period)}">${escapeHtml(lengthText(daysBetween(period)))}</span>` +
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
  const items = bunches
    .map((bunch) => {
      const { lead } = bunch;
      const many = bunch.bars.length > 1;
      const focused = bunch.bars.some((bar) => bar.key === focusKey);
      const words = many ? bunchLabel(bunch) : label(lead.festival, lead.edition);
      const html = many ? bunchCard(bunch) : festivalCard(lead.festival, lead.edition, lead.hasData);
      // Late in the year the label would run off the strip, so it is hung
      // from the pill's far end and reads back towards the start instead.
      const late = bunch.start > LATE_FRAC;
      const place = late ? `inset-inline-end:${pct(1 - bunch.end)}` : `inset-inline-start:${pct(bunch.start)}`;
      // Inside a city's pill each festival's run is a shade of its own, so
      // the days most festivals share read darkest.
      const width = bunch.end - bunch.start;
      const runs = many
        ? bunch.bars
            .map(
              (bar) =>
                `<span class="tl-run" style="inset-inline-start:${pct((bar.start - bunch.start) / width)};` +
                `width:${pct((bar.end - bar.start) / width)}"></span>`
            )
            .join("")
        : "";
      return (
        `<button type="button" class="tl-item${focused ? " is-focus" : ""}${bunch.hasData ? "" : " is-empty"}` +
        `${many ? " tl-item--bunch" : ""}${late ? " tl-item--late" : ""}"` +
        ` data-edition="${escapeHtml(bunch.key)}" data-festival="${escapeHtml(lead.festival.id)}"` +
        `${many ? ` data-bunch="${bunch.bars.length}"` : ""}` +
        ` aria-pressed="${focused}" data-span="${width}" style="${place}"` +
        ` aria-label="${escapeHtml(words.tip)}" data-card="${card(html)}">` +
        `<span class="tl-bar" aria-hidden="true">${runs}${flag(lead.festival.country)}</span>` +
        `<span class="tl-label">${escapeHtml(words.name)}</span></button>`
      );
    })
    .join("");
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
  host.innerHTML =
    `<div class="tl-months">${months}${orbs}${today}</div>` +
    `<div class="tl-track" role="group" aria-label="${escapeHtml(t("timeline.label"))}">${band}${items}</div>` +
    `<div class="tl-card" role="tooltip" hidden></div>`;
  host._cards = cards;
  if (!bunches.length) {
    host.querySelector(".tl-track").insertAdjacentHTML(
      "beforeend",
      `<p class="tl-none" data-i18n-slot="timeline.none">${escapeHtml(t("timeline.none"))}</p>`
    );
  }
  layoutRows(host);
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

function lengthStyle(span, trip) {
  const { start, end } = tripEdges(span, trip);
  return `inset-inline-start:${pct((start + end) / 2)}`;
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
  const length = host.querySelector(".tl-length");
  if (length) length.style.insetInlineStart = pct((start + end) / 2);
  for (const [which, frac] of [["from", start], ["to", end]]) {
    const day = host.querySelector(`.tl-day--${which}`);
    if (day) {
      day.style.insetInlineStart = pct(frac);
      day.textContent = dayOfMonth(trip[which]);
    }
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

/** Stack the bars into rows once their labels can be measured. */
export function layoutRows(host) {
  const track = host.querySelector(".tl-track");
  if (!track) return;
  const box = track.getBoundingClientRect();
  if (!box.width) return;
  const rtl = getComputedStyle(track).direction === "rtl";
  const items = [...track.querySelectorAll(".tl-item")];
  // A bar is as long as its run, but never shorter than something a finger
  // can find: a five-day festival is a few pixels of a year on a phone.
  for (const el of items) {
    el.querySelector(".tl-bar").style.width = `${Math.max(BAR_MIN_PX, Number(el.dataset.span) * box.width)}px`;
  }
  const extents = items.map((el) => {
    const r = el.getBoundingClientRect();
    return rtl ? { from: box.right - r.right, to: box.right - r.left } : { from: r.left - box.left, to: r.right - box.left };
  });
  const rows = stackRows(extents, LABEL_GAP_PX);
  items.forEach((el, i) => {
    el.style.top = `${rows[i] * ROW_PX}px`;
  });
  const count = rows.length ? Math.max(...rows) + 1 : 1;
  track.style.height = `calc(${count * ROW_PX + 6}px + var(--lane))`;
  fitWays(host);
}
