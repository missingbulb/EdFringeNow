/* The festival planner page.
 *
 * The Edinburgh planner's board, grid and schedule, driven by a festival
 * descriptor (./festival.js) rather than by anything Jerusalem-specific: the
 * only strings this module names are its own UI's. It shares the Fringe
 * planner's stylesheet and its pure scheduling engine (../plan/lib/), and
 * shares no state with it at all — every key it stores is under the
 * descriptor's own prefix.
 *
 * Where it deliberately differs from plan/plan.js, and why:
 *   - no favourites upload. This festival publishes no export to upload, so the
 *     board's empty state browses the whole programme (34 shows) instead.
 *   - no availability colours beyond "on sale" and "free". There is no live
 *     ticket feed here and nothing is ever cancelled, so the Fringe grid's
 *     sold-out and offer palette would be drawing a distinction the source
 *     never makes.
 *   - no re-plan animation, no draggable schedule furniture. Both are worth
 *     their code on a 25-day, 4,000-show programme; on five nights they are not
 *     what makes the page good.
 */

import {
  buildSchedule,
  placementDiagnostics,
  slotKey,
  summarize,
} from "../plan/lib/engine.js";
import { slotEndTime, toCsv, toIcs } from "../plan/lib/itinerary.js";
import { distanceKm, travelMinutes } from "../plan/lib/travel.js";
import { attachVersionPopup } from "../shared/version-popup.js";
import { FESTIVAL, festivalStayLink, festivalTravelLinks } from "./festival.js";
import { festivalDates, loadCatalogue, venueCoords } from "./catalogue.js";

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The schedule axis, in the same units and at the same scale as the Fringe
// planner's, so the two boards read alike: one hour is SCH_HOUR_PX tall, a day
// runs 09:00 to 27:00 (03:00 the next morning) and grows if a plan needs more.
const AXIS_TOP_MIN = 9 * 60;
const AXIS_BOTTOM_MIN = 27 * 60;
const SCH_HOUR_PX = 26;
const SCH_HEAD_PX = 42;
const SCH_MIN_BLOCK = 26;
const SCH_TIGHT_PX = 44;
const SCH_GUTTER_PX = 44;
const SCH_EMPTY_COL_PX = 26;

const MODE_META = {
  walk: { emoji: "🚶", verb: "walk" },
  bike: { emoji: "🚲", verb: "cycle" },
  car: { emoji: "🚗", verb: "drive" },
};

const KEY_STARRED = FESTIVAL.storagePrefix + "starred";
const KEY_PREFS = FESTIVAL.storagePrefix + "prefs";

const state = {
  catalogue: null,
  dates: [],          // every festival night, ascending — the grid's columns
  venues: new Map(),
  coords: new Map(),
  starred: new Set(),
  // The date window, as 1-based indices into `state.dates` (the Fringe planner
  // uses days-of-August the same way, which keeps the overlay maths identical).
  d0: 1,
  d1: 1,
  dayStartMin: 9 * 60,
  dayEndMin: 25 * 60,
  meals: [
    { id: "lunch", enabled: false, startMin: 12 * 60 + 30, endMin: 13 * 60 + 30 },
    { id: "dinner", enabled: false, startMin: 18 * 60, endMin: 19 * 60 },
  ],
  minPerDay: 1,
  maxPerDay: 3,
  minGap: 30,
  mode: "walk",
  forced: new Set(),
  schedule: null,
  scheduledSlugs: new Set(),
  selectedSlot: new Map(),
  layout: { trackLeft: 0, trackWidth: 0, dayW: 0 },
  search: { query: "", genres: new Set(), venues: new Set() },
};

// --- small helpers --------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* Every string that came out of the programme is marked as the festival's own
 * language and direction. Without it a browser lays Hebrew out with the page's
 * `lang="en"`, which puts a trailing "?" or a Latin word on the wrong side of
 * the line — the text is still Hebrew, and still wrong. */
function foreign(text) {
  return `<span lang="${FESTIVAL.lang}" dir="${FESTIVAL.dir}">${escapeHtml(text)}</span>`;
}

