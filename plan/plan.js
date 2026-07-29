// Fringe Planner — page logic.
//
// An ES module: shares no *globals* with the home site's js/app.js, but does
// share real code with it — anything both pages must agree on is imported from
// ../shared/, not copy-pasted. Wires the pure computation engine (./lib/*.js)
// to the UI.
//
// The page has one state switch, keyed on whether a favourites set is in:
// without one, the intake panel (drag/drop or pick a favourites CSV, or load
// the bundled sample) is all there is; with one, the availability calendar +
// the instant plan replace it. There is no "Plan" button — the itinerary
// recomputes live whenever the date window or any control changes.

import { isInUK } from "../shared/geo.js";
import { parseFavourites, urlFromSlug } from "./lib/favourites.js";
import { buildIndex, matchFavourites, summarize, buildSchedule, placementDiagnostics, slotKey } from "./lib/engine.js";
import { isAvailable } from "./lib/availability.js";
import { toCsv, toIcs, slotEndTime } from "./lib/itinerary.js";
import { distanceKm, travelMinutes } from "./lib/travel.js";
import { rehydrateShows } from "./lib/hydrate.js";
import {
  searchShows,
  catalogueFacets,
  hasActiveFilters,
  filterShows,
  showPrice,
  showAccessibility,
  ageLimitYears,
} from "./lib/search.js";

// ES modules are always strict mode, so no "use strict" directive is needed.

// --- Constants --------------------------------------------------------

const DATA_URL = "../data/normalized/shows.min.json"; // compact catalogue; rehydrated against VENUES_URL
const VENUES_URL = "../data/venues.json"; // shared lookups (enums + venue map) the catalogue indexes into
const APP_VERSION_URL = "../package.json"; // single source of truth for the version in the perf pill

const YEAR = 2026;
const MONTH = "08"; // August, 2-digit
const DAYS_IN_MONTH = 31; // Aug 1–31 is the axis this calendar draws.
const FEST_START_DAY = 7; // The Fringe runs Fri 7 – Sun 31 Aug 2026; days 1–6 draw as a shaded "before it opens" zone.

const T_MIN = 0; // 00:00 — the calendar's catchable-count filter never narrows on start time.
const T_MAX = 1440; // 24:00

const DEFAULT_D0 = 7; // default date window: Aug 7 → Aug 24 (the festival trip window)
const DEFAULT_D1 = 24;

// The schedule axis, and the range a "day ends" can reach: a Fringe evening
// runs past midnight, so the day is drawn from 09:00 to 27:00 (03:00) and a show
// may be allowed to finish any time up to that late edge.
const AXIS_TOP_MIN = 9 * 60; // 09:00 — top of every day column
const AXIS_BOTTOM_MIN = 27 * 60; // 27:00 = 03:00 — bottom of every day column
const DAY_END_CEIL = AXIS_BOTTOM_MIN; // a "day ends" can be set as late as 27:00

// Default day-hours window (minutes of day). The day ends at 25:00 (01:00) by
// default so ordinary late-night shows are catchable out of the box.
const DEFAULT_DAY_START = 9 * 60; // 09:00
const DEFAULT_DAY_END = 25 * 60; // 25:00 = 01:00

const STORAGE_KEY = "edfringe.plan.favourites.v1";
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // keep for 3 days, then forget

// Genre → a small emoji drawn on the left of each scheduled block. Keys are the
// ten headline genres in shows.json; anything else falls back to a ticket.
const GENRE_EMOJI = {
  "Comedy": "😂",
  "Theatre": "🎭",
  "Cabaret and Variety": "🎪",
  "Children's Shows": "🧸",
  "Dance, Physical Theatre & Circus": "💃",
  "Events": "✨",
  "Exhibitions": "🖼️",
  "Music": "🎵",
  "Musicals and Opera": "🎶",
  "Spoken Word": "🗣️",
};
function genreEmoji(genre) {
  return GENRE_EMOJI[genre] || "🎟️";
}

// Travel modes: emoji + a verb for the leg label ("12 min walk" / "by bike").
const MODE_META = {
  walk: { emoji: "🚶", verb: "walk" },
  bike: { emoji: "🚲", verb: "by bike" },
  car: { emoji: "🚗", verb: "by car" },
};

// --- Small helpers ------------------------------------------------------

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a day-of-month within August 2026. */
function dateStr(day) {
  return `${YEAR}-${MONTH}-${pad2(day)}`;
}

/** "HH:MM" for a minute-of-day (caps at 23:59 for the 1440 sentinel). */
function minToHHMM(min) {
  const m = Math.min(1439, Math.max(0, Math.round(min)));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
/**
 * Extended-hours clock for a minute-of-day that may run past midnight: 1500 →
 * "25:00", 1470 → "24:30". Used for the "day ends" control and the after-hours
 * lines/labels on the 09:00–27:00 schedule axis.
 */
function minToDayClock(min) {
  const m = Math.max(0, Math.round(min));
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
/** Parse an "HH:MM" time-input value to minutes of day (null if blank). */
function hhmmToMin(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// 1 Aug 2026 is a Saturday; compute weekday letters from real dates.
const DOW_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
function dow(day) {
  return new Date(Date.UTC(YEAR, 7, day)).getUTCDay();
}
function dowShort(day) {
  return DOW_SHORT[dow(day)];
}
function isWeekend(day) {
  const d = dow(day);
  return d === 0 || d === 6;
}

// --- App state ------------------------------------------------------------

const state = {
  index: null, // Map<slug, show> — the full catalogue
  catalogue: [], // the same catalogue as an array — what the show search scans
  lookups: null, // venues.json lists (genres, subgenres, …) — the search filters' options
  facets: null, // catalogueFacets() over the catalogue: which optional facets have data
  venueCoords: null, // { [venueCode]: {lat, lng} }
  // The working favourites, as slugs — the single source of truth for what's on
  // the grid and what we persist. Mutated by add (DEBUG) / remove-a-row, so the
  // stored list always mirrors the shows on screen, not the original upload.
  favSlugs: [],
  matched: [], // full show objects for the user's matched favourites
  totalFavourites: 0,
  missingSlugs: [],
  filename: "",
  savedAt: null,
  pendingUpload: null,
  // Date window (drives summarize()'s filter):
  d0: DEFAULT_D0,
  d1: DEFAULT_D1,
  // Day-hours + meal breaks + travel mode + must-sees (drive buildSchedule):
  dayStartMin: DEFAULT_DAY_START,
  dayEndMin: DEFAULT_DAY_END,
  mealBreaks: [
    { id: "lunch", enabled: true, startMin: 12 * 60 + 30, endMin: 13 * 60 + 30 },
    { id: "dinner", enabled: false, startMin: 18 * 60, endMin: 19 * 60 },
  ],
  // "Getting there" / "getting out" blocks (minute-of-day), applied to the first
  // (arrival) and last (departure) day of the trip window. Like meal breaks but
  // date-specific — the dates are derived from d0/d1 at plan time. Drag the block
  // edge on the schedule to set how much of the day travel eats.
  arrival: { endMin: 11 * 60, enabled: true },      // no shows before this on day one
  departure: { startMin: 22 * 60, enabled: true },  // no shows after this on the last day
  mode: "walk",
  // Must-sees, keyed by slug. Value `true` = pin the show (the scheduler picks a
  // performance); a slotKey string = pin that one specific performance. Click a
  // show name to toggle the first, click a performance mark to toggle the second.
  forced: new Map(),
  // Populated once per upload by buildCalendar():
  laneRefs: [], // [{ slug, el, statusEl }] in display (sorted) order
  layout: { trackLeft: 0, trackWidth: 0, dayW: 0 },
  dayHeaderBuilt: false,
  // The latest plan.
  schedule: null,
  scheduledSlugs: new Set(),
  // slug -> slotKey of the one performance the plan actually set for that show,
  // so the grid can ring the chosen day/time (not just flag the whole lane).
  selectedSlot: new Map(),
  diag: null, // latest placementDiagnostics(): which controls block which shows
  schedAxis: null, // { axisTopMin, axisBottomMin, hourPx, headPx } for overlay dragging
  // Build version + reschedule-timing telemetry (surfaced in the header pill).
  version: null,
  perf: { count: 0, sum: 0, last: 0, min: Infinity, max: 0 },
};

// --- Data loading + rehydration ---------------------------------------
//
// The planner downloads two files: the compact catalogue (shows.min.json, packed
// by scraper/normalize.py) and the shared lookups (venues.json). rehydrateShows()
// (./lib/hydrate.js) unpacks the first against the second back into the full
// records the engine expects — every enum is an index into a venues.json list,
// venueName is rebuilt from the venue code + room, dates are MMDD ints, and the
// bare image GUID gets its host prefix re-attached — so the rest of the app sees
// a ready-to-use catalogue identical in shape to the old shows.json.

let dataPromise = null;

function loadData() {
  dataPromise = (async () => {
    // Both files are required to rehydrate: the compact catalogue and the lookups
    // it indexes into. Fetch them together.
    const [wire, lookups] = await Promise.all([
      fetchJson(DATA_URL),
      fetchJson(VENUES_URL),
    ]);
    state.venueCoords = lookups.venues || null; // venue map drives travel legs/gaps
    state.lookups = lookups;
    state.catalogue = rehydrateShows(wire, lookups, YEAR);
    state.index = buildIndex(state.catalogue);
    state.facets = catalogueFacets(state.catalogue);
    initSearchUI();
    restoreStoredFavourites();
    return state.index;
  })();
  dataPromise.catch(() => {});
  return dataPromise;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.json();
}

async function ensureData() {
  if (state.index) return state.index;
  if (!dataPromise) loadData();
  $("errorState").hidden = true;
  $("loadingState").hidden = false;
  try {
    return await dataPromise;
  } catch (err) {
    dataPromise = null;
    throw err;
  } finally {
    $("loadingState").hidden = true;
  }
}

// --- Local persistence (localStorage, 3-day TTL) --------------------------

function saveFavourites(slugs, filename, savedAt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, slugs, filename, savedAt }));
  } catch (err) {
    console.warn("Fringe Planner: couldn't save favourites locally", err);
  }
}

function loadStoredFavourites() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Fringe Planner: local storage unavailable", err);
    return null;
  }
  if (!raw) return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    clearStoredFavourites();
    return null;
  }
  if (!data || !Array.isArray(data.slugs) || typeof data.savedAt !== "number") {
    clearStoredFavourites();
    return null;
  }
  if (Date.now() - data.savedAt > TTL_MS) {
    clearStoredFavourites();
    return null;
  }
  return {
    slugs: data.slugs.filter((s) => typeof s === "string"),
    filename: typeof data.filename === "string" ? data.filename : "",
    savedAt: data.savedAt,
  };
}

function clearStoredFavourites() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Fringe Planner: couldn't clear stored favourites", err);
  }
}

function restoreStoredFavourites() {
  const data = loadStoredFavourites();
  if (!data || data.slugs.length === 0) return;
  applyFavourites(data.slugs, data.filename, data.savedAt, { scroll: false });
}

function clearFavourites() {
  clearStoredFavourites();
  state.favSlugs = [];
  state.totalFavourites = 0;
  state.matched = [];
  state.missingSlugs = [];
  state.filename = "";
  state.savedAt = null;
  state.forced = new Map();

  const summaryEl = $("uploadSummary");
  summaryEl.hidden = true;
  summaryEl.classList.remove("is-partial");
  $("missingList").hidden = true;
  $("missingList").innerHTML = "";
  $("screen2").hidden = true;
  $("screen3").hidden = true;
  state.schedule = null;
  state.scheduledSlugs = new Set();
  const pageHead = $("pageHead");
  if (pageHead) pageHead.hidden = false; // bring the intro back on the empty state
  mountSearch("intake");
  syncSearchStars();
  $("screen1").hidden = false;
  $("screen1").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Screen 1: favourites intake -----------------------------------------

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => processFavouritesText(String(reader.result || ""), file.name);
  reader.onerror = () => {
    console.error("Fringe Planner: failed to read file", reader.error);
    alert("Couldn't read that file — please try again.");
  };
  reader.readAsText(file);
}

function processFavouritesText(text, filename) {
  const slugs = parseFavourites(text);
  const savedAt = Date.now();
  if (slugs.length > 0) saveFavourites(slugs, filename, savedAt);
  applyFavourites(slugs, filename, savedAt, { scroll: true });
}

async function applyFavourites(slugs, filename, savedAt, { scroll = false, keepForced = false, keepWindow = false } = {}) {
  state.pendingUpload = { slugs, filename, savedAt, scroll };

  let index;
  try {
    index = await ensureData();
  } catch (err) {
    console.error("Fringe Planner: failed to load show data", err);
    $("errorDetail").textContent =
      "Check your connection and try again. (" + (err && err.message ? err.message : "unknown error") + ")";
    $("errorState").hidden = false;
    return;
  }

  const { matched, missingSlugs } = matchFavourites(slugs, index);
  state.pendingUpload = null;

  state.favSlugs = slugs.slice();
  state.totalFavourites = slugs.length;
  state.matched = matched;
  state.missingSlugs = missingSlugs;
  state.filename = filename;
  state.savedAt = savedAt;
  // A fresh upload clears must-sees; an add/remove keeps the pins still on the grid.
  const survivingSlugs = new Set(matched.map((s) => s.slug));
  state.forced = keepForced
    ? new Map([...state.forced].filter(([slug]) => survivingSlugs.has(slug)))
    : new Map();

  syncSearchStars(); // the search popup's stars mirror the grid

  if (matched.length > 0) {
    // A fresh upload starts from the default window; a one-by-one add/remove is
    // a quiet tweak to a grid in use, so it leaves the user's dates alone.
    if (!keepWindow) {
      state.d0 = DEFAULT_D0;
      state.d1 = DEFAULT_D1;
    }
    renderFavLine();
    buildCalendar(); // builds the lanes DOM…
    refresh(); // …then the first plan + verdicts + hero
    $("screen1").hidden = true;
    showCalendar({ scroll });
  } else {
    renderUploadSummary();
    $("screen1").hidden = false;
    $("screen2").hidden = true;
  }
}

