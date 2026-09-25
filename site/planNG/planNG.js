/* The festival planner page.
 *
 * A calendar-led planner for every festival in the registry
 * (site/data/festivals/index.json), zoomed in on one at a time: the year's
 * timeline across the top chooses which, and that choice sets the planning
 * period (the edition's run and a day either side), the pool the calendar
 * drafts from (every reachable performance of every edition in the period —
 * lib/pool.js, ../shared/feasibility.js), the theme and the trip links
 * (./festivals.js). The only strings this module names are its own UI's. It
 * shares the Fringe planner's stylesheet and its pure engine (../plan/lib/),
 * and shares no state with it at all — every key it stores is under its own
 * prefix.
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
import { slotEndTime } from "../plan/lib/itinerary.js";
import { distanceKm, travelMinutes } from "../plan/lib/travel.js";
import { attachVersionPopup } from "../shared/version-popup.js";
import { readVersionStamp } from "../shared/version.js";
import { currentEdition, loadEdition, loadFestivalIndex, venueCoords } from "../shared/festival-catalogue.js";
import { originReach, poolReach } from "../shared/feasibility.js";
import {
  FACET_OPTIONS,
  MAX_PERIOD_DAYS,
  PICK_CHIPS,
  RIVAL_ROWS,
  SEARCH_RESULT_ROWS,
  capOptions,
  listPage,
} from "../shared/limits.js";
import {
  LEGACY_EDITION_ID,
  LEGACY_FESTIVAL_ID,
  LEGACY_STORAGE_PREFIX,
  PAGE_ROOT,
  SITE_NAV,
  STORAGE_PREFIX,
  kindEmoji,
  presentationOf,
} from "./festivals.js";
import { buildPool, daysOf, festivalOf, shiftDay } from "./lib/pool.js";
import { migrateLegacy } from "./lib/migrate.js";
import { editionKey, timelineSpan } from "./lib/timeline.js";
import { layoutRows, renderTimeline } from "./timeline-view.js";
import { currentDir, currentIntlLocale, escapeHtml, initI18n, t, tHtml } from "./i18n/i18n.js";

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
const SCH_HOUR_PX = 72;
// A day the reader has asked to keep breakfast free of is fifteen hours long
// with an evening festival in the last three of them. An hour keeps its full
// height while the calendar is a festival evening, and is compressed towards
// SCH_HOUR_MIN as the axis grows, so a long day is a calendar rather than a
// screen of empty morning to scroll past.
const SCH_HOUR_MIN = 34;
const SCH_AXIS_TARGET_PX = 780;
const SCH_HEAD_PX = 42;
// A card's face carries the show and nothing else — its name, its hour and its
// venue — so its floor is what those two rows measure. Everything the page has
// to say about the card is in the popup.
const SCH_MIN_BLOCK = 44;
const SCH_TIGHT_PX = 52;
const SCH_GUTTER_PX = 44;
// How far past the evening the draft uses the axis will stretch to show a
// slack day boundary — see calendarAxis().
const ZONE_MAX_MIN = 60;
// A dragged day boundary lands on five-minute marks, and can be pushed to
// 06:00 the following morning, which is where "late night" stops being one.
const SNAP_MIN = 5;
const DAY_END_CEIL = 30 * 60;

/* Every translation key is spelled out rather than built from an id: the
 * catalogue's own gate asks that each key be named in the page's source, which
 * is what keeps a key nothing says any more from being translated forever. */
const MODE_META = {
  walk: { emoji: "🚶", nameKey: "travel.walk", tipKey: "travel.walk.tip", verbKey: "travel.mode.walk" },
  bike: { emoji: "🚲", nameKey: "travel.bike", tipKey: "travel.bike.tip", verbKey: "travel.mode.bike" },
  car: { emoji: "🚗", nameKey: "travel.car", tipKey: "travel.car.tip", verbKey: "travel.mode.car" },
};

const KEY_STARRED = STORAGE_PREFIX + "starred";
const KEY_PREFS = STORAGE_PREFIX + "prefs";
const KEY_VERDICTS = STORAGE_PREFIX + "verdicts";
const KEY_ORIGIN = STORAGE_PREFIX + "origin";
const KEY_FOCUS = STORAGE_PREFIX + "focus";

/* The countries the origin question offers by name, beyond the festival's own.
 * Named by Intl in the reader's language, so there is no list of country names
 * to translate; any other country is "somewhere else abroad". */
const ORIGIN_COUNTRIES = ["GB", "US", "FR", "DE", "RU", "UA", "IT", "ES", "NL", "PL", "JP", "CA", "AU"];

const state = {
  // The registry, and which of its editions the page is zoomed in on.
  registry: null,
  focus: null,        // { festival, edition, key }
  // The planning period: the focused run and a day either side, unless the
  // reader has stretched it. Every day in it is a column of the calendar.
  period: null,       // { from, to } inclusive ISO dates
  reach: [],          // poolReach() for every edition overlapping the period
  origin: null,       // what the reader said about where they come from
  editions: new Map(), // dataUrl -> Promise of an adapted catalogue
  browsePages: 1,
  poolSlugs: new Set(),
  // The pool: every reachable show in the period, ids made unique by pool.js.
  catalogue: null,
  dates: [],          // every day of the period, ascending — the grid's columns
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
    { id: "breakfast", enabled: false, startMin: 8 * 60, endMin: 9 * 60, place: "" },
    { id: "lunch", enabled: false, startMin: 12 * 60 + 30, endMin: 13 * 60 + 30, place: "" },
    { id: "dinner", enabled: false, startMin: 18 * 60, endMin: 19 * 60, place: "" },
  ],
  maxPerDay: 3,
  minGap: 30,
  minGapSame: 0,
  mode: "walk",
  // The axis and column widths held still for the duration of a blocker drag.
  drag: null,
  // The kinds the reader said they came for, by the programme's own category
  // slug. Empty is the honest default and means no taste stated at all, which
  // is not the same as having chosen every kind — see MAX_OFF_INTEREST_PER_DAY.
  interests: new Set(),
  // Whether the reader asked to see every kind the pool offers.
  interestsOpen: false,
  // Which questions are showing their exact numbers. Not stored: it is where
  // the reader has got to, not something they decided.
  opened: new Set(),
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
function foreign(text, id) {
  const festival = festivalById(festivalOf(id)) || (state.focus && state.focus.festival);
  const lang = festival ? festival.lang : "und";
  const dir = festival ? festival.dir : "auto";
  return `<span lang="${lang}" dir="${dir}">${escapeHtml(text)}</span>`;
}

