// Fringe Planner — page logic.
//
// Self-contained ES module: no globals shared with the home site's js/app.js.
// Wires the real computation engine (./lib/engine.js, ./lib/favourites.js —
// pure, untouched here) to the UI described in
// plan/design/mock.html + plan/design/DESIGN_NOTES.md.
//
// The page has one state switch, keyed on whether a favourites set is in:
// without one, the intake panel (drag/drop or pick a favourites CSV, or load
// the bundled sample) is all there is; with one, the availability calendar
// replaces it — one lane per matched favourite across August 2026, a
// draggable date window filtering live via engine.summarize(), and quiet
// replace/clear actions on the calendar's favourites line.

import { parseFavourites, urlFromSlug } from "./lib/favourites.js";
import { buildIndex, matchFavourites, summarize, buildSchedule } from "./lib/engine.js";
import { isAvailable } from "./lib/availability.js";
import { toCsv, toIcs, slotEndTime } from "./lib/itinerary.js";

// ES modules are always strict mode, so no "use strict" directive is needed.

// --- Constants --------------------------------------------------------

const DATA_URL = "../data/normalized/shows.json";
const SAMPLE_URL = "./sample-favourites.csv";

const YEAR = 2026;
const MONTH = "08"; // August, 2-digit
const DAYS_IN_MONTH = 31; // Aug 1–31 is the axis this calendar draws.
// TODO: the underlying data actually spans 2026-07-24 through 2026-08-31
// (previews before Aug 1, and a handful of performances after Aug 31 do not
// occur — the latest date in the dataset is Aug 31 itself). Performances
// outside the Aug 1–31 axis simply fall off the calendar; this is expected
// per the spec and rare in practice (previews are the main case).
const FEST_END_DAY = 25; // Core run ends Mon 25 Aug; 26–31 draws as a shaded "after" zone.

// The whole calendar day — the engine's summarize() still takes a start-time
// window, but the planner no longer exposes a start-time selector (it wasn't a
// useful whole-stack filter), so we always pass the full day and never filter
// on start time. Only the date window narrows the catchable set now.
const T_MIN = 0; // 00:00
const T_MAX = 1440; // 24:00

const DEFAULT_D0 = 7; // default date window: Aug 7 → Aug 24 (the festival trip window)
const DEFAULT_D1 = 24;

// Persist the uploaded favourites (as the raw slug list) in this browser so a
// returning visitor doesn't have to re-export/re-upload. We store slugs, not
// the matched show objects, so availability is always re-derived against the
// freshest catalogue on restore. Keyed with a version suffix so the shape can
// evolve without misreading an old record.
const STORAGE_KEY = "edfringe.plan.favourites.v1";
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // keep for 3 days, then forget

// --- Small helpers ------------------------------------------------------

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const pad2 = (n) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" for a day-of-month within August 2026. */
function dateStr(day) {
  return `${YEAR}-${MONTH}-${pad2(day)}`;
}

// 1 Aug 2026 is a Saturday; compute weekday letters from real dates rather
// than hardcoding, so this stays correct if the festival year ever changes.
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
  matched: [], // full show objects for the user's matched favourites
  totalFavourites: 0,
  missingSlugs: [],
  filename: "",
  savedAt: null, // epoch ms the current set was uploaded/saved (drives the "from …" label)
  pendingUpload: null, // {slugs, filename, savedAt, scroll} retained so a failed load can retry it
  // Date window (drives summarize()'s filter):
  d0: DEFAULT_D0,
  d1: DEFAULT_D1,
  // Populated once per upload by buildCalendar():
  laneRefs: [], // [{ slug, el, statusEl }] in display (sorted) order
  layout: { trackLeft: 0, trackWidth: 0, dayW: 0 },
  dayHeaderBuilt: false,
  // Allocation (screen 3): once the user has built a plan, it re-plans live as
  // the date window or pacing controls change.
  planned: false,
  schedule: null, // last buildSchedule() result
};