function dayDiff(a, b) {
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

function fmtSavedWhen(ts) {
  if (!ts) return "this session";
  const then = new Date(ts);
  const days = dayDiff(then, new Date());
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function renderFavLine() {
  const { totalFavourites, matched, missingSlugs, filename, savedAt } = state;
  const el = $("favSummary");
  el.textContent = "";

  let text =
    missingSlugs.length > 0
      ? `${matched.length} of ${totalFavourites} favourites matched`
      : `${totalFavourites} favourite${totalFavourites === 1 ? "" : "s"}`;
  text += ` · from ${fmtSavedWhen(savedAt)}`;
  if (filename) text += ` · ${filename}`;
  el.append(text);

  if (missingSlugs.length > 0) {
    el.append(" ");
    const whichBtn = document.createElement("button");
    whichBtn.type = "button";
    whichBtn.className = "fav-action";
    whichBtn.textContent = "(which didn't?)";
    whichBtn.addEventListener("click", toggleMissingList);
    el.appendChild(whichBtn);
  }
  renderMissingList();
}

function renderUploadSummary() {
  const { totalFavourites, matched, missingSlugs, filename } = state;
  const summaryEl = $("uploadSummary");
  summaryEl.hidden = false;
  summaryEl.classList.toggle("is-partial", missingSlugs.length > 0);
  $("usMain").textContent =
    totalFavourites === 0
      ? "No favourites found in that file"
      : `${totalFavourites} favourite${totalFavourites === 1 ? "" : "s"} loaded`;
  $("usSub").textContent =
    totalFavourites === 0
      ? "We couldn't find any edfringe.com show links in that file."
      : `${matched.length} matched to our show data · ${missingSlugs.length} we couldn't find`;
  $("usFile").textContent = filename;
}

function renderMissingList() {
  const list = $("missingList");
  list.innerHTML = "";
  list.hidden = true;
  for (const slug of state.missingSlugs) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = urlFromSlug(slug);
    a.target = "_blank";
    a.rel = "noopener";
    a.className = "link-quiet";
    a.innerHTML = `<code>${slug}</code>`;
    li.appendChild(a);
    list.appendChild(li);
  }
}

function toggleMissingList() {
  const list = $("missingList");
  list.hidden = !list.hidden;
}

function showCalendar({ scroll = false } = {}) {
  // The marketing intro is empty-state chrome; drop it now the grid is the hero.
  const pageHead = $("pageHead");
  if (pageHead) pageHead.hidden = true;
  mountSearch("cal");
  const screen2 = $("screen2");
  screen2.hidden = false;
  $("screen3").hidden = false;
  updatePlanWindowLabel();
  requestAnimationFrame(() => {
    layoutOverlay();
    refresh(); // schedule geometry needs a laid-out panel
  });
  if (scroll) screen2.scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Screen 2: calendar ----------------------------------------------------

function currentFilter() {
  return {
    dateStart: dateStr(state.d0),
    dateEnd: dateStr(state.d1),
    startTimeMin: T_MIN,
    startTimeMax: T_MAX,
  };
}

function typicalStartTime(performances) {
  const counts = new Map();
  for (const p of performances) counts.set(p.start, (counts.get(p.start) || 0) + 1);
  let best = null;
  let bestCount = -1;
  for (const [time, count] of counts) {
    if (count > bestCount || (count === bestCount && (best === null || time < best))) {
      best = time;
      bestCount = count;
    }
  }
  return best || "00:00";
}

function ensureDayHeader() {
  if (state.dayHeaderBuilt) return;
  const dayHead = $("dayHead");
  dayHead.innerHTML = "";
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const col = document.createElement("div");
    col.className = "day-col" + (isWeekend(d) ? " wknd" : "") + (d < FEST_START_DAY ? " pre" : "");
    col.innerHTML = `<span class="day-dow">${dowShort(d)}</span><span class="day-num">${d}</span>`;
    dayHead.appendChild(col);
  }
  state.dayHeaderBuilt = true;
}

/**
 * (Re)build the lanes from scratch: one row per matched favourite, sorted by
 * typical start time. Performance marks are drawn once per upload; dragging the
 * window / re-planning only updates per-lane verdicts (see applyVerdicts).
 */
function buildCalendar() {
  ensureDayHeader();

  const filter = currentFilter();
  const result = summarize(state.matched, filter, state.totalFavourites);
  const ordered = [...result.shows].sort(
    (a, b) => typicalStartTime(a.performances).localeCompare(typicalStartTime(b.performances))
  );

  const lanesEl = $("lanes");
  lanesEl.innerHTML = "";
  state.laneRefs = [];

  for (const show of ordered) {
    const lane = document.createElement("div");
    lane.className = "cal-row lane";
    lane.dataset.slug = show.slug;

    const label = document.createElement("div");
    label.className = "lane-label";
    // No native title — the lock cursor + underline-on-hover already signal the
    // "click to lock" affordance, and a title here is the ugly browser tooltip.
    label.innerHTML =
      `<span class="lane-pin" aria-hidden="true">🔒</span>` +
      `<span class="lane-title">${escapeHtml(show.title)}</span>`;

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

    lane.appendChild(label);
    lane.appendChild(track);
    lane.appendChild(statusEl);
    lanesEl.appendChild(lane);

    state.laneRefs.push({ slug: show.slug, el: lane, statusEl });
  }
}

function segClass(p) {
  if (p.soldOut) return "seg-sold";
  switch ((p.status || "").toUpperCase()) {
    case "TICKETS_AVAILABLE": return "seg-avail";
    case "TWO_FOR_ONE": return "seg-2for1";
    case "PREVIEW_SHOW": return "seg-preview";
    case "FREE_TICKETED":
    case "FREE_NON_TICKETED": return "seg-free";
    case "EVENT_SPECIFIC": return "seg-event";
    case "NO_ALLOCATION_CONTACT_VENUE": return "seg-noalloc";
    default: return p.available ? "seg-avail" : "seg-sold";
  }
}

function statusLabel(p) {
  if (p.soldOut) return "sold out";
  switch ((p.status || "").toUpperCase()) {
    case "TICKETS_AVAILABLE": return "tickets available";
    case "TWO_FOR_ONE": return "2-for-1";
    case "PREVIEW_SHOW": return "preview";
    case "FREE_TICKETED": return "free (ticketed)";
    case "FREE_NON_TICKETED": return "free";
    case "EVENT_SPECIFIC": return "event-specific";
    case "NO_ALLOCATION_CONTACT_VENUE": return "no allocation — contact venue";
    default: return p.available ? "available" : "unavailable";
  }
}

function buildDayCells(performances) {
  const byDay = new Map();
  for (const p of performances) {
    if (!p.date.startsWith(`${YEAR}-${MONTH}-`)) continue;
    const day = Number(p.date.slice(8, 10));
    if (day < 1 || day > DAYS_IN_MONTH) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(p);
  }

  const frag = document.createDocumentFragment();
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const cell = document.createElement("span");
    cell.style.gridColumn = String(d);
    const entries = byDay.get(d);
    if (entries && entries.length > 0) {
      entries.sort((a, b) => a.start.localeCompare(b.start));
      cell.className = "cell" + (entries.length > 1 ? " cell-multi" : "");
      for (const p of entries) {
        const seg = document.createElement("span");
        seg.className = "seg " + segClass(p);
        seg.dataset.date = p.date;
        seg.dataset.start = p.start;
        // The custom cal-tip (cell.dataset.tip below) is the nicer hover — no
        // native title, so the two don't stack as parallel tooltips.
        cell.appendChild(seg);
      }
      cell.dataset.tip = entries
        .map((p) => `${dowShort(d)} ${d} Aug · ${p.start} · ${statusLabel(p)}`)
        .join("\n");
    }
    frag.appendChild(cell);
  }
  return frag;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * The single live recompute: summarize the window, build the plan, and render
 * every dependent surface (lane verdicts, hero count, schedule, summary,
 * exports). Called after any date-window / control / must-see change.
 *
 * @param {{animate?: boolean}} [opts] pass `{animate: false}` for the frame-by
 *   -frame path (dragging the date window / a resize), where the board should
 *   track the pointer instantly rather than replay an enter/leave transition.
 */
function refresh(opts) {
  if (state.matched.length === 0) return;
  const animate = !(opts && opts.animate === false);
  const filter = currentFilter();
  const summ = summarize(state.matched, filter, state.totalFavourites);

  // Time the reschedule computation itself (buildSchedule) for the header pill.
  const t0 = performance.now();
  const planOpts = gatherPlanOptions();
  const schedule = buildSchedule(state.matched, planOpts);
  recordResched(performance.now() - t0);
  state.schedule = schedule;
  state.scheduledSlugs = new Set(schedule.scheduled.map((s) => s.slug));
  // The exact performance the plan chose for each scheduled show, so the grid
  // can ring that one mark (the "selected plan" the user sees on the lanes).
  state.selectedSlot = new Map(schedule.scheduled.map((s) => [s.slug, slotKey(s)]));

  // Which controls are, on their own, making a catchable show un-placeable —
  // drives the "prevents N shows" labels, the lane marks, and the schedule
  // overlay badges.
  state.diag = placementDiagnostics(state.matched, {
    dateStart: planOpts.dateStart,
    dateEnd: planOpts.dateEnd,
    dayStartMin: state.dayStartMin,
    dayEndMin: effectiveDayEnd(),
    dayEndCeil: DAY_END_CEIL,
    mealBreaks: state.mealBreaks,
    venueCoords: state.venueCoords,
  });
  updateBlockLabels(state.diag);

  const bySlug = new Map(summ.shows.map((s) => [s.slug, s]));
  applyVerdicts(bySlug, filter);
  updateHero(summ.counts, schedule.counts);
  updatePlanWindowLabel();

  renderPlanSummary(schedule);
  renderSchedule(schedule, animate);
  const hasShows = schedule.scheduled.length > 0;
  $("downloadCsvBtn").disabled = !hasShows;
  $("importIcsBtn").disabled = !hasShows;
}

/**
 * The right-hand verdict a lane shows when it isn't in the plan. Distinct kinds
 * so the reason a show didn't make it is legible at a glance:
 *   - scheduled  : this show made the plan            ✓ Scheduled!
 *   - early      : catchable, but only before day-start  ☀ Too early
 *   - late       : catchable, but only after day-end     🌙 Too late
 *   - cantfit    : catchable in the window, but a clash / meal / cap left no room
 *   - sold       : every performance in the window (or the whole run) is sold out
 *   - baddates   : has bookable performances, but all fall outside your dates
 */
function laneStatus(show, filter, sets) {
  if (sets.scheduled) return { kind: "scheduled" };
  const perfs = show.performances || [];
  const inWindow = perfs.filter((p) => p.date >= filter.dateStart && p.date <= filter.dateEnd);
  const availInWindow = inWindow.filter((p) => p.available);

  if (availInWindow.length > 0) {
    const early = sets.earlySet.has(show.slug);
    const late = sets.lateSet.has(show.slug);
    // A single culprit reads cleanly; a mix (some too early, some too late, or a
    // meal break / clash) falls back to the honest "Can't fit".
    if (early && !late) return { kind: "early" };
    if (late && !early) return { kind: "late" };
    return { kind: "cantfit" };
  }

  // Nothing catchable in the window. Sold out (in-window, or the whole run)
  // takes priority over "bad dates" — a different window won't help a sold-out
  // run, whereas bad dates are exactly what the date scrubber fixes.
  const runSold = perfs.length > 0 && perfs.every((p) => p.soldOut);
  const windowSold = inWindow.length > 0 && inWindow.every((p) => p.soldOut);
  if (runSold || windowSold) return { kind: "sold" };
  return { kind: "baddates" };
}

/** The status pill HTML for a lane verdict (see laneStatus for the kinds). */
function statusPillHTML(status) {
  // No native title attributes — those are the browser's ugly tooltip; the short
  // pill label carries the verdict on its own.
  switch (status.kind) {
    case "scheduled":
      return `<span class="st-plan">&check;&nbsp;Scheduled!</span>`;
    case "early":
      return `<span class="st-blocked">☀ Too early</span>`;
    case "late":
      return `<span class="st-blocked">🌙 Too late</span>`;
    case "cantfit":
      return `<span class="st-cant">Can't fit</span>`;
    case "sold":
      return `<span class="st-sold">Sold out</span>`;
    case "baddates":
    default:
      return `<span class="st-dates">📅 No dates</span>`;
  }
}

/**
 * Update each lane's state and right-hand verdict (see laneStatus for the six
 * kinds). The lane also mirrors the plan on its performance marks, and a forced
 * (must-see) lane carries a pin.
 */
function applyVerdicts(bySlug, filter) {
  const diag = state.diag || {};
  const earlySet = new Set((diag.dayStart || []).map((s) => s.slug));
  const lateSet = new Set((diag.dayEnd || []).map((s) => s.slug));
  for (const ref of state.laneRefs) {
    const show = bySlug.get(ref.slug);
    if (!show) continue;
    const scheduled = state.scheduledSlugs.has(ref.slug);
    const forced = state.forced.has(ref.slug);
    const status = laneStatus(show, filter, { scheduled, earlySet, lateSet });
    const dimmed = status.kind === "baddates" || status.kind === "sold";
    const amber = status.kind === "early" || status.kind === "late";

    ref.el.classList.toggle("lane--out", dimmed);
    ref.el.classList.toggle("lane--scheduled", scheduled);
    ref.el.classList.toggle("lane--forced", forced);
    ref.el.classList.toggle("lane--blocked", amber);

    // Mark the performance marks so the grid *shows the plan*, not just flags the
    // lane: the one performance the plan set turns into a gold bar; a whole-show
    // pin dashes every performance (gold); an exact-performance pin also carries a
    // lock badge that sits above the mark (overlapping the row above is fine).
    const pin = state.forced.get(ref.slug);
    const pinnedKey = typeof pin === "string" ? pin : null;
    const forcedShow = pin === true;
    const selectedKey = state.selectedSlot.get(ref.slug) || null;
    for (const seg of ref.el.querySelectorAll(".seg")) {
      const key = slotKey({ date: seg.dataset.date, start: seg.dataset.start });
      const isSelected = selectedKey != null && key === selectedKey;
      const isPinned = pinnedKey != null && key === pinnedKey;
      seg.classList.toggle("seg--selected", isSelected);
      seg.classList.toggle("seg--pinned", isPinned);
      seg.classList.toggle("seg--forced-all", forcedShow && !isSelected);
      const cell = seg.parentElement;
      cell.classList.toggle("cell--pin", isPinned);
      let badge = seg.querySelector(".seg-pin");
      if (isPinned && !badge) {
        badge = document.createElement("span");
        badge.className = "seg-pin";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "🔒";
        seg.appendChild(badge);
      } else if (!isPinned && badge) {
        badge.remove();
      }
    }

    // A pinned lane shows the pin in its status too, right next to the verdict.
    const pinMark = forced
      ? `<span class="st-pin" aria-hidden="true">🔒</span>`
      : "";
    ref.statusEl.innerHTML = pinMark + statusPillHTML(status);
  }
}

// --- "This control prevents N shows" labels + grid flash -------------------

// Each blocking control's label + the diagnostics list it reads. The buttons
// live in index.html; clicking one flashes the shut-out lanes on the grid.
const BLOCK_CONTROLS = [
  { id: "blkDayStart", label: "Your day start", pick: (d) => d.dayStart },
  { id: "blkDayEnd", label: "Your day end", pick: (d) => d.dayEnd },
  { id: "blkMealLunch", label: "Your lunch break", pick: (d) => d.meals.lunch || [] },
  { id: "blkMealDinner", label: "Your dinner break", pick: (d) => d.meals.dinner || [] },
];

/** Human tooltip for a blocking control: "<label> rules out N shows: A, B, …". */
function blockTip(label, list) {
  const titles = list.map((s) => s.title);
  const shown = titles.slice(0, 8).join(", ");
  const more = titles.length > 8 ? `, +${titles.length - 8} more` : "";
  return `${label} rules out ${list.length} show${list.length === 1 ? "" : "s"}: ${shown}${more}`;
}

/** Show/hide the "Prevents N" chips next to the day-hours and meal controls. */
function updateBlockLabels(diag) {
  for (const c of BLOCK_CONTROLS) {
    const el = $(c.id);
    if (!el) continue;
    const list = (diag && c.pick(diag)) || [];
    el.hidden = list.length === 0;
    if (!list.length) continue;
    el.textContent = `⚠ Prevents ${list.length}`;
    const tip = blockTip(c.label, list);
    el.title = tip;
    el.setAttribute("aria-label", tip + " — click to highlight them on the grid");
  }
}

/** Briefly highlight the shut-out shows' lanes on the availability grid. */
function flashBlockedLanes(list) {
  if (!list.length) return;
  const slugs = new Set(list.map((s) => s.slug));
  $("screen2")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  for (const ref of state.laneRefs) {
    if (!slugs.has(ref.slug)) continue;
    ref.el.classList.remove("lane--flash");
    void ref.el.offsetWidth; // restart the animation
    ref.el.classList.add("lane--flash");
    ref.el.addEventListener("animationend", () => ref.el.classList.remove("lane--flash"), { once: true });
  }
}

/** Hero now reads scheduled / in-window / total. */
function updateHero(counts, planCounts) {
  const hcSched = $("hcSched");
  const changed = hcSched.textContent !== String(planCounts.scheduledShows);
  hcSched.textContent = planCounts.scheduledShows;
  $("hcIn").textContent = counts.showsAvailableInWindow;
  $("hcAll").textContent = counts.matchedShows;
  $("hcDetail").textContent = `${state.d0}–${state.d1} Aug`;
  if (changed) {
    const num = hcSched.closest(".hc-num");
    num.classList.remove("bump");
    void num.offsetWidth;
    num.classList.add("bump");
  }
}

// rAF-throttled recompute, coalesced to once per frame (window dragging).
// `animate` defaults off: the continuous drag path wants the board to track the
// pointer, not replay a transition every frame. A keyboard nudge passes true.
let recomputeScheduled = false;
let recomputeAnimate = false;
function scheduleRecompute(animate = false) {
  recomputeAnimate = recomputeAnimate || animate;
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  requestAnimationFrame(() => {
    recomputeScheduled = false;
    const a = recomputeAnimate;
    recomputeAnimate = false;
    refresh({ animate: a });
  });
}

// --- Window overlay geometry & date-window dragging ------------------------

const calWrap = () => $("calWrap");
const calInner = () => $("calInner");

function layoutOverlay() {
  const daysEl = $("dayHead");
  const dr = daysEl.getBoundingClientRect();
  if (dr.width === 0) return;
  const wr = calInner().getBoundingClientRect();
  const trackLeft = dr.left - wr.left;
  const trackWidth = dr.width;
  const dayW = trackWidth / DAYS_IN_MONTH;
  state.layout = { trackLeft, trackWidth, dayW };

  const win = $("win");
  win.style.left = trackLeft + "px";
  win.style.width = trackWidth + "px";

  const festEnd = $("festEnd");
  festEnd.style.left = trackLeft + "px";
  festEnd.style.width = (FEST_START_DAY - 1) * dayW + "px";

  paintWindow();
}

let slideTimer = null;
/**
 * Position the date-window overlay (dim panels, band, handles, flags) for the
 * current d0/d1. Pass `animate = true` for a discrete jump — "Pick my best
 * dates" or a keyboard nudge — so the lines glide to their new spot instead of
 * teleporting; the drag path leaves it false so the window tracks the pointer.
 */
function paintWindow(animate = false) {
  const win = $("win");
  const rail = $("winRail");
  if (animate && !prefersReducedMotion()) {
    win.classList.add("is-sliding");
    rail.classList.add("is-sliding");
    clearTimeout(slideTimer);
    slideTimer = setTimeout(() => {
      win.classList.remove("is-sliding");
      rail.classList.remove("is-sliding");
    }, 460);
  }
  const { trackLeft, trackWidth, dayW } = state.layout;
  const x0 = (state.d0 - 1) * dayW;
  const x1 = state.d1 * dayW;
  $("dimL").style.left = "0";
  $("dimL").style.width = x0 + "px";
  $("dimR").style.left = x1 + "px";
  $("dimR").style.width = Math.max(0, trackWidth - x1) + "px";
  $("band").style.left = x0 + "px";
  $("band").style.width = (x1 - x0) + "px";
  $("edgeStart").style.left = x0 + "px";
  $("edgeEnd").style.left = x1 + "px";
  $("hStart").style.left = (trackLeft + x0) + "px";
  $("hEnd").style.left = (trackLeft + x1) + "px";
  $("railBand").style.left = (trackLeft + x0) + "px";
  $("railBand").style.width = (x1 - x0) + "px";
  $("flagStart").textContent = `${state.d0} Aug`;
  $("flagEnd").textContent = `${state.d1} Aug`;
  const len = state.d1 - state.d0 + 1;
  const railLen = $("railLen");
  if (railLen) railLen.textContent = `${len} day${len === 1 ? "" : "s"}`;
  const hStart = $("hStart");
  hStart.setAttribute("aria-valuenow", state.d0);
  hStart.setAttribute("aria-valuetext", `${state.d0} August`);
  const hEnd = $("hEnd");
  hEnd.setAttribute("aria-valuenow", state.d1);
  hEnd.setAttribute("aria-valuetext", `${state.d1} August`);
}

function dayAt(clientX) {
  const wr = calInner().getBoundingClientRect();
  const { trackLeft, dayW } = state.layout;
  return clamp(Math.round((clientX - wr.left - trackLeft) / dayW), 0, DAYS_IN_MONTH);
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
      scheduleRecompute();
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
    const dd = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!dd) return;
    e.preventDefault();
    fn(dd);
    paintWindow(true);
    scheduleRecompute(true); // a discrete keyboard nudge animates the settle
  });
}