function festivalById(id) {
  return (state.registry && state.registry.festivals.find((f) => f.id === id)) || null;
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
  // stripes what the focused festival's audience actually has off work.
  const d = dowOf(iso);
  const country = state.focus ? state.focus.festival.country : null;
  return country === "IL" ? d === 5 || d === 6 : d === 6 || d === 0;
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
/* The day's end as the calendar draws it. A day that ended at or before it
 * started would draw an inverted zone and schedule nothing, so the two
 * boundaries are held a quarter of an hour apart. */
const dayEndMin = () => Math.max(state.dayStartMin + 15, state.dayEndMin);

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

/* Every verdict the reader ever gave, on any festival, is kept whole: a show
 * outside today's pool is still one they ruled on, and the pool moves with the
 * period. */
function restoreVerdicts() {
  const saved = readStore(KEY_VERDICTS, null);
  if (!saved) return;
  for (const [slug, key] of Object.entries(saved.locked || {})) state.locked.set(slug, key);
  for (const key of saved.noTime || []) state.noTime.add(key);
  for (const slug of saved.noShow || []) state.noShow.add(slug);
}

/* The date window and the period are remembered per edition, so going back to
 * a festival finds it as it was left; everything else is the reader's own and
 * holds on every festival. */
function savePrefs() {
  const saved = readStore(KEY_PREFS, {}) || {};
  const windows = { ...(saved.windows || {}) };
  const periods = { ...(saved.periods || {}) };
  if (state.focus && state.dates.length) {
    windows[state.focus.key] = { from: windowStartISO(), to: windowEndISO() };
    periods[state.focus.key] = { ...state.period };
  }
  writeStore(KEY_PREFS, {
    windows,
    periods,
    dayStartMin: state.dayStartMin,
    dayEndMin: state.dayEndMin,
    meals: state.meals,
    maxPerDay: state.maxPerDay,
    minGap: state.minGap,
    minGapSame: state.minGapSame,
    mode: state.mode,
    interests: [...state.interests],
  });
}

function restorePrefs() {
  const saved = readStore(KEY_PREFS, null);
  if (!saved) return;
  state.dayStartMin = Number.isFinite(saved.dayStartMin) ? saved.dayStartMin : state.dayStartMin;
  state.dayEndMin = Number.isFinite(saved.dayEndMin) ? saved.dayEndMin : state.dayEndMin;
  if (Array.isArray(saved.meals)) {
    for (const meal of state.meals) {
      const stored = saved.meals.find((m) => m && m.id === meal.id);
      if (stored) {
        Object.assign(meal, {
          enabled: !!stored.enabled,
          startMin: stored.startMin,
          endMin: stored.endMin,
          place: typeof stored.place === "string" ? stored.place : "",
        });
      }
    }
  }
  state.maxPerDay = Number(saved.maxPerDay) || state.maxPerDay;
  state.minGap = Number.isFinite(saved.minGap) ? saved.minGap : state.minGap;
  state.minGapSame = Number.isFinite(saved.minGapSame) ? saved.minGapSame : state.minGapSame;
  if (MODE_META[saved.mode]) state.mode = saved.mode;
  if (Array.isArray(saved.interests)) state.interests = new Set(saved.interests);
}

// --- chrome ---------------------------------------------------------------

/** The focused festival's name, in the reader's language where the page has it. */
function festivalName(festival) {
  const p = presentationOf(festival.id);
  return p ? t(p.nameKey) : festival.name;
}

/** The festival's city, in the reader's language where the page has it. */
function festivalCity(festival) {
  const p = presentationOf(festival.id);
  return p ? t(p.cityKey) : festival.city;
}

/** Its two-word mark, which the timeline labels it by. */
function wordmarkOf(festival) {
  const p = presentationOf(festival.id);
  if (p) return p.wordmark;
  const words = festival.name.split(" ");
  return [words[0], words.slice(1).join(" ")];
}

/* A domain as a reader would say it — "comedy-festival.co.il". */
const siteName = (url) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

function renderChrome() {
  const festival = state.focus && state.focus.festival;
  // The bar is the site's, not the festival's: the same nav whichever festival
  // is in focus. The timeline and the page title say which one that is.
  const nav = $("siteNav");
  nav.innerHTML =
    SITE_NAV.map(
      (link) =>
        `<a href="${link.href}" class="nav-link" data-i18n-slot="${link.labelKey}">` +
        `${escapeHtml(t(link.labelKey))}</a>`
    ).join("") +
    `<a href="./" class="nav-link is-active" data-i18n-slot="nav.festivals">` +
    `${escapeHtml(t("nav.festivals"))}</a>`;

  const title = $("pageTitle");
  title.textContent = festival ? t("festival.title", { festival: festivalName(festival) }) : t("page.title");
  title.dataset.i18nSlot = festival ? "festival.title" : "page.title";
  document.title = festival ? t("doc.titleFor", { festival: festivalName(festival) }) : t("doc.title");

  // The festival's own link in the footer: its programme's source.
  $("footerData").innerHTML = festival
    ? tHtml(
        "footer.dataFrom",
        {},
        {
          source:
            `<a href="${escapeHtml(festival.site)}" target="_blank" rel="noopener">` +
            `${escapeHtml(siteName(festival.site))}</a>`,
        }
      )
    : "";
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
      `<span class="lane-title">${foreign(show.title, show.slug)}</span>`;
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
  void trackLeft;
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

function wireWindow() {
  const n = () => state.dates.length;
  dragDate($("edgeStart"), (ev) => {
    state.d0 = clamp(dayAt(ev.clientX) + 1, 1, state.d1);
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
  // The drawer's grid is not measurable while it is folded away, so the
  // window's overlay is laid out when it opens rather than only at boot.
  $("boardDrawer").addEventListener("toggle", layoutOverlay);
  addEventListener("resize", () => {
    layoutOverlay();
    placeDateEdges();
  });
}

// --- the preference questions ---------------------------------------------
//
// The row above the calendar. Each question is one line, a handful of picture
// answers, and — where a picture is shorthand for numbers — the numbers
// themselves behind an expander. A picture is never a coarser control than the
// numbers it stands for: the fine controls are the state, and the pictures are
// read back off it, so opening a question can never discard an answer.

// What each picture answer of "how full a day?" is shorthand for. Read in both
// directions: picking one sets the pair, and a pair that matches one lights it.
const PACE_STEPS = [
  { id: "easy", key: "prefs.pace.easy", emoji: "\u{1F634}", maxPerDay: 1, minGap: 60 },
  { id: "steady", key: "prefs.pace.steady", emoji: "\u{1F604}", maxPerDay: 3, minGap: 30 },
  { id: "packed", key: "prefs.pace.packed", emoji: "\u{1F483}", maxPerDay: 5, minGap: 15 },
];

// Which meals each picture answer of "how do you want to eat?" asks for.
const FOOD_ANSWERS = [
  { id: "self", key: "prefs.food.self", emoji: "\u{1F96A}", meals: [] },
  { id: "dinner", key: "prefs.food.dinner", emoji: "\u{1F377}", meals: ["dinner"] },
  { id: "regular", key: "prefs.food.regular", emoji: "\u{1F37D}", meals: ["breakfast", "lunch", "dinner"] },
];

const MEAL_META = {
  breakfast: { emoji: "\u{1F950}", nameKey: "meal.breakfast" },
  lunch: { emoji: "\u{1F957}", nameKey: "meal.lunch" },
  dinner: { emoji: "\u{1F37D}", nameKey: "meal.dinner" },
};

// The variety question's answers. Drawn, refused, and not read by anything:
// see `prefs.variety.note` and leaf 21.4 — the rule that would make this live
// has not been decided, and a live-looking control over no rule would lie.
const VARIETY_ANSWERS = [
  { id: "little", key: "prefs.variety.little", emoji: "\u{1F9ED}" },
  { id: "some", key: "prefs.variety.some", emoji: "\u{1F5FA}" },
  { id: "lots", key: "prefs.variety.lots", emoji: "\u{1F3AA}" },
];

// Until the variety question answers it, this is the whole of "how much of a
// night may come from outside what you came for".
const MAX_OFF_INTEREST_PER_DAY = 1;

const GAP_CHOICES = [0, 15, 30, 45, 60];

/** Every show filed under a kind the reader named — the drafter's `preferred`. */
function preferredSlugs() {
  if (!state.interests.size || !state.catalogue) return [];
  return state.catalogue.shows
    .filter((show) => (show.genreSlugs || []).some((kind) => state.interests.has(kind)))
    .map((show) => show.slug);
}

/** The pace picture the current pair of numbers is, or none when it is neither. */
function paceAnswer() {
  const step = PACE_STEPS.find((p) => p.maxPerDay === state.maxPerDay && p.minGap === state.minGap);
  return step ? step.id : null;
}

/** The food picture the enabled meals are, or none when they are some other set. */
function foodAnswer() {
  const on = state.meals.filter((m) => m.enabled).map((m) => m.id);
  const answer = FOOD_ANSWERS.find(
    (a) => a.meals.length === on.length && a.meals.every((id) => on.includes(id))
  );
  return answer ? answer.id : null;
}

const pickHtml = (question, id, emoji, label, on, { disabled = false, tip = "" } = {}) =>
  `<button type="button" class="pref-pick${on ? " is-on" : ""}" data-pick="${question}:${id}"` +
  ` aria-pressed="${on}"${disabled ? " disabled" : ""}` +
  `${tip ? ` title="${escapeHtml(tip)}"` : ""}>` +
  `<span class="pref-ico" aria-hidden="true">${emoji}</span>` +
  `<span class="pref-word">${label}</span></button>`;

const gapSelectHtml = (id, value) =>
  `<select class="opt-select" data-num="${id}">` +
  GAP_CHOICES.map(
    (min) =>
      `<option value="${min}"${min === value ? " selected" : ""}>` +
      `${escapeHtml(min === 60 ? t("plan.gap.hour") : t("plan.gap.minutes", { count: min }))}</option>`
  ).join("") +
  `</select>`;

const timeInputHtml = (mealId, edge, min, labelKey) =>
  `<input class="ctl-time meal-time" type="time" step="300" data-time="${mealId}:${edge}"` +
  ` value="${minToClock(min)}"` +
  ` aria-label="${escapeHtml(t(labelKey, { meal: t(MEAL_META[mealId].nameKey) }))}" />`;

/** One question: the ask, its pictures, and the numbers behind them. */
function questionHtml(id, askKey, answers, fine) {
  const open = state.opened.has(id);
  return (
    `<section class="pref" data-q="${id}">` +
    `<p class="pref-ask">${escapeHtml(t(askKey))}</p>` +
    `<div class="pref-answers" role="group" aria-label="${escapeHtml(t(askKey))}">${answers}</div>` +
    (fine
      ? `<button type="button" class="pref-expand" data-expand="${id}" aria-expanded="${open}"` +
        ` aria-controls="fine-${id}">` +
        `<span class="pref-expand-word">${escapeHtml(t(open ? "prefs.less" : "prefs.more"))}</span>` +
        `<span class="pref-caret" aria-hidden="true">▾</span></button>` +
        `<div class="pref-fine" id="fine-${id}"${open ? "" : " hidden"}>${fine}</div>`
      : "") +
    `</section>`
  );
}

/* The kinds on offer: the focused festival's in its own order, then the other
 * festivals' by how much of the pool each holds. A period pooling several festivals can offer dozens, so
 * past PICK_CHIPS the rest wait behind one "more kinds" chip — except a kind
 * already chosen, which is always shown. */
function interestsHtml() {
  const count = new Map();
  for (const show of state.catalogue.shows) {
    for (const kind of show.genreSlugs || []) count.set(kind, (count.get(kind) || 0) + 1);
  }
  const focusId = state.focus.festival.id;
  const cats = state.catalogue.categories;
  const ordered = [
    ...cats.filter((kind) => kind.festivalId === focusId),
    ...cats.filter((kind) => kind.festivalId !== focusId).sort((a, b) => (count.get(b.slug) || 0) - (count.get(a.slug) || 0)),
  ];
  const shown = state.interestsOpen
    ? ordered
    : ordered.filter((kind, i) => i < PICK_CHIPS || state.interests.has(kind.slug));
  const held = ordered.length - shown.length;
  const kinds = shown
    .map((kind) =>
      pickHtml(
        "interest",
        kind.slug,
        kindEmoji(kind.festivalId, kind.slug.slice(kind.festivalId.length + 1)),
        foreign(kind.name, kind.slug),
        state.interests.has(kind.slug)
      )
    )
    .join("");
  const everything = pickHtml(
    "interest",
    "*",
    "✨",
    escapeHtml(t("prefs.interests.all")),
    state.interests.size === 0
  );
  const more = held
    ? `<button type="button" class="pref-pick pref-more-kinds" data-more-kinds="1">` +
      `<span class="pref-word" data-i18n-slot="prefs.interests.more">${escapeHtml(t("prefs.interests.more", { count: held }))}</span></button>`
    : "";
  return everything + kinds + more;
}

function varietyFineHtml() {
  return (
    `<div class="pref-row pref-row--soon">` +
    `<span class="pref-label">${escapeHtml(t("prefs.variety.q"))}</span>` +
    `<span class="pref-soon">${escapeHtml(t("prefs.variety.soon"))}</span>` +
    `</div>` +
    `<div class="pref-answers pref-answers--soon" role="group" aria-label="${escapeHtml(t("prefs.variety.q"))}">` +
    VARIETY_ANSWERS.map((a) =>
      pickHtml("variety", a.id, a.emoji, escapeHtml(t(a.key)), false, { disabled: true })
    ).join("") +
    `</div>` +
    `<p class="pref-note">${escapeHtml(t("prefs.variety.note", { count: MAX_OFF_INTEREST_PER_DAY }))}</p>`
  );
}

function paceFineHtml() {
  return (
    `<div class="pref-row">` +
    `<span class="pref-label">${escapeHtml(t("prefs.pace.atMost"))}</span>` +
    `<input class="ctl-num" type="number" min="1" max="8" step="1" inputmode="numeric"` +
    ` data-num="maxPerDay" value="${state.maxPerDay}"` +
    ` aria-label="${escapeHtml(t("prefs.pace.atMostLabel"))}" />` +
    `<span class="pref-label">${escapeHtml(t("prefs.pace.perDay"))}</span>` +
    `</div>` +
    `<div class="pref-row">` +
    `<span class="pref-label">${escapeHtml(t("prefs.pace.gap"))}</span>` +
    gapSelectHtml("minGap", state.minGap) +
    `</div>`
  );
}

function travelFineHtml() {
  return (
    `<div class="pref-row">` +
    `<span class="pref-label">${escapeHtml(t("prefs.travel.sameVenue"))}</span>` +
    gapSelectHtml("minGapSame", state.minGapSame) +
    `</div>`
  );
}

function foodFineHtml() {
  const rows = state.meals
    .map(
      (meal) =>
        `<div class="pref-meal" data-meal="${meal.id}">` +
        `<label class="pref-meal-on">` +
        `<input type="checkbox" data-mealon="${meal.id}"${meal.enabled ? " checked" : ""} />` +
        `<span class="meal-pill"><span aria-hidden="true">${MEAL_META[meal.id].emoji}</span> ` +
        `${escapeHtml(t(MEAL_META[meal.id].nameKey))}</span></label>` +
        `<span class="pref-meal-times">` +
        timeInputHtml(meal.id, "start", meal.startMin, "plan.mealStartLabel") +
        `<span class="meal-dash" aria-hidden="true">–</span>` +
        timeInputHtml(meal.id, "end", meal.endMin, "plan.mealEndLabel") +
        `</span>` +
        `<span class="pref-meal-place">` +
        `<input class="pref-place" type="text" data-place="${meal.id}"` +
        ` value="${escapeHtml(meal.place)}"` +
        ` placeholder="${escapeHtml(t("prefs.food.wherePlaceholder"))}"` +
        ` aria-label="${escapeHtml(t("prefs.food.whereLabel"))}" />` +
        `<span class="pref-soon">${escapeHtml(t("prefs.food.soon"))}</span>` +
        `</span>` +
        `</div>`
    )
    .join("");
  return rows + `<p class="pref-note">${escapeHtml(t("prefs.food.note"))}</p>`;
}

/** Build the whole row. Called once the programme is in, and on retranslation. */
function renderPrefs() {
  const pace = paceAnswer();
  const food = foodAnswer();
  $("prefs").innerHTML =
    questionHtml("interests", "prefs.interests.q", interestsHtml(), varietyFineHtml()) +
    questionHtml(
      "pace",
      "prefs.pace.q",
      PACE_STEPS.map((p) =>
        pickHtml("pace", p.id, p.emoji, escapeHtml(t(p.key)), p.id === pace)
      ).join(""),
      paceFineHtml()
    ) +
    questionHtml(
      "travel",
      "prefs.travel.q",
      Object.entries(MODE_META)
        .map(([mode, meta]) =>
          pickHtml("travel", mode, meta.emoji, escapeHtml(t(meta.nameKey)), mode === state.mode, {
            tip: t(meta.tipKey),
          })
        )
        .join(""),
      travelFineHtml()
    ) +
    questionHtml(
      "food",
      "prefs.food.q",
      FOOD_ANSWERS.map((a) =>
        pickHtml("food", a.id, a.emoji, escapeHtml(t(a.key)), a.id === food)
      ).join(""),
      foodFineHtml()
    );
}

/** Read the pictures back off the state, without rebuilding the row. */
function syncPrefs() {
  const lit = {
    interest: (id) => (id === "*" ? state.interests.size === 0 : state.interests.has(id)),
    pace: (id) => id === paceAnswer(),
    travel: (id) => id === state.mode,
    food: (id) => id === foodAnswer(),
    variety: () => false,
  };
  for (const btn of $("prefs").querySelectorAll("[data-pick]")) {
    const [question, id] = btn.dataset.pick.split(":");
    const on = lit[question](id);
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  }
}

/* One click, one change, one re-draft. Delegated from the row so nothing here
 * has to be re-wired when a question is rebuilt in another language. */
function wirePrefs() {
  const host = $("prefs");

  host.addEventListener("click", (e) => {
    const expand = e.target.closest("[data-expand]");
    if (expand) {
      const id = expand.dataset.expand;
      const open = !state.opened.has(id);
      if (open) state.opened.add(id);
      else state.opened.delete(id);
      $(`fine-${id}`).hidden = !open;
      expand.setAttribute("aria-expanded", String(open));
      expand.querySelector(".pref-expand-word").textContent = t(open ? "prefs.less" : "prefs.more");
      return;
    }
    if (e.target.closest("[data-more-kinds]")) {
      state.interestsOpen = true;
      renderPrefs();
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (!pick || pick.disabled) return;
    const [question, id] = pick.dataset.pick.split(":");
    if (question === "interest") {
      // "Everything" is the absence of a taste rather than a taste of its own,
      // so it clears rather than selects.
      if (id === "*") state.interests.clear();
      else if (state.interests.has(id)) state.interests.delete(id);
      else state.interests.add(id);
    } else if (question === "pace") {
      const step = PACE_STEPS.find((p) => p.id === id);
      state.maxPerDay = step.maxPerDay;
      state.minGap = step.minGap;
    } else if (question === "travel") {
      state.mode = id;
    } else if (question === "food") {
      const answer = FOOD_ANSWERS.find((a) => a.id === id);
      for (const meal of state.meals) meal.enabled = answer.meals.includes(meal.id);
    } else {
      return;
    }
    renderPrefs();
    redraftAndSave();
  });

  // The exact numbers. `change` rather than `input`, so a half-typed time or a
  // place being spelled out does not re-draft the calendar under the reader.
  host.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.num === "maxPerDay") {
      state.maxPerDay = clamp(Math.round(Number(el.value)) || 1, 1, 8);
      el.value = state.maxPerDay;
    } else if (el.dataset.num === "minGap") {
      state.minGap = Number(el.value);
    } else if (el.dataset.num === "minGapSame") {
      state.minGapSame = Number(el.value);
    } else if (el.dataset.mealon) {
      mealOf(el.dataset.mealon).enabled = el.checked;
    } else if (el.dataset.time) {
      const [id, edge] = el.dataset.time.split(":");
      const meal = mealOf(id);
      const min = clockToMin(el.value);
      if (min == null) {
        el.value = minToClock(edge === "start" ? meal.startMin : meal.endMin);
        return;
      }
      // A meal has to last: an end at or before its start is no break at all,
      // and the engine would silently drop it.
      if (edge === "start") meal.startMin = Math.min(min, meal.endMin - 15);
      else meal.endMin = Math.max(min, meal.startMin + 15);
      el.value = minToClock(edge === "start" ? meal.startMin : meal.endMin);
    } else if (el.dataset.place) {
      mealOf(el.dataset.place).place = el.value.trim();
    } else {
      return;
    }
    syncPrefs();
    redraftAndSave();
  });
}

const mealOf = (id) => state.meals.find((m) => m.id === id);

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
    minGapSameVenue: state.minGapSame,
    minGapDifferentVenue: state.minGap,
    preferred: preferredSlugs(),
    maxUnpreferredPerDay: MAX_OFF_INTEREST_PER_DAY,
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
  buildLanes();
  applyVerdicts(draft);
  renderDrawerCount(draft);
  showBoard();
  syncStars();
  placeDateEdges();
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

/** Every slot the draft placed, in time order. */
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

/** How many verdicts the reader has given on shows in today's pool. */
function decidedInPool() {
  const inPool = (slug) => state.poolSlugs.has(slug);
  const instance = (key) => inPool(key.slice(0, key.lastIndexOf("@")));
  return (
    [...state.starred].filter(inPool).length +
    [...state.locked.keys()].filter(inPool).length +
    [...state.noShow].filter(inPool).length +
    [...state.noTime].filter(instance).length
  );
}

function renderCounts(draft) {
  const el = $("boardCount");
  const decided = decidedInPool();
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

/** The drawer's own line: what is in it, without opening it. */
function renderDrawerCount(draft) {
  const el = $("drawerCount");
  el.dataset.i18nSlot = "drawer.count";
  el.textContent = t("drawer.count", {
    shows: state.catalogue.shows.length,
    decided: decidedInPool(),
    crowded: draft.crowdedOut.length,
  });
}

// --- the calendar ---------------------------------------------------------

function renderCalendar(draft) {
  const host = $("schedule");
  const empty = $("scheduleEmpty");
  host.innerHTML = "";
  host.hidden = false;
  // The note says what the constraints have cost; the calendar under it is
  // where they are loosened, so an empty draft shows both rather than swapping
  // one for the other.
  empty.hidden = Boolean(draft.counts.picked);

  const axis = calendarAxis(draft);
  const { topMin, botMin, axisH, hourPx } = axis;
  const minHour = topMin / 60;
  const maxHour = botMin / 60;
  const y = (min) => ((clamp(min, topMin, botMin) - topMin) / 60) * hourPx;

  host.style.setProperty("--sch-hour-h", `${hourPx}px`);
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
    label.style.top = `${(h - minHour) * hourPx}px`;
    label.textContent = `${pad2(((h % 24) + 24) % 24)}:00`;
    gBody.appendChild(label);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  // EVERY night of the festival gets a column, not only the ones the reader's
  // window takes: the nights outside it are what the first-night and
  // last-night blockers are dragged across, and a window drawn over columns
  // that vanish as it narrows would have nothing left to drag.
  const byDate = new Map(draft.days.map((d) => [d.date, d]));
  state.dates.forEach((iso, i) => {
    const day = byDate.get(iso) || { date: iso, slots: [] };
    const inWindow = i + 1 >= state.d0 && i + 1 <= state.d1;
    const col = document.createElement("div");
    col.className =
      "sch-day" +
      (isWeekend(iso) ? " wknd" : "") +
      (inWindow ? "" : " sch-day--out") +
      // A blank night collapses to a sliver, but only while the calendar has
      // something to show: when the whole draft is empty every column is
      // blank, and five slivers would leave the blockers nothing to sit on.
      (inWindow && !day.slots.length && draft.counts.picked && !state.drag ? " sch-day--empty" : "");
    col.dataset.date = iso;

    const head = document.createElement("div");
    head.className = "sch-day-head";
    head.innerHTML =
      `<div class="sch-dow">${escapeHtml(dates({ weekday: "short" }).format(dateOf(iso)))} ` +
      `<span class="sch-date">${escapeHtml(dayLabel(iso))}</span></div>` +
      `<div class="sch-day-count" data-i18n-slot="schedule.dayCount">` +
      `${escapeHtml(t("schedule.dayCount", { count: inWindow ? day.slots.length : 0 }))}</div>`;

    const body = document.createElement("div");
    body.className = "sch-body";
    body.style.height = `${axisH}px`;

    if (inWindow) {
      // The hours the reader's day does not cover, and the meals it holds
      // back: drawn in the column rather than over the calendar, so each one
      // is clipped by the night it applies to.
      body.appendChild(zone("top", 0, y(state.dayStartMin)));
      body.appendChild(zone("bottom", y(dayEndMin()), axisH - y(dayEndMin())));
      for (const meal of state.meals) {
        if (meal.enabled) body.appendChild(mealBand(meal, y));
      }

      for (let i2 = 0; i2 < day.slots.length - 1; i2++) {
        const a = day.slots[i2];
        const b = day.slots[i2 + 1];
        const gap = b.startMinuteOfDay - a.endMinuteOfDay;
        if (gap < 0 || gap >= 60) continue;
        body.appendChild(buildTravelLeg(a, b, y(a.endMinuteOfDay), y(b.startMinuteOfDay)));
      }
      day.slots.forEach((slot, i2) => {
        // A short show is drawn at SCH_MIN_BLOCK so its four verdicts fit — but
        // never past the next block's own start, or the two would overlap and
        // the calendar would claim a clash the scheduler took care to avoid.
        const next = day.slots[i2 + 1];
        const ceiling = next ? y(next.startMinuteOfDay) - 2 : axisH;
        body.appendChild(
          buildScheduleBlock(slot, y(slot.startMinuteOfDay), y(slot.endMinuteOfDay), ceiling)
        );
      });
    }

    col.append(head, body);
    host.appendChild(col);
  });

  host.appendChild(buildBlockers(axis, y, gutter.getBoundingClientRect().width));
}

/* The hours the calendar draws.
 *
 * The evening the draft actually uses, padded by an hour either side, and then
 * stretched towards the reader's own day boundaries — but never by more than
 * ZONE_MAX_MIN, because this festival runs in the evening and an axis anchored
 * at a 09:00 day start would be two thirds empty morning. A boundary further
 * out than that is drawn against the axis edge with the hour it really holds
 * on its flag.
 */
function calendarAxis(draft) {
  if (state.drag) return axisOf(state.drag.topMin, state.drag.botMin);
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
  // Nothing drafted is exactly when the blockers matter most: the axis then
  // spans the day the reader asked for, so whatever emptied the calendar is on
  // screen with a grip on it.
  if (!mins.length) {
    mins.push(state.dayStartMin);
    maxs.push(dayEndMin());
  }
  const padTop = Math.min(...mins) - AXIS_PAD_MIN;
  const padBottom = Math.max(...maxs) + AXIS_PAD_MIN;
  const minHour = Math.floor(clamp(state.dayStartMin, padTop - ZONE_MAX_MIN, padTop) / 60);
  const maxHour = Math.max(
    minHour + 1,
    Math.ceil(clamp(dayEndMin(), padBottom, padBottom + ZONE_MAX_MIN) / 60)
  );
  return axisOf(minHour * 60, maxHour * 60);
}

/** An axis's height, and how tall an hour on it is drawn — see SCH_HOUR_MIN. */
function axisOf(topMin, botMin) {
  const hours = (botMin - topMin) / 60;
  const hourPx = clamp(Math.round(SCH_AXIS_TARGET_PX / hours), SCH_HOUR_MIN, SCH_HOUR_PX);
  return { topMin, botMin, hourPx, axisH: hours * hourPx };
}

function zone(which, top, height) {
  const el = document.createElement("div");
  el.className = `sch-zone sch-zone--${which}`;
  el.style.top = `${top}px`;
  el.style.height = `${Math.max(0, height)}px`;
  return el;
}

/* A meal the reader asked for: an hour of the night nothing is drafted
 * through, carrying the place when they have named one. */
function mealBand(meal, y) {
  const el = document.createElement("div");
  el.className = `sch-meal sch-meal--${meal.id}`;
  el.style.top = `${y(meal.startMin)}px`;
  el.style.height = `${Math.max(2, y(meal.endMin) - y(meal.startMin))}px`;
  el.innerHTML =
    `<span class="meal-label"><span aria-hidden="true">${MEAL_META[meal.id].emoji}</span> ` +
    `${escapeHtml(meal.place || t(MEAL_META[meal.id].nameKey))}</span>`;
  return el;
}

// --- the four blockers ----------------------------------------------------
//
// Where the day starts and ends, and which nights the window takes, drawn
// against the hours and the columns they rule out rather than typed into a
// strip above them. One overlay holds all four; it is rebuilt with the
// calendar, and the gestures are delegated from the calendar itself
// (wireBlockers) so nothing has to be re-wired when it is.

function buildBlockers(axis, y, gutterPx) {
  const ov = document.createElement("div");
  ov.className = "sch-blockers";
  ov.style.insetInlineStart = `${gutterPx}px`;
  ov.style.top = `${SCH_HEAD_PX}px`;
  ov.style.height = `${axis.axisH}px`;
  ov.dataset.topMin = String(axis.topMin);
  ov.dataset.botMin = String(axis.botMin);
  ov.append(
    dayLine("start", state.dayStartMin, y, axis),
    dayLine("end", dayEndMin(), y, axis),
    dateEdge("start"),
    dateEdge("end")
  );
  return ov;
}

function dayLine(which, min, y, axis) {
  const beyond = which === "start" ? min < axis.topMin : min > axis.botMin;
  const el = document.createElement("div");
  el.className = `sch-dayline sch-dayline--${which}${beyond ? " is-beyond" : ""}`;
  el.style.top = `${y(min)}px`;
  el.dataset.which = which;
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", t(which === "start" ? "blocker.dayStartLabel" : "blocker.dayEndLabel"));
  el.setAttribute("aria-valuemin", "0");
  el.setAttribute("aria-valuemax", String(DAY_END_CEIL));
  el.setAttribute("aria-valuenow", String(min));
  el.setAttribute("aria-valuetext", minToDayClock(min));
  el.innerHTML =
    `<span class="dl-grip" aria-hidden="true"></span>` +
    `<span class="dl-flag">${escapeHtml(
      t(which === "start" ? "blocker.dayStart" : "blocker.dayEnd", { time: minToDayClock(min) })
    )}</span>`;
  return el;
}

/* The window's two ends. Positioned from the columns' own boxes rather than
 * from an assumed column width, because a blank night is drawn narrower than a
 * full one; measured in logical pixels from the track's inline start, so the
 * sums are the same whichever way the page runs. */
function dateEdge(which) {
  const el = document.createElement("div");
  el.className = `sch-dateedge sch-dateedge--${which}`;
  el.dataset.which = which;
  el.tabIndex = 0;
  el.setAttribute("role", "slider");
  el.setAttribute("aria-label", t(which === "start" ? "rail.startLabel" : "rail.endLabel"));
  el.setAttribute("aria-valuemin", "1");
  el.setAttribute("aria-valuemax", String(state.dates.length));
  el.setAttribute("aria-valuenow", String(which === "start" ? state.d0 : state.d1));
  el.setAttribute("aria-valuetext", dayAndDate(which === "start" ? windowStartISO() : windowEndISO()));
  el.innerHTML =
    `<span class="de-grip" aria-hidden="true"></span>` +
    `<span class="de-flag"><span class="wf-cap">${escapeHtml(
      t(which === "start" ? "rail.from" : "rail.to")
    )}</span> ${escapeHtml(dayLabel(which === "start" ? windowStartISO() : windowEndISO()))}</span>`;
  return el;
}

/** Slide the two date edges onto the boundaries of the window's own columns. */
function placeDateEdges() {
  const ov = document.querySelector(".sch-blockers");
  if (!ov) return;
  const cols = [...$("schedule").querySelectorAll(".sch-day")];
  if (cols.length < state.d1) return;
  const track = ov.getBoundingClientRect();
  if (!track.width) return;
  const rtl = isRtl();
  const inlineStart = (el) => {
    const box = el.getBoundingClientRect();
    return rtl ? track.right - box.right : box.left - track.left;
  };
  const inlineEnd = (el) => {
    const box = el.getBoundingClientRect();
    return rtl ? track.right - box.left : box.right - track.left;
  };
  const startEl = ov.querySelector(".sch-dateedge--start");
  const endEl = ov.querySelector(".sch-dateedge--end");
  if (startEl) startEl.style.insetInlineStart = `${inlineStart(cols[state.d0 - 1])}px`;
  if (endEl) endEl.style.insetInlineStart = `${inlineEnd(cols[state.d1 - 1])}px`;
}

/** The minute of the day at a pointer's height over the calendar's axis. */
function minuteAt(clientY) {
  const ov = document.querySelector(".sch-blockers");
  if (!ov) return null;
  const box = ov.getBoundingClientRect();
  if (!box.height) return null;
  const topMin = Number(ov.dataset.topMin);
  const botMin = Number(ov.dataset.botMin);
  const raw = topMin + ((clientY - box.top) / box.height) * (botMin - topMin);
  return clamp(Math.round(raw / SNAP_MIN) * SNAP_MIN, 0, DAY_END_CEIL);
}

/** The night whose column a pointer is nearest — direction-blind, by centres. */
function dayAtX(clientX) {
  const cols = [...$("schedule").querySelectorAll(".sch-day")];
  let best = 1;
  let nearest = Infinity;
  cols.forEach((col, i) => {
    const box = col.getBoundingClientRect();
    const d = Math.abs(clientX - (box.left + box.right) / 2);
    if (d < nearest) {
      nearest = d;
      best = i + 1;
    }
  });
  return best;
}

function setDayStart(min) {
  const next = clamp(min, 0, dayEndMin() - 15);
  if (next === state.dayStartMin) return false;
  state.dayStartMin = next;
  return true;
}

function setDayEnd(min) {
  const next = clamp(min, state.dayStartMin + 15, DAY_END_CEIL);
  if (next === state.dayEndMin) return false;
  state.dayEndMin = next;
  return true;
}

/* A drag holds the axis and the column widths still for its duration. Without
 * that, moving a line re-drafts, the re-draft re-fits the axis, and the same
 * pointer position then means a different minute — the line would chase the
 * pointer instead of following it. */
function startBlockerDrag(onMove) {
  const ov = document.querySelector(".sch-blockers");
  state.drag = { topMin: Number(ov.dataset.topMin), botMin: Number(ov.dataset.botMin) };
  const move = (ev) => {
    if (onMove(ev)) redraftAndSave();
  };
  const up = () => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    state.drag = null;
    // One last draft with the axis free again, so it re-fits to what is left.
    redraft();
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
}

function wireBlockers() {
  const host = $("schedule");

  host.addEventListener("pointerdown", (e) => {
    const line = e.target.closest(".sch-dayline");
    if (line) {
      e.preventDefault();
      line.focus();
      const which = line.dataset.which;
      startBlockerDrag((ev) => {
        const min = minuteAt(ev.clientY);
        return min == null ? false : which === "start" ? setDayStart(min) : setDayEnd(min);
      });
      return;
    }
    const edge = e.target.closest(".sch-dateedge");
    if (!edge) return;
    e.preventDefault();
    edge.focus();
    const which = edge.dataset.which;
    startBlockerDrag((ev) => {
      const day = dayAtX(ev.clientX);
      if (which === "start") {
        const next = clamp(day, 1, state.d1);
        if (next === state.d0) return false;
        state.d0 = next;
      } else {
        const next = clamp(day, state.d0, state.dates.length);
        if (next === state.d1) return false;
        state.d1 = next;
      }
      return true;
    });
  });

  host.addEventListener("keydown", (e) => {
    const line = e.target.closest(".sch-dayline");
    if (line) {
      const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const moved =
        line.dataset.which === "start"
          ? setDayStart(state.dayStartMin + step * 15)
          : setDayEnd(state.dayEndMin + step * 15);
      if (moved) redraftAndSave();
      focusBlocker(`.sch-dayline--${line.dataset.which}`);
      return;
    }
    const edge = e.target.closest(".sch-dateedge");
    if (!edge) return;
    // The arrow that moves the window later is the one that points along the
    // page's reading direction, which is the way the columns themselves run.
    const later = isRtl() ? "ArrowLeft" : "ArrowRight";
    const step = e.key === later ? 1 : e.key === (isRtl() ? "ArrowRight" : "ArrowLeft") ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    if (edge.dataset.which === "start") state.d0 = clamp(state.d0 + step, 1, state.d1);
    else state.d1 = clamp(state.d1 + step, state.d0, state.dates.length);
    redraftAndSave();
    focusBlocker(`.sch-dateedge--${edge.dataset.which}`);
  });
}

/** Put the keyboard back on the blocker just moved — it is a new element. */
function focusBlocker(selector) {
  const el = document.querySelector(`.sch-blockers ${selector}`);
  if (el) el.focus();
}

/** How rare the drafted show is — the whole reason it won its hour. */
function rarityText(freedom) {
  return freedom === 1 ? t("rarity.only") : t("rarity.some", { count: freedom });
}

/* One hour of one night: the shows that wanted it, drawn behind the one that
 * took it. The stack is the picture of a contested hour — an edge per show
 * turned down — and it is also the way to hand the hour to one of them, so it
 * is a button rather than decoration. An uncontested hour is a single card. */
function buildScheduleBlock(slot, top, rawBottom, ceiling) {
  const key = slotKey(slot);
  const height = Math.max(
    Math.min(SCH_MIN_BLOCK, Math.max(12, ceiling - top)),
    rawBottom - top
  );
  const locked = state.locked.get(slot.slug) === key;
  const favourite = state.starred.has(slot.slug);

  const wrap = document.createElement("div");
  wrap.className = "sch-slot" + (slot.contenders.length ? " sch-slot--stacked" : "");
  wrap.style.top = `${top}px`;
  wrap.style.height = `${height}px`;

  const block = document.createElement("div");
  block.className =
    "sch-show " + (slot.status === "FREE_NON_TICKETED" ? "seg-free" : "seg-avail") +
    (locked ? " sch-show--locked" : "") +
    (favourite ? " sch-show--fav" : "");
  block.dataset.slug = slot.slug;
  block.dataset.key = key;
  block.tabIndex = 0;
  if (height < SCH_TIGHT_PX) block.classList.add("sch-show--tight");

  // A show with no published running time has end === start, so the clock
  // would read "22:00–22:00". Say the start and stop there rather than draw a
  // length nobody published.
  const end = slotEndTime(slot);
  const timeStr = end === slot.startTime ? slot.startTime : `${slot.startTime}–${end}`;

  block.innerHTML =
    `<a class="sch-open" href="${escapeHtml(slot.url)}" target="_blank" rel="noopener" draggable="false">` +
    `<span class="sch-name">${foreign(slot.title, slot.slug)}</span>` +
    `<span class="sch-meta">` +
    `<span class="sch-time">${escapeHtml(timeStr)}</span>` +
    (slot.venueName ? `<span class="sch-venue">${foreign(slot.venueName, slot.slug)}</span>` : "") +
    `</span></a>` +
    // The one thing a card's face says beyond the show itself.
    (locked ? `<span class="sch-lock" aria-hidden="true">🔒</span>` : "");
  wrap.appendChild(block);

  if (slot.contenders.length) {
    const stack = document.createElement("button");
    stack.type = "button";
    stack.className = "sch-stack";
    stack.setAttribute("aria-expanded", "false");
    const label = t("rivals.more", { count: slot.contenders.length });
    stack.setAttribute("aria-label", label);
    stack.dataset.i18nAriaLabel = "rivals.more";
    // Capped at three edges: past that the stack says "several" either way, and
    // a fourth would reach into the hour below.
    stack.innerHTML = slot.contenders
      .slice(0, 3)
      .map((_, i) => `<span class="sch-beaten" style="--i:${i + 1}"></span>`)
      .join("");
    // After the card in the DOM so a keyboard reaches the show first, behind it
    // on screen so only the edges it leaves showing can be clicked.
    wrap.appendChild(stack);
  }
  return wrap;
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
  for (const btn of document.querySelectorAll(".sch-stack[aria-expanded='true']")) {
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

/* Everything the page has to say about one card, in one place: how few nights
 * its show has — which is the reason it holds the hour — every night it plays,
 * and the four answers. None of it is on the card's own face, so a calendar at
 * rest reads as a calendar; all of it is one pointer-move away.
 *
 * It is something to act on rather than something to read, so it is reachable
 * by keyboard, and it does not close the moment the pointer leaves the card. */
function openCardPop(block) {
  const slug = block.dataset.slug;
  const show = state.catalogue.shows.find((sh) => sh.slug === slug);
  if (!show) return;
  const pop = $("calPreview");
  const key = block.dataset.key;
  pop.dataset.slug = slug;
  pop.dataset.key = key;

  const drafted = state.picked.get(slug);
  const nights = [...show.performances]
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .map((perf) => {
      const perfKey = `${perf.date}T${perf.start}`;
      const isDrafted = perfKey === drafted;
      const isRejected = state.noTime.has(instanceKey(slug, perfKey));
      const note = isDrafted ? t("preview.drafted") : isRejected ? t("preview.rejected") : "";
      return (
        `<li class="pop-night${isDrafted ? " is-drafted" : ""}${isRejected ? " is-rejected" : ""}">` +
        `<span class="pn-when">${escapeHtml(dayAndDate(perf.date))} · ${escapeHtml(perf.start)}</span>` +
        (note ? `<span class="pn-note">${escapeHtml(note)}</span>` : "") +
        `</li>`
      );
    })
    .join("");

  const locked = state.locked.get(slug) === key;
  const favourite = state.starred.has(slug);
  const freedom = (state.draft.pool.get(slug) || show.performances).length;
  const verdict = (kind, vKey, mark, on) => {
    const label = escapeHtml(t(vKey));
    return (
      `<button type="button" class="vb vb--${kind}${on ? " is-on" : ""}" data-verdict="${kind}"` +
      ` aria-pressed="${on}" data-i18n-aria-label="${vKey}" data-i18n-title="${vKey}"` +
      ` aria-label="${label}" title="${label}">` +
      `<span class="vb-mark" aria-hidden="true">${mark}</span>` +
      `<span class="vb-word">${label}</span></button>`
    );
  };

  pop.innerHTML =
    `<p class="pop-title">${foreign(show.title, show.slug)}</p>` +
    `<p class="pop-lead"><span class="pop-rarity${freedom === 1 ? " pop-rarity--rare" : ""}"` +
    ` data-i18n-slot="${freedom === 1 ? "rarity.only" : "rarity.some"}">` +
    `${escapeHtml(rarityText(freedom))}</span></p>` +
    `<ul class="pop-nights">${nights}</ul>` +
    `<div class="pop-verdicts" role="group" aria-label="${escapeHtml(t("verdict.groupLabel"))}"` +
    ` data-i18n-aria-label="verdict.groupLabel">` +
    verdict("lock", "verdict.lock", "🔒", locked) +
    verdict("favourite", "verdict.favourite", "★", favourite) +
    verdict("noTime", "verdict.noTime", "✕", false) +
    verdict("noShow", "verdict.noShow", "⊘", false) +
    `</div>`;
  placePop(pop, block);
}

/* Who else wanted this hour, and what it would cost to take one instead: a
 * contender carries the count that lost it the hour, and choosing it locks it,
 * because wanting a particular show at a particular hour is exactly a lock. */
function openRivals(stack) {
  const block = stack.closest(".sch-slot").querySelector(".sch-show");
  const slot = draftedSlots().find(
    (s) => s.slug === block.dataset.slug && slotKey(s) === block.dataset.key
  );
  if (!slot || !slot.contenders.length) return;
  const pop = $("calRivals");
  pop.innerHTML =
    `<p class="pop-title" data-i18n-slot="rivals.title">${escapeHtml(t("rivals.title", { time: slot.startTime }))}</p>` +
    `<ul class="pop-rivals">` +
    // The scarcest few (contention.js sorts them): a Fringe hour can have fifty.
    slot.contenders
      .slice(0, RIVAL_ROWS)
      .map(
        (rival) =>
          `<li><button type="button" class="pop-rival" data-take="${escapeHtml(rival.slug)}"` +
          ` data-key="${escapeHtml(slotKey(rival))}">` +
          `<span class="pr-title">${foreign(rival.title, rival.slug)}</span>` +
          `<span class="pr-nights">${escapeHtml(rarityText(rival.freedom))}</span></button></li>`
      )
      .join("") +
    `</ul>` +
    (slot.contenders.length > RIVAL_ROWS
      ? `<p class="pop-more" data-i18n-slot="rivals.others">` +
        `${escapeHtml(t("rivals.others", { count: slot.contenders.length - RIVAL_ROWS }))}</p>`
      : "") +
    `<p class="pop-foot" data-i18n-slot="rivals.foot">${escapeHtml(t("rivals.foot"))}</p>`;
  placePop(pop, block);
}

// --- browse + search ------------------------------------------------------

function showMeta(show) {
  // Performances, not nights: some of this programme's shows play twice on one
  // evening, so counting distinct dates would under-report what is on offer.
  const runs = show.performances.length;
  const venue = show.venueNames.join(", ");
  const parts = [
    show.genre ? foreign(show.genre, show.slug) : null,
    venue ? foreign(venue, show.slug) : null,
    escapeHtml(t("show.performances", { count: runs })),
    show.duration ? escapeHtml(t("show.minutes", { count: show.duration })) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/* A programme published in two languages names the show in the city's own one
 * too, when it differs: it is what the posters and the box office say. */
function localTitle(show) {
  if (!show.titleLocal || show.titleLocal === show.title) return "";
  return ` <span class="ss-row-local" dir="auto">${escapeHtml(show.titleLocal)}</span>`;
}

function rowHtml(show) {
  const on = state.starred.has(show.slug);
  return (
    `<button type="button" class="ss-star" data-slug="${escapeHtml(show.slug)}"` +
    ` aria-pressed="${on}" aria-label="${escapeHtml(t(on ? "search.star.remove" : "search.star.add", { title: show.title }))}">` +
    `${on ? "★" : "☆"}</button>` +
    `<span class="ss-row-title">${foreign(show.title, show.slug)}${localTitle(show)}</span>` +
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

/* The whole pool as a list — until it is too long to browse, when the list
 * asks for a search instead (../shared/limits.js). */
function renderBrowse() {
  const list = $("browseList");
  list.innerHTML = "";
  const { rows, total, more, searchFirst } = listPage(state.catalogue.shows, { pages: state.browsePages });
  for (const show of rows) {
    list.appendChild(rowElement(show, "li"));
  }
  const tail = $("browseMore");
  tail.hidden = !(more || searchFirst);
  tail.innerHTML = searchFirst
    ? `<span class="browse-search-first" data-i18n-slot="browse.searchFirst">${escapeHtml(t("browse.searchFirst", { count: total }))}</span>`
    : more
      ? `<button type="button" class="btn btn-ghost browse-more-btn" id="browseMoreBtn" data-i18n-slot="browse.more">` +
        `${escapeHtml(t("browse.more", { count: more }))}</button>`
      : "";
  $("browseLine1").textContent = t("browse.pick", { count: total });
}

function matchesFilters(show) {
  const { query, genres, venues } = state.search;
  if (genres.size && !genres.has(show.genreSlug)) return false;
  if (venues.size && !show.performances.some((p) => venues.has(p.venue))) return false;
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    show.title.toLowerCase().includes(q) ||
    (show.titleLocal || "").toLowerCase().includes(q) ||
    (show.genre || "").toLowerCase().includes(q) ||
    show.venueNames.some((v) => v.toLowerCase().includes(q)) ||
    (show.blurb || "").toLowerCase().includes(q)
  );
}

function runSearch() {
  const hits = state.catalogue.shows.filter(matchesFilters);
  const results = $("ssResults");
  results.innerHTML = "";
  for (const show of hits.slice(0, SEARCH_RESULT_ROWS)) {
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
        `<span>${foreign(c.name, c.slug)}</span>` +
        `<span class="opt-count">${state.catalogue.shows.filter((s) => s.genreSlug === c.slug).length}</span></label>`
    )
    .join("");
  const venueOptions = $("ssfVenueOptions");
  // Only the venues the pool actually plays: a festival's venue list covers
  // every edition, and a venue with nothing on in the period is no filter.
  const playing = new Map();
  for (const show of state.catalogue.shows) playing.set(show.venue, (playing.get(show.venue) || 0) + 1);
  const venues = [...state.venues.values()].filter((v) => playing.has(v.code));
  // Only as many as a panel can list (../shared/limits.js), the busiest making
  // the cut, drawn in the programme's own order; the rest are one search away,
  // since the query matches venue names.
  const ranked = [...venues].sort(
    (a, b) => playing.get(b.code) - playing.get(a.code) || a.name.localeCompare(b.name)
  );
  const { rows, more } = capOptions(ranked, (v) => state.search.venues.has(v.code), FACET_OPTIONS);
  const listed = new Set(rows);
  venueOptions.innerHTML =
    venues
      .filter((v) => listed.has(v))
      .map(
        (v) =>
          `<label class="panel-option"><input type="checkbox" data-facet="venue" value="${escapeHtml(v.code)}" />` +
          `<span>${foreign(v.name, v.code)}</span>` +
          `<span class="opt-count">${playing.get(v.code)}</span></label>`
      )
      .join("") +
    (more
      ? `<p class="panel-more" data-i18n-slot="search.moreVenues">${escapeHtml(t("search.moreVenues", { count: more }))}</p>`
      : "");
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
  // calendar alone would never hear a verdict or a contender being taken.
  const card = $("planResult");

  card.addEventListener("click", (e) => {
    // The four verdicts live in the popup now, so they carry no card of their
    // own: which card they are a verdict on is what the popup remembers.
    const verdictBtn = e.target.closest("[data-verdict]");
    if (verdictBtn) {
      const pop = $("calPreview");
      applyVerdict(verdictBtn.dataset.verdict, pop.dataset.slug, pop.dataset.key);
      return;
    }
    // Taking a contender IS locking it: you are naming a show and an hour.
    const take = e.target.closest("[data-take]");
    if (take) {
      applyVerdict("lock", take.dataset.take, take.dataset.key);
      return;
    }
    const stack = e.target.closest(".sch-stack");
    if (stack) {
      const open = stack.getAttribute("aria-expanded") === "true";
      closePops();
      if (!open) {
        stack.setAttribute("aria-expanded", "true");
        openRivals(stack);
      }
      return;
    }
    if (!e.target.closest(".cal-pop")) closePops();
  });

  // The popup holds buttons, so it cannot close the instant the pointer leaves
  // the card — it has to survive the travel between the two.
  let closeTimer = null;
  const holdOpen = () => clearTimeout(closeTimer);
  const closeSoon = () => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      $("calPreview").hidden = true;
    }, 220);
  };

  wrap.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const block = e.target.closest(".sch-show");
    if (!block) return;
    // While the contenders are open they are the thing being read.
    if ($("calRivals").hidden === false) return;
    holdOpen();
    if ($("calPreview").dataset.key !== block.dataset.key || $("calPreview").hidden) openCardPop(block);
  });
  wrap.addEventListener("pointerleave", closeSoon);
  $("calPreview").addEventListener("pointerenter", holdOpen);
  $("calPreview").addEventListener("pointerleave", closeSoon);

  // A keyboard reaches the same popup by tabbing to the card, and steps into
  // its buttons from there; Escape closes it and hands focus back.
  wrap.addEventListener("focusin", (e) => {
    const block = e.target.closest(".sch-show");
    if (block) {
      holdOpen();
      openCardPop(block);
    }
  });
  wrap.addEventListener("keydown", (e) => {
    const block = e.target.closest(".sch-show");
    if (!block || e.target !== block) return;
    if (e.key !== "Enter" && e.key !== " " && e.key !== "ArrowDown") return;
    e.preventDefault();
    holdOpen();
    openCardPop(block);
    const first = $("calPreview").querySelector("button");
    if (first) first.focus();
  });

  // A popover is placed once, against where the card was; scrolling the
  // calendar under it would leave it pointing at nothing.
  wrap.addEventListener("scroll", closePops);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const inPop = document.activeElement && document.activeElement.closest(".cal-pop");
    const slug = $("calPreview").dataset.slug;
    closePops();
    if (inPop && slug) {
      const back = wrap.querySelector(`.sch-show[data-slug="${CSS.escape(slug)}"]`);
      if (back) back.focus();
    }
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

// --- boot -----------------------------------------------------------------

/* Everything the page drew itself, redrawn in the language just chosen. The
 * static markup is the i18n module's own job; this is the rest. */
function retranslate() {
  renderChrome();
  if (!state.catalogue) return;
  renderTimelineStrip();
  renderPeriodBar();
  renderPoolNote();
  renderOriginCard();
  renderPrefs();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  rebuild();
  layoutOverlay();
}

// --- the year, and which festival the page is zoomed in on -----------------

/** Today on the festival's own calendar — the pinned clock in a case. */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function renderTimelineStrip() {
  const monthFmt = (options) => new Intl.DateTimeFormat(currentIntlLocale(), { timeZone: "UTC", ...options });
  renderTimeline($("timeline"), {
    registry: state.registry,
    span: timelineSpan(todayISO()),
    todayISO: todayISO(),
    focusKey: state.focus ? state.focus.key : null,
    period: state.period,
    label: (festival, edition) => ({
      name: wordmarkOf(festival).join(" "),
      tip: `${festivalName(festival)} · ${dates({ day: "numeric", month: "short", year: "numeric" }).formatRange(
        dateOf(edition.firstDate),
        dateOf(edition.lastDate)
      )}`,
    }),
    // A month is its short name; January also says which year has begun.
    monthLabel: (iso) =>
      monthFmt(iso.slice(5, 7) === "01" ? { month: "short", year: "numeric" } : { month: "short" }).format(dateOf(iso)),
  });
}

/** The registry entry and edition a key names, or null. */
function editionByKey(key) {
  for (const festival of state.registry.festivals) {
    for (const edition of festival.editions) {
      if (editionKey(festival.id, edition.id) === key) return { festival, edition, key };
    }
  }
  return null;
}

/* Which edition to open on: the one the URL names, else the one last chosen,
 * else the next to start (or running) of every festival with a programme. */
function initialFocus() {
  const url = new URLSearchParams(location.search);
  const asked = url.get("festival");
  if (asked) {
    const festival = state.registry.festivals.find((f) => f.id === asked);
    if (festival) {
      const edition =
        festival.editions.find((e) => e.id === url.get("edition")) ||
        currentEdition(festival, todayISO()) ||
        festival.editions[festival.editions.length - 1];
      if (edition) return editionByKey(editionKey(festival.id, edition.id));
    }
  }
  const stored = editionByKey(readStore(KEY_FOCUS, ""));
  if (stored) return stored;
  const today = todayISO();
  const candidates = state.registry.festivals
    .map((festival) => ({ festival, edition: currentEdition(festival, today) }))
    .filter((c) => c.edition)
    .sort((a, b) => {
      // Running or upcoming before finished; then soonest.
      const past = (c) => (c.edition.lastDate < today ? 1 : 0);
      return past(a) - past(b) || a.edition.firstDate.localeCompare(b.edition.firstDate);
    });
  const first = candidates[0];
  return first ? editionByKey(editionKey(first.festival.id, first.edition.id)) : null;
}

/* Zoom in on one edition: the period, the pool, the theme and the trip links
 * all follow. `fresh` is a reader's click, which also writes the address and
 * remembers the choice; the page's own first focus writes nothing. */
async function focusEdition(focus, { fresh = false } = {}) {
  state.focus = focus;
  const saved = readStore(KEY_PREFS, {}) || {};
  const storedPeriod = (saved.periods || {})[focus.key];
  state.period =
    storedPeriod && storedPeriod.from && storedPeriod.to
      ? storedPeriod
      : { from: shiftDay(focus.edition.firstDate, -1), to: shiftDay(focus.edition.lastDate, 1) };
  applyTheme(focus.festival);
  if (fresh) {
    writeStore(KEY_FOCUS, focus.key);
    const url = new URL(location.href);
    url.searchParams.set("festival", focus.festival.id);
    // The edition only needs naming when the festival has more than one.
    if (focus.festival.editions.length > 1) url.searchParams.set("edition", focus.edition.id);
    else url.searchParams.delete("edition");
    history.replaceState(null, "", url);
  }
  const win = (saved.windows || {})[focus.key];
  await loadPool({ window: win });
}

/* The festival's palette is CSS (planNG.css, keyed by this attribute); its
 * language and direction are the registry's, for its name wherever the page
 * prints it. */
function applyTheme(festival) {
  document.documentElement.dataset.festival = festival.id;
}

/* Where the shared data cache (shared/data-cache.js) reports a cache write it
 * couldn't make or a stale copy it fell back on. Never surfaced: the caller
 * still got its data. */
function noteCache(err, url) {
  console.info("planNG: data cache —", url, err);
}

/* One edition's adapted programme, fetched once however often it is asked for,
 * and only once a period reaches it: a festival the reader never focuses near
 * never costs a download. */
function editionCatalogue(festival, edition) {
  const { dataUrl } = edition;
  if (!state.editions.has(dataUrl)) state.editions.set(dataUrl, loadEdition(festival, edition, { onNote: noteCache }));
  return state.editions.get(dataUrl);
}

/* Every edition overlapping the period, judged for reach from the focused
 * festival's city, fetched where it can contribute, and joined into the pool
 * the calendar drafts from. */
async function loadPool({ window: win = null, keepWindow = false } = {}) {
  const { festival, edition } = state.focus;
  const overlapping = [];
  for (const f of state.registry.festivals) {
    for (const e of f.editions) {
      if (e.lastDate < state.period.from || e.firstDate > state.period.to) continue;
      overlapping.push({ festivalId: f.id, lat: f.lat, lng: f.lng, firstDate: e.firstDate, lastDate: e.lastDate, festival: f, entry: e });
    }
  }
  const focusShape = { festivalId: festival.id, lat: festival.lat, lng: festival.lng, firstDate: edition.firstDate, lastDate: edition.lastDate };
  state.reach = poolReach(focusShape, overlapping, state.period);

  const previousWindow = keepWindow && state.dates.length ? { from: windowStartISO(), to: windowEndISO() } : null;
  $("loadingState").hidden = false;
  $("errorState").hidden = true;
  let parts;
  try {
    parts = await Promise.all(
      state.reach
        .filter((r) => r.verdict !== "out" && r.edition.entry.dataUrl)
        .map(async (reach) => ({ reach, catalogue: await editionCatalogue(reach.edition.festival, reach.edition.entry) }))
    );
  } catch (error) {
    $("loadingState").hidden = true;
    $("errorState").hidden = false;
    // The translated line stays; what the failure actually said goes beneath it,
    // untranslated, because it came from the network rather than from us.
    $("errorTech").textContent = String(error.message || error);
    return;
  }
  $("loadingState").hidden = true;

  state.catalogue = buildPool(parts);
  state.poolSlugs = new Set(state.catalogue.shows.map((s) => s.slug));
  state.venues = state.catalogue.venues;
  state.coords = venueCoords(state.venues);
  state.dates = daysOf(state.period.from, state.period.to);
  document.documentElement.style.setProperty("--fest-days", String(state.dates.length));
  const wanted = previousWindow || win;
  const at = (iso, fallback) => {
    const i = iso ? state.dates.indexOf(iso) : -1;
    return i === -1 ? fallback : i + 1;
  };
  state.d0 = wanted ? at(wanted.from, 1) : 1;
  state.d1 = Math.max(state.d0, wanted ? at(wanted.to, state.dates.length) : state.dates.length);
  state.browsePages = 1;
  state.search.genres.clear();
  state.search.venues.clear();

  $("planPanel").hidden = false;
  $("boardDrawer").hidden = false;
  renderChrome();
  renderTimelineStrip();
  renderPeriodBar();
  renderPoolNote();
  renderOriginCard();
  renderPrefs();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  rebuild();
  requestAnimationFrame(() => requestAnimationFrame(layoutOverlay));
}

// --- the period ------------------------------------------------------------

function renderPeriodBar() {
  const { from, to } = state.period;
  const days = daysOf(from, to).length;
  const full = days >= MAX_PERIOD_DAYS;
  $("periodRange").textContent = t("period.range", {
    range: dates({ day: "numeric", month: "short" }).formatRange(dateOf(from), dateOf(to)),
    count: days,
  });
  $("periodEarlier").disabled = full;
  $("periodLater").disabled = full;
}

/* A day more of calendar at one end. The window grows with it — a day the
 * reader asked for and then could not plan would be a button that did nothing. */
async function extendPeriod(which) {
  if (daysOf(state.period.from, state.period.to).length >= MAX_PERIOD_DAYS) return;
  const keep = { from: windowStartISO(), to: windowEndISO() };
  if (which === "earlier") {
    state.period = { ...state.period, from: shiftDay(state.period.from, -1) };
    keep.from = state.period.from;
  } else {
    state.period = { ...state.period, to: shiftDay(state.period.to, 1) };
    keep.to = state.period.to;
  }
  await loadPool({ window: keep });
  savePrefs();
}

/* What the pool holds besides the focused festival, and what it had to leave
 * out: a festival dropped for distance is named, never silently missing. */
function renderPoolNote() {
  const host = $("poolNote");
  const lines = [];
  const focus = state.focus;
  if (!focus.edition.dataUrl) {
    lines.push(
      `<p class="pool-line pool-line--wait" data-i18n-slot="pool.noProgramme">` +
        `${escapeHtml(t("pool.noProgramme", { festival: festivalName(focus.festival) }))}</p>`
    );
  }
  const km = (n) => new Intl.NumberFormat(currentIntlLocale(), { maximumFractionDigits: 0 }).format(n);
  for (const r of state.reach) {
    if (r.verdict === "focus") continue;
    const other = r.edition.festival;
    const name = festivalName(other);
    if (r.verdict === "day-trip" && r.edition.entry.dataUrl) {
      lines.push(
        `<p class="pool-line pool-line--also" data-i18n-slot="pool.also">` +
          `${escapeHtml(t("pool.also", { festival: name, km: km(r.km) }))}</p>`
      );
    } else if (r.verdict === "partly") {
      lines.push(
        `<p class="pool-line pool-line--partly" data-i18n-slot="pool.partly">` +
          `${escapeHtml(t("pool.partly", { festival: name, km: km(r.km) }))}</p>`
      );
    } else if (r.verdict === "out") {
      lines.push(
        `<p class="pool-line pool-line--out" data-i18n-slot="pool.out">` +
          `${escapeHtml(t("pool.out", { festival: name, city: festivalCity(focus.festival), km: km(r.km ?? 0) }))}</p>`
      );
    }
  }
  host.innerHTML = lines.join("");
  host.hidden = !lines.length;
}

// --- where the reader is coming from ----------------------------------------

function regionName(code) {
  try {
    return new Intl.DisplayNames([currentIntlLocale()], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

/* Asked once per browser, the first time a festival is focused: the card
 * sits above the questions, the calendar drafts regardless, and the answer
 * (or "not now") is stored so it never comes back. */
function renderOriginCard() {
  const card = $("originCard");
  const show = !state.origin && Boolean(state.focus);
  card.hidden = !show;
  if (!show) return;
  const festival = state.focus.festival;
  const country = regionName(festival.country);
  const abroad = ORIGIN_COUNTRIES.filter((c) => c !== festival.country)
    .map((c) => ({ code: c, name: regionName(c) }))
    .sort((a, b) => a.name.localeCompare(b.name, currentIntlLocale()));
  const answer = (id, emoji, key, params = {}) =>
    `<button type="button" class="pref-pick origin-pick" data-origin="${id}">` +
    `<span class="pref-ico" aria-hidden="true">${emoji}</span>` +
    `<span class="pref-word" data-i18n-slot="${key}">${escapeHtml(t(key, params))}</span></button>`;
  card.innerHTML =
    `<div class="origin-head">` +
    `<p class="origin-ask" data-i18n-slot="origin.q">${escapeHtml(t("origin.q", { festival: festivalName(festival) }))}</p>` +
    `<p class="origin-why" data-i18n-slot="origin.why">${escapeHtml(t("origin.why"))}</p>` +
    `</div>` +
    `<div class="origin-answers" role="group" aria-label="${escapeHtml(t("origin.q", { festival: festivalName(festival) }))}">` +
    answer("position", "\u{1F4CD}", "origin.position") +
    answer("city", "\u{1F3E0}", "origin.city", { city: festivalCity(festival) }) +
    answer("country", "\u{1F686}", "origin.country", { country }) +
    `<label class="pref-pick origin-pick origin-abroad">` +
    `<span class="pref-ico" aria-hidden="true">\u{2708}\u{FE0F}</span>` +
    `<span class="pref-word" data-i18n-slot="origin.abroad">${escapeHtml(t("origin.abroad"))}</span>` +
    `<select class="opt-select origin-select" id="originCountry" aria-label="${escapeHtml(t("origin.abroad"))}">` +
    `<option value="">${escapeHtml(t("origin.abroad.pick"))}</option>` +
    abroad.map((c) => `<option value="${c.code}">${escapeHtml(c.name)}</option>`).join("") +
    `<option value="*">${escapeHtml(t("origin.abroad.other"))}</option>` +
    `</select></label>` +
    `</div>` +
    `<button type="button" class="origin-skip" data-origin="skip" data-i18n-slot="origin.skip">${escapeHtml(t("origin.skip"))}</button>` +
    `<p class="origin-status" id="originStatus" role="status" aria-live="polite"></p>`;
}

function setOrigin(origin) {
  state.origin = origin;
  writeStore(KEY_ORIGIN, origin);
  renderOriginCard();
}

function wireOrigin() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-origin]");
    if (!btn || btn.tagName === "SELECT") return;
    const festival = state.focus && state.focus.festival;
    if (!festival) return;
    const kind = btn.dataset.origin;
    if (kind === "skip") {
      setOrigin({ kind: "skipped" });
    } else if (kind === "city") {
      setOrigin({ kind: "city", city: festival.city, cityName: festivalCity(festival), country: festival.country, lat: festival.lat, lng: festival.lng });
    } else if (kind === "country") {
      setOrigin({ kind: "country", country: festival.country });
    } else if (kind === "position") {
      const status = $("originStatus");
      status.textContent = t("origin.locating");
      if (!navigator.geolocation) {
        status.textContent = t("origin.noPosition");
        return;
      }
      // Kept as a point, judged by distance, sent nowhere.
      navigator.geolocation.getCurrentPosition(
        (pos) => setOrigin({ kind: "position", lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          status.textContent = t("origin.noPosition");
        },
        { maximumAge: 600000, timeout: 15000 }
      );
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id !== "originCountry" || !e.target.value) return;
    const code = e.target.value;
    setOrigin(code === "*" ? { kind: "abroad" } : { kind: "abroad", country: code });
  });
}

function wireFocus() {
  $("timeline").addEventListener("click", (e) => {
    const item = e.target.closest(".tl-item");
    if (!item) return;
    const next = editionByKey(item.dataset.edition);
    if (next && (!state.focus || next.key !== state.focus.key)) focusEdition(next, { fresh: true });
  });
  $("periodEarlier").addEventListener("click", () => extendPeriod("earlier"));
  $("periodLater").addEventListener("click", () => extendPeriod("later"));
  $("browseMore").addEventListener("click", (e) => {
    if (!e.target.closest("#browseMoreBtn")) return;
    state.browsePages += 1;
    renderBrowse();
    syncStars();
  });
  addEventListener("resize", () => layoutRows($("timeline")));
}

async function boot() {
  $("loadingState").hidden = false;
  let registryError = null;
  try {
    state.registry = await loadFestivalIndex();
  } catch (error) {
    registryError = error;
  }
  // What /planJerusalem/ saved, carried over before anything reads storage —
  // its date window counted nights of that festival's edition, which the
  // registry has the dates of.
  const legacy = state.registry && editionByKey(editionKey(LEGACY_FESTIVAL_ID, LEGACY_EDITION_ID));
  if (legacy) {
    try {
      migrateLegacy(localStorage, {
        from: LEGACY_STORAGE_PREFIX,
        to: STORAGE_PREFIX,
        festivalId: LEGACY_FESTIVAL_ID,
        editionKey: legacy.key,
        nights: daysOf(legacy.edition.firstDate, legacy.edition.lastDate),
      });
    } catch {
      /* no storage, nothing to carry */
    }
  }
  initI18n({
    root: PAGE_ROOT,
    storagePrefix: STORAGE_PREFIX,
    localeSelect: $("langSelect"),
    themeButton: $("themeToggle"),
    onChange: retranslate,
    documentTitle: () =>
      state.focus ? t("doc.titleFor", { festival: festivalName(state.focus.festival) }) : null,
  });
  renderChrome();
  if (registryError) {
    $("loadingState").hidden = true;
    $("errorState").hidden = false;
    // The translated line stays; what the failure actually said goes beneath it,
    // untranslated, because it came from the network rather than from us.
    $("errorTech").textContent = String(registryError.message || registryError);
    return;
  }

  state.starred = new Set(readStore(KEY_STARRED, []));
  restoreVerdicts();
  restorePrefs();
  state.origin = readStore(KEY_ORIGIN, null);

  wireWindow();
  wireBoard();
  wireCalendar();
  wireBlockers();
  wireSearch();
  wirePrefs();
  wireOrigin();
  wireFocus();

  const focus = initialFocus();
  if (!focus) {
    $("loadingState").hidden = true;
    renderTimelineStrip();
    return;
  }
  await focusEdition(focus);
}

/* The site version in the footer's popup, exactly as the other two pages carry
 * it — read from the stamp the release wrote into this page. */
function showVersion() {
  const version = readVersionStamp();
  if (version) attachVersionPopup($("footerVersion"), `v${version}`);
}

showVersion();
boot();
