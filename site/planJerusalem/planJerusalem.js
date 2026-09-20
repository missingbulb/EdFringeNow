/* The festival planner page.
 *
 * A calendar-led planner, driven by a festival descriptor (./festival.js)
 * rather than by anything Jerusalem-specific: the only strings this module
 * names are its own UI's. It shares the Fringe planner's stylesheet and its
 * pure engine (../plan/lib/), and shares no state with it at all — every key
 * it stores is under the descriptor's own prefix.
 *
 * The model, which is this page's own: the calendar drafts from the WHOLE
 * programme before the reader has chosen anything, giving each contested hour
 * to the contender with the fewest nights of its own (../plan/lib/contention.js
 * decides that, and knows nothing about this page). Because that pick is the
 * page's guess rather than the reader's choice, every drafted block offers the
 * four answers back — lock this night, favourite the show, not this night, not
 * this show — and each re-drafts what is left. The grid the Fringe planner
 * leads with is a drawer here, holding the record of those verdicts.
 *
 * Where it deliberately differs from plan/plan.js, and why:
 *   - no favourites upload, and nothing to star before the page is useful.
 *     This festival publishes no export to upload, and the calendar draws from
 *     the whole programme (34 shows) rather than from a list built first.
 *   - no availability colours beyond "on sale" and "free". There is no live
 *     ticket feed here and nothing is ever cancelled, so the Fringe grid's
 *     sold-out and offer palette would be drawing a distinction the source
 *     never makes.
 *   - no re-plan animation, no draggable schedule furniture. Both are worth
 *     their code on a 25-day, 4,000-show programme; on five nights they are not
 *     what makes the page good.
 */

import { slotKey } from "../plan/lib/engine.js";
import { draftCalendar, instanceKey } from "../plan/lib/contention.js";
import { slotEndTime, toCsv, toIcs } from "../plan/lib/itinerary.js";
import { distanceKm, travelMinutes } from "../plan/lib/travel.js";
import { attachVersionPopup } from "../shared/version-popup.js";
import { readVersionStamp } from "../shared/version.js";
import { FESTIVAL, festivalStayLink, festivalTravelLinks } from "./festival.js";
import { festivalDates, loadCatalogue, venueCoords } from "./catalogue.js";
import { applyTranslations, currentDir, currentIntlLocale, escapeHtml, initI18n, t, tHtml } from "./i18n/i18n.js";

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));


// The calendar's axis. Taller per hour than the Fringe planner's, because a
// block here is something the reader acts on rather than reads: it has to hold
// a name, an hour, how rare the show is and the four verdicts. The axis spans
// only the hours the draft actually uses, padded by one either side — a
// five-night comedy festival runs in the evening, and an axis anchored at 09:00
// would be two thirds empty morning.
const AXIS_PAD_MIN = 60;
const SCH_HOUR_PX = 84;
const SCH_HEAD_PX = 42;
// A block has to hold a name, an hour, how rare the show is, and four buttons,
// so its floor is what those four rows measure rather than a token height.
const SCH_MIN_BLOCK = 68;
const SCH_TIGHT_PX = 84;
// Below this a block keeps only its name and its four verdicts: a block the
// reader cannot rule on is worse than one that does not say where it is.
const SCH_SQUEEZED_PX = 62;
const SCH_GUTTER_PX = 44;

const MODE_META = {
  walk: { emoji: "🚶", verbKey: "travel.mode.walk" },
  bike: { emoji: "🚲", verbKey: "travel.mode.bike" },
  car: { emoji: "🚗", verbKey: "travel.mode.car" },
};

const KEY_STARRED = FESTIVAL.storagePrefix + "starred";
const KEY_PREFS = FESTIVAL.storagePrefix + "prefs";
const KEY_VERDICTS = FESTIVAL.storagePrefix + "verdicts";

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
  maxPerDay: 3,
  minGap: 30,
  mode: "walk",
  // The four verdicts. `starred` is the favourites set and keeps its own
  // storage key, because it predates the other three and a reader who starred
  // shows under the old board should find them still starred.
  locked: new Map(),   // slug -> slotKey: this night, whatever the draft thinks
  noTime: new Set(),   // instanceKey(): not this night, another one may be used
  noShow: new Set(),   // slug: not this show, on any night
  draft: null,
  picked: new Map(),
  layout: { trackLeft: 0, trackWidth: 0, dayW: 0 },
  search: { query: "", genres: new Set(), venues: new Set() },
};

// --- small helpers --------------------------------------------------------

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

/* Dates are written by Intl in the reader's own language, so nothing here has
 * a month or a weekday name of its own to translate. UTC throughout, because
 * every date in this page is already Jerusalem wall clock (see catalogue.js). */
function dates(options) {
  return new Intl.DateTimeFormat(currentIntlLocale(), { timeZone: "UTC", ...options });
}

function dayLabel(iso) {
  return dates({ day: "numeric", month: "short" }).format(dateOf(iso));
}

function dowShort(iso) {
  return dates({ weekday: "short" }).format(dateOf(iso));
}