// --- Wiring -----------------------------------------------------------

function wireDropzone() {
  const dz = $("dropzone");
  const input = $("csvInput");
  input.addEventListener("change", () => {
    if (input.files && input.files[0]) handleFile(input.files[0]);
    input.value = "";
  });
  ["dragenter", "dragover"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      dz.classList.add("is-dragover");
    })
  );
  ["dragleave", "dragend"].forEach((evt) =>
    dz.addEventListener(evt, () => dz.classList.remove("is-dragover"))
  );
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("is-dragover");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

function wireFavActions() {
  $("replaceFavBtn").addEventListener("click", () => $("csvInput").click());
  $("clearFavBtn").addEventListener("click", clearFavourites);
}

/* Fisher–Yates shuffle, in place; returns the same array for chaining. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* DEBUG: top up the favourites UI with more random shows so the calendar +
 * plan can be exercised without a real edfringe.com export. Picks N slugs the
 * grid doesn't already carry and *appends* them to the working set (never
 * replacing it), then runs the combined list through the normal favourites path
 * — persistence, matching, calendar, plan — exactly as an upload would. */
async function loadDebugRandomShows(count = 10) {
  let index;
  try {
    index = await ensureData();
  } catch (err) {
    console.error("Fringe Planner: failed to load show data for debug set", err);
    return;
  }
  const existing = new Set(state.favSlugs);
  const picks = shuffle([...index.keys()].filter((s) => !existing.has(s))).slice(0, count);
  if (picks.length === 0) return;
  const slugs = [...state.favSlugs, ...picks];
  const savedAt = Date.now();
  const filename = `debug · ${slugs.length} random shows`;
  saveFavourites(slugs, filename, savedAt);
  applyFavourites(slugs, filename, savedAt, { scroll: true, keepForced: true });
}

/* Drop one show from the working set — the row leaves the grid and the change
 * is written straight back to the stored list, so a removed show stays gone on
 * reload. Clearing the last row falls back to the empty-state reset. */
function removeFavourite(slug) {
  const slugs = state.favSlugs.filter((s) => s !== slug);
  if (slugs.length === state.favSlugs.length) return; // nothing removed
  if (slugs.length === 0) {
    clearFavourites();
    return;
  }
  const savedAt = state.savedAt || Date.now();
  saveFavourites(slugs, state.filename, savedAt);
  applyFavourites(slugs, state.filename, savedAt, { scroll: false, keepForced: true, keepWindow: true });
}

// --- Show search: build / top up the grid one show at a time ---------------
//
// One component (#showSearch), two homes: the bottom of the empty intake stage
// and the bottom line of the availability grid. mountSearch() moves the node
// itself between the two slots on the state switch, so the bar looks and
// behaves identically before and after the grid has data. Results render as
// one line per show; the star on the left adds the show to the working
// favourites through the same path an upload takes (applyFavourites), so
// persistence, matching and the live re-plan all follow. The matching/
// filtering itself is pure and lives in ./lib/search.js.

const SEARCH_LIMIT = 30;

const searchUi = {
  active: -1, // index of the keyboard-highlighted row, -1 = none
  results: [],
  total: 0,
  debounce: null,
  // One entry per facet: a Set for the multi-select lists, a string ("" = not
  // set) for the two single-answer ones.
  filters: {
    genre: new Set(),
    subgenre: new Set(),
    accessibility: new Set(),
    age: "",
    price: "",
  },
};

/** Park the search component in the intake stage or under the calendar grid. */
function mountSearch(where) {
  const node = $("showSearch");
  const slot = $(where === "cal" ? "ssSlotCal" : "ssSlotIntake");
  if (!node || !slot || node.parentElement === slot) return;
  // Moving a node drops focus; hand it back so "star one, keep typing" flows on.
  const hadFocus = document.activeElement === $("ssInput");
  slot.appendChild(node);
  if (hadFocus) $("ssInput").focus({ preventScroll: true });
}

