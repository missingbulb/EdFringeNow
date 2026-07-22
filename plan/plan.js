// Fringe Planner — page logic.
//
// Self-contained ES module: no globals shared with the home site's js/app.js.
// Wires the pure computation engine (./lib/*.js) to the UI.
//
// The page has one state switch, keyed on whether a favourites set is in:
// without one, the intake panel (drag/drop or pick a favourites CSV, or load
// the bundled sample) is all there is; with one, the availability calendar +
// the instant plan replace it. There is no "Plan" button — the itinerary
// recomputes live whenever the date window or any control changes.

import { parseFavourites, urlFromSlug } from "./lib/favourites.js";
import { buildIndex, matchFavourites, summarize, buildSchedule } from "./lib/engine.js";
import { isAvailable } from "./lib/availability.js";
import { toCsv, toIcs, slotEndTime } from "./lib/itinerary.js";
import { distanceKm, travelMinutes } from "./lib/travel.js";

// ES modules are always strict mode, so no "use strict" directive is needed.

// --- Constants --------------------------------------------------------

const DATA_URL = "../data/normalized/shows.json";
const VENUES_URL = "../data/venues.json";
const SAMPLE_URL = "./sample-favourites.csv";

const YEAR = 2026;
const MONTH = "08"; // August, 2-digit
const DAYS_IN_MONTH = 31; // Aug 1–31 is the axis this calendar draws.
const FEST_START_DAY = 7; // The Fringe runs Fri 7 – Sun 31 Aug 2026; days 1–6 draw as a shaded "before it opens" zone.

const T_MIN = 0; // 00:00 — the calendar's catchable-count filter never narrows on start time.
const T_MAX = 1440; // 24:00

const DEFAULT_D0 = 7; // default date window: Aug 7 → Aug 24 (the festival trip window)
const DEFAULT_D1 = 24;

// Default day-hours window (minutes of day) and meal breaks. Day end 1439 is the
// time input's "23:59"; it means "midnight / no cap" (see effectiveDayEnd).
const DEFAULT_DAY_START = 9 * 60; // 09:00
const DEFAULT_DAY_END = 23 * 60 + 59; // 23:59 → treated as end-of-day

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
  venueCoords: null, // { [venueCode]: {lat, lng} }
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
  mode: "walk",
  forced: new Set(), // slugs the user right-clicked to force into the plan
  // Populated once per upload by buildCalendar():
  laneRefs: [], // [{ slug, el, statusEl }] in display (sorted) order
  layout: { trackLeft: 0, trackWidth: 0, dayW: 0 },
  dayHeaderBuilt: false,
  // The latest plan.
  schedule: null,
  scheduledSlugs: new Set(),
  schedAxis: null, // { axisTopMin, axisBottomMin, hourPx, headPx } for overlay dragging
};

// --- Data loading -----------------------------------------------------

let dataPromise = null;

function loadData() {
  dataPromise = (async () => {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
    const shows = await res.json();
    state.index = buildIndex(shows);
    loadVenues(); // fire-and-forget; travel legs/gaps degrade gracefully without it
    restoreStoredFavourites();
    return state.index;
  })();
  dataPromise.catch(() => {});
  return dataPromise;
}

/** Load venue coordinates for travel-time estimates. Best-effort: if it fails,
 *  the planner falls back to the flat different-venue gap and hides distances. */