/** "Sunday 18 Oct" — the weekday and date a tooltip names together. */
function dayAndDate(iso) {
  return dates({ weekday: "long", day: "numeric", month: "short" }).format(dateOf(iso));
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

function saveVerdicts() {
  writeStore(KEY_VERDICTS, {
    locked: Object.fromEntries(state.locked),
    noTime: [...state.noTime],
    noShow: [...state.noShow],
  });
}

function restoreVerdicts(known) {
  const saved = readStore(KEY_VERDICTS, null);
  if (!saved) return;
  for (const [slug, key] of Object.entries(saved.locked || {})) {
    if (known.has(slug)) state.locked.set(slug, key);
  }
  for (const key of saved.noTime || []) state.noTime.add(key);
  for (const slug of saved.noShow || []) if (known.has(slug)) state.noShow.add(slug);
}

function savePrefs() {
  writeStore(KEY_PREFS, {
    d0: state.d0,
    d1: state.d1,
    dayStartMin: state.dayStartMin,
    dayEndMin: state.dayEndMin,
    meals: state.meals,
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
  state.maxPerDay = Number(saved.maxPerDay) || state.maxPerDay;
  state.minGap = Number.isFinite(saved.minGap) ? saved.minGap : state.minGap;
  if (MODE_META[saved.mode]) state.mode = saved.mode;
}

// --- chrome ---------------------------------------------------------------

function renderChrome() {
  // The wordmark is the festival's mark rather than a sentence, so it is the
  // one piece of chrome that reads the same in every language.
  const [head, tail] = FESTIVAL.wordmark;
  $("wordmark").innerHTML = `${escapeHtml(head)}<span class="logo-now">${escapeHtml(tail)}</span>`;

  const nav = $("siteNav");
  nav.innerHTML =
    FESTIVAL.siteNav
      .map(
        (link) =>
          `<a href="${link.href}" class="nav-link" data-i18n-slot="${link.labelKey}">` +
          `${escapeHtml(t(link.labelKey))}</a>`
      )
      .join("") +
    `<a href="./" class="nav-link is-active" data-i18n-slot="${FESTIVAL.navLabelKey}">` +
    `${escapeHtml(t(FESTIVAL.navLabelKey))}</a>`;

  // The festival's own two links in the footer: its programme's source, and
  // the note that some of the trip links are paid.
  $("footerData").innerHTML = tHtml(
    "footer.dataFrom",
    {},
    {
      source:
        `<a href="${escapeHtml(FESTIVAL.sourceUrl)}" target="_blank" rel="noopener">` +
        `${escapeHtml(FESTIVAL.sourceName)}</a>`,
    }
  );
}

function renderHeaderHint() {
  const first = dateOf(state.dates[0]);
  const last = dateOf(state.dates[state.dates.length - 1]);
  $("headerHint").textContent = t("header.run", {
    city: t("festival.city"),
    // formatRange, not two formats spliced: only the locale's own data knows
    // where the year goes and which part of a range is dropped as repeated.
    range: dates({ day: "numeric", month: "short", year: "numeric" }).formatRange(first, last),
  });
}

// --- the board ------------------------------------------------------------

/* The drawer's own two states. The calendar above it is always shown, so this
 * is only about whether there is a grid to draw: the browse list stands in for
 * it until some show has been ruled on. */
function showBoard() {
  const ruled = ruledShows().length > 0;
  $("browseStage").hidden = ruled;
  $("calWrap").hidden = !ruled;
  $("clearFavBtn").hidden = !ruled;
  $("legendBtn").hidden = !ruled;
  $("tripLinks").hidden = false;
}

function buildDayHeader() {
  const head = $("dayHead");
  head.innerHTML = "";
  for (const iso of state.dates) {
    const col = document.createElement("div");
    col.className = "day-col" + (isWeekend(iso) ? " wknd" : "");
    col.innerHTML =
      `<span class="day-dow">${escapeHtml(dowShort(iso))}</span>` +
      `<span class="day-num">${dateOf(iso).getUTCDate()}</span>`;
    head.appendChild(col);
  }
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
        seg.title = t(p.free ? "perf.tip.free" : "perf.tip", {
          day: dayAndDate(iso),
          time: p.start,
        });
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
  for (const show of ruledShows()) {
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
    remove.setAttribute("aria-label", t("lane.remove", { title: show.title }));
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

/* The verdict pill each lane wears. Under the calendar-led model a lane is
 * drawn because the reader ruled on the show, so the pill names that ruling
 * first and what the draft did with it second. */
function applyVerdicts(draft) {
  const drafted = draft.picked;
  const crowded = new Set(draft.crowdedOut.map((s) => s.slug));
  for (const lane of $("lanes").querySelectorAll(".lane")) {
    const slug = lane.dataset.slug;
    const scheduled = drafted.has(slug);
    const rejected = state.noShow.has(slug);
    lane.classList.toggle("lane--scheduled", scheduled);
    lane.classList.toggle("lane--forced", state.locked.has(slug));
    lane.classList.toggle("lane--out", rejected);
    lane.classList.toggle("lane--blocked", !scheduled && !rejected);

    // The pill's emoji is the page's, not the translation's: a marker a
    // translator cannot lose, beside a word that is entirely theirs.
    const [verdictClass, verdictKey, verdictMark] = rejected
      ? ["st-dates st-no", "lane.rejected", "⊘"]
      : state.locked.has(slug)
        ? ["st-plan st-in", "lane.locked", "🔒"]
        : scheduled
          ? ["st-plan st-in", "lane.scheduled", "✓"]
          : crowded.has(slug)
            ? ["st-conflict st-warn", "lane.crowdedOut", "⏰"]
            : ["st-cant", "lane.cantFit", ""];
    const statusEl = lane.querySelector(".lane-status");
    statusEl.innerHTML =
      `<span class="${verdictClass}" data-i18n-slot="${verdictKey}">` +
      (verdictMark ? `<span aria-hidden="true">${verdictMark}</span> ` : "") +
      `${escapeHtml(t(verdictKey))}</span>`;

    // Ring the one performance the draft picked, and strike the nights ruled out.
    const picked = drafted.get(slug);
    for (const cell of lane.querySelectorAll(".cell")) {
      let pinned = false;
      for (const seg of cell.querySelectorAll(".seg")) {
        // slotKey()'s own spelling — the map is keyed by the engine, so the
        // grid has to ask the question in the engine's words.
        const key = `${seg.dataset.date}T${seg.dataset.start}`;
        const isPick = picked === key;
        seg.classList.toggle("seg--selected", isPick);
        seg.classList.toggle("seg--refused", state.noTime.has(instanceKey(slug, key)));
        if (isPick) pinned = true;
      }
      cell.classList.toggle("cell--pin", pinned && state.locked.has(slug));
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

/* The overlay is positioned in physical pixels over a grid whose columns follow
 * the page's direction, so on a right-to-left page day 1 is the rightmost
 * column and every x below is measured from the other end. `boundaryX` is the
 * one place that knows it; the rest of the window's maths is direction-blind. */
const isRtl = () => currentDir() === "rtl";

/** The physical offset of the boundary `days` days after the first night. */
function boundaryX(days) {
  const { trackWidth, dayW } = state.layout;
  return isRtl() ? trackWidth - days * dayW : days * dayW;
}

function paintWindow() {
  const { trackLeft, trackWidth } = state.layout;
  const x0 = boundaryX(state.d0 - 1);
  const x1 = boundaryX(state.d1);
  // The window's own edges keep their logical identity; the dimmed regions and
  // the band are whatever lies outside and inside them on screen.
  const near = Math.min(x0, x1);
  const far = Math.max(x0, x1);
  $("dimL").style.cssText = `left:0;width:${near}px`;
  $("dimR").style.cssText = `left:${far}px;width:${Math.max(0, trackWidth - far)}px`;
  $("band").style.cssText = `left:${near}px;width:${far - near}px`;
  $("edgeStart").style.left = `${x0}px`;
  $("edgeEnd").style.left = `${x1}px`;
  $("hStart").style.left = `${trackLeft + x0}px`;
  $("hEnd").style.left = `${trackLeft + x1}px`;
  $("railBand").style.cssText = `left:${trackLeft + near}px;width:${far - near}px`;
  $("flagStart").textContent = dayLabel(windowStartISO());
  $("flagEnd").textContent = dayLabel(windowEndISO());
  const len = state.d1 - state.d0 + 1;
  $("railLen").textContent = t("rail.nights", { count: len });
  for (const [el, value, iso] of [
    [$("hStart"), state.d0, windowStartISO()],
    [$("hEnd"), state.d1, windowEndISO()],
  ]) {
    el.setAttribute("aria-valuemax", String(state.dates.length));
    el.setAttribute("aria-valuenow", String(value));
    el.setAttribute("aria-valuetext", dayAndDate(iso));
  }
}

function dayAt(clientX) {
  const wr = $("calInner").getBoundingClientRect();
  const { trackLeft, trackWidth, dayW } = state.layout;
  const x = clientX - wr.left - trackLeft;
  return clamp(Math.round((isRtl() ? trackWidth - x : x) / dayW), 0, state.dates.length);
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
      redraftAndSave();
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
    // The arrow that moves the window later is the one that points along the
    // page's reading direction, which is the way the grid itself runs.
    const later = isRtl() ? "ArrowLeft" : "ArrowRight";
    const step = e.key === later ? 1 : e.key === (isRtl() ? "ArrowRight" : "ArrowLeft") ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    fn(step);
    paintWindow();
    redraftAndSave();
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
    const travelled = (ev.clientX - startX) * (isRtl() ? -1 : 1);
    const shift = Math.round(travelled / state.layout.dayW);
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
    maxPerDay: state.maxPerDay,
    minGapSameVenue: 0,
    minGapDifferentVenue: state.minGap,
    travelMode: state.mode,
    venueCoords: state.coords,
    locked: state.locked,
    favourites: state.starred,
    rejectedShows: state.noShow,
    rejectedInstances: state.noTime,
  };
}

/* Re-draft from the whole programme and redraw everything that reads it.
 * Every verdict, every control and the date window all land here: there is one
 * draft on the page and it is rebuilt rather than patched, which is what keeps
 * a verdict's knock-on effects (a freed hour, a show that is now scarcer)
 * honest instead of locally repaired. */
function redraft() {
  closePops();
  const draft = draftCalendar(state.catalogue.shows, planOptions());
  state.draft = draft;
  state.picked = draft.picked;

  renderCalendar(draft);
  renderCounts(draft);
  renderPlanSummary(draft);
  buildLanes();
  applyVerdicts(draft);
  renderDrawerCount(draft);
  showBoard();
  syncStars();
  renderTripLinks();
  renderPlanSub();
}

/** The star on every browse and search row, set from the favourites. */
function syncStars() {
  for (const row of document.querySelectorAll(".ss-row")) {
    const on = state.starred.has(row.dataset.slug);
    row.classList.toggle("is-on", on);
    const star = row.querySelector(".ss-star");
    star.setAttribute("aria-pressed", String(on));
    star.textContent = on ? "★" : "☆";
  }
}

/** Re-draft after the reader changed something the page should remember. */
function redraftAndSave() {
  savePrefs();
  saveVerdicts();
  redraft();
}

/** Every slot the draft placed, in time order — what the exports write. */
function draftedSlots() {
  return state.draft ? state.draft.days.flatMap((d) => d.slots) : [];
}

/* One verdict, applied. Each is a toggle, and each clears whatever it
 * contradicts: locking a night is not compatible with having rejected that
 * night or the show, and rejecting the show is not compatible with wanting it.
 * Keeping that here rather than in the drafter means the drafter never has to
 * arbitrate between two verdicts that cannot both be true. */
function applyVerdict(kind, slug, key) {
  const instance = instanceKey(slug, key);
  if (kind === "lock") {
    if (state.locked.get(slug) === key) state.locked.delete(slug);
    else {
      state.locked.set(slug, key);
      state.noTime.delete(instance);
      state.noShow.delete(slug);
    }
  } else if (kind === "favourite") {
    if (state.starred.has(slug)) state.starred.delete(slug);
    else {
      state.starred.add(slug);
      state.noShow.delete(slug);
    }
    saveStarred();
  } else if (kind === "noTime") {
    if (state.noTime.has(instance)) state.noTime.delete(instance);
    else {
      state.noTime.add(instance);
      if (state.locked.get(slug) === key) state.locked.delete(slug);
    }
  } else if (kind === "noShow") {
    if (state.noShow.has(slug)) state.noShow.delete(slug);
    else {
      state.noShow.add(slug);
      state.starred.delete(slug);
      state.locked.delete(slug);
      saveStarred();
    }
  }
  redraftAndSave();
}

/** Every verdict lifted from one show — what the drawer's × does. */
function clearVerdicts(slug) {
  state.starred.delete(slug);
  state.locked.delete(slug);
  state.noShow.delete(slug);
  for (const key of [...state.noTime]) {
    if (key.startsWith(`${slug}@`)) state.noTime.delete(key);
  }
  saveStarred();
  redraftAndSave();
}

/** The shows the drawer draws a lane for: the ones a verdict has touched. */
function ruledShows() {
  const slugs = new Set([...state.starred, ...state.locked.keys(), ...state.noShow]);
  for (const key of state.noTime) slugs.add(key.slice(0, key.indexOf("@")));
  return state.catalogue.shows
    .filter((show) => slugs.has(show.slug))
    .sort((a, b) => {
      const at = a.performances[0]?.start || "";
      const bt = b.performances[0]?.start || "";
      return at.localeCompare(bt) || a.slug.localeCompare(b.slug);
    });
}

/* "…across 18–22 Oct…" — the window's dates sit inside the sentence, so the
 * translation decides where they land rather than the markup. */
function renderPlanSub() {
  const window = state.dates.length
    ? dates({ day: "numeric", month: "short" }).formatRange(
        dateOf(windowStartISO()),
        dateOf(windowEndISO())
      )
    : t("plan.window.placeholder");
  $("planSub").innerHTML = tHtml(
    "plan.sub",
    {},
    { window: `<span id="planWindowLabel">${escapeHtml(window)}</span>` }
  );
}

function renderCounts(draft) {
  const el = $("boardCount");
  const decided = state.starred.size + state.locked.size + state.noShow.size + state.noTime.size;
  el.dataset.i18nSlot = decided ? "board.count.some" : "board.count.none";
  el.innerHTML = decided
    ? tHtml(
        "board.count.some",
        { planned: draft.counts.picked, selected: decided },
        {
          // The two numbers are wrapped where they land in the sentence, so the
          // emphasis follows the translation's own word order.
          planned: `<span class="bc-planned">${draft.counts.picked}</span>`,
          selected: `<span class="bc-selected">${decided}</span>`,
        }
      )
    : escapeHtml(t("board.count.none", { count: draft.counts.picked }));
}

function renderPlanSummary(draft) {
  const nights = draft.days.filter((d) => d.slots.length).length;
  $("planSummary").textContent = draft.counts.picked
    ? t("plan.summary", { shows: draft.counts.picked, nights }) +
      (draft.counts.contested
        ? ` ${t("plan.summary.contested", { count: draft.counts.contested })}`
        : "")
    : "";
}

/** The drawer's own line: what is in it, without opening it. */
function renderDrawerCount(draft) {
  const el = $("drawerCount");
  el.dataset.i18nSlot = "drawer.count";
  el.textContent = t("drawer.count", {
    shows: state.catalogue.shows.length,
    decided: state.starred.size + state.locked.size + state.noShow.size + state.noTime.size,
    crowded: draft.crowdedOut.length,
  });
}

// --- the calendar ---------------------------------------------------------

function renderCalendar(draft) {
  const host = $("schedule");
  const empty = $("scheduleEmpty");
  host.innerHTML = "";
  if (!draft.counts.picked) {
    host.hidden = true;
    empty.hidden = false;
    return;
  }
  host.hidden = false;
  empty.hidden = true;

  // The axis covers the drafted evening and an hour either side — see
  // AXIS_PAD_MIN. Meal breaks the reader has switched on count too, since they
  // are drawn on the same axis.
  const mins = [];
  const maxs = [];
  for (const day of draft.days) {
    for (const slot of day.slots) {
      mins.push(slot.startMinuteOfDay);
      maxs.push(slot.endMinuteOfDay);
    }
  }
  for (const meal of state.meals) {
    if (!meal.enabled) continue;
    mins.push(meal.startMin);
    maxs.push(meal.endMin);
  }
  const minHour = Math.floor((Math.min(...mins) - AXIS_PAD_MIN) / 60);
  const maxHour = Math.max(minHour + 1, Math.ceil((Math.max(...maxs) + AXIS_PAD_MIN) / 60));
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
    label.textContent = `${pad2(h % 24)}:00`;
    gBody.appendChild(label);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  // Every night of the window gets a column whether or not the draft filled it:
  // an empty night is a fact about the programme and the reader's controls, and
  // collapsing it would hide it.
  const byDate = new Map(draft.days.map((d) => [d.date, d]));
  const renderDays = state.dates
    .slice(state.d0 - 1, state.d1)
    .map((iso) => byDate.get(iso) || { date: iso, slots: [] });

  for (const day of renderDays) {
    const col = document.createElement("div");
    col.className = "sch-day" + (isWeekend(day.date) ? " wknd" : "") + (day.slots.length ? "" : " sch-day--empty");
    col.dataset.date = day.date;

    const head = document.createElement("div");
    head.className = "sch-day-head";
    head.innerHTML =
      `<div class="sch-dow">${escapeHtml(dates({ weekday: "short" }).format(dateOf(day.date)))} ` +
      `<span class="sch-date">${escapeHtml(dayLabel(day.date))}</span></div>` +
      `<div class="sch-day-count" data-i18n-slot="schedule.dayCount">` +
      `${escapeHtml(t("schedule.dayCount", { count: day.slots.length }))}</div>`;

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
    day.slots.forEach((slot, i) => {
      // A short show is drawn at SCH_MIN_BLOCK so its four verdicts fit — but
      // never past the next block's own start, or the two would overlap and
      // the calendar would claim a clash the scheduler took care to avoid.
      const next = day.slots[i + 1];
      const ceiling = next ? y(next.startMinuteOfDay) - 2 : axisH;
      body.appendChild(
        buildScheduleBlock(slot, y(slot.startMinuteOfDay), y(slot.endMinuteOfDay), ceiling)
      );
    });

    col.append(head, body);
    host.appendChild(col);
  }
}

/** How rare the drafted show is — the whole reason it won its hour. */
function rarityText(freedom) {
  return freedom === 1 ? t("rarity.only") : t("rarity.some", { count: freedom });
}

function buildScheduleBlock(slot, top, rawBottom, ceiling) {
  const key = slotKey(slot);
  const height = Math.max(
    Math.min(SCH_MIN_BLOCK, Math.max(12, ceiling - top)),
    rawBottom - top
  );
  const locked = state.locked.get(slot.slug) === key;
  const favourite = state.starred.has(slot.slug);

  const block = document.createElement("div");
  block.className =
    "sch-show " + (slot.status === "FREE_NON_TICKETED" ? "seg-free" : "seg-avail") +
    (locked ? " sch-show--locked" : "") +
    (favourite ? " sch-show--fav" : "") +
    (slot.freedom === 1 ? " sch-show--rare" : "");
  block.style.top = `${top}px`;
  block.style.height = `${height}px`;
  block.dataset.slug = slot.slug;
  block.dataset.key = key;
  block.tabIndex = 0;
  if (height < SCH_TIGHT_PX) block.classList.add("sch-show--tight");
  if (height < SCH_SQUEEZED_PX) block.classList.add("sch-show--squeezed");

  // A show with no published running time has end === start, so the clock
  // would read "22:00–22:00". Say the start and stop there rather than draw a
  // length nobody published.
  const end = slotEndTime(slot);
  const timeStr = end === slot.startTime ? slot.startTime : `${slot.startTime}–${end}`;

  const verdict = (kind, key, mark, on) => {
    const label = escapeHtml(t(key));
    return (
      `<button type="button" class="vb vb--${kind}${on ? " is-on" : ""}" data-verdict="${kind}"` +
      ` aria-pressed="${on}" data-i18n-aria-label="${key}" data-i18n-title="${key}"` +
      ` aria-label="${label}" title="${label}">` +
      `<span aria-hidden="true">${mark}</span></button>`
    );
  };

  block.innerHTML =
    `<a class="sch-open" href="${escapeHtml(slot.url)}" target="_blank" rel="noopener" draggable="false">` +
    `<span class="sch-name">${foreign(slot.title)}</span>` +
    `<span class="sch-meta">` +
    `<span class="sch-time">${escapeHtml(timeStr)}</span>` +
    (slot.venueName ? `<span class="sch-venue">${foreign(slot.venueName)}</span>` : "") +
    `</span></a>` +
    `<div class="sch-why">` +
    `<span class="sch-rarity" data-i18n-slot="${slot.freedom === 1 ? "rarity.only" : "rarity.some"}">` +
    `${escapeHtml(rarityText(slot.freedom))}</span>` +
    `</div>` +
    // The foot is the row a squeezed block keeps: what else wanted this hour,
    // and the four answers. Both are reachable however little room there is.
    `<div class="sch-foot">` +
    (slot.contenders.length
      ? `<button type="button" class="sch-rivals-btn" aria-expanded="false"` +
        ` data-i18n-slot="rivals.more">${escapeHtml(t("rivals.more", { count: slot.contenders.length }))}</button>`
      : "") +
    `<div class="sch-verdicts" role="group" aria-label="${escapeHtml(t("verdict.groupLabel"))}"` +
    ` data-i18n-aria-label="verdict.groupLabel">` +
    verdict("lock", "verdict.lock", "🔒", locked) +
    verdict("favourite", "verdict.favourite", "★", favourite) +
    verdict("noTime", "verdict.noTime", "✕", false) +
    verdict("noShow", "verdict.noShow", "⊘", false) +
    `</div></div>`;
  return block;
}

function buildTravelLeg(a, b, top, bottom) {
  const leg = document.createElement("div");
  leg.className = "sch-leg";
  leg.style.top = `${top}px`;
  leg.style.height = `${Math.max(0, bottom - top)}px`;

  const gapMin = Math.max(0, b.startMinuteOfDay - a.endMinuteOfDay);
  const meta = MODE_META[state.mode];
  const km1 = (km) =>
    new Intl.NumberFormat(currentIntlLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(km);
  let text;
  let title;
  let key;
  if (a.venueCode && b.venueCode && a.venueCode === b.venueCode) {
    key = "leg.sameVenue";
    text = t(key, { gap: gapMin });
    title = t("leg.sameVenue.tip", { venue: a.venueName || "", gap: gapMin });
  } else {
    const km = distanceKm({ lat: a.venueLat, lng: a.venueLng }, { lat: b.venueLat, lng: b.venueLng });
    const mins = travelMinutes(
      { lat: a.venueLat, lng: a.venueLng },
      { lat: b.venueLat, lng: b.venueLng },
      state.mode
    );
    if (km == null || mins == null) {
      key = "leg.nearby";
      text = t(key, { gap: gapMin });
      title = t("leg.unknown.tip");
    } else {
      const spare = Math.round(gapMin - mins);
      key = "leg.travel";
      text = t(key, {
        minutes: Math.round(mins),
        km: km1(km),
        spare: `${spare >= 0 ? "+" : ""}${spare}`,
      });
      title = t("leg.travel.tip", {
        minutes: Math.round(mins),
        mode: t(meta.verbKey),
        km: km1(km),
        gap: gapMin,
        spare,
      });
    }
  }
  leg.title = title;
  leg.dataset.i18nSlot = key;
  leg.innerHTML =
    `<span class="leg-emoji" aria-hidden="true">${meta.emoji}</span>` +
    `<span class="leg-text">${escapeHtml(text)}</span>`;
  return leg;
}

// --- the calendar's two floating surfaces ---------------------------------
//
// What else this show plays (hover, and focus for a keyboard), and who else
// wanted this hour (click). Both are drawn into a single element apiece and
// positioned against the block, so nothing is created per block and the
// calendar can be rebuilt on every verdict without leaking listeners.

function closePops() {
  for (const id of ["calPreview", "calRivals"]) {
    const pop = $(id);
    if (pop) pop.hidden = true;
  }
  for (const btn of document.querySelectorAll(".sch-rivals-btn[aria-expanded='true']")) {
    btn.setAttribute("aria-expanded", "false");
  }
}

/* Anchored to the block, in the card around the calendar rather than in the
 * calendar itself: the calendar is a scroller, and a scroller clips whatever
 * leaves it — which is every popover that wants to sit above a block. The card
 * is the popovers' offset parent, so the sums below are in its coordinates,
 * and a scroll of the calendar closes them rather than dragging them along. */
function placePop(pop, block) {
  const host = $("planResult").getBoundingClientRect();
  const box = block.getBoundingClientRect();
  pop.hidden = false;
  const popBox = pop.getBoundingClientRect();
  const left = clamp(
    box.left - host.left + box.width / 2 - popBox.width / 2,
    4,
    Math.max(4, host.width - popBox.width - 4)
  );
  // Above the block when there is room for it there, below when there is not.
  const above = box.top - host.top > popBox.height + 10;
  pop.classList.toggle("cal-pop--below", !above);
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(above ? box.top - host.top - popBox.height - 8 : box.bottom - host.top + 8)}px`;
}

/* Every night the programme prints for this show: the drafted one marked, the
 * ones the reader has rejected struck through. This is what makes "not this
 * night" a decision rather than a guess — you can see whether there is another
 * one before you take it. */
function openPreview(block) {
  const slug = block.dataset.slug;
  const show = state.catalogue.shows.find((sh) => sh.slug === slug);
  if (!show) return;
  const pop = $("calPreview");
  const drafted = state.picked.get(slug);
  const nights = [...show.performances]
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((perf) => {
      const key = `${perf.date}T${perf.start}`;
      const isDrafted = key === drafted;
      const isRejected = state.noTime.has(instanceKey(slug, key));
      const note = isDrafted ? t("preview.drafted") : isRejected ? t("preview.rejected") : "";
      return (
        `<li class="pop-night${isDrafted ? " is-drafted" : ""}${isRejected ? " is-rejected" : ""}">` +
        `<span class="pn-when">${escapeHtml(dayAndDate(perf.date))} · ${escapeHtml(perf.start)}</span>` +
        (note ? `<span class="pn-note">${escapeHtml(note)}</span>` : "") +
        `</li>`
      );
    })
    .join("");
  pop.innerHTML =
    `<p class="pop-title">${foreign(show.title)}</p>` +
    `<p class="pop-lead">${escapeHtml(
      show.performances.length === 1 ? t("preview.onlyNight") : t("preview.nights", { count: show.performances.length })
    )}</p>` +
    `<ul class="pop-nights">${nights}</ul>`;
  placePop(pop, block);
}

/* Who else wanted this hour, and what it would cost to take one instead: a
 * contender carries the count that lost it the hour, and choosing it locks it,
 * because wanting a particular show at a particular hour is exactly a lock. */
function openRivals(block) {
  const slot = draftedSlots().find(
    (s) => s.slug === block.dataset.slug && slotKey(s) === block.dataset.key
  );
  if (!slot || !slot.contenders.length) return;
  const pop = $("calRivals");
  pop.innerHTML =
    `<p class="pop-title" data-i18n-slot="rivals.title">${escapeHtml(t("rivals.title", { time: slot.startTime }))}</p>` +
    `<ul class="pop-rivals">` +
    slot.contenders
      .map(
        (rival) =>
          `<li><button type="button" class="pop-rival" data-take="${escapeHtml(rival.slug)}"` +
          ` data-key="${escapeHtml(slotKey(rival))}">` +
          `<span class="pr-title">${foreign(rival.title)}</span>` +
          `<span class="pr-nights">${escapeHtml(rarityText(rival.freedom))}</span></button></li>`
      )
      .join("") +
    `</ul>` +
    `<p class="pop-foot" data-i18n-slot="rivals.foot">${escapeHtml(t("rivals.foot"))}</p>`;
  placePop(pop, block);
}

// --- the two questions the festival doesn't answer ------------------------

function renderTripLinks() {
  const row = $("tripLinksRow");
  const links = [festivalStayLink(windowStartISO(), windowEndISO()), ...festivalTravelLinks()];
  row.innerHTML = links
    .map((link) => {
      // The partner writes the URL; the page writes what the link is called,
      // so the offer reads in the reader's language rather than the vendor's.
      const label = t(link.labelKey);
      return (
        `<a class="trip-link" href="${escapeHtml(link.url)}" target="_blank" rel="sponsored noopener noreferrer"` +
        ` title="${escapeHtml(t("trip.partnerTip", { text: label, partner: link.partner }))}">` +
        `<span class="trip-link-text" data-i18n-slot="${link.labelKey}">${escapeHtml(label)}</span>` +
        `<span class="trip-link-partner">${escapeHtml(link.partner)}</span></a>`
      );
    })
    .join("");
}

// --- browse + search ------------------------------------------------------

function showMeta(show) {
  // Performances, not nights: some of this programme's shows play twice on one
  // evening, so counting distinct dates would under-report what is on offer.
  const runs = show.performances.length;
  const venue = show.venueNames.join(", ");
  const parts = [
    show.genre ? foreign(show.genre) : null,
    venue ? foreign(venue) : null,
    escapeHtml(t("show.performances", { count: runs })),
    show.duration ? escapeHtml(t("show.minutes", { count: show.duration })) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function rowHtml(show) {
  const on = state.starred.has(show.slug);
  return (
    `<button type="button" class="ss-star" data-slug="${escapeHtml(show.slug)}"` +
    ` aria-pressed="${on}" aria-label="${escapeHtml(t(on ? "search.star.remove" : "search.star.add", { title: show.title }))}">` +
    `${on ? "★" : "☆"}</button>` +
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
  $("browseLine1").textContent = t("browse.pick", { count: state.catalogue.shows.length });
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
  $("ssfGenreValue").textContent = genres.size
    ? t("search.kindsChosen", { count: genres.size })
    : t("search.anyKind");
  $("ssfGenreValue").dataset.i18nSlot = genres.size ? "search.kindsChosen" : "search.anyKind";
  $("ssfVenueValue").textContent = venues.size
    ? t("search.venuesChosen", { count: venues.size })
    : t("search.anyVenue");
  $("ssfVenueValue").dataset.i18nSlot = venues.size ? "search.venuesChosen" : "search.anyVenue";
  const active = genres.size + venues.size;
  $("ssBadge").hidden = active === 0;
  $("ssBadge").textContent = String(active);
  $("ssReset").hidden = active === 0;
}

function toggleStar(slug) {
  applyVerdict("favourite", slug, state.picked.get(slug) || "");
}

/** Everything the page draws, redrawn. */
function rebuild() {
  renderBrowse();
  redraft();
  layoutOverlay();
}

// --- controls -------------------------------------------------------------

function wireControls() {
  $("ctlDayStart").addEventListener("change", (e) => {
    const min = clockToMin(e.target.value);
    if (min != null) state.dayStartMin = min;
    e.target.value = minToDayClock(state.dayStartMin);
    redraftAndSave();
  });
  $("ctlDayEnd").addEventListener("change", (e) => {
    const min = clockToMin(e.target.value);
    if (min != null) state.dayEndMin = min;
    e.target.value = minToDayClock(state.dayEndMin);
    redraftAndSave();
  });
  for (const meal of state.meals) {
    const cap = meal.id[0].toUpperCase() + meal.id.slice(1);
    $(`meal${cap}On`).addEventListener("change", (e) => {
      meal.enabled = e.target.checked;
      redraftAndSave();
    });
    $(`meal${cap}Start`).addEventListener("change", (e) => {
      const min = clockToMin(e.target.value);
      if (min != null) meal.startMin = min;
      redraftAndSave();
    });
    $(`meal${cap}End`).addEventListener("change", (e) => {
      const min = clockToMin(e.target.value);
      if (min != null) meal.endMin = min;
      redraftAndSave();
    });
  }
  $("ctlMax").addEventListener("change", (e) => {
    state.maxPerDay = Math.max(1, Number(e.target.value) || 1);
    redraftAndSave();
  });
  $("ctlGap").addEventListener("change", (e) => {
    state.minGap = Number(e.target.value);
    redraftAndSave();
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
    redraftAndSave();
  });
}

/* The two controls whose option text and field labels are words rather than
 * numbers: the gap menu, and the meal time fields (whose label names the meal). */
function syncControlWords() {
  for (const option of $("ctlGap").options) {
    const minutes = Number(option.value);
    option.textContent =
      minutes === 60 ? t("plan.gap.hour") : t("plan.gap.minutes", { count: minutes });
  }
  for (const meal of state.meals) {
    const cap = meal.id[0].toUpperCase() + meal.id.slice(1);
    const name = t(meal.id === "lunch" ? "plan.lunch" : "plan.dinner");
    $(`meal${cap}Start`).setAttribute("aria-label", t("plan.mealStartLabel", { meal: name }));
    $(`meal${cap}End`).setAttribute("aria-label", t("plan.mealEndLabel", { meal: name }));
  }
}

function syncControls() {
  syncControlWords();
  $("ctlDayStart").value = minToDayClock(state.dayStartMin);
  $("ctlDayEnd").value = minToDayClock(state.dayEndMin);
  for (const meal of state.meals) {
    const cap = meal.id[0].toUpperCase() + meal.id.slice(1);
    $(`meal${cap}On`).checked = meal.enabled;
    $(`meal${cap}Start`).value = minToClock(meal.startMin);
    $(`meal${cap}End`).value = minToClock(meal.endMin);
  }
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
    // The lane's × lifts every verdict on that show, which is what takes the
    // lane off the grid — the grid holds the shows you have ruled on.
    const remove = e.target.closest(".lane-remove");
    if (remove) {
      clearVerdicts(remove.closest(".lane").dataset.slug);
      return;
    }
    if (!e.target.closest(".show-search")) closeSearch();
  });

  $("clearFavBtn").addEventListener("click", () => {
    state.starred.clear();
    state.locked.clear();
    state.noTime.clear();
    state.noShow.clear();
    saveStarred();
    saveVerdicts();
    rebuild();
  });

  $("legendBtn").addEventListener("click", () => {
    const legend = $("calLegend");
    legend.hidden = !legend.hidden;
    $("legendBtn").setAttribute("aria-expanded", String(!legend.hidden));
    $("legendBtn").classList.toggle("is-on", !legend.hidden);
  });
}

/* One delegated set of listeners for the whole calendar: it is rebuilt on
 * every verdict, so nothing may hold a reference to a block. */
function wireCalendar() {
  const wrap = $("scheduleWrap");
  // Clicks are delegated from the card, because the popovers are the card's
  // children rather than the calendar's (see placePop) — a listener on the
  // calendar alone would never hear a contender being taken.
  const card = $("planResult");

  card.addEventListener("click", (e) => {
    const verdictBtn = e.target.closest("[data-verdict]");
    if (verdictBtn) {
      const block = verdictBtn.closest(".sch-show");
      applyVerdict(verdictBtn.dataset.verdict, block.dataset.slug, block.dataset.key);
      return;
    }
    // Taking a contender IS locking it: you are naming a show and an hour.
    const take = e.target.closest("[data-take]");
    if (take) {
      applyVerdict("lock", take.dataset.take, take.dataset.key);
      return;
    }
    const rivalsBtn = e.target.closest(".sch-rivals-btn");
    if (rivalsBtn) {
      const open = rivalsBtn.getAttribute("aria-expanded") === "true";
      closePops();
      if (!open) {
        rivalsBtn.setAttribute("aria-expanded", "true");
        openRivals(rivalsBtn.closest(".sch-show"));
      }
      return;
    }
    if (!e.target.closest(".cal-pop")) closePops();
  });

  // The preview follows the pointer between blocks and closes when it leaves
  // the calendar. It is deliberately not opened from inside a verdict button:
  // a reader reaching for ✕ is past wanting to be told what else is on.
  wrap.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const block = e.target.closest(".sch-show");
    if (!block || e.target.closest(".sch-verdicts") || e.target.closest(".cal-pop")) return;
    if ($("calRivals").hidden === false) return;
    openPreview(block);
  });
  wrap.addEventListener("pointerleave", () => {
    $("calPreview").hidden = true;
  });
  // A keyboard reaches the same preview by tabbing to the block.
  wrap.addEventListener("focusin", (e) => {
    const block = e.target.closest(".sch-show");
    if (block && !e.target.closest(".sch-verdicts")) openPreview(block);
  });

  // A popover is placed once, against where the block was; scrolling the
  // calendar under it would leave it pointing at nothing.
  wrap.addEventListener("scroll", closePops);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePops();
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
    if (!state.draft) return;
    download(`${FESTIVAL.id}-plan.csv`, toCsv(draftedSlots()), "text/csv;charset=utf-8");
  });
  $("importIcsBtn").addEventListener("click", () => {
    if (!state.draft) return;
    download(
      `${FESTIVAL.id}-plan.ics`,
      toIcs(draftedSlots(), {
        now: new Date(),
        timezone: state.catalogue.festival.timezone,
        calendarName: t("export.calendarName", { festival: state.catalogue.festival.name }),
        prodId: "-//EdFringeNow//Festival Planner//EN",
      }),
      "text/calendar;charset=utf-8"
    );
  });
}

// --- boot -----------------------------------------------------------------

/* Everything the page drew itself, redrawn in the language just chosen. The
 * static markup is the i18n module's own job; this is the rest. */
function retranslate() {
  renderChrome();
  syncControlWords();
  if (!state.catalogue) return;
  renderHeaderHint();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  renderPlanSub();
  rebuild();
  layoutOverlay();
}

async function boot() {
  initI18n({
    storagePrefix: FESTIVAL.storagePrefix,
    localeSelect: $("langSelect"),
    themeButton: $("themeToggle"),
    onChange: retranslate,
  });
  renderChrome();
  syncControlWords();
  renderPlanSub();
  $("loadingState").hidden = false;
  try {
    state.catalogue = await loadCatalogue(FESTIVAL.dataUrl);
  } catch (error) {
    $("loadingState").hidden = true;
    $("errorState").hidden = false;
    // The translated line stays; what the failure actually said goes beneath it,
    // untranslated, because it came from the network rather than from us.
    $("errorTech").textContent = String(error.message || error);
    return;
  }
  $("loadingState").hidden = true;

  state.venues = state.catalogue.venues;
  state.coords = venueCoords(state.venues);
  state.dates = festivalDates(state.catalogue.shows);
  state.d0 = 1;
  state.d1 = state.dates.length;

  const known = new Set(state.catalogue.shows.map((s) => s.slug));
  state.starred = new Set(readStore(KEY_STARRED, []).filter((slug) => known.has(slug)));
  restoreVerdicts(known);
  restorePrefs();

  renderHeaderHint();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  syncControls();
  wireWindow();
  wireBoard();
  wireCalendar();
  wireSearch();
  wireControls();
  wireExports();
  rebuild();
  // Two frames: the board has to be laid out before the window overlay can be
  // measured off the day header's real geometry.
  requestAnimationFrame(() => requestAnimationFrame(layoutOverlay));
}

/* The site version in the footer's popup, exactly as the other two pages carry
 * it — read from the stamp the release wrote into this page. */
function showVersion() {
  const version = readVersionStamp();
  if (version) attachVersionPopup($("footerVersion"), `v${version}`);
}

showVersion();
boot();