/** "AUDIO_DESCRIPTION" → "Audio description". */
function humanizeEnum(v) {
  const s = String(v).replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* The five search facets, each rendered as a chip that drops a panel of
 * options with a grey count of how many shows it would give you.
 *   multi    — a checkbox list (ticking a second box widens the search); the
 *              single-answer ones (age, price) are radios.
 *   values   — the option list, once the catalogue is in.
 *   valuesOf — a show's own value(s) for the facet, when it has a fixed set we
 *              can tally in one pass. Facets without it (the "up to X" caps)
 *              are counted by testing each option with `matches`.
 */
const SEARCH_FACETS = [
  {
    key: "genre",
    id: "Genre",
    multi: true,
    any: "Any genre",
    noun: "genres",
    values: () => [...(state.lookups.genres || [])].sort(),
    valuesOf: (show) => [show.genre].filter(Boolean),
  },
  {
    key: "subgenre",
    id: "Subgenre",
    multi: true,
    any: "Any subgenre",
    noun: "subgenres",
    values: () => [...(state.lookups.subgenres || [])].sort(),
    valuesOf: (show) => show.subgenres || [],
  },
  {
    key: "accessibility",
    id: "Access",
    multi: true,
    any: "Any accessibility",
    noun: "access needs",
    label: humanizeEnum,
    values: () => state.facets.accessibility,
    valuesOf: showAccessibility,
    // The scraper doesn't ship this field yet (see lib/search.js). A control
    // that could only ever match nothing is presented as coming soon rather
    // than left to look broken.
    unavailable: () => state.facets.accessibility.length === 0,
    unavailableHint: "Accessibility data hasn't landed in our catalogue yet — coming soon",
  },
  {
    key: "age",
    id: "Age",
    multi: false,
    any: "Any age limit",
    values: () => ["0", "3", "5", "8", "12", "14", "16"],
    label: (v) => (v === "0" ? "0+ only" : `Up to ${v}+`),
    matches: (show, v) => {
      const age = ageLimitYears(show);
      return age !== null && age <= Number(v);
    },
  },
  {
    key: "price",
    id: "Price",
    multi: false,
    any: "Any price",
    money: true,
    values: () => ["free", "10", "15", "20", "30"],
    label: (v) => (v === "free" ? "Free" : `Up to £${v}`),
    matches: (show, v) =>
      v === "free" ? showPrice(show) === 0 : showPrice(show) !== null && showPrice(show) <= Number(v),
    // Per-show pricing is still to land; "Free" already works off the flag.
    optionUnavailable: (v) => v !== "free" && !state.facets.hasPrice,
    optionUnavailableHint: "Per-show pricing is coming soon — “Free” already works",
  },
];

const facetById = (key) => SEARCH_FACETS.find((f) => f.key === key);

/** Is this facet narrowing the search right now? */
function facetIsSet(facet) {
  const v = searchUi.filters[facet.key];
  return facet.multi ? v.size > 0 : v !== "";
}

/** The chosen value(s) of a facet, as a list. */
function facetChosen(facet) {
  const v = searchUi.filters[facet.key];
  return facet.multi ? [...v] : v ? [v] : [];
}

/** Read the facet state into a lib/search.js-shaped filters object. */
function currentSearchFilters() {
  const f = searchUi.filters;
  const filters = {
    genre: [...f.genre],
    subgenre: [...f.subgenre],
    accessibility: [...f.accessibility],
  };
  if (f.age !== "") filters.maxAge = Number(f.age);
  if (f.price === "free") filters.price = "free";
  else if (f.price !== "") filters.price = Number(f.price);
  return filters;
}

/** The same object with one facet left out — the pool a facet's own option
 *  counts are measured against, so a count answers "how many shows would
 *  ticking this give me". */
function searchFiltersExcept(key) {
  const filters = currentSearchFilters();
  if (key === "age") delete filters.maxAge;
  else if (key === "price") delete filters.price;
  else filters[key] = [];
  return filters;
}

/** How many catalogue shows each of a facet's options would match. */
function facetOptionCounts(facet, values) {
  const pool = filterShows(state.catalogue, searchFiltersExcept(facet.key));
  const counts = new Map(values.map((v) => [v, 0]));
  if (facet.valuesOf) {
    for (const show of pool) {
      for (const v of facet.valuesOf(show)) {
        if (counts.has(v)) counts.set(v, counts.get(v) + 1);
      }
    }
  } else {
    for (const show of pool) {
      for (const v of values) if (facet.matches(show, v)) counts.set(v, counts.get(v) + 1);
    }
  }
  return counts;
}

/** Render one facet's option rows (checkboxes, or radios for the single-answer
 *  facets), each with its grey show count. */
function buildFacetPanel(facet) {
  const wrap = $(`ssf${facet.id}Options`);
  if (!wrap) return;
  const values = facet.values();
  wrap.innerHTML = "";
  if (!values.length) {
    wrap.innerHTML = `<p class="panel-note">${escapeHtml(facet.unavailableHint || "Nothing to filter by yet.")}</p>`;
    return;
  }
  const counts = facetOptionCounts(facet, values);
  const chosen = new Set(facetChosen(facet));
  for (const v of values) {
    const n = counts.get(v) || 0;
    const off = facet.optionUnavailable ? facet.optionUnavailable(v) : false;
    const row = document.createElement("label");
    row.className = "panel-option" + (n === 0 || off ? " is-empty" : "");
    if (off && facet.optionUnavailableHint) row.title = facet.optionUnavailableHint;
    row.innerHTML =
      `<input type="${facet.multi ? "checkbox" : "radio"}" name="ssf-${facet.key}"` +
      ` value="${escapeHtml(v)}"${chosen.has(v) ? " checked" : ""}${off ? " disabled" : ""} />` +
      `<span>${escapeHtml(facet.label ? facet.label(v) : v)}</span>` +
      // An option we can't actually answer for gets an em dash, not a count
      // that would read as a real (and wrong) number of matches.
      (off
        ? '<span class="opt-count" aria-label="no data yet">&mdash;</span>'
        : `<span class="opt-count" aria-label="${n} ${n === 1 ? "show" : "shows"}">${n}</span>`);
    const input = row.querySelector("input");
    input.addEventListener("change", () => {
      if (facet.multi) {
        if (input.checked) searchUi.filters[facet.key].add(v);
        else searchUi.filters[facet.key].delete(v);
      } else {
        // A radio can't be un-picked by clicking it — "everything!" beside the
        // question is the way back to "any".
        searchUi.filters[facet.key] = v;
      }
      onSearchFilterChange();
    });
    wrap.appendChild(row);
  }
}

/** Rebuild every facet panel from scratch (once, when the catalogue lands). */
function buildAllFacetPanels() {
  for (const facet of SEARCH_FACETS) buildFacetPanel(facet);
}

/** Re-count every panel's rows in place. The option lists themselves never
 *  change once the catalogue is in, and rebuilding them would drop focus
 *  mid-click, so only the numbers and the ticks are rewritten. */
function refreshFacetCounts() {
  for (const facet of SEARCH_FACETS) {
    const wrap = $(`ssf${facet.id}Options`);
    if (!wrap) continue;
    const rows = [...wrap.querySelectorAll(".panel-option")];
    if (!rows.length) continue;
    const counts = facetOptionCounts(facet, rows.map((r) => r.querySelector("input").value));
    const chosen = new Set(facetChosen(facet));
    for (const row of rows) {
      const input = row.querySelector("input");
      input.checked = chosen.has(input.value);
      if (input.disabled) continue; // an "— no data yet" row keeps its dash
      const n = counts.get(input.value) || 0;
      const out = row.querySelector(".opt-count");
      out.textContent = String(n);
      out.setAttribute("aria-label", `${n} ${n === 1 ? "show" : "shows"}`);
      row.classList.toggle("is-empty", n === 0);
    }
  }
}

/**
 * Fill the data-driven filter options + the search placeholder once the
 * catalogue is in.
 */
function initSearchUI() {
  const input = $("ssInput");
  if (!input || !state.lookups) return;
  input.placeholder =
    `Search all ${state.catalogue.length.toLocaleString("en-GB")} shows — title, performer or venue`;
  buildAllFacetPanels();
  updateFilterChrome();
}

/** A facet changed: re-count every panel, re-label the chips, search again. */
function onSearchFilterChange() {
  refreshFacetCounts();
  updateFilterChrome();
  runSearch();
}

function setSearchOpen(open) {
  $("ssPop").hidden = !open;
  $("showSearch").classList.toggle("is-open", open);
  $("ssInput").setAttribute("aria-expanded", String(open));
  if (!open) setActiveRow(-1);
}

function runSearch() {
  if (!state.index) return; // catalogue still loading — the input just holds the text
  const query = $("ssInput").value;
  const filters = currentSearchFilters();
  if (query.trim() === "" && !hasActiveFilters(filters)) {
    searchUi.results = [];
    searchUi.total = 0;
    setSearchOpen(false);
    return;
  }
  const { results, total } = searchShows(state.catalogue, query, filters, { limit: SEARCH_LIMIT });
  searchUi.results = results;
  searchUi.total = total;
  renderSearchResults();
}

function renderSearchResults() {
  const list = $("ssResults");
  list.innerHTML = "";
  const favs = new Set(state.favSlugs);
  searchUi.results.forEach((show, i) => {
    list.appendChild(buildSearchRow(show, i, favs.has(show.slug)));
  });
  $("ssEmpty").hidden = searchUi.results.length > 0;
  const foot = $("ssFoot");
  const capped = searchUi.total > searchUi.results.length;
  foot.hidden = !capped;
  if (capped) {
    foot.textContent =
      `Showing ${searchUi.results.length} of ${searchUi.total} matches — keep typing to narrow it down`;
  }
  setActiveRow(-1);
  setSearchOpen(true);
}

function starLabel(title, isOn) {
  return isOn ? `Remove ${title} from your grid` : `Add ${title} to your grid`;
}

function buildSearchRow(show, i, isOn) {
  const li = document.createElement("li");
  li.className = "ss-row" + (isOn ? " is-on" : "");
  li.id = `ssOpt${i}`;
  li.setAttribute("role", "option");
  li.setAttribute("aria-selected", "false");
  li.dataset.slug = show.slug;
  li.dataset.title = show.title;

  const star = document.createElement("button");
  star.type = "button";
  star.className = "ss-star";
  star.textContent = isOn ? "★" : "☆";
  star.setAttribute("aria-label", starLabel(show.title, isOn));

  const title = document.createElement("span");
  title.className = "ss-row-title";
  title.textContent = show.title;

  const meta = document.createElement("span");
  meta.className = "ss-row-meta";
  meta.textContent = [
    show.free ? "Free" : null,
    show.genre,
    show.venueName,
    typicalStartTime(show.performances || []),
  ].filter(Boolean).join(" · ");

  li.append(star, title, meta);
  return li;
}

/** Re-mark every rendered result row against the current favourites, so the
 *  stars always mirror the grid (called on any favourites change). */
function syncSearchStars() {
  const list = $("ssResults");
  if (!list) return;
  const favs = new Set(state.favSlugs);
  for (const row of list.querySelectorAll(".ss-row")) {
    const on = favs.has(row.dataset.slug);
    row.classList.toggle("is-on", on);
    const star = row.querySelector(".ss-star");
    star.textContent = on ? "★" : "☆";
    star.setAttribute("aria-label", starLabel(row.dataset.title, on));
  }
}

/** The star toggle: put the show on the grid (through the same path an upload
 *  takes), or lift it back off. */
function toggleShowOnGrid(slug) {
  if (state.favSlugs.includes(slug)) {
    removeFavourite(slug);
    return;
  }
  const slugs = [...state.favSlugs, slug];
  const savedAt = state.savedAt || Date.now();
  saveFavourites(slugs, state.filename, savedAt);
  applyFavourites(slugs, state.filename, savedAt, { scroll: false, keepForced: true, keepWindow: true });
}

function setActiveRow(i) {
  const rows = [...$("ssResults").querySelectorAll(".ss-row")];
  searchUi.active = i;
  rows.forEach((row, j) => {
    row.classList.toggle("is-active", j === i);
    row.setAttribute("aria-selected", String(j === i));
  });
  const input = $("ssInput");
  if (i >= 0 && rows[i]) {
    input.setAttribute("aria-activedescendant", rows[i].id);
    rows[i].scrollIntoView({ block: "nearest" });
  } else {
    input.removeAttribute("aria-activedescendant");
  }
}

/** Label each chip with its facet's answer, mark the set ones, count them on
 *  the tools button and show/hide the reset. */
function updateFilterChrome() {
  let active = 0;
  for (const facet of SEARCH_FACETS) {
    const chip = document.querySelector(`.filter-chip[data-facet="${facet.key}"]`);
    const value = $(`ssf${facet.id}Value`);
    const chosen = facetChosen(facet);
    const set = chosen.length > 0;
    if (set) active++;
    if (value) {
      const one = (v) => (facet.label ? facet.label(v) : v);
      value.textContent =
        chosen.length === 0
          ? facet.any
          : chosen.length === 1
          ? one(chosen[0])
          : `${chosen.length} ${facet.noun}`;
    }
    if (chip) {
      chip.classList.toggle("is-set", set);
      const off = facet.unavailable ? facet.unavailable() : false;
      chip.classList.toggle("is-disabled", off);
      if (off && facet.unavailableHint) chip.title = facet.unavailableHint;
    }
  }
  const badge = $("ssBadge");
  badge.hidden = active === 0;
  badge.textContent = String(active);
  $("ssReset").hidden = active === 0;
  // A re-labelled chip is a different width, which can re-flow the wrapped
  // chip row under a panel that's still open — so re-fit whatever is open.
  for (const panel of document.querySelectorAll(".chip-panel:not([hidden])")) clampChipPanel(panel);
}

/** Clear every facet back to "any". */
function clearSearchFilters() {
  for (const facet of SEARCH_FACETS) {
    if (facet.multi) searchUi.filters[facet.key].clear();
    else searchUi.filters[facet.key] = "";
  }
}

/* ---- The facet chips' dropdowns ---- */
/** Keep an open panel inside the viewport: the chips wrap and re-flow as their
 *  labels change, so one anchored to its chip's left edge can hang off. */
function clampChipPanel(panel) {
  panel.style.transform = "";
  const rect = panel.getBoundingClientRect();
  const pad = 8;
  let dx = 0;
  if (rect.left < pad) dx = pad - rect.left;
  else if (rect.right > window.innerWidth - pad) dx = window.innerWidth - pad - rect.right;
  if (dx) panel.style.transform = `translateX(${Math.round(dx)}px)`;
}

function closeFacetPanels() {
  for (const panel of document.querySelectorAll(".chip-panel")) panel.hidden = true;
  for (const t of document.querySelectorAll(".chip-trigger")) t.setAttribute("aria-expanded", "false");
}

function wireFacetChips() {
  for (const trigger of document.querySelectorAll(".chip-trigger")) {
    const panel = $(trigger.dataset.panel);
    if (!panel) continue;
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = panel.hidden;
      closeFacetPanels();
      if (!willOpen) return;
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      clampChipPanel(panel);
    });
  }
  // "everything!" — this facet back to "any".
  for (const link of document.querySelectorAll(".panel-everything[data-clear]")) {
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      const facet = facetById(link.dataset.clear);
      if (!facet) return;
      if (facet.multi) searchUi.filters[facet.key].clear();
      else searchUi.filters[facet.key] = "";
      onSearchFilterChange();
    });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".filter-chip")) closeFacetPanels();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeFacetPanels();
  });
}

function wireShowSearch() {
  const root = $("showSearch");
  const input = $("ssInput");
  if (!root || !input) return;

  input.addEventListener("input", () => {
    clearTimeout(searchUi.debounce);
    searchUi.debounce = setTimeout(runSearch, 120);
  });
  // Re-focusing a bar that still holds a query (or live filters) reopens it.
  input.addEventListener("focus", () => {
    if (input.value.trim() !== "" || hasActiveFilters(currentSearchFilters())) runSearch();
  });
  input.addEventListener("keydown", (e) => {
    const n = searchUi.results.length;
    if (e.key === "ArrowDown" && n > 0) {
      e.preventDefault();
      if ($("ssPop").hidden) setSearchOpen(true);
      setActiveRow((searchUi.active + 1) % n);
    } else if (e.key === "ArrowUp" && n > 0) {
      e.preventDefault();
      setActiveRow((searchUi.active - 1 + n) % n);
    } else if (e.key === "Enter" && searchUi.active >= 0 && searchUi.active < n) {
      e.preventDefault();
      toggleShowOnGrid(searchUi.results[searchUi.active].slug);
    } else if (e.key === "Escape" && !$("ssPop").hidden) {
      e.stopPropagation();
      setSearchOpen(false);
    }
  });

  // A row is one target: the star and the line both toggle the show.
  $("ssResults").addEventListener("click", (e) => {
    const row = e.target.closest(".ss-row");
    if (row) toggleShowOnGrid(row.dataset.slug);
  });

  $("ssToolsBtn").addEventListener("click", () => {
    const tools = $("ssTools");
    tools.hidden = !tools.hidden;
    if (tools.hidden) closeFacetPanels();
    $("ssToolsBtn").setAttribute("aria-expanded", String(!tools.hidden));
  });

  wireFacetChips();
  $("ssReset").addEventListener("click", () => {
    clearSearchFilters();
    onSearchFilterChange();
    input.focus({ preventScroll: true });
  });

  // Click-away closes the results overlay (the tools line stays as set).
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) setSearchOpen(false);
  });
}

// Hide the debug menu when the browser's real location is inside the UK. Left
// visible (the default) for overseas testers or when the location is unknown.
function hideDebugInUK() {
  const menu = $("debugMenu");
  if (!menu || !("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (isInUK([pos.coords.latitude, pos.coords.longitude])) menu.hidden = true;
    },
    () => {}, // denied / unavailable — keep the debug tools visible
    { timeout: 8000, maximumAge: 60000 }
  );
}

