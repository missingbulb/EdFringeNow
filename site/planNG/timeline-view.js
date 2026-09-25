/* The year's festivals, drawn: the strip across the top of the page, with the
 * reader's trip banded across it and a handle at each end of the band.
 *
 * The layout rules are lib/timeline.js's; this draws them. Positions are
 * logical (inset-inline-start), so on a right-to-left page the year runs from
 * the right as the reader expects, with no maths of its own — only a dragged
 * handle has to read the pointer the other way round.
 */

import { dayFrac, monthTicks, stackRows, timelineBars } from "./lib/timeline.js";
import { shiftDay } from "./lib/pool.js";
import { escapeHtml, t } from "./i18n/i18n.js";

const ROW_PX = 30;
const LABEL_GAP_PX = 10;
const LATE_FRAC = 0.72;
const BAR_MIN_PX = 10;

/**
 * @param {HTMLElement} host
 * @param {object} o
 * @param {object} o.registry the festival registry
 * @param {object} o.span from timelineSpan()
 * @param {string} o.todayISO
 * @param {string|null} o.focusKey the focused edition's key
 * @param {{from: string, to: string}|null} o.period the trip
 * @param {(festival: object, edition: object) => string} o.label a bar's words
 * @param {(iso: string) => string} o.monthLabel
 * @param {(iso: string) => string} o.dayText a day as a handle announces it
 */
export function renderTimeline(host, { registry, span, todayISO, focusKey, period, label, monthLabel, dayText }) {
  const bars = timelineBars(registry, span);
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
      handle("to", "trip.to", period.to, tripEdges(span, period).end, dayText)
    : "";
  const today = `<span class="tl-today" aria-hidden="true" style="inset-inline-start:${pct(dayFrac(span, todayISO))}"></span>`;
  const items = bars
    .map((bar) => {
      const focused = bar.key === focusKey;
      const words = label(bar.festival, bar.edition);
      // Late in the year the label would run off the strip, so it is hung
      // from the bar's far end and reads back towards the start instead.
      const late = bar.start > LATE_FRAC;
      const place = late ? `inset-inline-end:${pct(1 - bar.end)}` : `inset-inline-start:${pct(bar.start)}`;
      return (
        `<button type="button" class="tl-item${focused ? " is-focus" : ""}${bar.hasData ? "" : " is-empty"}${late ? " tl-item--late" : ""}"` +
        ` data-edition="${escapeHtml(bar.key)}" data-festival="${escapeHtml(bar.festival.id)}"` +
        ` aria-pressed="${focused}" data-span="${bar.end - bar.start}" style="${place}"` +
        ` title="${escapeHtml(words.tip)}">` +
        `<span class="tl-bar" aria-hidden="true"></span>` +
        `<span class="tl-label">${escapeHtml(words.name)}</span></button>`
      );
    })
    .join("");
  host.innerHTML =
    `<div class="tl-months">${months}</div>` +
    `<div class="tl-track" role="group" aria-label="${escapeHtml(t("timeline.label"))}">${band}${today}${items}</div>`;
  if (!bars.length) {
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

function bandStyle(span, trip) {
  const { start, end } = tripEdges(span, trip);
  return `inset-inline-start:${pct(start)};width:${pct(end - start)}`;
}

/* One end of the band: a slider a pointer drags and the arrow keys step. */
function handle(end, labelKey, iso, frac, dayText) {
  return (
    `<span class="tl-handle tl-handle--${end}" role="slider" tabindex="0" data-end="${end}"` +
    ` aria-label="${escapeHtml(t(labelKey))}" aria-valuetext="${escapeHtml(dayText(iso))}"` +
    ` style="inset-inline-start:${pct(frac)}"></span>`
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
}

/**
 * Let the reader move either end of the trip: drag a handle along the year,
 * or step it a day with the arrow keys. A drag previews in place and commits
 * once, on release; a key commits at once.
 * @param {HTMLElement} host
 * @param {object} o
 * @param {() => object} o.span
 * @param {() => {from: string, to: string}} o.trip the trip as it stands
 * @param {(trip: object) => {from: string, to: string}} o.normalize what the
 *   page would make of a trip, so the preview shows what the release commits
 * @param {(trip: object, moved: "from"|"to") => void} o.commit
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
  host.addEventListener("pointerdown", (e) => {
    const h = e.target.closest(".tl-handle");
    if (!h) return;
    e.preventDefault();
    h.setPointerCapture(e.pointerId);
    drag = { end: h.dataset.end, pointerId: e.pointerId, trip: { ...trip() } };
  });
  host.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.trip = normalize({ ...trip(), [drag.end]: dayAt(e.clientX, drag.end) }, drag.end);
    previewTrip(host, span(), drag.trip);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { end, trip: next } = drag;
    drag = null;
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
  track.style.height = `${count * ROW_PX + 6}px`;
}