async function loadVenues() {
  try {
    const res = await fetch(VENUES_URL);
    if (!res.ok) return;
    const data = await res.json();
    state.venueCoords = data.venues || data || null;
    // A plan built before the venues landed re-plans now that travel is known.
    if (state.matched.length > 0) refresh();
  } catch (err) {
    console.warn("Fringe Planner: couldn't load venue coordinates", err);
  }
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
  state.totalFavourites = 0;
  state.matched = [];
  state.missingSlugs = [];
  state.filename = "";
  state.savedAt = null;
  state.forced = new Set();

  const summaryEl = $("uploadSummary");
  summaryEl.hidden = true;
  summaryEl.classList.remove("is-partial");
  $("missingList").hidden = true;
  $("missingList").innerHTML = "";
  $("screen2").hidden = true;
  $("screen3").hidden = true;
  state.schedule = null;
  state.scheduledSlugs = new Set();
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

async function applyFavourites(slugs, filename, savedAt, { scroll = false } = {}) {
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

  state.totalFavourites = slugs.length;
  state.matched = matched;
  state.missingSlugs = missingSlugs;
  state.filename = filename;
  state.savedAt = savedAt;
  state.forced = new Set(); // a fresh set clears any must-sees

  if (matched.length > 0) {
    state.d0 = DEFAULT_D0;
    state.d1 = DEFAULT_D1;
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
    label.title = `${show.title} · usually ${typicalStartTime(show.performances)} · right-click to force into the plan`;
    label.innerHTML =
      `<span class="lane-pin" aria-hidden="true" title="Forced into the plan">📌</span>` +
      `<span class="lane-title">${escapeHtml(show.title)}</span>`;

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
 */
function refresh() {
  if (state.matched.length === 0) return;
  const filter = currentFilter();
  const summ = summarize(state.matched, filter, state.totalFavourites);

  const schedule = buildSchedule(state.matched, gatherPlanOptions());
  state.schedule = schedule;
  state.scheduledSlugs = new Set(schedule.scheduled.map((s) => s.slug));

  const bySlug = new Map(summ.shows.map((s) => [s.slug, s]));
  applyVerdicts(bySlug, filter);
  updateHero(summ.counts, schedule.counts);
  updatePlanWindowLabel();

  renderPlanSummary(schedule);
  renderSchedule(schedule);
  const hasShows = schedule.scheduled.length > 0;
  $("downloadCsvBtn").disabled = !hasShows;
  $("importIcsBtn").disabled = !hasShows;
}

/**
 * Update each lane's state and right-hand verdict. Three states now:
 *   - scheduled: this show made the plan (green "In plan")
 *   - in window: catchable in the date window but not placed (muted)
 *   - out: nothing catchable in the window (the whole lane dims)
 * A forced (must-see) lane carries a pin.
 */
function applyVerdicts(bySlug, filter) {
  for (const ref of state.laneRefs) {
    const show = bySlug.get(ref.slug);
    if (!show) continue;
    const { catchable, count } = laneVerdict(show.performances, filter);
    const scheduled = state.scheduledSlugs.has(ref.slug);
    const forced = state.forced.has(ref.slug);

    ref.el.classList.toggle("lane--out", !catchable);
    ref.el.classList.toggle("lane--scheduled", scheduled);
    ref.el.classList.toggle("lane--forced", forced);

    if (scheduled) {
      ref.statusEl.innerHTML = `<span class="st-plan" title="in your plan">&check;&nbsp;In plan</span>`;
    } else if (catchable) {
      ref.statusEl.innerHTML = `<span class="st-in" title="${count} catchable date${count === 1 ? "" : "s"} — not placed">In window</span>`;
    } else {
      ref.statusEl.innerHTML = `<span class="st-no" title="nothing catchable in your window">&ndash;</span>`;
    }
  }
}

function laneVerdict(performances, filter) {
  const availableInRange = performances.filter(
    (p) => p.available && p.date >= filter.dateStart && p.date <= filter.dateEnd
  );
  return availableInRange.length > 0
    ? { catchable: true, count: availableInRange.length }
    : { catchable: false, count: 0 };
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
let recomputeScheduled = false;
function scheduleRecompute() {
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  requestAnimationFrame(() => {
    recomputeScheduled = false;
    refresh();
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

function paintWindow() {
  const { trackLeft, trackWidth, dayW } = state.layout;
  const x0 = (state.d0 - 1) * dayW;
  const x1 = state.d1 * dayW;
  $("dimL").style.left = "0";
  $("dimL").style.width = x0 + "px";
  $("dimR").style.left = x1 + "px";
  $("dimR").style.width = Math.max(0, trackWidth - x1) + "px";
  $("band").style.left = x0 + "px";
  $("band").style.width = (x1 - x0) + "px";
  $("hStart").style.left = (trackLeft + x0) + "px";
  $("hEnd").style.left = (trackLeft + x1) + "px";
  $("railBand").style.left = (trackLeft + x0) + "px";
  $("railBand").style.width = (x1 - x0) + "px";
  $("flagStart").textContent = `${state.d0} Aug`;
  $("flagEnd").textContent = `${state.d1} Aug`;
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
    const startX = e.clientX;
    const s0 = state.d0;
    const s1 = state.d1;
    const move = (ev) => {
      apply(ev, s0, s1, startX);
      paintWindow();
      scheduleRecompute();
    };
    const up = () => {
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
    paintWindow();
    scheduleRecompute();
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

function wireSampleLink() {
  $("sampleLink").addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      processFavouritesText(text, "sample-favourites.csv");
    } catch (err) {
      console.error("Fringe Planner: failed to load sample favourites", err);
      alert("Couldn't load the sample favourites — please try uploading a file instead.");
    }
  });
}

function wireFavActions() {
  $("replaceFavBtn").addEventListener("click", () => $("csvInput").click());
  $("clearFavBtn").addEventListener("click", clearFavourites);
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

  // Right-click a lane to force that show into the plan (or lift it out).
  $("lanes").addEventListener("contextmenu", (e) => {
    const lane = e.target.closest(".lane");
    if (!lane) return;
    e.preventDefault();
    const slug = lane.dataset.slug;
    const forced = state.forced.has(slug);
    const show = state.index && state.index.get(slug);
    showContextMenu(e.clientX, e.clientY, [
      {
        label: forced ? "📌 Lift from must-sees" : "📌 Force into plan",
        onClick: () => {
          if (forced) state.forced.delete(slug);
          else state.forced.add(slug);
          refresh();
        },
      },
      { label: "Open on edfringe.com ↗", onClick: () => window.open(urlFromSlug(slug), "_blank", "noopener") },
    ], show ? show.title : slug);
  });

  window.addEventListener("resize", () => {
    layoutOverlay();
    refresh();
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

function bestWindow(candidates) {
  let best = null;
  for (const c of candidates) {
    const score = windowScore(c.d0, c.d1);
    if (!best || score.shows > best.shows || (score.shows === best.shows && score.dates > best.dates)) {
      best = { ...c, ...score };
    }
  }
  return best;
}

function wireOptimizer() {
  $("optimizeBtn").addEventListener("click", () => {
    if (state.matched.length === 0) return;
    const value = $("stayLen").value;
    const candidates = [];
    if (value === "wknd") {
      for (let d = 1; d < DAYS_IN_MONTH; d++) {
        if (dow(d) === 6) candidates.push({ d0: d, d1: d + 1 });
      }
    } else {
      const len = Number(value);
      for (let d0 = 1; d0 + len - 1 <= DAYS_IN_MONTH; d0++) {
        candidates.push({ d0, d1: d0 + len - 1 });
      }
    }
    const best = bestWindow(candidates);
    if (!best) return;
    state.d0 = best.d0;
    state.d1 = best.d1;
    paintWindow();
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

const SCH_HOUR_PX = 46;
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

/** Day end 23:59 (1439) is the input's "no cap" sentinel → treat as midnight. */
function effectiveDayEnd() {
  return state.dayEndMin >= 1439 ? 1440 : state.dayEndMin;
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
    windowStart: `${dateStr(state.d0)}T00:00`,
    windowEnd: `${dateStr(state.d1)}T23:59`,
    minGapDifferentVenue: Number($("ctlGap").value),
    minGapSameVenue: 0,
    maxPerDay: clamp(Number($("ctlMax").value) || 1, 1, 8),
    minPerDay: Number($("ctlMin").value),
    dayStartMin: state.dayStartMin,
    dayEndMin: effectiveDayEnd(),
    mealBreaks: state.mealBreaks.filter((m) => m.enabled).map((m) => ({ startMin: m.startMin, endMin: m.endMin })),
    forcedSlugs: [...state.forced],
    travelMode: state.mode,
    venueCoords: state.venueCoords,
  };
}

function renderPlanSummary(schedule) {
  const { scheduledShows, matchedShows, days } = schedule.counts;
  const el = $("planSummary");
  el.innerHTML = "";
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
function renderSchedule(schedule) {
  const host = $("schedule");
  const empty = $("scheduleEmpty");
  host.innerHTML = "";

  if (schedule.days.length === 0) {
    host.hidden = true;
    empty.hidden = false;
    state.schedAxis = null;
    return;
  }
  host.hidden = false;
  empty.hidden = true;

  // Shared axis: span the scheduled shows, the day-hours window and the meal
  // breaks, padded 30 min so the boundary lines always have a visible margin.
  const mins = [state.dayStartMin, effectiveDayEnd()];
  const maxs = [state.dayStartMin, effectiveDayEnd()];
  for (const slot of schedule.scheduled) {
    mins.push(slot.startMinuteOfDay);
    maxs.push(slot.endMinuteOfDay);
  }
  for (const m of state.mealBreaks) {
    if (!m.enabled) continue;
    mins.push(m.startMin);
    maxs.push(m.endMin);
  }
  const lo = Math.max(0, Math.min(...mins) - 30);
  const hi = Math.min(1440, Math.max(...maxs) + 30);
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

  // Left hour gutter.
  const gutter = document.createElement("div");
  gutter.className = "sch-gutter";
  const gHead = document.createElement("div");
  gHead.className = "sch-gutter-head";
  const gBody = document.createElement("div");
  gBody.className = "sch-gutter-body";
  gBody.style.height = `${axisH}px`;
  for (let h = minHour; h <= maxHour; h++) {
    const lab = document.createElement("div");
    lab.className = "sch-hour";
    lab.style.top = `${(h - minHour) * SCH_HOUR_PX}px`;
    lab.textContent = `${pad2(h % 24)}:00`;
    gBody.appendChild(lab);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  // One column per day; columns flex to share the width.
  for (const day of schedule.days) {
    const dayNum = Number(day.date.slice(8, 10));
    const col = document.createElement("div");
    col.className = "sch-day" + (isWeekend(dayNum) ? " wknd" : "");

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

    for (const slot of day.slots) {
      body.appendChild(buildScheduleBlock(slot, y(slot.startMinuteOfDay), y(slot.endMinuteOfDay)));
    }

    col.append(head, body);
    host.appendChild(col);
  }

  // Draggable overlay: day-start / day-end lines + meal bands.
  host.appendChild(buildScheduleOverlay(axisH, y));
}

/** One scheduled show block. */
function buildScheduleBlock(slot, top, rawBottom) {
  const height = Math.max(SCH_MIN_BLOCK, rawBottom - top);
  const block = document.createElement("div");
  block.className = "sch-show " + statusSegClass(slot.status);
  block.style.top = `${top}px`;
  block.style.height = `${height}px`;
  block.dataset.slug = slot.slug;

  const timeStr = `${slot.startTime}–${slotEndTime(slot)}`;
  const venue = slot.venueName || slot.venueCode || "";
  block.title = `${slot.title}\n${timeStr}${venue ? " · " + venue : ""}`;
  block.innerHTML =
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

function buildScheduleOverlay(axisH, y) {
  const overlay = document.createElement("div");
  overlay.className = "sch-overlay";
  overlay.style.left = `${SCH_GUTTER_PX}px`;
  overlay.style.top = `${SCH_HEAD_PX}px`;
  overlay.style.height = `${axisH}px`;
  overlay.dataset.axisTop = state.schedAxis.axisTopMin;

  const dayEnd = effectiveDayEnd();

  // Shaded "before day starts" / "after day ends" zones.
  const zoneTop = document.createElement("div");
  zoneTop.className = "sch-zone";
  zoneTop.style.top = "0px";
  zoneTop.style.height = `${y(state.dayStartMin)}px`;
  const zoneBottom = document.createElement("div");
  zoneBottom.className = "sch-zone";
  zoneBottom.style.top = `${y(dayEnd)}px`;
  zoneBottom.style.height = `${axisH - y(dayEnd)}px`;
  overlay.append(zoneTop, zoneBottom);

  // Meal-break bands (enabled only).
  for (const meal of state.mealBreaks) {
    if (!meal.enabled) continue;
    overlay.appendChild(buildMealBand(meal, y));
  }

  // Day-start / day-end draggable lines.
  overlay.appendChild(buildDayLine("start", state.dayStartMin, y));
  overlay.appendChild(buildDayLine("end", dayEnd, y));

  return overlay;
}

function buildDayLine(which, min, y) {
  const line = document.createElement("div");
  line.className = `sch-dayline sch-dayline--${which}`;
  line.style.top = `${y(min)}px`;
  line.dataset.which = which;
  const label = which === "start" ? "Day starts" : "Day ends";
  line.innerHTML =
    `<span class="dl-grip" aria-hidden="true"></span>` +
    `<span class="dl-flag">${label} ${minToHHMM(min)}</span>`;
  wireDayLineDrag(line, which);
  return line;
}

function buildMealBand(meal, y) {
  const band = document.createElement("div");
  band.className = "sch-meal";
  band.style.top = `${y(meal.startMin)}px`;
  band.style.height = `${Math.max(6, y(meal.endMin) - y(meal.startMin))}px`;
  band.dataset.meal = meal.id;
  const name = meal.id.charAt(0).toUpperCase() + meal.id.slice(1);
  band.innerHTML =
    `<span class="meal-resize meal-resize--top" data-edge="top"></span>` +
    `<span class="meal-label">🍽 ${name} ${minToHHMM(meal.startMin)}–${minToHHMM(meal.endMin)}</span>` +
    `<span class="meal-resize meal-resize--bottom" data-edge="bottom"></span>`;
  wireMealDrag(band, meal);
  return band;
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
    endLine.querySelector(".dl-flag").textContent = `Day ends ${minToHHMM(state.dayEndMin)}`;
  }
  for (const meal of state.mealBreaks) {
    if (!meal.enabled) continue;
    const band = overlay.querySelector(`.sch-meal[data-meal="${meal.id}"]`);
    if (!band) continue;
    band.style.top = `${y(meal.startMin)}px`;
    band.style.height = `${Math.max(6, y(meal.endMin) - y(meal.startMin))}px`;
    const name = meal.id.charAt(0).toUpperCase() + meal.id.slice(1);
    band.querySelector(".meal-label").textContent = `🍽 ${name} ${minToHHMM(meal.startMin)}–${minToHHMM(meal.endMin)}`;
  }
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
        const v = clamp(min, state.dayStartMin + 15, 1440);
        state.dayEndMin = v >= 1440 ? 1439 : v;
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

  // Right-click a scheduled block → open its edfringe page (via a small menu,
  // so it isn't swallowed by a pop-up blocker).
  host.addEventListener("contextmenu", (e) => {
    const block = e.target.closest(".sch-show");
    if (!block) return;
    e.preventDefault();
    const slot = findSlot(block.dataset.slug);
    if (!slot) return;
    card.hidden = true;
    showContextMenu(e.clientX, e.clientY, [
      { label: "Open on edfringe.com ↗", onClick: () => window.open(slot.url, "_blank", "noopener") },
    ], slot.title);
  });
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

/** Upgrade the edfringe image host to https so it isn't blocked as mixed content. */
function httpsImage(url) {
  return url ? url.replace(/^http:\/\//i, "https://") : "";
}

function fillShowCard(card, slot) {
  const img = httpsImage(slot.image);
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
    `<div class="card-hint">Right-click for the edfringe.com page ↗</div>` +
    `</div>`;
}

// --- A tiny reusable context menu ------------------------------------------

let ctxMenuEl = null;
function showContextMenu(x, y, items, headerText) {
  hideContextMenu();
  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  if (headerText) {
    const h = document.createElement("div");
    h.className = "ctx-head";
    h.textContent = headerText;
    menu.appendChild(h);
  }
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-item";
    btn.textContent = item.label;
    btn.addEventListener("click", () => {
      hideContextMenu();
      item.onClick();
    });
    menu.appendChild(btn);
  }
  menu.style.left = "0px";
  menu.style.top = "0px";
  document.body.appendChild(menu);
  // Flip so the menu stays on-screen.
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  menu.style.left = Math.min(x, window.innerWidth - w - 8) + "px";
  menu.style.top = Math.min(y, window.innerHeight - h - 8) + "px";
  ctxMenuEl = menu;
  setTimeout(() => {
    document.addEventListener("pointerdown", onDocPointerForMenu, true);
    document.addEventListener("keydown", onEscForMenu, true);
  }, 0);
}
function onDocPointerForMenu(e) {
  if (ctxMenuEl && !ctxMenuEl.contains(e.target)) hideContextMenu();
}
function onEscForMenu(e) {
  if (e.key === "Escape") hideContextMenu();
}
function hideContextMenu() {
  if (!ctxMenuEl) return;
  ctxMenuEl.remove();
  ctxMenuEl = null;
  document.removeEventListener("pointerdown", onDocPointerForMenu, true);
  document.removeEventListener("keydown", onEscForMenu, true);
}

// --- Plan controls wiring --------------------------------------------------

function syncDayInputs() {
  $("ctlDayStart").value = minToHHMM(state.dayStartMin);
  $("ctlDayEnd").value = minToHHMM(state.dayEndMin);
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
  $("ctlDayStart").addEventListener("change", () => {
    const v = hhmmToMin($("ctlDayStart").value);
    if (v == null) return;
    state.dayStartMin = clamp(v, 0, effectiveDayEnd() - 15);
    syncDayInputs();
    refresh();
  });
  $("ctlDayEnd").addEventListener("change", () => {
    const v = hhmmToMin($("ctlDayEnd").value);
    if (v == null) return;
    state.dayEndMin = clamp(v, state.dayStartMin + 15, 1439);
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

// --- Go ---------------------------------------------------------------

wireDropzone();
wireSampleLink();
wireFavActions();
wireRetry();
wireCalendarControls();
wireOptimizer();
wireCellTips();
wireScheduleInteractions();
wirePlanControls();
wireExports();

loadData();