function wireDebugButton() {
  const menu = $("debugMenu");
  const pill = $("debugPill");
  const pop = $("debugPop");
  if (menu && pill && pop) {
    const setOpen = (open) => {
      pop.hidden = !open;
      pill.setAttribute("aria-expanded", String(open));
    };
    pill.addEventListener("click", () => setOpen(pop.hidden));
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pop.hidden) {
        setOpen(false);
        pill.focus();
      }
    });
    $("debugRandomBtn")?.addEventListener("click", () => {
      loadDebugRandomShows(10);
      setOpen(false);
    });
    $("debugDownloadBtn")?.addEventListener("click", () => {
      downloadDebugState();
      setOpen(false);
    });
  } else {
    $("debugRandomBtn")?.addEventListener("click", () => loadDebugRandomShows(10));
    $("debugDownloadBtn")?.addEventListener("click", () => downloadDebugState());
  }
}

/* Dump the whole live planner state — favourites, every control, and the current
 * plan + diagnostics — to a JSON file, so a bug report can carry an exact,
 * reproducible snapshot. Nothing leaves the browser; it's a normal download. */
function downloadDebugState() {
  const planOptions = gatherPlanOptions();
  delete planOptions.venueCoords; // large + not needed to reproduce a plan
  const snapshot = {
    exportedAt: new Date().toISOString(),
    version: state.version,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    favourites: {
      slugs: state.favSlugs,
      filename: state.filename,
      savedAt: state.savedAt,
      totalFavourites: state.totalFavourites,
      matchedCount: state.matched.length,
      missingSlugs: state.missingSlugs,
    },
    settings: {
      d0: state.d0,
      d1: state.d1,
      dayStartMin: state.dayStartMin,
      dayEndMin: state.dayEndMin,
      effectiveDayEnd: effectiveDayEnd(),
      mealBreaks: state.mealBreaks,
      arrival: state.arrival,
      departure: state.departure,
      mode: state.mode,
      controls: {
        gap: $("ctlGap")?.value,
        max: $("ctlMax")?.value,
        min: $("ctlMin")?.value,
      },
      forced: [...state.forced.entries()],
    },
    planOptions,
    plan: state.schedule
      ? {
          counts: state.schedule.counts,
          forced: state.schedule.forced,
          scheduled: state.schedule.scheduled.map((s) => ({
            slug: s.slug,
            title: s.title,
            date: s.date,
            realDate: s.realDate,
            startTime: s.startTime,
            startMinuteOfDay: s.startMinuteOfDay,
            endMinuteOfDay: s.endMinuteOfDay,
            venueCode: s.venueCode,
            status: s.status,
          })),
          unscheduled: state.schedule.unscheduled,
        }
      : null,
    diagnostics: state.diag
      ? {
          blockedSlugs: [...state.diag.blockedSlugs],
          dayStart: state.diag.dayStart,
          dayEnd: state.diag.dayEnd,
          meals: state.diag.meals,
        }
      : null,
    perf: state.perf,
  };
  downloadText("fringe-plan-debug.json", JSON.stringify(snapshot, null, 2), "application/json");
}

function wireRetry() {
  $("retryBtn").addEventListener("click", () => {
    $("errorState").hidden = true;
    loadData();
    if (state.pendingUpload) {
      const { slugs, filename, savedAt, scroll } = state.pendingUpload;
      applyFavourites(slugs, filename, savedAt, { scroll });
    }
  });
}

function wireCalendarControls() {
  dragDate($("hStart"), (ev) => {
    state.d0 = clamp(dayAt(ev.clientX) + 1, 1, state.d1);
  });
  dragDate($("hEnd"), (ev) => {
    state.d1 = clamp(dayAt(ev.clientX), state.d0, DAYS_IN_MONTH);
  });
  // The two vertical band lines drag the same window edges as the rail flags.
  dragDate($("edgeStart"), (ev) => {
    state.d0 = clamp(dayAt(ev.clientX) + 1, 1, state.d1);
  });
  dragDate($("edgeEnd"), (ev) => {
    state.d1 = clamp(dayAt(ev.clientX), state.d0, DAYS_IN_MONTH);
  });
  dragDate($("railBand"), (ev, s0, s1, startX) => {
    const { dayW } = state.layout;
    const dd = Math.round((ev.clientX - startX) / dayW);
    const len = s1 - s0;
    state.d0 = clamp(s0 + dd, 1, DAYS_IN_MONTH - len);
    state.d1 = state.d0 + len;
  });
  keysDate($("hStart"), (dd) => {
    state.d0 = clamp(state.d0 + dd, 1, state.d1);
  });
  keysDate($("hEnd"), (dd) => {
    state.d1 = clamp(state.d1 + dd, state.d0, DAYS_IN_MONTH);
  });

  // Collapse / expand the grid canvas (schedule stays the focus below).
  $("calCollapseBtn").addEventListener("click", () => {
    const btn = $("calCollapseBtn");
    const collapsed = $("screen2").classList.toggle("is-collapsed");
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.querySelector(".cc-text").textContent = collapsed ? "Show grid" : "Hide grid";
    if (!collapsed) requestAnimationFrame(() => layoutOverlay());
  });

  // Click a show name to pin the whole show into the plan; click a performance
  // mark to pin that exact performance. Both toggle — click again to lift it.
  $("lanes").addEventListener("click", (e) => {
    const lane = e.target.closest(".lane");
    if (!lane) return;
    const slug = lane.dataset.slug;
    if (e.target.closest(".lane-remove")) {
      removeFavourite(slug);
      return;
    }
    const seg = e.target.closest(".seg");
    if (seg) {
      togglePinPerformance(slug, seg.dataset.date, seg.dataset.start);
    } else if (e.target.closest(".lane-label")) {
      togglePinShow(slug);
    }
  });

  window.addEventListener("resize", () => {
    layoutOverlay();
    refresh({ animate: false });
  });
}

// --- "Pick my best dates": place the window where it catches the most shows --

function windowScore(d0, d1) {
  const a = dateStr(d0);
  const b = dateStr(d1);
  let shows = 0;
  let dates = 0;
  for (const show of state.matched) {
    let n = 0;
    for (const p of show.performances || []) {
      if (p.date >= a && p.date <= b && isAvailable(p)) n++;
    }
    if (n > 0) shows++;
    dates += n;
  }
  return { shows, dates };
}

/** Count the weekend days (Sat/Sun) within an inclusive day-of-month range. */
function weekendDays(d0, d1) {
  let n = 0;
  for (let d = d0; d <= d1; d++) if (isWeekend(d)) n++;
  return n;
}

/**
 * Best placement for a fixed-length window. Without "weekends", it maximises
 * shows caught (then catchable dates). With "weekends" on, it first maximises
 * the weekend days the window covers — so the trip lands on the busiest Fringe
 * days — then breaks ties by shows, then dates.
 */
function optimizeDates(days, weekends) {
  const len = clamp(days, 1, DAYS_IN_MONTH);
  let best = null;
  for (let d0 = 1; d0 + len - 1 <= DAYS_IN_MONTH; d0++) {
    const d1 = d0 + len - 1;
    const score = windowScore(d0, d1);
    const cand = { d0, d1, wknd: weekends ? weekendDays(d0, d1) : 0, ...score };
    if (!best) { best = cand; continue; }
    const better = weekends
      ? cand.wknd > best.wknd ||
        (cand.wknd === best.wknd && (cand.shows > best.shows || (cand.shows === best.shows && cand.dates > best.dates)))
      : cand.shows > best.shows || (cand.shows === best.shows && cand.dates > best.dates);
    if (better) best = cand;
  }
  return best;
}

/** The optimizer, folded into the window bar: an "Optimize?" link on the
 *  draggable centre band opens a small popover (day count + weekends toggle). */
function wireWindowOptimizer() {
  const btn = $("railOptBtn");
  const pop = $("railPop");
  if (!btn || !pop) return;

  const setOpen = (open) => {
    btn.setAttribute("aria-expanded", String(open));
    if (!open) { pop.hidden = true; return; }
    $("optDays").value = String(state.d1 - state.d0 + 1);
    pop.hidden = false; // unhide first so we can measure it
    const r = btn.getBoundingClientRect();
    const pw = pop.offsetWidth;
    pop.style.top = `${r.bottom + 6}px`;
    pop.style.left = `${clamp(r.left + r.width / 2 - pw / 2, 8, window.innerWidth - pw - 8)}px`;
  };

  // Keep clicks/drags on the control from starting a window drag or bubbling to
  // the document "click-away" closer.
  btn.addEventListener("pointerdown", (e) => e.stopPropagation());
  pop.addEventListener("pointerdown", (e) => e.stopPropagation());
  pop.addEventListener("click", (e) => e.stopPropagation());
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(pop.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!pop.hidden && e.target !== btn && !pop.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !pop.hidden) { setOpen(false); btn.focus(); }
  });

  $("optApplyBtn").addEventListener("click", () => {
    if (state.matched.length === 0) { setOpen(false); return; }
    const days = clamp(Number($("optDays").value) || 1, 1, DAYS_IN_MONTH);
    const best = optimizeDates(days, $("optWeekends").checked);
    setOpen(false);
    if (!best) return;
    state.d0 = best.d0;
    state.d1 = best.d1;
    paintWindow(true); // glide the window lines to the chosen dates
    refresh();
  });
}

// --- Performance-time tooltip over the day cells ----------------------------

function wireCellTips() {
  const lanes = $("lanes");
  const tip = $("calTip");

  const position = (e) => {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - pad;
    if (y + tip.offsetHeight > window.innerHeight - 8) y = e.clientY - tip.offsetHeight - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  };

  lanes.addEventListener("pointerover", (e) => {
    const cell = e.target.closest(".cell");
    if (!cell || !cell.dataset.tip) {
      tip.hidden = true;
      return;
    }
    tip.textContent = cell.dataset.tip;
    tip.hidden = false;
    position(e);
  });
  lanes.addEventListener("pointermove", (e) => {
    if (!tip.hidden) position(e);
  });
  lanes.addEventListener("pointerleave", () => {
    tip.hidden = true;
  });
  calWrap().addEventListener("scroll", () => {
    tip.hidden = true;
  });
}

// --- Screen 3: the plan ----------------------------------------------------

const SCH_HOUR_PX = 34; // the axis now spans a fixed 09:00–27:00 (18h), so a
                        // shorter hour keeps the whole night on one calm board
const SCH_MIN_BLOCK = 34;
const SCH_HEAD_PX = 46;
const SCH_GUTTER_PX = 52;

const DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function planWindowText() {
  return `${state.d0}–${state.d1} Aug`;
}

function updatePlanWindowLabel() {
  const el = $("planWindowLabel");
  if (el) el.textContent = planWindowText();
}

/** The day-end minute the scheduler and axis use, clamped to the drawable range
 *  (never before 15 min past the day start, never past the 27:00 axis edge). */
function effectiveDayEnd() {
  return clamp(state.dayEndMin, state.dayStartMin + 15, DAY_END_CEIL);
}

function statusSegClass(status) {
  switch ((status || "").toUpperCase()) {
    case "TWO_FOR_ONE": return "seg-2for1";
    case "PREVIEW_SHOW": return "seg-preview";
    case "FREE_TICKETED":
    case "FREE_NON_TICKETED": return "seg-free";
    case "EVENT_SPECIFIC": return "seg-event";
    case "NO_ALLOCATION_CONTACT_VENUE": return "seg-noalloc";
    default: return "seg-avail";
  }
}

/** Read every control + the current window into buildSchedule options. */
function gatherPlanOptions() {
  return {
    // Membership is by festival date so an after-midnight late show counts as
    // the night before (see eligibleSlots); the epoch window is kept as a
    // fallback for any caller that omits the date bounds.
    dateStart: dateStr(state.d0),
    dateEnd: dateStr(state.d1),
    windowStart: `${dateStr(state.d0)}T00:00`,
    windowEnd: `${dateStr(state.d1)}T23:59`,
    minGapDifferentVenue: Number($("ctlGap").value),
    minGapSameVenue: 0,
    maxPerDay: clamp(Number($("ctlMax").value) || 1, 1, 8),
    minPerDay: Number($("ctlMin").value),
    dayStartMin: state.dayStartMin,
    dayEndMin: effectiveDayEnd(),
    mealBreaks: state.mealBreaks.filter((m) => m.enabled).map((m) => ({ startMin: m.startMin, endMin: m.endMin })),
    arrival: state.arrival.enabled ? { date: dateStr(state.d0), endMin: state.arrival.endMin } : null,
    departure: state.departure.enabled ? { date: dateStr(state.d1), startMin: state.departure.startMin } : null,
    forcedSlugs: [...state.forced.keys()],
    forcedPerformances: forcedPerformanceMap(),
    travelMode: state.mode,
    venueCoords: state.venueCoords,
  };
}

/** The must-sees pinned to one exact performance (slug -> slotKey), for the engine. */
function forcedPerformanceMap() {
  const out = {};
  for (const [slug, val] of state.forced) if (typeof val === "string") out[slug] = val;
  return out;
}

/**
 * Pin / unpin a whole show as a must-see (the scheduler picks the performance).
 * Toggling off also clears a specific-performance pin on that show.
 */
function togglePinShow(slug) {
  if (state.forced.has(slug)) state.forced.delete(slug);
  else state.forced.set(slug, true);
  refresh();
}

/**
 * Pin / unpin one exact performance of a show. Pinning replaces any prior pin on
 * that show; clicking the already-pinned performance clears it.
 */
function togglePinPerformance(slug, date, start) {
  const key = slotKey({ date, start });
  if (state.forced.get(slug) === key) state.forced.delete(slug);
  else state.forced.set(slug, key);
  refresh();
}

function renderPlanSummary(schedule) {
  const { scheduledShows, matchedShows, days } = schedule.counts;
  const el = $("planSummary");
  el.innerHTML = "";
  el.classList.toggle("is-planned", scheduledShows > 0);
  if (scheduledShows === 0) {
    el.textContent = "No clash-free plan fits in this window yet — widen your dates or relax the controls.";
    return;
  }
  const strong = document.createElement("b");
  strong.textContent = `${scheduledShows} of ${matchedShows} shows`;
  el.append("Planned ", strong, ` across ${days} day${days === 1 ? "" : "s"} (${planWindowText()}). `);
  const forcedCount = schedule.forced.length;
  const sub = document.createElement("span");
  sub.className = "ps-sub";
  const bits = [];
  if (forcedCount > 0) bits.push(`${forcedCount} forced in`);
  bits.push(`by ${MODE_META[state.mode].verb.replace(/^by /, "")}`);
  sub.textContent = bits.join(" · ");
  el.append(sub);
}

/**
 * The schedule graphic. All scheduled day-columns share one time axis and flex
 * to fit the page width (no day is ever hidden off-screen). Each block carries a
 * genre emoji, a small time, a hover card and a right-click link; travel legs
 * are drawn between shows less than an hour apart; and a draggable overlay holds
 * the day-start / day-end lines and the meal-break bands.
 */
