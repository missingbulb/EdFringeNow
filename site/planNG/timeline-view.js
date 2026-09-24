/* The year's festivals, drawn: the strip across the top of the page.
 *
 * The layout rules are lib/timeline.js's; this draws them. Positions are
 * logical (inset-inline-start), so on a right-to-left page the year runs from
 * the right as the reader expects, with no maths of its own.
 */

import { dayFrac, monthTicks, stackRows, timelineBars } from "./lib/timeline.js";
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
 * @param {{from: string, to: string}|null} o.period the planning period
 * @param {(festival: object, edition: object) => string} o.label a bar's words
 * @param {(iso: string) => string} o.monthLabel
 */
export function renderTimeline(host, { registry, span, todayISO, focusKey, period, label, monthLabel }) {
  const bars = timelineBars(registry, span);
  const pct = (f) => `${(f * 100).toFixed(3)}%`;
  const months = monthTicks(span)
    .map(
      (m, i) =>
        `<span class="tl-month${i === 0 ? " tl-month--first" : ""}" style="inset-inline-start:${pct(m.frac)}">` +
        `${escapeHtml(monthLabel(m.date))}</span>`
    )
    .join("");
  const band =
    period && period.to >= span.from && period.from <= span.to
      ? `<span class="tl-period" aria-hidden="true" style="inset-inline-start:${pct(Math.max(0, dayFrac(span, period.from)))};` +
        `width:${pct(Math.min(1, dayFrac(span, period.to) + 1 / span.days) - Math.max(0, dayFrac(span, period.from)))}"></span>`
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