// --- Data loading -----------------------------------------------------

// The show catalogue is a few MB and isn't needed until the user brings their
// favourites, so it loads in the background: the upload screen is usable right
// away, and we only make anyone wait (via ensureData) if they upload before the
// fetch lands. `dataPromise` resolves to state.index or rejects on failure.
let dataPromise = null;

function loadData() {
  dataPromise = (async () => {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
    const shows = await res.json();
    state.index = buildIndex(shows);
    // Now the catalogue is available, re-hydrate any favourites saved from a
    // previous visit (fire-and-forget; a return visitor's calendar appears as
    // soon as the data lands, without ever blocking the upload screen).
    restoreStoredFavourites();
    return state.index;
  })();
  // Failures are surfaced at the await site (ensureData); swallow here so an
  // unconsumed background rejection doesn't log as "unhandled".
  dataPromise.catch(() => {});
  return dataPromise;
}

// Resolve the catalogue for a consumer that actually needs it now. Shows the
// loading panel only if the background fetch is still in flight, so the user is
// never delayed unless their own action is waiting on the data.
async function ensureData() {
  if (state.index) return state.index;
  if (!dataPromise) loadData();
  $("errorState").hidden = true;
  $("loadingState").hidden = false;
  try {
    return await dataPromise;
  } catch (err) {
    dataPromise = null; // clear the rejected promise so the next attempt re-fetches
    throw err;
  } finally {
    $("loadingState").hidden = true;
  }
}

// --- Local persistence (localStorage, 3-day TTL) --------------------------

/** Persist the current favourite slugs so a return visit needn't re-upload. */
function saveFavourites(slugs, filename, savedAt) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, slugs, filename, savedAt }));
  } catch (err) {
    // Private mode / quota / disabled storage — persistence is a bonus, not
    // load-bearing, so swallow it and let the session run in-memory.
    console.warn("Fringe Planner: couldn't save favourites locally", err);
  }
}

/**
 * Read the saved favourites, or null if there are none, they're malformed, or
 * they've aged past the TTL (expired/corrupt records are removed as a side
 * effect so we don't keep re-reading them).
 * @returns {{slugs: string[], filename: string, savedAt: number} | null}
 */
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
    clearStoredFavourites(); // stale — forget it
    return null;
  }
  return {
    slugs: data.slugs.filter((s) => typeof s === "string"),
    filename: typeof data.filename === "string" ? data.filename : "",
    savedAt: data.savedAt,
  };
}

/** Remove the saved favourites from this browser. */
function clearStoredFavourites() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Fringe Planner: couldn't clear stored favourites", err);
  }
}

/** On load, re-hydrate a still-valid saved set (no scroll — no jump on open). */
function restoreStoredFavourites() {
  const data = loadStoredFavourites();
  if (!data || data.slugs.length === 0) return;
  applyFavourites(data.slugs, data.filename, data.savedAt, { scroll: false });
}

/** Wipe the current favourites from both the UI and storage (back to intake). */
function clearFavourites() {
  clearStoredFavourites();

  state.totalFavourites = 0;
  state.matched = [];
  state.missingSlugs = [];
  state.filename = "";
  state.savedAt = null;

  const summaryEl = $("uploadSummary");
  summaryEl.hidden = true;
  summaryEl.classList.remove("is-partial");
  $("missingList").hidden = true;
  $("missingList").innerHTML = "";
  $("screen2").hidden = true;
  $("screen3").hidden = true;
  resetPlan();
  $("screen1").hidden = false;

  $("screen1").scrollIntoView({ behavior: "smooth", block: "start" });
}

// --- Screen 1: favourites intake -----------------------------------------

/** Read a File via FileReader and hand its text to processFavouritesText. */
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

/**
 * Parse a fresh upload, persist it (when it yielded any slugs), and render.
 * A file that parses to zero slugs leaves any previously saved set intact —
 * picking the wrong file shouldn't wipe a good saved list.
 */