function renderSchedule(schedule, animate = false) {
  const host = $("schedule");
  const empty = $("scheduleEmpty");
  // Snapshot the outgoing board (block positions + which days were shown) before
  // it's wiped, so the diff can play the right transition per block.
  const prev = animate && !prefersReducedMotion() ? snapshotBoard(host) : null;
  host.innerHTML = "";

  if (schedule.days.length === 0) {
    host.hidden = true;
    empty.hidden = false;
    state.schedAxis = null;
    return;
  }
  host.hidden = false;
  empty.hidden = true;

  // Fixed festival axis: every day column runs 09:00 → 27:00 (03:00) so a late
  // show has somewhere to land and the board never looks cramped or shifts as
  // the plan changes. It only ever grows — never shrinks below that span — to
  // hold an unusually early day-start or a show that runs to the small hours.
  const mins = [AXIS_TOP_MIN, state.dayStartMin];
  const maxs = [AXIS_BOTTOM_MIN, effectiveDayEnd()];
  for (const slot of schedule.scheduled) {
    mins.push(slot.startMinuteOfDay);
    maxs.push(slot.endMinuteOfDay);
  }
  for (const m of state.mealBreaks) {
    if (!m.enabled) continue;
    mins.push(m.startMin);
    maxs.push(m.endMin);
  }
  const lo = Math.max(0, Math.min(...mins));
  const hi = Math.max(...maxs);
  const minHour = Math.floor(lo / 60);
  let maxHour = Math.ceil(hi / 60);
  if (maxHour <= minHour) maxHour = minHour + 1;
  const axisTopMin = minHour * 60;
  const axisBottomMin = maxHour * 60;
  const axisH = (maxHour - minHour) * SCH_HOUR_PX;
  state.schedAxis = { axisTopMin, axisBottomMin, hourPx: SCH_HOUR_PX, headPx: SCH_HEAD_PX };
  const y = (min) => ((clamp(min, axisTopMin, axisBottomMin) - axisTopMin) / 60) * SCH_HOUR_PX;

  host.style.setProperty("--sch-hour-h", `${SCH_HOUR_PX}px`);
  host.style.setProperty("--sch-head-h", `${SCH_HEAD_PX}px`);

  // Left hour gutter. Past midnight the labels keep counting (24:00, 25:00, …)
  // so the "same festival night" reads as one continuous evening.
  const gutter = document.createElement("div");
  gutter.className = "sch-gutter";
  const gHead = document.createElement("div");
  gHead.className = "sch-gutter-head";
  const gBody = document.createElement("div");
  gBody.className = "sch-gutter-body";
  gBody.style.height = `${axisH}px`;
  for (let h = minHour; h <= maxHour; h++) {
    const lab = document.createElement("div");
    lab.className = "sch-hour" + (h >= 24 ? " sch-hour--late" : "");
    lab.style.top = `${(h - minHour) * SCH_HOUR_PX}px`;
    lab.textContent = `${pad2(h)}:00`;
    gBody.appendChild(lab);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  // Days to draw: every day that got shows, plus the trip's first/last day so
  // the "getting there" / "getting out" blocks always have a column to live on
  // (an empty boundary day shows just its travel block).
  const renderDays = schedule.days.slice();
  const shownDates = new Set(renderDays.map((d) => d.date));
  const ensureDay = (date) => {
    if (shownDates.has(date)) return;
    shownDates.add(date);
    renderDays.push({ date, slots: [] });
  };
  if (state.arrival.enabled) ensureDay(dateStr(state.d0));
  if (state.departure.enabled) ensureDay(dateStr(state.d1));
  renderDays.sort((a, b) => a.date.localeCompare(b.date));

  // Columns flex to share the width, so on a many-day plan each one gets tight.
  // Flag two breakpoints the CSS uses to shed chrome the block can't afford:
  // narrow drops the tiny start–end time; tiny also drops the genre emoji, so
  // the show title always wins the space.
  const wrapW = ($("scheduleWrap").clientWidth || 800) - SCH_GUTTER_PX;
  const colW = wrapW / Math.max(1, renderDays.length);
  host.classList.toggle("cols-narrow", colW < 78);
  host.classList.toggle("cols-tiny", colW < 56);

  // One column per day; columns flex to share the width.
  for (const day of renderDays) {
    const dayNum = Number(day.date.slice(8, 10));
    const col = document.createElement("div");
    col.className = "sch-day" + (isWeekend(dayNum) ? " wknd" : "");
    col.dataset.date = day.date;

    const head = document.createElement("div");
    head.className = "sch-day-head";
    head.innerHTML =
      `<div class="sch-dow">${DOW_LONG[dow(dayNum)]} <span class="sch-date">${dayNum} Aug</span></div>` +
      `<div class="sch-day-count">${day.slots.length} show${day.slots.length === 1 ? "" : "s"}</div>`;

    const body = document.createElement("div");
    body.className = "sch-body";
    body.style.height = `${axisH}px`;

    // Travel legs between consecutive shows less than an hour apart.
    for (let i = 0; i < day.slots.length - 1; i++) {
      const a = day.slots[i];
      const b = day.slots[i + 1];
      const gapMin = b.startMinuteOfDay - a.endMinuteOfDay;
      if (gapMin < 0 || gapMin >= 60) continue;
      body.appendChild(buildTravelLeg(a, b, y(a.endMinuteOfDay), y(b.startMinuteOfDay)));
    }

    // "Getting there" / "getting out" blocks live inside their own day column
    // (first / last day of the trip window), behind the shows.
    if (state.arrival.enabled && day.date === dateStr(state.d0)) {
      body.appendChild(buildTripBlock("arrival", y, axisH));
    }
    if (state.departure.enabled && day.date === dateStr(state.d1)) {
      body.appendChild(buildTripBlock("departure", y, axisH));
    }

    for (const slot of day.slots) {
      body.appendChild(buildScheduleBlock(slot, y(slot.startMinuteOfDay), y(slot.endMinuteOfDay)));
    }

    col.append(head, body);
    host.appendChild(col);
  }

  // Draggable overlay: day-start / day-end lines + meal bands. The column count
  // lets the day-start line + top zone skip the first (arrival) column and the
  // day-end line + bottom zone skip the last (departure) column, where the trip
  // blocks own the boundary instead.
  host.appendChild(buildScheduleOverlay(axisH, y, renderDays.length));
  populateDecors(host); // fill every emoji scatter now the regions have a size

  // Animate what actually changed since the last board: shows arrive, depart, or
  // fly to a new slot; brand-new day columns ease in.
  if (prev) animateBoardDiff(host, prev);
}

// --- Live re-plan animation ------------------------------------------------
// The board is rebuilt wholesale on every re-plan. To keep a switch believable
// (a different show is a new card arriving, not the old one sliding to a new
// time) we diff against a snapshot of the previous board: same show in a new
// slot → a FLIP move; a new show → an arrival; a dropped show → a ghost that
// fades out where it sat. Skipped entirely while scrubbing the date window (the
// board should track the pointer) and under prefers-reduced-motion.

function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Capture each show block (by slug) with its box relative to the host, plus the
 *  set of day dates on screen — everything animateBoardDiff needs. */
function snapshotBoard(host) {
  const hostRect = host.getBoundingClientRect();
  const blocks = new Map();
  for (const el of host.querySelectorAll(".sch-show")) {
    const r = el.getBoundingClientRect();
    blocks.set(el.dataset.slug, {
      left: r.left - hostRect.left,
      top: r.top - hostRect.top,
      width: r.width,
      height: r.height,
      html: el.outerHTML,
    });
  }
  const days = new Set([...host.querySelectorAll(".sch-day")].map((c) => c.dataset.date));
  return { blocks, days };
}

function animateBoardDiff(host, prev) {
  const hostRect = host.getBoundingClientRect();
  const newDays = new Set(
    [...host.querySelectorAll(".sch-day")].map((c) => c.dataset.date).filter((d) => !prev.days.has(d))
  );
  const seen = new Set();
  let enterIndex = 0;

  for (const el of host.querySelectorAll(".sch-show")) {
    const slug = el.dataset.slug;
    seen.add(slug);
    const before = prev.blocks.get(slug);
    const inNewColumn = newDays.has(el.closest(".sch-day")?.dataset.date);
    if (before) {
      // Same show, possibly rescheduled: fly from where it was to where it is.
      const r = el.getBoundingClientRect();
      const dx = before.left - (r.left - hostRect.left);
      const dy = before.top - (r.top - hostRect.top);
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) flipMove(el, dx, dy);
    } else if (!inNewColumn) {
      // A newly placed show in an existing day: arrive in place. (Shows inside a
      // brand-new column ride that column's entrance instead — no double motion.)
      enterBlock(el, enterIndex++);
    }
  }

  // Whole new day columns ease in.
  for (const col of host.querySelectorAll(".sch-day")) {
    if (newDays.has(col.dataset.date)) col.classList.add("sch-day--enter");
  }

  // Departed shows: float a ghost where they sat and fade it out.
  for (const [slug, info] of prev.blocks) {
    if (seen.has(slug)) continue;
    ghostOut(host, info);
  }
}

/** FLIP: invert to the old position, then release to animate to the new one. */
function flipMove(el, dx, dy) {
  el.style.transition = "none";
  el.style.transform = `translate(${dx}px, ${dy}px)`;
  el.classList.add("sch-show--moving");
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      el.style.transition = "";
      el.style.transform = "";
    })
  );
  el.addEventListener(
    "transitionend",
    () => {
      el.classList.remove("sch-show--moving");
      el.style.transform = "";
      el.style.transition = "";
    },
    { once: true }
  );
}

function enterBlock(el, i) {
  el.style.animationDelay = `${Math.min(i * 26, 180)}ms`;
  el.classList.add("sch-show--enter");
  el.addEventListener(
    "animationend",
    () => {
      el.classList.remove("sch-show--enter");
      el.style.animationDelay = "";
    },
    { once: true }
  );
}

function ghostOut(host, info) {
  const tmp = document.createElement("div");
  tmp.innerHTML = info.html;
  const ghost = tmp.firstElementChild;
  if (!ghost) return;
  ghost.classList.add("sch-ghost");
  ghost.classList.remove("sch-show--enter", "sch-show--moving");
  ghost.style.cssText = `left:${info.left}px;top:${info.top}px;width:${info.width}px;height:${info.height}px`;
  host.appendChild(ghost);
  ghost.addEventListener("animationend", () => ghost.remove(), { once: true });
}

/** One scheduled show block. It's an <a> to the edfringe.com page so a
 *  right-click / middle-click / long-press "open link" works natively; a plain
 *  left-click is intercepted (see wireScheduleInteractions) to lock the show in
 *  instead. A locked (forced) show carries a pushpin. */
function buildScheduleBlock(slot, top, rawBottom) {
  const height = Math.max(SCH_MIN_BLOCK, rawBottom - top);
  const forced = state.forced.has(slot.slug);
  const block = document.createElement("a");
  block.className = "sch-show " + statusSegClass(slot.status) + (forced ? " sch-show--pinned" : "");
  block.href = slot.url;
  block.target = "_blank";
  block.rel = "noopener";
  block.draggable = false;
  block.style.top = `${top}px`;
  block.style.height = `${height}px`;
  block.dataset.slug = slot.slug;

  const timeStr = `${slot.startTime}–${slotEndTime(slot)}`;
  const venue = slot.venueName || slot.venueCode || "";
  // No native title — the rich hover card (fillShowCard) carries all of this, and
  // a title here would double up as a second, parallel tooltip on hover.
  block.innerHTML =
    (forced ? `<span class="sch-pin" aria-hidden="true">🔒</span>` : "") +
    `<span class="sch-emoji" aria-hidden="true">${genreEmoji(slot.genre)}</span>` +
    `<span class="sch-body-text">` +
    `<span class="sch-time">${escapeHtml(timeStr)}</span>` +
    `<span class="sch-name">${escapeHtml(slot.title)}</span>` +
    (venue ? `<span class="sch-venue">${escapeHtml(venue)}</span>` : "") +
    `</span>`;
  return block;
}

/** A narrow travel-leg block in the gap between two shows < 1h apart. */
function buildTravelLeg(a, b, top, bottom) {
  const leg = document.createElement("div");
  leg.className = "sch-leg";
  leg.style.top = `${top}px`;
  leg.style.height = `${Math.max(0, bottom - top)}px`;

  const sameVenue = a.venueCode && b.venueCode && a.venueCode === b.venueCode;
  let text;
  let title;
  if (sameVenue) {
    text = "same venue";
    title = `${a.venueName || "Same venue"} — no travel`;
  } else {
    const km = distanceKm(
      { lat: a.venueLat, lng: a.venueLng },
      { lat: b.venueLat, lng: b.venueLng }
    );
    const mins = travelMinutes(
      { lat: a.venueLat, lng: a.venueLng },
      { lat: b.venueLat, lng: b.venueLng },
      state.mode
    );
    if (km == null || mins == null) {
      text = "nearby";
      title = "Travel time unknown (venue has no coordinates)";
    } else {
      const meta = MODE_META[state.mode];
      text = `${Math.round(mins)} min ${meta.verb.replace(/^by /, "")} · ${km.toFixed(1)} km`;
      title = `${meta.emoji} ${Math.round(mins)} min ${meta.verb} · ${km.toFixed(1)} km from ${a.venueName || "there"} to ${b.venueName || "there"}`;
    }
  }
  leg.title = title;
  leg.innerHTML = `<span class="leg-emoji" aria-hidden="true">${MODE_META[state.mode].emoji}</span><span class="leg-text">${escapeHtml(text)}</span>`;
  return leg;
}

// --- The draggable day-hours / meal-break overlay --------------------------