/** "2026-10-18" → its Date in UTC, which is how every date here is compared. */
function dateOf(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

function dayLabel(iso) {
  const d = dateOf(iso);
  return `${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

function dowOf(iso) {
  return dateOf(iso).getUTCDay();
}

function isWeekend(iso) {
  // Israel's weekend is Friday and Saturday, not Saturday and Sunday. The grid
  // stripes what the audience actually has off work.
  const d = dowOf(iso);
  return d === 5 || d === 6;
}

function minToClock(min) {
  return `${pad2(Math.floor(min / 60) % 24)}:${pad2(min % 60)}`;
}

function minToDayClock(min) {
  return `${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`;
}

function clockToMin(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** The window's first and last night, as ISO dates. */
const windowStartISO = () => state.dates[state.d0 - 1];
const windowEndISO = () => state.dates[state.d1 - 1];

// --- persistence ----------------------------------------------------------

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // A blocked or full localStorage is a working page with no memory, not a
    // broken one.
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* see readStore */
  }
}

function saveStarred() {
  writeStore(KEY_STARRED, [...state.starred]);
}

function savePrefs() {
  writeStore(KEY_PREFS, {
    d0: state.d0,
    d1: state.d1,
    dayStartMin: state.dayStartMin,
    dayEndMin: state.dayEndMin,
    meals: state.meals,
    minPerDay: state.minPerDay,
    maxPerDay: state.maxPerDay,
    minGap: state.minGap,
    mode: state.mode,
  });
}

function restorePrefs() {
  const saved = readStore(KEY_PREFS, null);
  if (!saved) return;
  const n = state.dates.length;
  state.d0 = clamp(Number(saved.d0) || 1, 1, n);
  state.d1 = clamp(Number(saved.d1) || n, state.d0, n);
  state.dayStartMin = Number.isFinite(saved.dayStartMin) ? saved.dayStartMin : state.dayStartMin;
  state.dayEndMin = Number.isFinite(saved.dayEndMin) ? saved.dayEndMin : state.dayEndMin;
  if (Array.isArray(saved.meals)) {
    for (const meal of state.meals) {
      const stored = saved.meals.find((m) => m && m.id === meal.id);
      if (stored) Object.assign(meal, { enabled: !!stored.enabled, startMin: stored.startMin, endMin: stored.endMin });
    }
  }
  state.minPerDay = Number(saved.minPerDay) || state.minPerDay;
  state.maxPerDay = Number(saved.maxPerDay) || state.maxPerDay;
  state.minGap = Number.isFinite(saved.minGap) ? saved.minGap : state.minGap;
  if (MODE_META[saved.mode]) state.mode = saved.mode;
}

// --- chrome ---------------------------------------------------------------

function renderChrome() {
  const [head, tail] = FESTIVAL.wordmark;
  $("wordmark").innerHTML = `${escapeHtml(head)}<span class="logo-now">${escapeHtml(tail)}</span>`;
  $("pageTitle").textContent = FESTIVAL.title;

  const nav = $("siteNav");
  nav.innerHTML =
    FESTIVAL.siteNav
      .map((link) => `<a href="${link.href}" class="nav-link">${escapeHtml(link.label)}</a>`)
      .join("") + `<a href="./" class="nav-link is-active">${escapeHtml(FESTIVAL.navLabel)}</a>`;
}

function renderHeaderHint() {
  const first = state.dates[0];
  const last = state.dates[state.dates.length - 1];
  const year = dateOf(first).getUTCFullYear();
  $("headerHint").textContent =
    `${FESTIVAL.city} · ${dateOf(first).getUTCDate()}–${dayLabel(last)} ${year}`;
}

// --- the board ------------------------------------------------------------

function showBoard() {
  const populated = state.starred.size > 0;
  $("browseStage").hidden = populated;
  $("calWrap").hidden = !populated;
  $("clearFavBtn").hidden = !populated;
  $("legendBtn").hidden = !populated;
  $("planPanel").hidden = !populated;
  $("tripLinks").hidden = !populated;
}

function buildDayHeader() {
  const head = $("dayHead");
  head.innerHTML = "";
  for (const iso of state.dates) {
    const col = document.createElement("div");
    col.className = "day-col" + (isWeekend(iso) ? " wknd" : "");
    col.innerHTML =
      `<span class="day-dow">${DOW_SHORT[dowOf(iso)]}</span>` +
      `<span class="day-num">${dateOf(iso).getUTCDate()}</span>`;
    head.appendChild(col);
  }
}

/** The shows on the grid, in the order the lanes are drawn: by first start. */
function starredShows() {
  return state.catalogue.shows
    .filter((s) => state.starred.has(s.slug))
    .sort((a, b) => {
      const at = a.performances[0]?.start || "";
      const bt = b.performances[0]?.start || "";
      return at.localeCompare(bt) || a.slug.localeCompare(b.slug);
    });
}

function segClass(perf) {
  // Two states, because the source publishes two. See catalogue.js.
  return perf.status === "FREE_NON_TICKETED" ? "seg seg-free" : "seg seg-avail";
}

function buildDayCells(performances) {
  const byDate = new Map();
  for (const p of performances) {
    if (!byDate.has(p.date)) byDate.set(p.date, []);
    byDate.get(p.date).push(p);
  }
  const frag = document.createDocumentFragment();
  state.dates.forEach((iso, i) => {
    const cell = document.createElement("span");
    cell.style.gridColumn = String(i + 1);
    const entries = byDate.get(iso);
    if (entries && entries.length) {
      entries.sort((a, b) => a.start.localeCompare(b.start));
      cell.className = "cell" + (entries.length > 1 ? " cell-multi" : "");
      cell.dataset.day = iso;
      for (const p of entries) {
        const seg = document.createElement("span");
        seg.className = segClass(p);
        seg.dataset.date = p.date;
        seg.dataset.start = p.start;
        seg.title = `${DOW_LONG[dowOf(iso)]} ${dayLabel(iso)}, ${p.start}` +
          (p.free ? " — free entry" : "");
        cell.appendChild(seg);
      }
    }
    frag.appendChild(cell);
  });
  return frag;
}

function buildLanes() {
  const lanesEl = $("lanes");
  lanesEl.innerHTML = "";
  for (const show of starredShows()) {
    const lane = document.createElement("div");
    lane.className = "cal-row lane";
    lane.dataset.slug = show.slug;

    const label = document.createElement("div");
    label.className = "lane-label";
    label.innerHTML =
      `<span class="lane-pin" aria-hidden="true">🔒</span>` +
      `<span class="lane-title">${foreign(show.title)}</span>`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "lane-remove";
    remove.setAttribute("aria-label", `Remove ${show.title} from the list`);
    remove.textContent = "×";
    label.appendChild(remove);

    const track = document.createElement("div");
    track.className = "lane-track";
    track.appendChild(buildDayCells(show.performances));

    const statusEl = document.createElement("div");
    statusEl.className = "lane-status";

    lane.append(label, track, statusEl);
    lanesEl.appendChild(lane);
  }
}

/** The verdict pill each lane wears, mirroring the plan. */
function applyVerdicts(summary, diagnostics) {
  const bySlug = new Map(summary.shows.map((s) => [s.slug, s]));
  for (const lane of $("lanes").querySelectorAll(".lane")) {
    const slug = lane.dataset.slug;
    const show = bySlug.get(slug);
    const scheduled = state.scheduledSlugs.has(slug);
    const inWindow = show ? show.performances.some((p) => p.inWindow) : false;
    lane.classList.toggle("lane--scheduled", scheduled);
    lane.classList.toggle("lane--forced", state.forced.has(slug));
    lane.classList.toggle("lane--out", !inWindow);
    lane.classList.toggle("lane--blocked", diagnostics.blockedSlugs.has(slug));

    const statusEl = lane.querySelector(".lane-status");
    if (scheduled) statusEl.innerHTML = `<span class="st-plan st-in">✓ Scheduled!</span>`;
    else if (!inWindow) statusEl.innerHTML = `<span class="st-dates st-no">📅 No dates</span>`;
    else if (diagnostics.blockedSlugs.has(slug)) statusEl.innerHTML = `<span class="st-conflict st-warn">⏰ Outside your hours</span>`;
    else statusEl.innerHTML = `<span class="st-cant">Can't fit</span>`;

    // Ring the one performance the plan picked, the way the Fringe grid does.
    const picked = state.selectedSlot.get(slug);
    for (const cell of lane.querySelectorAll(".cell")) {
      let pinned = false;
      for (const seg of cell.querySelectorAll(".seg")) {
        // slotKey()'s own spelling — the map is keyed by the engine, so the
        // grid has to ask the question in the engine's words.
        const isPick = picked === `${seg.dataset.date}T${seg.dataset.start}`;
        seg.classList.toggle("seg--selected", isPick);
        if (isPick) pinned = true;
      }
      cell.classList.toggle("cell--pin", pinned && state.forced.has(slug));
    }
  }
}

// --- the date window ------------------------------------------------------

function layoutOverlay() {
  const daysEl = $("dayHead");
  const dr = daysEl.getBoundingClientRect();
  if (dr.width === 0) return;
  const wr = $("calInner").getBoundingClientRect();
  state.layout = {
    trackLeft: dr.left - wr.left,
    trackWidth: dr.width,
    dayW: dr.width / state.dates.length,
  };
  const win = $("win");
  win.style.left = state.layout.trackLeft + "px";
  win.style.width = state.layout.trackWidth + "px";
  paintWindow();
}

function paintWindow() {
  const { trackLeft, trackWidth, dayW } = state.layout;
  const x0 = (state.d0 - 1) * dayW;
  const x1 = state.d1 * dayW;
  $("dimL").style.cssText = `left:0;width:${x0}px`;
  $("dimR").style.cssText = `left:${x1}px;width:${Math.max(0, trackWidth - x1)}px`;
  $("band").style.cssText = `left:${x0}px;width:${x1 - x0}px`;
  $("edgeStart").style.left = `${x0}px`;
  $("edgeEnd").style.left = `${x1}px`;
  $("hStart").style.left = `${trackLeft + x0}px`;
  $("hEnd").style.left = `${trackLeft + x1}px`;
  $("railBand").style.cssText = `left:${trackLeft + x0}px;width:${x1 - x0}px`;
  $("flagStart").textContent = dayLabel(windowStartISO());
  $("flagEnd").textContent = dayLabel(windowEndISO());
  const len = state.d1 - state.d0 + 1;
  $("railLen").textContent = `${len} night${len === 1 ? "" : "s"}`;
  for (const [el, value, iso] of [
    [$("hStart"), state.d0, windowStartISO()],
    [$("hEnd"), state.d1, windowEndISO()],
  ]) {
    el.setAttribute("aria-valuemax", String(state.dates.length));
    el.setAttribute("aria-valuenow", String(value));
    el.setAttribute("aria-valuetext", `${DOW_LONG[dowOf(iso)]} ${dayLabel(iso)}`);
  }
}

function dayAt(clientX) {
  const wr = $("calInner").getBoundingClientRect();
  const { trackLeft, dayW } = state.layout;
  return clamp(Math.round((clientX - wr.left - trackLeft) / dayW), 0, state.dates.length);
}

function dragDate(el, apply) {
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    const startX = e.clientX;
    const s0 = state.d0;
    const s1 = state.d1;
    const move = (ev) => {
      apply(ev, s0, s1, startX);
      paintWindow();
      replan();
    };
    const up = () => {
      el.classList.remove("dragging");
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
}

function keysDate(el, fn) {
  el.addEventListener("keydown", (e) => {
    const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    e.preventDefault();
    fn(step);
    paintWindow();
    replan();
  });
}

function wireWindow() {
  const n = () => state.dates.length;
  dragDate($("hStart"), (ev) => {
    state.d0 = clamp(dayAt(ev.clientX) + 1, 1, state.d1);
  });
  dragDate($("edgeStart"), (ev) => {
    state.d0 = clamp(dayAt(ev.clientX) + 1, 1, state.d1);
  });
  dragDate($("hEnd"), (ev) => {
    state.d1 = clamp(dayAt(ev.clientX), state.d0, n());
  });
  dragDate($("edgeEnd"), (ev) => {
    state.d1 = clamp(dayAt(ev.clientX), state.d0, n());
  });
  dragDate($("band"), (ev, s0, s1, startX) => {
    const shift = Math.round((ev.clientX - startX) / state.layout.dayW);
    const span = s1 - s0;
    const d0 = clamp(s0 + shift, 1, n() - span);
    state.d0 = d0;
    state.d1 = d0 + span;
  });
  keysDate($("hStart"), (step) => {
    state.d0 = clamp(state.d0 + step, 1, state.d1);
  });
  keysDate($("hEnd"), (step) => {
    state.d1 = clamp(state.d1 + step, state.d0, n());
  });
  addEventListener("resize", layoutOverlay);
}

// --- planning -------------------------------------------------------------

function planOptions() {
  return {
    dateStart: windowStartISO(),
    dateEnd: windowEndISO(),
    windowStart: `${windowStartISO()}T00:00`,
    windowEnd: `${windowEndISO()}T23:59`,
    dayStartMin: state.dayStartMin,
    dayEndMin: state.dayEndMin,
    mealBreaks: state.meals,
    minPerDay: state.minPerDay,
    maxPerDay: state.maxPerDay,
    minGapSameVenue: 0,
    minGapDifferentVenue: state.minGap,
    travelMode: state.mode,
    venueCoords: state.coords,
    forcedSlugs: [...state.forced],
  };
}

function replan() {
  const shows = starredShows();
  const options = planOptions();
  const summary = summarize(shows, {
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    startTimeMin: 0,
    startTimeMax: 1439,
  });
  const schedule = buildSchedule(shows, options);
  const diagnostics = placementDiagnostics(shows, options);

  state.schedule = schedule;
  state.scheduledSlugs = new Set(schedule.scheduled.map((s) => s.slug));
  state.selectedSlot = new Map(schedule.scheduled.map((s) => [s.slug, slotKey(s)]));

  applyVerdicts(summary, diagnostics);
  renderCounts(schedule.counts.scheduledShows, shows.length);
  renderPlanSummary(schedule);
  renderSchedule(schedule);
  renderTripLinks();
  $("planWindowLabel").textContent =
    state.d0 === state.d1
      ? dayLabel(windowStartISO())
      : `${dayLabel(windowStartISO())} – ${dayLabel(windowEndISO())}`;
  savePrefs();
}

function renderCounts(scheduled, selected) {
  $("boardCount").innerHTML = selected
    ? `<span class="bc-planned">${scheduled}</span> show${scheduled === 1 ? "" : "s"} planned out of ` +
      `<span class="bc-selected">${selected}</span> selected`
    : "No shows planned, no shows selected";
}

function renderPlanSummary(schedule) {
  const nights = schedule.days.filter((d) => d.slots.length).length;
  $("planSummary").textContent = schedule.scheduled.length
    ? `${schedule.scheduled.length} show${schedule.scheduled.length === 1 ? "" : "s"} across ` +
      `${nights} night${nights === 1 ? "" : "s"}.` +
      (schedule.unscheduled.length ? ` ${schedule.unscheduled.length} couldn't be fitted.` : "")
    : "";
}

// --- the schedule board ---------------------------------------------------

function renderSchedule(schedule) {
  const host = $("schedule");
  const empty = $("scheduleEmpty");
  host.innerHTML = "";
  if (!schedule.scheduled.length) {
    host.hidden = true;
    empty.hidden = false;
    return;
  }
  host.hidden = false;
  empty.hidden = true;

  const mins = [AXIS_TOP_MIN, state.dayStartMin];
  const maxs = [AXIS_BOTTOM_MIN, state.dayEndMin];
  for (const slot of schedule.scheduled) {
    mins.push(slot.startMinuteOfDay);
    maxs.push(slot.endMinuteOfDay);
  }
  for (const meal of state.meals) {
    if (!meal.enabled) continue;
    mins.push(meal.startMin);
    maxs.push(meal.endMin);
  }
  const minHour = Math.floor(Math.max(0, Math.min(...mins)) / 60);
  const maxHour = Math.max(minHour + 1, Math.ceil(Math.max(...maxs) / 60));
  const axisTopMin = minHour * 60;
  const axisBottomMin = maxHour * 60;
  const axisH = (maxHour - minHour) * SCH_HOUR_PX;
  const y = (min) => ((clamp(min, axisTopMin, axisBottomMin) - axisTopMin) / 60) * SCH_HOUR_PX;

  host.style.setProperty("--sch-hour-h", `${SCH_HOUR_PX}px`);
  host.style.setProperty("--sch-head-h", `${SCH_HEAD_PX}px`);

  const gutter = document.createElement("div");
  gutter.className = "sch-gutter";
  const gHead = document.createElement("div");
  gHead.className = "sch-gutter-head";
  const gBody = document.createElement("div");
  gBody.className = "sch-gutter-body";
  gBody.style.height = `${axisH}px`;
  for (let h = minHour; h <= maxHour; h++) {
    const label = document.createElement("div");
    label.className = "sch-hour" + (h >= 24 ? " sch-hour--late" : "");
    label.style.top = `${(h - minHour) * SCH_HOUR_PX}px`;
    label.textContent = `${pad2(h)}:00`;
    gBody.appendChild(label);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  const byDate = new Map(schedule.days.map((d) => [d.date, d]));
  const renderDays = state.dates
    .slice(state.d0 - 1, state.d1)
    .map((iso) => byDate.get(iso) || { date: iso, slots: [] });

  const wrapW = ($("scheduleWrap").clientWidth || 800) - SCH_GUTTER_PX;
  const emptyCount = renderDays.filter((d) => !d.slots.length).length;
  const fullCount = Math.max(1, renderDays.length - emptyCount);
  const colW = Math.max(1, (wrapW - emptyCount * SCH_EMPTY_COL_PX) / fullCount);
  host.classList.toggle("cols-narrow", colW < 78);
  host.classList.toggle("cols-tiny", colW < 56);

  for (const day of renderDays) {
    const full = day.slots.length > 0;
    const col = document.createElement("div");
    col.className = "sch-day" + (isWeekend(day.date) ? " wknd" : "") + (full ? "" : " sch-day--empty");
    col.dataset.date = day.date;

    const head = document.createElement("div");
    head.className = "sch-day-head";
    head.innerHTML = full
      ? `<div class="sch-dow">${DOW_LONG[dowOf(day.date)]} <span class="sch-date">${dayLabel(day.date)}</span></div>` +
        `<div class="sch-day-count">${day.slots.length} show${day.slots.length === 1 ? "" : "s"}</div>`
      : `<div class="sch-dow sch-dow--empty">${dateOf(day.date).getUTCDate()}</div>`;
    if (!full) col.title = `${DOW_LONG[dowOf(day.date)]} ${dayLabel(day.date)} — nothing planned`;

    const body = document.createElement("div");
    body.className = "sch-body";
    body.style.height = `${axisH}px`;

    for (let i = 0; i < day.slots.length - 1; i++) {
      const a = day.slots[i];
      const b = day.slots[i + 1];
      const gap = b.startMinuteOfDay - a.endMinuteOfDay;
      if (gap < 0 || gap >= 60) continue;
      body.appendChild(buildTravelLeg(a, b, y(a.endMinuteOfDay), y(b.startMinuteOfDay)));
    }
    for (const slot of day.slots) {
      body.appendChild(buildScheduleBlock(slot, y(slot.startMinuteOfDay), y(slot.endMinuteOfDay)));
    }

    col.append(head, body);
    host.appendChild(col);
  }
}

function buildScheduleBlock(slot, top, rawBottom) {
  const height = Math.max(SCH_MIN_BLOCK, rawBottom - top);
  const forced = state.forced.has(slot.slug);
  const block = document.createElement("a");
  block.className =
    "sch-show " + (slot.status === "FREE_NON_TICKETED" ? "seg-free" : "seg-avail") +
    (forced ? " sch-show--pinned" : "");
  block.href = slot.url;
  block.target = "_blank";
  block.rel = "noopener";
  block.draggable = false;
  block.style.top = `${top}px`;
  block.style.height = `${height}px`;
  block.dataset.slug = slot.slug;
  if (height < SCH_TIGHT_PX) block.classList.add("sch-show--tight");

  // A show with no published running time has end === start, so the clock
  // would read "22:00–22:00". Say the start and stop there rather than draw a
  // length nobody published.
  const end = slotEndTime(slot);
  const timeStr = end === slot.startTime ? slot.startTime : `${slot.startTime}–${end}`;
  block.innerHTML =
    (forced ? `<span class="sch-pin" aria-hidden="true">🔒</span>` : "") +
    `<span class="sch-body-text">` +
    `<span class="sch-name">${foreign(slot.title)}</span>` +
    `<span class="sch-meta">` +
    `<span class="sch-time">${escapeHtml(timeStr)}</span>` +
    (slot.venueName ? `<span class="sch-venue">${foreign(slot.venueName)}</span>` : "") +
    `</span></span>`;
  return block;
}

function buildTravelLeg(a, b, top, bottom) {
  const leg = document.createElement("div");
  leg.className = "sch-leg";
  leg.style.top = `${top}px`;
  leg.style.height = `${Math.max(0, bottom - top)}px`;

  const gapMin = Math.max(0, b.startMinuteOfDay - a.endMinuteOfDay);
  const meta = MODE_META[state.mode];
  let text;
  let title;
  if (a.venueCode && b.venueCode && a.venueCode === b.venueCode) {
    text = `same venue · ${gapMin}′ gap`;
    title = `${a.venueName || "Same venue"} — no travel, ${gapMin} min between shows`;
  } else {
    const km = distanceKm({ lat: a.venueLat, lng: a.venueLng }, { lat: b.venueLat, lng: b.venueLng });
    const mins = travelMinutes(
      { lat: a.venueLat, lng: a.venueLng },
      { lat: b.venueLat, lng: b.venueLng },
      state.mode
    );
    if (km == null || mins == null) {
      text = `nearby · ${gapMin}′ gap`;
      title = "Travel time unknown (venue has no coordinates)";
    } else {
      const spare = Math.round(gapMin - mins);
      text = `${Math.round(mins)}′ · ${km.toFixed(1)}km · ${spare >= 0 ? "+" : ""}${spare}′`;
      title =
        `${meta.emoji} ${Math.round(mins)} min ${meta.verb} · ${km.toFixed(1)} km — ` +
        `${gapMin} min gap, ${spare} min spare`;
    }
  }
  leg.title = title;
  leg.innerHTML =
    `<span class="leg-emoji" aria-hidden="true">${meta.emoji}</span>` +
    `<span class="leg-text">${escapeHtml(text)}</span>`;
  return leg;
}

// --- the two questions the festival doesn't answer ------------------------

function renderTripLinks() {
  const row = $("tripLinksRow");
  const links = [festivalStayLink(windowStartISO(), windowEndISO()), ...festivalTravelLinks()];
  row.innerHTML = links
    .map(
      (link) =>
        `<a class="trip-link" href="${escapeHtml(link.url)}" target="_blank" rel="sponsored noopener noreferrer"` +
        ` title="${escapeHtml(link.text)} on ${escapeHtml(link.partner)} — partner link, we may earn a commission">` +
        `<span class="trip-link-text">${escapeHtml(link.text)}</span>` +
        `<span class="trip-link-partner">${escapeHtml(link.partner)}</span></a>`
    )
    .join("");
}

// --- browse + search ------------------------------------------------------

function showMeta(show) {
  // Performances, not nights: three of this programme's runs play twice on one
  // evening, so counting distinct dates would under-report what is on offer.
  const runs = show.performances.length;
  const venue = show.venueNames.join(", ");
  const parts = [
    show.genre ? foreign(show.genre) : null,
    venue ? foreign(venue) : null,
    `${runs} performance${runs === 1 ? "" : "s"}`,
    show.duration ? `${show.duration} min` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function rowHtml(show) {
  const on = state.starred.has(show.slug);
  return (
    `<button type="button" class="ss-star" data-slug="${escapeHtml(show.slug)}"` +
    ` aria-pressed="${on}" aria-label="${on ? "Remove" : "Add"} ${escapeHtml(show.title)}">${on ? "★" : "☆"}</button>` +
    `<span class="ss-row-title">${foreign(show.title)}</span>` +
    `<span class="ss-row-meta">${showMeta(show)}</span>`
  );
}

/** A result/browse row, carrying its own starred state as `is-on`. */
function rowElement(show, tag) {
  const row = document.createElement(tag);
  row.className = "ss-row" + (state.starred.has(show.slug) ? " is-on" : "");
  row.dataset.slug = show.slug;
  row.innerHTML = rowHtml(show);
  return row;
}

function renderBrowse() {
  const list = $("browseList");
  list.innerHTML = "";
  for (const show of state.catalogue.shows) {
    list.appendChild(rowElement(show, "li"));
  }
  $("browseLine1").textContent = `Pick from ${state.catalogue.shows.length} shows`;
}

function matchesFilters(show) {
  const { query, genres, venues } = state.search;
  if (genres.size && !genres.has(show.genreSlug)) return false;
  if (venues.size && !show.performances.some((p) => venues.has(p.venue))) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    show.title.toLowerCase().includes(q) ||
    (show.genre || "").toLowerCase().includes(q) ||
    show.venueNames.some((v) => v.toLowerCase().includes(q)) ||
    (show.blurb || "").toLowerCase().includes(q)
  );
}

function runSearch() {
  const hits = state.catalogue.shows.filter(matchesFilters);
  const results = $("ssResults");
  results.innerHTML = "";
  for (const show of hits.slice(0, 40)) {
    const row = rowElement(show, "li");
    row.setAttribute("role", "option");
    results.appendChild(row);
  }
  $("ssEmpty").hidden = hits.length > 0;
  $("ssPop").hidden = false;
  $("ssInput").setAttribute("aria-expanded", "true");
}

function closeSearch() {
  $("ssPop").hidden = true;
  $("ssInput").setAttribute("aria-expanded", "false");
}

function buildFacets() {
  const genreOptions = $("ssfGenreOptions");
  genreOptions.innerHTML = state.catalogue.categories
    .map(
      (c) =>
        `<label class="panel-option"><input type="checkbox" data-facet="genre" value="${escapeHtml(c.slug)}" />` +
        `<span>${foreign(c.name)}</span>` +
        `<span class="opt-count">${state.catalogue.shows.filter((s) => s.genreSlug === c.slug).length}</span></label>`
    )
    .join("");
  const venueOptions = $("ssfVenueOptions");
  venueOptions.innerHTML = [...state.venues.values()]
    .map(
      (v) =>
        `<label class="panel-option"><input type="checkbox" data-facet="venue" value="${escapeHtml(v.code)}" />` +
        `<span>${foreign(v.name)}</span>` +
        `<span class="opt-count">${state.catalogue.shows.filter((s) => s.venue === v.code).length}</span></label>`
    )
    .join("");
}

function syncFacetChrome() {
  const { genres, venues } = state.search;
  $("ssfGenreValue").textContent = genres.size ? `${genres.size} kinds` : "Any kind";
  $("ssfVenueValue").textContent = venues.size ? `${venues.size} venues` : "Any venue";
  const active = genres.size + venues.size;
  $("ssBadge").hidden = active === 0;
  $("ssBadge").textContent = String(active);
  $("ssReset").hidden = active === 0;
}

function toggleStar(slug) {
  if (state.starred.has(slug)) state.starred.delete(slug);
  else state.starred.add(slug);
  saveStarred();
  rebuild();
}

/** Everything that changes when the starred set changes. */
function rebuild() {
  showBoard();
  buildLanes();
  renderBrowse();
  for (const row of document.querySelectorAll(".ss-row")) {
    const on = state.starred.has(row.dataset.slug);
    row.classList.toggle("is-on", on);
    const star = row.querySelector(".ss-star");
    star.setAttribute("aria-pressed", String(on));
    star.textContent = on ? "★" : "☆";
  }
  if (state.starred.size) {
    layoutOverlay();
    replan();
  } else {
    renderCounts(0, 0);
  }
}

// --- controls -------------------------------------------------------------

function wireControls() {
  $("ctlDayStart").addEventListener("change", (e) => {
    const min = clockToMin(e.target.value);
    if (min != null) state.dayStartMin = min;
    e.target.value = minToDayClock(state.dayStartMin);
    replan();
  });
  $("ctlDayEnd").addEventListener("change", (e) => {
    const min = clockToMin(e.target.value);
    if (min != null) state.dayEndMin = min;
    e.target.value = minToDayClock(state.dayEndMin);
    replan();
  });
  for (const meal of state.meals) {
    const cap = meal.id[0].toUpperCase() + meal.id.slice(1);
    $(`meal${cap}On`).addEventListener("change", (e) => {
      meal.enabled = e.target.checked;
      replan();
    });
    $(`meal${cap}Start`).addEventListener("change", (e) => {
      const min = clockToMin(e.target.value);
      if (min != null) meal.startMin = min;
      replan();
    });
    $(`meal${cap}End`).addEventListener("change", (e) => {
      const min = clockToMin(e.target.value);
      if (min != null) meal.endMin = min;
      replan();
    });
  }
  $("ctlMin").addEventListener("change", (e) => {
    state.minPerDay = Number(e.target.value);
    replan();
  });
  $("ctlMax").addEventListener("change", (e) => {
    state.maxPerDay = Math.max(1, Number(e.target.value) || 1);
    replan();
  });
  $("ctlGap").addEventListener("change", (e) => {
    state.minGap = Number(e.target.value);
    replan();
  });
  $("ctlMode").addEventListener("click", (e) => {
    const btn = e.target.closest(".tmode-btn");
    if (!btn) return;
    state.mode = btn.dataset.mode;
    for (const other of $("ctlMode").querySelectorAll(".tmode-btn")) {
      const on = other === btn;
      other.classList.toggle("is-on", on);
      other.setAttribute("aria-pressed", String(on));
    }
    replan();
  });
}

function syncControls() {
  $("ctlDayStart").value = minToDayClock(state.dayStartMin);
  $("ctlDayEnd").value = minToDayClock(state.dayEndMin);
  for (const meal of state.meals) {
    const cap = meal.id[0].toUpperCase() + meal.id.slice(1);
    $(`meal${cap}On`).checked = meal.enabled;
    $(`meal${cap}Start`).value = minToClock(meal.startMin);
    $(`meal${cap}End`).value = minToClock(meal.endMin);
  }
  $("ctlMin").value = String(state.minPerDay);
  $("ctlMax").value = String(state.maxPerDay);
  $("ctlGap").value = String(state.minGap);
  for (const btn of $("ctlMode").querySelectorAll(".tmode-btn")) {
    const on = btn.dataset.mode === state.mode;
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  }
}

function wireBoard() {
  // One delegated listener for every star on the page — the browse list and the
  // search results are rebuilt constantly, and per-row listeners would leak.
  document.addEventListener("click", (e) => {
    const star = e.target.closest(".ss-star");
    if (star) {
      toggleStar(star.dataset.slug);
      return;
    }
    const remove = e.target.closest(".lane-remove");
    if (remove) {
      toggleStar(remove.closest(".lane").dataset.slug);
      return;
    }
    // Clicking a show's name pins it into the plan; clicking again lifts the pin.
    const label = e.target.closest(".lane-label");
    if (label) {
      const slug = label.closest(".lane").dataset.slug;
      if (state.forced.has(slug)) state.forced.delete(slug);
      else state.forced.add(slug);
      replan();
      return;
    }
    if (!e.target.closest(".show-search")) closeSearch();
  });

  $("clearFavBtn").addEventListener("click", () => {
    state.starred.clear();
    state.forced.clear();
    saveStarred();
    rebuild();
  });

  $("legendBtn").addEventListener("click", () => {
    const legend = $("calLegend");
    legend.hidden = !legend.hidden;
    $("legendBtn").setAttribute("aria-expanded", String(!legend.hidden));
    $("legendBtn").classList.toggle("is-on", !legend.hidden);
  });
}

function wireSearch() {
  $("ssInput").addEventListener("input", (e) => {
    state.search.query = e.target.value.trim();
    runSearch();
  });
  $("ssInput").addEventListener("focus", runSearch);
  $("ssToolsBtn").addEventListener("click", () => {
    const tools = $("ssTools");
    tools.hidden = !tools.hidden;
    $("ssToolsBtn").setAttribute("aria-expanded", String(!tools.hidden));
  });
  $("ssTools").addEventListener("change", (e) => {
    const input = e.target.closest("input[type=checkbox]");
    if (!input) return;
    const set = input.dataset.facet === "genre" ? state.search.genres : state.search.venues;
    if (input.checked) set.add(input.value);
    else set.delete(input.value);
    syncFacetChrome();
    runSearch();
  });
  $("ssTools").addEventListener("click", (e) => {
    const trigger = e.target.closest(".chip-trigger");
    if (trigger) {
      const panel = $(trigger.dataset.panel);
      const open = panel.hidden;
      for (const other of $("ssTools").querySelectorAll(".chip-panel")) other.hidden = true;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      return;
    }
    const clear = e.target.closest(".panel-everything");
    if (clear) {
      (clear.dataset.clear === "genre" ? state.search.genres : state.search.venues).clear();
      for (const box of $("ssTools").querySelectorAll(`input[data-facet=${clear.dataset.clear}]`)) box.checked = false;
      syncFacetChrome();
      runSearch();
    }
  });
  $("ssReset").addEventListener("click", () => {
    state.search.genres.clear();
    state.search.venues.clear();
    for (const box of $("ssTools").querySelectorAll("input[type=checkbox]")) box.checked = false;
    syncFacetChrome();
    runSearch();
  });
}

// --- exports --------------------------------------------------------------

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function wireExports() {
  $("downloadCsvBtn").addEventListener("click", () => {
    if (!state.schedule) return;
    download(`${FESTIVAL.id}-plan.csv`, toCsv(state.schedule.scheduled), "text/csv;charset=utf-8");
  });
  $("importIcsBtn").addEventListener("click", () => {
    if (!state.schedule) return;
    download(
      `${FESTIVAL.id}-plan.ics`,
      toIcs(state.schedule.scheduled, {
        now: new Date(),
        timezone: state.catalogue.festival.timezone,
        calendarName: `My ${state.catalogue.festival.name} plan`,
        prodId: "-//EdFringeNow//Festival Planner//EN",
      }),
      "text/calendar;charset=utf-8"
    );
  });
}

// --- boot -----------------------------------------------------------------

async function boot() {
  renderChrome();
  $("loadingState").hidden = false;
  try {
    state.catalogue = await loadCatalogue(FESTIVAL.dataUrl);
  } catch (error) {
    $("loadingState").hidden = true;
    $("errorState").hidden = false;
    $("errorDetail").textContent = String(error.message || error);
    return;
  }
  $("loadingState").hidden = true;

  state.venues = state.catalogue.venues;
  state.coords = venueCoords(state.venues);
  state.dates = festivalDates(state.catalogue.shows);
  state.d0 = 1;
  state.d1 = state.dates.length;

  const stored = readStore(KEY_STARRED, []);
  const known = new Set(state.catalogue.shows.map((s) => s.slug));
  state.starred = new Set(stored.filter((slug) => known.has(slug)));
  restorePrefs();

  renderHeaderHint();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  syncControls();
  wireWindow();
  wireBoard();
  wireSearch();
  wireControls();
  wireExports();
  rebuild();
  // Two frames: the board has to be laid out before the window overlay can be
  // measured off the day header's real geometry.
  requestAnimationFrame(() => requestAnimationFrame(layoutOverlay));
}

/* The site version in the footer's popup, exactly as the other two pages carry
 * it. version.json is the published version record and ships in the publish set
 * for this. A failure here is silent on purpose: not knowing the version must
 * never stop the planner loading. */
async function showVersion() {
  try {
    const response = await fetch("../version.json");
    if (!response.ok) return;
    const pkg = await response.json();
    if (typeof pkg.version === "string") {
      attachVersionPopup($("footerVersion"), `v${pkg.version}`);
    }
  } catch (error) {
    console.warn("Festival planner: couldn't read app version", error);
  }
}

showVersion();
boot();