function processFavouritesText(text, filename) {
  const slugs = parseFavourites(text);
  const savedAt = Date.now();
  if (slugs.length > 0) saveFavourites(slugs, filename, savedAt);
  applyFavourites(slugs, filename, savedAt, { scroll: true });
}

/**
 * Match a slug list against the catalogue and render both screens. Shared by
 * fresh uploads (scroll to the calendar) and storage restores (stay put).
 */
async function applyFavourites(slugs, filename, savedAt, { scroll = false } = {}) {
  // Retained so the error state's "Try again" can re-run this exact set once
  // the catalogue fetch is retried.
  state.pendingUpload = { slugs, filename, savedAt, scroll };

  // The catalogue is fetched in the background; wait for it now (only blocks if
  // it hasn't landed yet) before matching.
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

  // The state switch: with any matched favourite the calendar replaces the
  // intake panel entirely; otherwise stay on intake and explain what happened.
  if (matched.length > 0) {
    // Reset the window to the defaults on every fresh set.
    state.d0 = DEFAULT_D0;
    state.d1 = DEFAULT_D1;
    resetPlan(); // a fresh set starts before the plan step
    renderFavLine();
    buildCalendar();
    $("screen1").hidden = true;
    showCalendar({ scroll });
  } else {
    renderUploadSummary();
    $("screen1").hidden = false;
    $("screen2").hidden = true;
  }
}

/** Day boundaries in local time; number of whole days from `a` to `b`. */
function dayDiff(a, b) {
  const da = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const db = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / 86400000);
}