function buildScheduleOverlay(axisH, y, numCols = 1) {
  const overlay = document.createElement("div");
  overlay.className = "sch-overlay";
  overlay.style.left = `${SCH_GUTTER_PX}px`;
  overlay.style.top = `${SCH_HEAD_PX}px`;
  overlay.style.height = `${axisH}px`;
  overlay.dataset.axisTop = state.schedAxis.axisTopMin;

  const dayEnd = effectiveDayEnd();
  // Skip the boundary column where a trip block already owns the edge: the
  // getting-there block replaces day-start on the first column, getting-out
  // replaces day-end on the last.
  const colPct = numCols > 0 ? 100 / numCols : 0;
  const insetStart = state.arrival.enabled ? colPct : 0;
  const insetEnd = state.departure.enabled ? colPct : 0;

  // Shaded "before day starts" / "after day ends" zones, each with a themed
  // emoji scatter (breakfast up top, night at the bottom).
  const zoneTop = document.createElement("div");
  zoneTop.className = "sch-zone";
  zoneTop.style.top = "0px";
  zoneTop.style.left = `${insetStart}%`;
  zoneTop.style.height = `${y(state.dayStartMin)}px`;
  zoneTop.innerHTML = decorSpan("morning", "daystart");
  const zoneBottom = document.createElement("div");
  zoneBottom.className = "sch-zone";
  zoneBottom.style.top = `${y(dayEnd)}px`;
  zoneBottom.style.right = `${insetEnd}%`;
  zoneBottom.style.height = `${axisH - y(dayEnd)}px`;
  zoneBottom.innerHTML = decorSpan("night", "dayend");
  overlay.append(zoneTop, zoneBottom);

  // Meal-break bands (enabled only).
  for (const meal of state.mealBreaks) {
    if (!meal.enabled) continue;
    overlay.appendChild(buildMealBand(meal, y));
  }

  // Day-start / day-end draggable lines (each skipping its boundary column).
  overlay.appendChild(buildDayLine("start", state.dayStartMin, y, insetStart));
  overlay.appendChild(buildDayLine("end", dayEnd, y, insetEnd));

  return overlay;
}

function buildDayLine(which, min, y, insetPct = 0) {
  const line = document.createElement("div");
  line.className = `sch-dayline sch-dayline--${which}`;
  line.style.top = `${y(min)}px`;
  if (which === "start") line.style.left = `${insetPct}%`;
  else line.style.right = `${insetPct}%`;
  line.dataset.which = which;
  const label = which === "start" ? "Day starts" : "Day ends";
  const clock = which === "end" ? minToDayClock(min) : minToHHMM(min);
  const blocks = (state.diag && (which === "start" ? state.diag.dayStart : state.diag.dayEnd)) || [];
  line.classList.toggle("sch-dayline--blocking", blocks.length > 0);
  const badge = blocks.length
    ? `<span class="dl-blocked" data-excl="${exclData(blocks)}">excludes ${blocks.length} show${blocks.length === 1 ? "" : "s"}</span>`
    : "";
  line.innerHTML =
    `<span class="dl-grip" aria-hidden="true"></span>` +
    `<span class="dl-flag">${label} ${clock}</span>` +
    badge;
  wireDayLineDrag(line, which);
  return line;
}

// Faint emoji scatters drawn behind each "you can't be here" region, themed to
// what that region *is*: food behind meal breaks, breakfast behind the pre-day
// -start zone, night behind the post-day-end zone, and travel behind the
// getting-there / getting-out trip blocks. Each set is deliberately wide so the
// scatter feels varied.
const DECOR_SETS = {
  food: [
    "🍕","🍔","🌭","🥪","🌮","🌯","🍟","🥗","🍣","🍱","🍜","🍝","🍛","🍲","🥘","🍳",
    "🥞","🧇","🥐","🥨","🧀","🍗","🍖","🥩","🍤","🥟","🍢","🍩","🍪","🧁","🍰","🥧",
    "🍦","🍨","🍎","🍓","🍇","🍊","🍌","🥑","🍅","🌶","🥕","🌽","🥦","☕","🍺","🥤","🧋",
  ],
  // Before the day starts — breakfasty / morningy.
  morning: [
    "☕","🍳","🥐","🥞","🧇","🥣","🥛","🍵","🫖","🥯","🥓","🍞","🧈","🍯","🌅","🌄",
    "🌞","⏰","🐓","🍊","🗞️","🥁",
  ],
  // After the day ends — nightly / sleepy.
  night: [
    "🌙","🌛","🌜","⭐","🌟","✨","💤","🛏️","😴","🥱","🌃","🌌","🦉","🕯️","🌠","🍷",
    "🌉","🔭","🧦","🫖",
  ],
  // Getting there / getting out — travel.
  travel: [
    "🧳","✈️","🚆","🚂","🚕","🚌","🚉","🎒","🗺️","🧭","🛫","🛬","🚄","🚏","🛄","⛴️",
    "🚲","🛴","🪧","📸",
  ],
};

/** A decor layer element for a region: `<span>` the fill routine paints into.
 *  `set` names an emoji palette (DECOR_SETS); `seed` keeps two same-set regions
 *  (lunch vs dinner, arrival vs departure) scattering differently. */
function decorSpan(set, seed) {
  return `<span class="sch-decor" data-decor="${set}" data-seed="${seed}" aria-hidden="true"></span>`;
}

// The scatter is laid on a fixed pixel grid (one jittered emoji per cell), not a
// percentage cloud, so it never stretches: a wider region just gains more cells
// at the same density. Positions/emoji are a deterministic hash of the cell
// index + the region's seed, so it stays put across re-plans and a resize only
// *appends* emoji — the ones already on screen don't jump. Cached by seed+set+
// rounded size so re-plans at the same size reuse the string.
const decorCache = new Map();

// ~96px per inch; 5 emoji per square inch → one cell every 96/√5 ≈ 43px.
const DECOR_CELL_PX = 43;

/** A stable 0..1 pseudo-random from three integers (cell x, cell y, salt). */
function decorHash(x, y, salt) {
  let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(salt, 83492791)) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** A small integer seed from a string, so different regions scatter differently. */
function decorSalt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildDecorHTML(w, h, setName, seed) {
  const set = DECOR_SETS[setName] || DECOR_SETS.food;
  const salt = decorSalt(`${seed}:${setName}`);
  const cols = Math.max(1, Math.ceil(w / DECOR_CELL_PX));
  const rows = Math.max(1, Math.ceil(h / DECOR_CELL_PX));
  let html = "";
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const jx = (decorHash(i, j, salt + 1) - 0.5) * DECOR_CELL_PX * 0.8;
      const jy = (decorHash(i, j, salt + 2) - 0.5) * DECOR_CELL_PX * 0.8;
      const cx = i * DECOR_CELL_PX + DECOR_CELL_PX / 2 + jx;
      const cy = j * DECOR_CELL_PX + DECOR_CELL_PX / 2 + jy;
      if (cx < 0 || cx > w || cy < 0 || cy > h) continue;
      const emoji = set[Math.floor(decorHash(i, j, salt + 3) * set.length)];
      const size = (11 + decorHash(i, j, salt + 4) * 13).toFixed(1);
      const rot = Math.round(decorHash(i, j, salt + 5) * 80 - 40);
      const op = (0.55 + decorHash(i, j, salt + 6) * 0.45).toFixed(2);
      html += `<span style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;font-size:${size}px;opacity:${op};transform:translate(-50%,-50%) rotate(${rot}deg)">${emoji}</span>`;
    }
  }
  return html;
}

/** Fill every decor layer on the board once sizes are known (meal bands, the
 *  day-start/day-end zones, the trip blocks). Cached by seed+set+rounded size so
 *  scrubbing the plan doesn't reshuffle the emoji. */
function populateDecors(host) {
  for (const decor of host.querySelectorAll(".sch-decor")) {
    const region = decor.parentElement;
    const w = region.clientWidth || 600;
    const h = region.clientHeight || 34;
    const setName = decor.dataset.decor || "food";
    const seed = decor.dataset.seed || setName;
    const key = `${setName}:${seed}:${Math.round(w / 16)}:${Math.round(h / 16)}`;
    // Skip untouched layers: the same region at the same tile-count keeps its
    // spans (and their in-flight CSS drift). This makes re-tiling on every drag
    // frame a no-op until a region actually crosses a 16px tile boundary.
    if (decor.dataset.decorKey === key) continue;
    decor.dataset.decorKey = key;
    let html = decorCache.get(key);
    if (html == null) {
      html = buildDecorHTML(w, h, setName, seed);
      decorCache.set(key, html);
    }
    decor.innerHTML = html;
  }
}

/** The excluded-show titles, escaped + newline-joined, for a [data-excl] hover
 *  target — the schedule's excludes popup reads them back on pointerover. */
function exclData(list) {
  return escapeHtml(list.map((s) => s.title).join("\n"));
}

/** The inline orange "(excludes N shows)" pill for a meal band's centre label. */
function exclPillHTML(list) {
  if (!list.length) return "";
  return ` <span class="excl-pill" data-excl="${exclData(list)}">(excludes ${list.length} show${list.length === 1 ? "" : "s"})</span>`;
}

function buildMealBand(meal, y) {
  const band = document.createElement("div");
  band.className = "sch-meal";
  band.style.top = `${y(meal.startMin)}px`;
  band.style.height = `${Math.max(6, y(meal.endMin) - y(meal.startMin))}px`;
  band.dataset.meal = meal.id;
  const name = meal.id.charAt(0).toUpperCase() + meal.id.slice(1);
  const blocks = (state.diag && state.diag.meals && state.diag.meals[meal.id]) || [];
  band.classList.toggle("sch-meal--blocking", blocks.length > 0);
  const timeStr = `${minToHHMM(meal.startMin)}–${minToHHMM(meal.endMin)}`;
  // A faint, playful scatter of food emoji — filled in once laid out
  // (populateDecors), so the count matches the band's actual area. The
  // centre label carries the time + meal + an inline "(excludes N shows)" pill
  // (hover it for the list) instead of a separate corner badge.
  band.innerHTML =
    decorSpan("food", meal.id) +
    `<span class="meal-resize meal-resize--top" data-edge="top"></span>` +
    `<span class="meal-label">${timeStr} · 🍽 ${name}${exclPillHTML(blocks)}</span>` +
    `<span class="meal-resize meal-resize--bottom" data-edge="bottom"></span>`;
  wireMealDrag(band, meal);
  return band;
}

/* "Getting there" (top of the first day) / "getting out" (bottom of the last
 * day) block. Rendered inside its own day-column body so it stays on that one
 * day; you drag the inner edge to set how much of the day travel eats. */
function buildTripBlock(which, y, axisH) {
  const block = document.createElement("div");
  block.className = `sch-trip sch-trip--${which}`;
  block.dataset.trip = which;
  if (which === "arrival") {
    block.style.top = "0px";
    block.style.height = `${y(state.arrival.endMin)}px`;
    block.title = "Getting there — drag the lower edge; no shows are placed before this on your first day";
    block.innerHTML =
      decorSpan("travel", "arrival") +
      `<span class="sch-trip-label">🚆 Arrive ${minToHHMM(state.arrival.endMin)}</span>` +
      `<span class="meal-resize meal-resize--bottom" data-edge="bottom"></span>`;
  } else {
    block.style.top = `${y(state.departure.startMin)}px`;
    block.style.height = `${Math.max(6, axisH - y(state.departure.startMin))}px`;
    block.title = "Getting out — drag the upper edge; no shows are placed after this on your last day";
    block.innerHTML =
      decorSpan("travel", "departure") +
      `<span class="meal-resize meal-resize--top" data-edge="top"></span>` +
      `<span class="sch-trip-label">🧳 Leave ${minToDayClock(state.departure.startMin)}</span>`;
  }
  wireTripDrag(block, which, axisH);
  return block;
}

function wireTripDrag(block, which, axisH) {
  const edge = block.querySelector(".meal-resize");
  if (!edge) return;
  edge.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    edge.setPointerCapture(e.pointerId);
    block.classList.add("dragging");
    const axis = state.schedAxis;
    const yy = (min) => ((clamp(min, axis.axisTopMin, axis.axisBottomMin) - axis.axisTopMin) / 60) * axis.hourPx;
    const move = (ev) => {
      const min = minuteFromClientY(ev.clientY);
      if (min == null) return;
      if (which === "arrival") {
        const v = clamp(min, axis.axisTopMin, effectiveDayEnd());
        state.arrival.endMin = v;
        block.style.height = `${yy(v)}px`;
        block.querySelector(".sch-trip-label").textContent = `🚆 Arrive ${minToHHMM(v)}`;
      } else {
        const v = clamp(min, state.dayStartMin, axis.axisBottomMin);
        state.departure.startMin = v;
        block.style.top = `${yy(v)}px`;
        block.style.height = `${Math.max(6, axisH - yy(v))}px`;
        block.querySelector(".sch-trip-label").textContent = `🧳 Leave ${minToDayClock(v)}`;
      }
    };
    const up = () => {
      block.classList.remove("dragging");
      edge.removeEventListener("pointermove", move);
      edge.removeEventListener("pointerup", up);
      refresh();
    };
    edge.addEventListener("pointermove", move);
    edge.addEventListener("pointerup", up);
  });
}

/** Minute-of-day for a clientY over the schedule overlay, snapped to 5 min. */
function minuteFromClientY(clientY) {
  const overlay = $("schedule").querySelector(".sch-overlay");
  if (!overlay || !state.schedAxis) return null;
  const rect = overlay.getBoundingClientRect();
  const rel = clientY - rect.top;
  const raw = state.schedAxis.axisTopMin + (rel / state.schedAxis.hourPx) * 60;
  return Math.round(raw / 5) * 5;
}

/** Live-reposition the overlay's zones/lines/bands during a drag, without a
 *  full re-plan (that happens on pointer release). */
function repositionOverlayLive() {
  const overlay = $("schedule").querySelector(".sch-overlay");
  if (!overlay || !state.schedAxis) return;
  const { axisTopMin, axisBottomMin, hourPx } = state.schedAxis;
  const axisH = ((axisBottomMin - axisTopMin) / 60) * hourPx;
  const y = (min) => ((clamp(min, axisTopMin, axisBottomMin) - axisTopMin) / 60) * hourPx;
  const dayEnd = effectiveDayEnd();

  const zones = overlay.querySelectorAll(".sch-zone");
  if (zones[0]) zones[0].style.height = `${y(state.dayStartMin)}px`;
  if (zones[1]) {
    zones[1].style.top = `${y(dayEnd)}px`;
    zones[1].style.height = `${axisH - y(dayEnd)}px`;
  }
  const startLine = overlay.querySelector(".sch-dayline--start");
  if (startLine) {
    startLine.style.top = `${y(state.dayStartMin)}px`;
    startLine.querySelector(".dl-flag").textContent = `Day starts ${minToHHMM(state.dayStartMin)}`;
  }
  const endLine = overlay.querySelector(".sch-dayline--end");
  if (endLine) {
    endLine.style.top = `${y(dayEnd)}px`;
    endLine.querySelector(".dl-flag").textContent = `Day ends ${minToDayClock(dayEnd)}`;
  }
  for (const meal of state.mealBreaks) {
    if (!meal.enabled) continue;
    const band = overlay.querySelector(`.sch-meal[data-meal="${meal.id}"]`);
    if (!band) continue;
    band.style.top = `${y(meal.startMin)}px`;
    band.style.height = `${Math.max(6, y(meal.endMin) - y(meal.startMin))}px`;
    const name = meal.id.charAt(0).toUpperCase() + meal.id.slice(1);
    band.querySelector(".meal-label").textContent = `${minToHHMM(meal.startMin)}–${minToHHMM(meal.endMin)} · 🍽 ${name}`;
  }

  // Re-tile the emoji scatter live as regions grow/shrink, so a dragged band or
  // day-hours zone fills with emoji while it expands instead of popping in only
  // on drop. The key-guard in populateDecors keeps this a no-op until a region
  // crosses a tile boundary, so the ambient CSS drift keeps flowing between
  // refills — and fresh emoji swim in wherever new space opens up.
  populateDecors($("schedule"));
}

