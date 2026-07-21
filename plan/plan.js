// Fringe Planner — page logic.
//
// Self-contained ES module: no globals shared with the home site's js/app.js.
// Wires the real computation engine (./lib/engine.js, ./lib/favourites.js —
// pure, untouched here) to the two-screen UI described in
// plan/design/mock.html + plan/design/DESIGN_NOTES.md.
//
// Screen 1 (input): drag/drop or pick a favourites CSV, or load the bundled
//   sample. Screen 2 (calendar): one lane per matched favourite across
//   August 2026, with a draggable date window and a start-time range slider
//   that filter live via engine.summarize().

import { parseFavourites, urlFromSlug } from "./lib/favourites.js";
import { buildIndex, matchFavourites, summarize } from "./lib/engine.js";

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
function dowShort(day) {
  return DOW_SHORT[new Date(Date.UTC(YEAR, 7, day)).getUTCDay()];
}
function isWeekend(day) {
  const d = new Date(Date.UTC(YEAR, 7, day)).getUTCDay();
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

/** On load, re-hydrate a still-valid saved set (no scroll — stay on screen 1). */
function restoreStoredFavourites() {
  const data = loadStoredFavourites();
  if (!data || data.slugs.length === 0) return;
  applyFavourites(data.slugs, data.filename, data.savedAt, { scroll: false });
}

/** Wipe the current favourites from both the UI and storage. */
function clearFavourites() {
  clearStoredFavourites();

  state.totalFavourites = 0;
  state.matched = [];
  state.missingSlugs = [];
  state.filename = "";
  state.savedAt = null;

  $("summaryCap").hidden = true;
  const summaryEl = $("uploadSummary");
  summaryEl.hidden = true;
  summaryEl.classList.remove("is-partial");
  $("missingList").hidden = true;
  $("missingList").innerHTML = "";
  $("continueRow").hidden = true;
  $("savedBar").hidden = true;
  $("screen2").hidden = true;

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

  renderUploadSummary();
  renderSavedBar();

  if (matched.length > 0) {
    // Reset the window to the defaults on every fresh set.
    state.d0 = DEFAULT_D0;
    state.d1 = DEFAULT_D1;
    buildCalendar();
    showCalendar({ scroll });
  } else {
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

/** The "N favourites from <when>" provenance line + Clear button visibility. */
function renderSavedBar() {
  const bar = $("savedBar");
  if (state.totalFavourites > 0) {
    const n = state.totalFavourites;
    $("savedNote").textContent =
      `${n} favourite${n === 1 ? "" : "s"} from ${fmtSavedWhen(state.savedAt)}`;
    bar.hidden = false;
  } else {
    bar.hidden = true;
  }
}

function renderUploadSummary() {
  const { totalFavourites, matched, missingSlugs, filename } = state;

  $("summaryCap").hidden = false;
  const summaryEl = $("uploadSummary");
  summaryEl.hidden = false;
  summaryEl.classList.toggle("is-partial", missingSlugs.length > 0);

  $("usMain").textContent =
    totalFavourites === 0
      ? "No favourites found in that file"
      : `${totalFavourites} favourite${totalFavourites === 1 ? "" : "s"} loaded`;

  if (totalFavourites === 0) {
    $("usSub").textContent = "We couldn't find any edfringe.com show links in that file.";
  } else {
    let sub = `${matched.length} matched to our show data`;
    if (missingSlugs.length > 0) {
      sub += ` · ${missingSlugs.length} we couldn't find `;
    }
    $("usSub").textContent = sub;
    if (missingSlugs.length > 0) {
      const whichBtn = document.createElement("button");
      whichBtn.type = "button";
      whichBtn.className = "link-quiet";
      whichBtn.textContent = "(which?)";
      whichBtn.addEventListener("click", toggleMissingList);
      $("usSub").appendChild(whichBtn);
    }
  }
  $("usFile").textContent = filename;

  renderMissingList();

  const continueRow = $("continueRow");
  continueRow.hidden = matched.length === 0;
  $("continueBtn").disabled = matched.length === 0;
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
 *  uploads and the Continue button do; a silent storage restore does not). */
function showCalendar({ scroll = false } = {}) {
  const screen2 = $("screen2");
  screen2.hidden = false;
  // Layout needs real geometry, which only exists once the panel is visible.
  requestAnimationFrame(() => layoutOverlay());
  if (scroll) screen2.scrollIntoView({ behavior: "smooth", block: "start" });
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
    // not a per-show detail card, so no time / genre / venue line.
    const label = document.createElement("div");
    label.className = "lane-label";
    label.title = show.title;
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
      cell.title = entries
        .map((p) => `${dowShort(d)} ${d} Aug · ${p.start} · ${statusLabel(p)}`)
        .join("; ");
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
  const { trackWidth, dayW } = state.layout;
  const x0 = (state.d0 - 1) * dayW;
  const x1 = state.d1 * dayW;
  $("dimL").style.left = "0";
  $("dimL").style.width = x0 + "px";
  $("dimR").style.left = x1 + "px";
  $("dimR").style.width = Math.max(0, trackWidth - x1) + "px";
  $("band").style.left = x0 + "px";
  $("band").style.width = (x1 - x0) + "px";
  $("hStart").style.left = x0 + "px";
  $("hEnd").style.left = x1 + "px";
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

function wireContinueButton() {
  $("continueBtn").addEventListener("click", () => {
    if (state.matched.length > 0) showCalendar({ scroll: true });
  });
}

function wireClearButton() {
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
  dragDate($("band"), (ev, s0, s1, startX) => {
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

// --- Go ---------------------------------------------------------------

wireDropzone();
wireSampleLink();
wireContinueButton();
wireClearButton();
wireRetry();
wireCalendarControls();

// The upload screen is visible from first paint; fetch the catalogue in the
// background so the user can read the instructions and export their CSV while it
// loads, and only waits (if at all) at the moment they actually upload.
loadData();