/** Friendly "when" for the saved-set label: today / yesterday / "18 Jul". */
function fmtSavedWhen(ts) {
  if (!ts) return "this session";
  const then = new Date(ts);
  const days = dayDiff(then, new Date());
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * The calendar's favourites provenance line: what's loaded, where it came
 * from, which slugs didn't match, plus the quiet Replace/Clear actions
 * (those are static in the HTML — only the summary text is rendered here).
 */
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

/** Intake-panel feedback for an upload that yielded nothing usable. */
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

/** Reveal the calendar panel; scroll to it only when the caller asks (fresh
 *  uploads do; a silent storage restore does not). The Plan card rides along
 *  with the calendar, but its result stays folded away until "Plan my Fringe". */
function showCalendar({ scroll = false } = {}) {
  const screen2 = $("screen2");
  screen2.hidden = false;
  $("screen3").hidden = false;
  updatePlanWindowLabel();
  // Layout needs real geometry, which only exists once the panel is visible.
  requestAnimationFrame(() => layoutOverlay());
  if (scroll) screen2.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Fold the plan away (a fresh favourites set / a clear starts from scratch). */
function resetPlan() {
  state.planned = false;
  state.schedule = null;
  $("planResult").hidden = true;
}

// --- Screen 2: calendar ----------------------------------------------------

/** Current summarize() filter derived from state.{d0,d1}. Start time is left
 *  wide open (00:00–24:00) — the planner filters on the date window only. */
function currentFilter() {
  return {
    dateStart: dateStr(state.d0),
    dateEnd: dateStr(state.d1),
    startTimeMin: T_MIN,
    startTimeMax: T_MAX,
  };
}

/** Mode of a show's performance start times — used to order lanes morning → night. */
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

/** Build the static day-of-month header row (runs once; independent of data). */
function ensureDayHeader() {
  if (state.dayHeaderBuilt) return;
  const dayHead = $("dayHead");
  dayHead.innerHTML = "";
  for (let d = 1; d <= DAYS_IN_MONTH; d++) {
    const col = document.createElement("div");
    col.className = "day-col" + (isWeekend(d) ? " wknd" : "") + (d > FEST_END_DAY ? " post" : "");
    col.innerHTML = `<span class="day-dow">${dowShort(d)}</span><span class="day-num">${d}</span>`;
    dayHead.appendChild(col);
  }
  state.dayHeaderBuilt = true;
}

/**
 * (Re)build the lanes from scratch: one row per matched favourite, sorted by
 * typical start time. Performance marks (filled/hollow/absent) are drawn from
 * `available`/`soldOut`, which don't depend on the date/time filter, so this
 * only needs to run once per upload — dragging the window only changes
 * per-lane verdicts (see applyVerdicts), not the marks themselves.
 */
function buildCalendar() {
  ensureDayHeader();

  const filter = currentFilter();
  const result = summarize(state.matched, filter, state.totalFavourites);
  const bySlug = new Map(result.shows.map((s) => [s.slug, s]));

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

    // Just the show title — this screen is an overview of the shows you want,
    // not a per-show detail card, so no time / genre / venue line. The hover
    // tooltip carries the full title plus the show's usual start time.
    const label = document.createElement("div");
    label.className = "lane-label";
    label.title = `${show.title} · usually ${typicalStartTime(show.performances)}`;
    label.innerHTML = `<div class="lane-title">${escapeHtml(show.title)}</div>`;

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

  applyVerdicts(bySlug, filter);
  updateHero(result.counts, filter);
  layoutOverlay();
}

// Map a performance to the edfringe.com day-picker colour class (CSS defines
// the actual hex — see plan.css). The status values come straight from
// shows.json; the palette mirrors edfringe.com's own availability legend.
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

/** Human label for a performance's status, used in the day-cell tooltip. */
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

/**
 * Build the 31 day cells for one show. Each day with performances renders one
 * coloured segment per performance (colour = edfringe.com availability status),
 * so a day with two shows shows as two side-by-side segments — the split is the
 * graphical cue that there's more than one performance that day.
 */
function buildDayCells(performances) {
  const byDay = new Map(); // day-of-month -> performances that land on it
  for (const p of performances) {
    if (!p.date.startsWith(`${YEAR}-${MONTH}-`)) continue; // outside the Aug axis — see TODO above
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
      // Earliest performance first, so matinee/evening segments read left→right.
      entries.sort((a, b) => a.start.localeCompare(b.start));
      cell.className = "cell" + (entries.length > 1 ? " cell-multi" : "");
      for (const p of entries) {
        const seg = document.createElement("span");
        seg.className = "seg " + segClass(p);
        cell.appendChild(seg);
      }
      // Consumed by the custom hover tooltip (see wireCellTips) — one line per
      // performance, so the time a show is on is visible on hover.
      cell.dataset.tip = entries
        .map((p) => `${dowShort(d)} ${d} Aug · ${p.start} · ${statusLabel(p)}`)
        .join("\n");
    }
    frag.appendChild(cell);
  }
  return frag;
}

/** Escape untrusted show text before inserting via innerHTML. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/**
 * Update each lane's dimmed/active state and right-hand verdict from a fresh
 * summarize() result — this is the cheap per-drag update (no DOM rebuild).
 */
function applyVerdicts(bySlug, filter) {
  for (const ref of state.laneRefs) {
    const show = bySlug.get(ref.slug);
    if (!show) continue;
    const { catchable, count } = laneVerdict(show.performances, filter);
    ref.el.classList.toggle("lane--out", !catchable);
    ref.statusEl.innerHTML = catchable
      ? `<span class="st-ok" title="${count} catchable date${count === 1 ? "" : "s"} in your window">&check;&nbsp;${count}</span>`
      : `<span class="st-no" title="nothing catchable in your window">&ndash;</span>`;
  }
}

/** Catchable = at least one available performance inside the date window. */
function laneVerdict(performances, filter) {
  const availableInRange = performances.filter(
    (p) => p.available && p.date >= filter.dateStart && p.date <= filter.dateEnd
  );
  return availableInRange.length > 0
    ? { catchable: true, count: availableInRange.length }
    : { catchable: false, count: 0 };
}

function updateHero(counts, filter) {
  const hcIn = $("hcIn");
  const changed = hcIn.textContent !== String(counts.showsAvailableInWindow);
  hcIn.textContent = counts.showsAvailableInWindow;
  $("hcAll").textContent = counts.matchedShows;
  $("hcDetail").textContent = `${state.d0}–${state.d1} Aug`;
  if (changed) {
    const num = hcIn.closest(".hc-num");
    num.classList.remove("bump");
    void num.offsetWidth; // restart the CSS animation
    num.classList.add("bump");
  }
}

/** rAF-throttled: re-summarize + re-render verdicts, coalesced to once per frame. */
let recomputeScheduled = false;
function scheduleRecompute() {
  if (recomputeScheduled) return;
  recomputeScheduled = true;
  requestAnimationFrame(() => {
    recomputeScheduled = false;
    recomputeAndRender();
  });
}
function recomputeAndRender() {
  const filter = currentFilter();
  const result = summarize(state.matched, filter, state.totalFavourites);
  const bySlug = new Map(result.shows.map((s) => [s.slug, s]));
  applyVerdicts(bySlug, filter);
  updateHero(result.counts, filter);
  updatePlanWindowLabel();
  // A built plan re-shapes live as the window moves (same "nudge a control,
  // watch the world change" loop as the calendar).
  if (state.planned) runPlan();
}

// --- Window overlay geometry & date-window dragging ------------------------

const calWrap = () => $("calWrap");
const calInner = () => $("calInner");

function layoutOverlay() {
  const daysEl = $("dayHead");
  const dr = daysEl.getBoundingClientRect();
  if (dr.width === 0) return; // panel not visible yet
  const wr = calInner().getBoundingClientRect();
  const trackLeft = dr.left - wr.left;
  const trackWidth = dr.width;
  const dayW = trackWidth / DAYS_IN_MONTH;
  state.layout = { trackLeft, trackWidth, dayW };

  const win = $("win");
  win.style.left = trackLeft + "px";
  win.style.width = trackWidth + "px";

  const festEnd = $("festEnd");
  festEnd.style.left = trackLeft + FEST_END_DAY * dayW + "px";
  festEnd.style.width = (DAYS_IN_MONTH - FEST_END_DAY) * dayW + "px";

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
  // The rail (handles + between-space) spans the full cal-inner width, unlike
  // the #win overlay, so its children carry the track offset themselves.
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

/** Wire pointer-drag on a date handle/band; `apply` mutates state.d0/d1 per move. */
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
    input.value = ""; // allow re-selecting the same filename later
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
  // "Replace file" re-opens the same picker the intake dropzone uses; the
  // change handler in wireDropzone routes the new file through the same
  // upload pipeline.
  $("replaceFavBtn").addEventListener("click", () => $("csvInput").click());
  $("clearFavBtn").addEventListener("click", clearFavourites);
}

function wireRetry() {
  $("retryBtn").addEventListener("click", () => {
    $("errorState").hidden = true;
    loadData(); // fresh fetch, replacing the rejected promise
    if (state.pendingUpload) {
      // Re-run the set the user was waiting on; ensureData awaits the retry.
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
  // The space between the two handles slides the whole window.
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

  window.addEventListener("resize", () => layoutOverlay());
}

// --- "Pick my best dates": place the window where it catches the most shows --

/** Catchable shows (primary) and catchable dates (tie-break) for a window. */
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

/** The best-scoring window among candidates; ties go to the earliest. */
function bestWindow(candidates) {
  let best = null;
  for (const c of candidates) {
    const score = windowScore(c.d0, c.d1);
    if (
      !best ||
      score.shows > best.shows ||
      (score.shows === best.shows && score.dates > best.dates)
    ) {
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
      // Every Sat–Sun pair on the axis.
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
    scheduleRecompute();
  });
}

// --- Performance-time tooltip over the day cells ----------------------------

function wireCellTips() {
  const lanes = $("lanes");
  const tip = $("calTip");

  const position = (e) => {
    // Beside the cursor, flipped left when it would run off the viewport.
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

// --- Screen 3: allocate the shows into an itinerary -------------------------

// The schedule graphic's vertical scale: pixels per hour on the shared time
// axis, and a floor on a show block's height so its label always fits.
const SCH_HOUR_PX = 46;
const SCH_MIN_BLOCK = 34;
const SCH_HEAD_PX = 46;

const DOW_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "7–24 Aug" for the current date window. */
function planWindowText() {
  return `${state.d0}–${state.d1} Aug`;
}

function updatePlanWindowLabel() {
  const el = $("planWindowLabel");
  if (el) el.textContent = planWindowText();
}

/** Minutes-since-midnight of a slot's epoch-minute value (wall clock). */
function slotMinuteOfDay(epochMinutes) {
  const d = new Date(epochMinutes * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Left-accent colour class for a scheduled slot (all are bookable, so the
 *  default is "available"). Mirrors the calendar's segClass palette. */
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

/** Read the pacing controls + current date window into buildSchedule options. */
function gatherPlanOptions() {
  const gap = Number($("ctlGap").value);
  return {
    windowStart: `${dateStr(state.d0)}T00:00`,
    windowEnd: `${dateStr(state.d1)}T23:59`,
    // The chosen buffer is travel time between venues; back-to-back at the same
    // venue (a double bill) needs no gap, matching the ported engine defaults.
    minGapDifferentVenue: gap,
    minGapSameVenue: 0,
    maxPerDay: Number($("ctlMax").value),
    minPerDay: Number($("ctlMin").value),
  };
}

/** Build (or rebuild) the itinerary from the current window + controls, and
 *  render every part of the result. */
function runPlan() {
  if (state.matched.length === 0) return;
  const schedule = buildSchedule(state.matched, gatherPlanOptions());
  state.schedule = schedule;
  state.planned = true;
  $("planResult").hidden = false;
  renderPlanSummary(schedule);
  renderSchedule(schedule);
  renderLeftOut(schedule);
  const hasShows = schedule.scheduled.length > 0;
  $("downloadCsvBtn").disabled = !hasShows;
  $("importIcsBtn").disabled = !hasShows;
}

function renderPlanSummary(schedule) {
  const { scheduledShows, matchedShows, days } = schedule.counts;
  const el = $("planSummary");
  el.innerHTML = "";
  if (scheduledShows === 0) {
    el.textContent = "No clash-free plan fits in this window yet.";
    return;
  }
  const strong = document.createElement("b");
  strong.textContent = `${scheduledShows} of ${matchedShows} shows`;
  el.append("Planned ", strong, ` across ${days} day${days === 1 ? "" : "s"} (${planWindowText()}). `);
  const sub = document.createElement("span");
  sub.className = "ps-sub";
  const leftOut = matchedShows - scheduledShows;
  sub.textContent = leftOut > 0
    ? `${leftOut} couldn't be fitted — see below.`
    : "Everything catchable made it in.";
  el.append(sub);
}

/**
 * Draw the schedule graphic: a shared hour axis down the left, then one column
 * per scheduled day with each show placed by its start time and sized by its
 * duration. Empty when nothing could be scheduled.
 */
function renderSchedule(schedule) {
  const host = $("schedule");
  const empty = $("scheduleEmpty");
  host.innerHTML = "";

  if (schedule.days.length === 0) {
    host.hidden = true;
    empty.hidden = false;
    return;
  }
  host.hidden = false;
  empty.hidden = true;

  // Shared axis bounds across every day, rounded out to whole hours.
  let minM = Infinity;
  let maxM = -Infinity;
  for (const slot of schedule.scheduled) {
    const s = slotMinuteOfDay(slot.start);
    let e = slotMinuteOfDay(slot.end);
    if (e <= s) e = 24 * 60; // zero-duration or crossed midnight — clamp to end of day
    minM = Math.min(minM, s);
    maxM = Math.max(maxM, e);
  }
  const minHour = Math.floor(minM / 60);
  let maxHour = Math.ceil(maxM / 60);
  if (maxHour <= minHour) maxHour = minHour + 1;
  const axisH = (maxHour - minHour) * SCH_HOUR_PX;

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
    lab.textContent = `${pad2(h)}:00`;
    gBody.appendChild(lab);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  // One column per day.
  for (const day of schedule.days) {
    const dayNum = Number(day.date.slice(8, 10));
    const col = document.createElement("div");
    col.className = "sch-day" + (isWeekend(dayNum) ? " wknd" : "");

    const head = document.createElement("div");
    head.className = "sch-day-head";
    const dowEl = document.createElement("div");
    dowEl.className = "sch-dow";
    dowEl.innerHTML = `${DOW_LONG[dow(dayNum)]} <span class="sch-date">${dayNum} Aug</span>`;
    const countEl = document.createElement("div");
    countEl.className = "sch-day-count";
    countEl.textContent = `${day.slots.length} show${day.slots.length === 1 ? "" : "s"}`;
    head.append(dowEl, countEl);

    const body = document.createElement("div");
    body.className = "sch-body";
    body.style.height = `${axisH}px`;

    for (const slot of day.slots) {
      const startMin = slotMinuteOfDay(slot.start);
      let endMin = slotMinuteOfDay(slot.end);
      if (endMin <= startMin) endMin = maxHour * 60;
      const top = ((startMin - minHour * 60) / 60) * SCH_HOUR_PX;
      const height = Math.max(SCH_MIN_BLOCK, ((endMin - startMin) / 60) * SCH_HOUR_PX);

      const block = document.createElement("div");
      block.className = "sch-show " + statusSegClass(slot.status);
      block.style.top = `${top}px`;
      block.style.height = `${height}px`;
      const timeStr = `${slot.startTime}–${slotEndTime(slot)}`;
      const venue = slot.venueName || slot.venueCode || "";
      block.title = `${slot.title}\n${timeStr}${venue ? " · " + venue : ""}`;
      block.innerHTML =
        `<div class="sch-time">${escapeHtml(timeStr)}</div>` +
        `<div class="sch-name">${escapeHtml(slot.title)}</div>` +
        (venue ? `<div class="sch-venue">${escapeHtml(venue)}</div>` : "");
      body.appendChild(block);
    }

    col.append(head, body);
    host.appendChild(col);
  }
}

function renderLeftOut(schedule) {
  const box = $("planLeftOut");
  const list = $("leftOutList");
  const { unscheduled } = schedule;
  list.innerHTML = "";
  if (unscheduled.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $("leftOutCount").textContent = unscheduled.length;
  for (const item of unscheduled) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${escapeHtml(item.title || item.slug)}</b> <span class="lo-reason">— ${escapeHtml(item.reason)}</span>`;
    list.appendChild(li);
  }
}

// --- Downloads (CSV / ICS), built in the browser ---------------------------

/** Trigger a client-side download of `text` as `filename`. */
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

function wirePlanner() {
  $("planBtn").addEventListener("click", () => {
    runPlan();
    $("planResult").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // The pacing controls re-plan live once a plan exists.
  for (const id of ["ctlGap", "ctlMax", "ctlMin"]) {
    $(id).addEventListener("change", () => {
      if (state.planned) runPlan();
    });
  }

  $("downloadCsvBtn").addEventListener("click", () => {
    if (!state.schedule || state.schedule.scheduled.length === 0) return;
    // A UTF-8 BOM (U+FEFF) so Excel reads accented show titles correctly.
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
wirePlanner();

// The upload screen is visible from first paint; fetch the catalogue in the
// background so the user can read the instructions and export their CSV while it
// loads, and only waits (if at all) at the moment they actually upload.
loadData();