function wireDayLineDrag(line, which) {
  line.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    line.setPointerCapture(e.pointerId);
    line.classList.add("dragging");
    const move = (ev) => {
      const min = minuteFromClientY(ev.clientY);
      if (min == null) return;
      if (which === "start") {
        state.dayStartMin = clamp(min, 0, effectiveDayEnd() - 15);
        syncDayInputs();
      } else {
        state.dayEndMin = clamp(min, state.dayStartMin + 15, DAY_END_CEIL);
        syncDayInputs();
      }
      repositionOverlayLive();
    };
    const up = () => {
      line.classList.remove("dragging");
      line.removeEventListener("pointermove", move);
      line.removeEventListener("pointerup", up);
      refresh();
    };
    line.addEventListener("pointermove", move);
    line.addEventListener("pointerup", up);
  });
}

function wireMealDrag(band, meal) {
  band.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const edge = e.target.closest(".meal-resize")?.dataset.edge || "move";
    band.setPointerCapture(e.pointerId);
    band.classList.add("dragging");
    const startY = e.clientY;
    const s0 = meal.startMin;
    const e0 = meal.endMin;
    const len = e0 - s0;
    const move = (ev) => {
      const min = minuteFromClientY(ev.clientY);
      if (min == null) return;
      if (edge === "top") {
        meal.startMin = clamp(min, 0, meal.endMin - 10);
      } else if (edge === "bottom") {
        meal.endMin = clamp(min, meal.startMin + 10, 1440);
      } else {
        // Move the whole band, keeping its length.
        const deltaMin = Math.round((ev.clientY - startY) / state.schedAxis.hourPx * 60 / 5) * 5;
        let ns = clamp(s0 + deltaMin, 0, 1440 - len);
        meal.startMin = ns;
        meal.endMin = ns + len;
      }
      syncMealInputs(meal);
      repositionOverlayLive();
    };
    const up = () => {
      band.classList.remove("dragging");
      band.removeEventListener("pointermove", move);
      band.removeEventListener("pointerup", up);
      refresh();
    };
    band.addEventListener("pointermove", move);
    band.addEventListener("pointerup", up);
  });
}

// --- The hover card + right-click link over schedule blocks ----------------

function wireScheduleInteractions() {
  const host = $("schedule");
  const card = ensureShowCard();

  const positionCard = (e) => {
    const pad = 16;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + card.offsetWidth > window.innerWidth - 8) x = e.clientX - card.offsetWidth - pad;
    if (y + card.offsetHeight > window.innerHeight - 8) y = window.innerHeight - card.offsetHeight - 8;
    if (y < 8) y = 8;
    card.style.left = x + "px";
    card.style.top = y + "px";
  };

  // The decorative food scatter only shows while the pointer is on the board
  // (and never on touch, where there's no hover — see the CSS). Toggling a class
  // on the host survives the wholesale re-render (innerHTML is replaced, not the
  // element), so the reveal state persists across re-plans.
  host.addEventListener("pointerenter", () => host.classList.add("is-grid-hover"));
  host.addEventListener("pointerleave", () => host.classList.remove("is-grid-hover"));

  host.addEventListener("pointerover", (e) => {
    const block = e.target.closest(".sch-show");
    if (!block) return;
    const slot = findSlot(block.dataset.slug);
    if (!slot) return;
    fillShowCard(card, slot);
    card.hidden = false;
    positionCard(e);
  });
  host.addEventListener("pointermove", (e) => {
    if (!card.hidden && e.target.closest(".sch-show")) positionCard(e);
    else if (!card.hidden && !e.target.closest(".sch-show")) card.hidden = true;
  });
  host.addEventListener("pointerleave", () => {
    card.hidden = true;
  });
  $("scheduleWrap").addEventListener("scroll", () => {
    card.hidden = true;
  });

  // Left-click a scheduled block → lock that exact performance into the plan
  // (click again to unlock). The block is an <a href> to edfringe.com, so a
  // right-click / middle-click still opens the page natively — we only take over
  // the plain primary click here.
  host.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const block = e.target.closest(".sch-show");
    if (!block) return;
    e.preventDefault();
    const slot = findSlot(block.dataset.slug);
    if (!slot) return;
    card.hidden = true;
    togglePinPerformance(slot.slug, slot.realDate, slot.startTime);
  });
}

/**
 * A cursor-following popup listing the shows a day-hours line or meal break
 * excludes. Delegated over the schedule for any [data-excl] target (the day-line
 * badge, the meal band's inline pill) — a nicer, narrower cousin of the show
 * hover card.
 */
function wireExcludePopup() {
  const host = $("schedule");
  let pop = $("exclPop");
  if (!pop) {
    pop = document.createElement("div");
    pop.id = "exclPop";
    pop.className = "excl-pop";
    pop.hidden = true;
    document.body.appendChild(pop);
  }
  const position = (e) => {
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + pop.offsetWidth > window.innerWidth - 8) x = e.clientX - pop.offsetWidth - pad;
    if (y + pop.offsetHeight > window.innerHeight - 8) y = e.clientY - pop.offsetHeight - pad;
    pop.style.left = x + "px";
    pop.style.top = Math.max(8, y) + "px";
  };
  const fill = (pill) => {
    const titles = (pill.dataset.excl || "").split("\n").filter(Boolean);
    const shown = titles.slice(0, 14);
    const more = titles.length - shown.length;
    pop.innerHTML =
      `<div class="excl-pop-head">Excludes ${titles.length} show${titles.length === 1 ? "" : "s"}</div>` +
      `<ul class="excl-pop-list">${shown.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` +
      (more > 0 ? `<div class="excl-pop-more">+${more} more</div>` : "");
  };
  host.addEventListener("pointerover", (e) => {
    const pill = e.target.closest("[data-excl]");
    if (!pill) return;
    fill(pill);
    pop.hidden = false;
    position(e);
  });
  host.addEventListener("pointermove", (e) => {
    if (pop.hidden) return;
    if (e.target.closest("[data-excl]")) position(e);
    else pop.hidden = true;
  });
  host.addEventListener("pointerleave", () => { pop.hidden = true; });
  $("scheduleWrap").addEventListener("scroll", () => { pop.hidden = true; });
}

/** Find a scheduled slot by slug in the current plan. */
function findSlot(slug) {
  if (!state.schedule) return null;
  return state.schedule.scheduled.find((s) => s.slug === slug) || null;
}

function ensureShowCard() {
  let card = $("schedCard");
  if (card) return card;
  card = document.createElement("div");
  card.id = "schedCard";
  card.className = "sch-card";
  card.hidden = true;
  document.body.appendChild(card);
  return card;
}

function fillShowCard(card, slot) {
  // slot.image is already an absolute https url — rehydrateShows() re-attaches the
  // host prefix when it unpacks the catalogue (see § imageUrl).
  const img = slot.image || "";
  const timeStr = `${slot.startTime}–${slotEndTime(slot)}`;
  const venue = [slot.venueName, slot.room].filter(Boolean).join(" · ");
  const blurb = slot.blurb ? escapeHtml(slot.blurb.slice(0, 220)) + (slot.blurb.length > 220 ? "…" : "") : "";
  card.innerHTML =
    (img ? `<div class="card-img"><img src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()" /></div>` : "") +
    `<div class="card-body">` +
    `<div class="card-genre">${genreEmoji(slot.genre)} ${escapeHtml(slot.genre || "Show")}</div>` +
    `<div class="card-title">${escapeHtml(slot.title)}</div>` +
    `<div class="card-meta">${escapeHtml(timeStr)}${venue ? " · " + escapeHtml(venue) : ""}</div>` +
    (blurb ? `<div class="card-blurb">${blurb}</div>` : "") +
    `<div class="card-hint">Click to lock into your plan 🔒 · right-click to open edfringe.com ↗</div>` +
    `</div>`;
}

// --- Plan controls wiring --------------------------------------------------

function syncDayInputs() {
  // Extended clock so a past-midnight day-end reads honestly ("25:00", not "01:00").
  $("ctlDayStart").value = minToDayClock(state.dayStartMin);
  $("ctlDayEnd").value = minToDayClock(state.dayEndMin);
}

/** Parse an "HH:MM" day-clock string to minutes-of-day, allowing the extended
 *  Fringe range (hours up to 27 for a 03:00 finish). Null if malformed. */
function parseDayClock(str) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(str || "");
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 27 || mi > 59) return null;
  return h * 60 + mi;
}
function syncMealInputs(meal) {
  $(`meal${cap(meal.id)}Start`).value = minToHHMM(meal.startMin);
  $(`meal${cap(meal.id)}End`).value = minToHHMM(meal.endMin);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function wirePlanControls() {
  // Numeric / select pacing controls.
  for (const id of ["ctlGap", "ctlMax", "ctlMin"]) {
    $(id).addEventListener("change", refresh);
  }
  $("ctlMax").addEventListener("input", refresh);

  // Day-hours time pickers.
  // Day start/end are HH:MM text boxes: parse + clamp on change; a malformed
  // entry just reverts to the current value (syncDayInputs reformats either way).
  $("ctlDayStart").addEventListener("change", () => {
    const v = parseDayClock($("ctlDayStart").value);
    if (v != null) state.dayStartMin = clamp(v, 0, effectiveDayEnd() - 15);
    syncDayInputs();
    refresh();
  });
  $("ctlDayEnd").addEventListener("change", () => {
    const v = parseDayClock($("ctlDayEnd").value);
    if (v != null) state.dayEndMin = clamp(v, state.dayStartMin + 15, DAY_END_CEIL);
    syncDayInputs();
    refresh();
  });

  // Travel mode segmented control.
  $("ctlMode").addEventListener("click", (e) => {
    const btn = e.target.closest(".tmode-btn");
    if (!btn) return;
    state.mode = btn.dataset.mode;
    for (const b of $("ctlMode").querySelectorAll(".tmode-btn")) {
      const on = b === btn;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    }
    refresh();
  });

  // Meal breaks: toggle + time pickers for each.
  for (const meal of state.mealBreaks) {
    const id = cap(meal.id);
    $(`meal${id}On`).addEventListener("change", (e) => {
      meal.enabled = e.target.checked;
      refresh();
    });
    $(`meal${id}Start`).addEventListener("change", (e) => {
      const v = hhmmToMin(e.target.value);
      if (v != null) meal.startMin = clamp(v, 0, meal.endMin - 5);
      syncMealInputs(meal);
      refresh();
    });
    $(`meal${id}End`).addEventListener("change", (e) => {
      const v = hhmmToMin(e.target.value);
      if (v != null) meal.endMin = clamp(v, meal.startMin + 5, 1440);
      syncMealInputs(meal);
      refresh();
    });
  }

  // "Prevents N" chips: clicking one flashes the shut-out shows on the grid.
  for (const c of BLOCK_CONTROLS) {
    $(c.id)?.addEventListener("click", () => flashBlockedLanes((state.diag && c.pick(state.diag)) || []));
  }
}

// --- Downloads (CSV / ICS), built in the browser ---------------------------

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function wireExports() {
  $("downloadCsvBtn").addEventListener("click", () => {
    if (!state.schedule || state.schedule.scheduled.length === 0) return;
    downloadText("fringe-itinerary.csv", "﻿" + toCsv(state.schedule.scheduled), "text/csv;charset=utf-8");
  });
  $("importIcsBtn").addEventListener("click", () => {
    if (!state.schedule || state.schedule.scheduled.length === 0) return;
    downloadText("fringe-plan.ics", toIcs(state.schedule.scheduled, { now: new Date() }), "text/calendar;charset=utf-8");
  });
}

// --- Version + reschedule-timing pill --------------------------------------

/** Fetch the app version (single-sourced from package.json) for the pill. */
async function loadVersion() {
  try {
    const res = await fetch(APP_VERSION_URL);
    if (res.ok) {
      const pkg = await res.json();
      if (pkg && typeof pkg.version === "string") state.version = pkg.version;
    }
  } catch (err) {
    console.warn("Fringe Planner: couldn't read app version", err);
  }
  renderPerfPill();
}

/** Fold one reschedule (buildSchedule) duration into the rolling stats. */
function recordResched(ms) {
  const p = state.perf;
  p.count++;
  p.sum += ms;
  p.last = ms;
  p.min = Math.min(p.min, ms);
  p.max = Math.max(p.max, ms);
  renderPerfPill();
}

function fmtMs(ms) {
  if (ms >= 100) return `${Math.round(ms)} ms`;
  if (ms >= 10) return `${ms.toFixed(1)} ms`;
  return `${ms.toFixed(2)} ms`;
}

function renderPerfPill() {
  const pill = $("debugPill");
  if (pill) pill.textContent = state.version ? `debug v${state.version}` : "debug";

  const stat = $("perfStat");
  if (!stat) return;
  const p = state.perf;
  if (p.count === 0) {
    stat.textContent = "Avg replanning time: —";
    stat.title = "Timing appears after the first plan";
    return;
  }
  const avg = p.sum / p.count;
  stat.textContent = `Avg replanning time: ${fmtMs(avg)}`;
  stat.title =
    `Reschedule computation (buildSchedule)\n` +
    `avg ${fmtMs(avg)} · last ${fmtMs(p.last)} · min ${fmtMs(p.min)} · max ${fmtMs(p.max)}\n` +
    `over ${p.count} run${p.count === 1 ? "" : "s"} this session`;
}

// --- Go ---------------------------------------------------------------

wireDropzone();
wireFavActions();
wireShowSearch();
wireDebugButton();
hideDebugInUK();
wireRetry();
wireCalendarControls();
wireWindowOptimizer();
wireCellTips();
wireScheduleInteractions();
wireExcludePopup();
wirePlanControls();
wireExports();

renderPerfPill(); // paint the version placeholder immediately
loadVersion();
loadData();
