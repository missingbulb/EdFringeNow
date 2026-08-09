// Fringe Planner — page logic.
//
// An ES module: shares no *globals* with the home site's js/app.js, but does
// share real code with it — anything both pages must agree on is imported from
// ../shared/, not copy-pasted. Wires the pure computation engine (./lib/*.js)
// to the UI.
//
// The page has one state switch, keyed on whether a favourites set is in — and
// it swaps only the *body* of the board: the drop stage (drag/drop or pick a
// favourites CSV) becomes the availability grid, at the same height, while the
// count line above it and the search bar below it stay put. The plan panel
// appears underneath. There is no "Plan" button — the itinerary recomputes live
// whenever the date window or any control changes.

import { isInUK } from "../shared/geo.js";
import { cachedFetchJson, evictCached, DAY_MS } from "../shared/data-cache.js";
import { stayLink, travelLink } from "../shared/affiliates.js";
import { attachVersionPopup } from "../shared/version-popup.js";
import { parseFavourites } from "./lib/favourites.js";
import { buildIndex, matchFavourites, summarize, buildSchedule, placementDiagnostics, slotKey } from "./lib/engine.js";
import { isAvailable } from "./lib/availability.js";
import { toCsv, toIcs, slotEndTime } from "./lib/itinerary.js";
import { distanceKm, travelMinutes } from "./lib/travel.js";
import { rehydrateShows, joinFingerprint } from "./lib/hydrate.js";
import {
  searchShows,
  catalogueFacets,
  catalogueVenues,
  hasActiveFilters,
  filterShows,
  matchFacets,
  showPrice,
  showAccessibility,
  ageLimitYears,
} from "./lib/search.js";
import { PRICE_OPTIONS, matchesPrice, priceLabel } from "../shared/price.js";

// ES modules are always strict mode, so no "use strict" directive is needed.

// --- Constants --------------------------------------------------------

const DATA_URL = "../data/normalized/shows.min.json"; // compact catalogue; rehydrated against VENUES_URL
const VENUES_URL = "../data/venues.json"; // shared lookups (enums + venue map) the catalogue indexes into
const AVAILABILITY_URL = "../data/normalized/availability.min.json"; // per-performance ticket status
const DESCRIPTIONS_URL = "../data/normalized/descriptions.min.json"; // slug → full text, fetched lazily

/* How long a downloaded data file may be reused before we ask the network
 * again (shared/data-cache.js). Each file gets the lifetime its content has,
 * which is the whole reason availability was split out of the catalogue:
 *
 *  - the catalogue is the bulkiest blocking download (3.0 MB, 948 KB gzipped)
 *    and now carries nothing that changes through the day, so four days of
 *    reuse costs a returning visitor only the shows added since;
 *  - availability moves hourly, so a day is the most it can be trusted — and at
 *    149 KB gzipped that daily re-download is a sixth of what re-fetching the
 *    catalogue with it would have cost;
 *  - venues.json is small and its lookup lists are append-only, so refetching
 *    it daily keeps it at least as new as any cached catalogue that indexes
 *    into it;
 *  - (the now page holds its day file for an hour, not a day — it draws live
 *    SOLD OUT stamps, so it tracks the hourly refresh; see js/app.js);
 *  - descriptions are effectively immutable, so a week means a returning
 *    visitor pays for them once. */
const CATALOGUE_TTL_MS = 4 * DAY_MS;
const AVAILABILITY_TTL_MS = DAY_MS;
const LOOKUPS_TTL_MS = DAY_MS;
const DESCRIPTIONS_TTL_MS = 7 * DAY_MS;
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

// Dismissed partner nags (see buildNag). Kept in its own key with no TTL: an "I
// don't need this" is an answer, not a stale cache, so it outlives the
// favourites it was dismissed over.
const NAGS_KEY = "edfringe.plan.nags.v1";
/* The scheduling preferences: the date window, day hours, meal breaks, the
 * arrival/departure blocks, travel mode, the pacing controls and the must-sees.
 * Its own key, like the two above — these shape *how* the plan is built, and a
 * visitor who set them expects them back on the next visit, so they must not
 * expire with the 3-day favourites TTL. */
const PREFS_KEY = "edfringe.plan.prefs.v1";

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
  // Partner nags the visitor has closed with the × (see buildNag); a Set of nag
  // kinds ("sleep" / "travel"), restored from localStorage at boot.
  nagsDismissed: loadDismissedNags(),
  // The descriptions sidecar (see loadDescriptions): slug → full text. Empty
  // until it lands, and it may never land — every reader falls back to the
  // catalogue's blurb.
  descriptions: new Map(),
  descriptionsPromise: null,

  // Build version + reschedule-timing telemetry (surfaced in the header pill).
  version: null,
  perf: { count: 0, sum: 0, last: 0, min: Infinity, max: 0 },
};

// --- Data loading + rehydration ---------------------------------------
//
// The planner downloads three files up front: the compact catalogue
// (shows.min.json, packed by scraper/normalize.py), the shared lookups
// (venues.json) and the availability sidecar (availability.min.json).
// rehydrateShows() (./lib/hydrate.js) joins them back into the full records the
// engine expects — every enum is an index into a venues.json list, venueName is
// rebuilt from the venue code + room, dates are MMDD ints, the bare image GUID
// gets its host prefix re-attached, and each performance picks up its ticket
// status from the sidecar — so the rest of the app sees a ready-to-use
// catalogue identical in shape to the old shows.json.
//
// The three are split the way they are so each can be cached for as long as its
// contents actually last: see the TTL constants above. Availability is the only
// one of them that moves through the day, and it is the smallest.
//
// A fourth file — the descriptions sidecar — follows *after* those have landed,
// and nothing waits for it: see loadDescriptions.

/* What each file has to look like before we'll build a planner out of it.
 *
 * These exist because a cached copy from an older generation of a file parses
 * perfectly and then joins to nothing — no exception, no console line, just a
 * planner quietly reporting that the whole festival is unavailable (#309). The
 * sidecar has carried a `v` for this all along; nothing was reading it. Kept
 * deliberately shallow: enough to tell "this is the file I think it is" from
 * "this is something else", not a schema validator. */
const isCatalogue = (d) => Array.isArray(d) && d.length > 0;
const isLookups = (d) => Boolean(d) && typeof d.venues === "object" && d.venues !== null;
const isAvailabilitySidecar = (d) =>
  Boolean(d) && d.v === 1 && Array.isArray(d.ts) && d.ts.length > 0 &&
  Boolean(d.a) && typeof d.a === "object" && Object.keys(d.a).length > 0;

/* How much of the catalogue must come back with a ticket status before we are
 * willing to draw it.
 *
 * The catalogue is cached for four days and the sidecar for one, so they are
 * routinely joined across generations, and a few misses are the honest cost of
 * that: a show that added or dropped a date since the catalogue was packed
 * finds no status, which is exactly what the date-and-time naming scheme was
 * designed to do. Real drift over four days is a fraction of a percent.
 *
 * A systematic key change is a different animal. #274 corrected every start
 * time by an hour, and the next day's sidecar matched 6% of the previous day's
 * catalogue — 94% of the festival status-unknown, drawn as unavailable (#309).
 * Nothing between 6% and 99% is a state we can tell a coherent story about, so
 * the line sits where it separates drift from breakage rather than where it
 * splits the difference. */
const MIN_STATUS_COVERAGE = 0.9;

/**
 * Do these two files describe the same festival?
 *
 * Two independent answers, because they fail in different places. The
 * fingerprint is exact and cheap and settles it outright — but only for a
 * sidecar new enough to carry one, which a cached copy predating that field
 * won't. Coverage is the fallback: approximate, but it reads the join itself
 * rather than a claim about it, so it also catches whatever the fingerprint
 * hasn't thought of.
 *
 * @returns {{ok: boolean, why?: string}}
 */
function joinIsSound(wire, availability, catalogue) {
  const stamped = availability && typeof availability.k === "string";
  if (stamped) {
    const mine = joinFingerprint(wire);
    if (mine !== availability.k) {
      return { ok: false, why: `catalogue ${mine} vs availability ${availability.k}` };
    }
  }

  let performances = 0;
  let withStatus = 0;
  for (const show of catalogue) {
    for (const perf of show.performances || []) {
      performances++;
      if (perf.status) withStatus++;
    }
  }
  if (performances === 0) return { ok: true }; // an empty catalogue is a different problem
  const coverage = withStatus / performances;
  if (coverage < MIN_STATUS_COVERAGE) {
    return {
      ok: false,
      why: `only ${withStatus} of ${performances} performances (${Math.round(coverage * 100)}%) ` +
           "carry a ticket status",
    };
  }
  return { ok: true };
}

/**
 * The three files the planner is built from, joined — refetched once from source
 * if the copies we were given don't agree with each other.
 *
 * All three are required. Availability used to be allowed to fail on the theory
 * that status-unknown is a state the grid already draws — it isn't. An empty
 * status reads as not-bookable everywhere downstream (isAvailable, segClass,
 * laneStatus), so continuing without the sidecar doesn't degrade the planner, it
 * inverts it: every performance turns red and every show reports "No dates", for
 * a festival that is very much on sale (#309).
 *
 * The retry is the substance. A generation disagreement is not a network failure
 * and not a corrupt file — it is two perfectly good files that have drifted
 * apart on their separate TTLs, and the fix is simply to go and get today's, so
 * that is what happens. Only if freshly-downloaded copies *still* disagree is
 * this a real failure, and then it belongs in the error panel: at that point we
 * genuinely don't know what's bookable, and a wrong plan is worse than no plan.
 */
async function loadCatalogue() {
  for (const attempt of [1, 2]) {
    const [wire, lookups, availability] = await Promise.all([
      cachedFetchJson(DATA_URL, CATALOGUE_TTL_MS, noteCache, isCatalogue),
      cachedFetchJson(VENUES_URL, LOOKUPS_TTL_MS, noteCache, isLookups),
      cachedFetchJson(AVAILABILITY_URL, AVAILABILITY_TTL_MS, noteCache, isAvailabilitySidecar),
    ]);
    const catalogue = rehydrateShows(wire, lookups, YEAR, availability);
    const verdict = joinIsSound(wire, availability, catalogue);
    if (verdict.ok) return { lookups, catalogue };

    if (attempt === 2) {
      throw new Error(
        `the catalogue and the ticket availability don't match (${verdict.why})`
      );
    }
    // Drop both and go again. Which of the two is stale isn't knowable from
    // here — the catalogue's four-day TTL makes it the usual suspect, but a
    // sidecar can be the stale one too — and this costs one extra download of
    // each on a path that only runs when they've already disagreed.
    console.warn("Fringe Planner: catalogue/availability mismatch, refetching both —", verdict.why);
    await Promise.all([evictCached(DATA_URL), evictCached(AVAILABILITY_URL)]);
  }
}

let dataPromise = null;

function loadData() {
  dataPromise = (async () => {
    const { lookups, catalogue } = await loadCatalogue();
    state.venueCoords = lookups.venues || null; // venue map drives travel legs/gaps
    state.lookups = lookups;
    state.catalogue = catalogue;
    state.index = buildIndex(state.catalogue);
    state.facets = catalogueFacets(state.catalogue);
    initSearchUI();
    restoreStoredFavourites();
    // Deliberately not awaited: the page is fully usable without descriptions,
    // and starting them here rather than alongside the catalogue keeps them off
    // the critical path entirely.
    loadDescriptions();
    return state.index;
  })();
  dataPromise.catch(() => {});
  return dataPromise;
}

/* Where the shared data cache (shared/data-cache.js) reports a cache write it
 * couldn't make or a stale copy it fell back on. Never surfaced in the UI: in
 * both cases the caller still got its data. */
function noteCache(err, url) {
  console.info("Fringe Planner: data cache —", url, err);
}

/**
 * The one place a data-load failure becomes visible, shared by every entry point
 * that can trigger one: an upload (applyFavourites), the boot load, and the
 * retry button.
 *
 * The boot load is the reason this is factored out. It has no upload to report
 * through, so its rejection used to land in a no-op catch and leave the page
 * sitting in its empty "drop your favourites" state — indistinguishable from a
 * first-time visitor, while the real story was that we couldn't say what was
 * bookable (#309). Not knowing is worth saying out loud; it's the half-loaded
 * board that lies.
 */
function showLoadError(err) {
  console.error("Fringe Planner: failed to load show data", err);
  $("errorDetail").textContent =
    "Check your connection and try again. (" + (err && err.message ? err.message : "unknown error") + ")";
  $("errorState").hidden = false;
}

/**
 * The descriptions sidecar: slug → the show's full text, fetched once per page
 * and cached for a week. Everything it feeds already works without it — the
 * hover card falls back to the catalogue's one-line blurb, and so does search —
 * so a failure here is logged and dropped, never surfaced. When it does land,
 * an open search re-runs so the results deepen under the query already typed.
 */
function loadDescriptions() {
  if (state.descriptionsPromise) return state.descriptionsPromise;
  state.descriptionsPromise = cachedFetchJson(DESCRIPTIONS_URL, DESCRIPTIONS_TTL_MS, noteCache)
    .then((payload) => {
      state.descriptions = new Map(Object.entries((payload && payload.d) || {}));
      if (!$("ssPop").hidden) runSearch();
      return state.descriptions;
    })
    .catch((err) => {
      console.info("Fringe Planner: descriptions unavailable — using blurbs", err);
      return null;
    });
  return state.descriptionsPromise;
}

/** A show's description: the sidecar's full text when it has arrived, and the
 *  catalogue's own truncated blurb until then. */
function descriptionFor(slug) {
  const full = state.descriptions.get(slug);
  if (full) return full;
  const show = showBySlug(slug);
  return (show && show.blurb) || "";
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

/** The partner nags closed with the ×, as a Set of nag kinds. Anything
 *  unreadable (no storage, private mode, hand-edited value) reads as "nothing
 *  dismissed" — the nag is small and dismissible, so showing it again is the
 *  harmless direction to fail in. */
function loadDismissedNags() {
  try {
    const data = JSON.parse(localStorage.getItem(NAGS_KEY) || "{}");
    return new Set(Array.isArray(data.dismissed) ? data.dismissed.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDismissedNags() {
  try {
    localStorage.setItem(NAGS_KEY, JSON.stringify({ v: 1, dismissed: [...state.nagsDismissed] }));
  } catch (err) {
    console.warn("Fringe Planner: couldn't save dismissed suggestions", err);
  }
}

/* The colour key opens as a popup over the grid's top-right corner, from the
 * button above the Status column. It used to be a column beside the grid, which
 * meant every open and close resized the calendar under the pointer; as a popup
 * it costs the grid nothing, so it can simply appear and be dismissed. It is
 * transient like the optimizer popover — closed on every load, and closed again
 * by a click elsewhere or Escape — so there is no stored state to restore. */
let legendOpen = false;

function setLegendOpen(open) {
  legendOpen = Boolean(open);
  const panel = $("calLegend");
  const btn = $("legendBtn");
  // The key stays `hidden` whenever the board is empty: there are no marks to
  // key, and showCalendar/showIntake own that state.
  if (panel) panel.hidden = !legendOpen || $("calWrap").hidden;
  if (btn) {
    btn.classList.toggle("is-on", legendOpen);
    btn.setAttribute("aria-expanded", String(legendOpen));
  }
  // Placed from the button, unhidden first so the panel can be measured. Right
  // edges aligned, so it hangs into the grid rather than off the card.
  if (panel && !panel.hidden && btn) {
    const r = btn.getBoundingClientRect();
    const pw = panel.offsetWidth;
    panel.style.top = `${r.bottom + 6}px`;
    panel.style.left = `${clamp(r.right - pw, 8, Math.max(8, window.innerWidth - pw - 8))}px`;
  }
}

function wireLegendFold() {
  const btn = $("legendBtn");
  const panel = $("calLegend");
  if (!btn || !panel) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // don't trip the click-away closer below
    setLegendOpen(!legendOpen);
  });
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", () => {
    if (legendOpen) setLegendOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && legendOpen) { setLegendOpen(false); btn.focus(); }
  });
  // Fixed to the viewport, so a page scroll would leave it hanging where the
  // button no longer is: re-place it against the button instead.
  window.addEventListener("scroll", () => { if (legendOpen) setLegendOpen(true); }, { passive: true });
}

/* --- Scheduling preferences ---------------------------------------------
 * Everything the planner's controls set, as opposed to *what* is on the grid
 * (the favourites, stored separately under their own TTL). Written after every
 * refresh() and read back at boot, so a reload returns the plan the visitor had
 * shaped rather than the defaults. */
function savePlanPrefs() {
  try {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        v: 1,
        d0: state.d0,
        d1: state.d1,
        dayStartMin: state.dayStartMin,
        dayEndMin: state.dayEndMin,
        mode: state.mode,
        meals: state.mealBreaks.map((m) => ({
          id: m.id,
          enabled: m.enabled,
          startMin: m.startMin,
          endMin: m.endMin,
        })),
        arrival: { ...state.arrival },
        departure: { ...state.departure },
        forced: [...state.forced],
        pacing: { gap: $("ctlGap").value, max: $("ctlMax").value, min: $("ctlMin").value },
      })
    );
  } catch (err) {
    console.warn("Fringe Planner: couldn't save scheduling preferences", err);
  }
}

/* refresh() runs once per pointer-frame while the date window is dragged, and
 * localStorage writes are synchronous — so the save trails the interaction
 * rather than riding inside it. */
let prefsSaveTimer = null;
function schedulePrefsSave() {
  if (prefsSaveTimer) clearTimeout(prefsSaveTimer);
  prefsSaveTimer = setTimeout(() => {
    prefsSaveTimer = null;
    savePlanPrefs();
  }, 400);
}

/* Land a pending debounced save before the page goes away, so preferences
 * changed in the last moments of a visit aren't the ones that get lost. */
function flushPlanPrefs() {
  if (!prefsSaveTimer) return;
  clearTimeout(prefsSaveTimer);
  prefsSaveTimer = null;
  savePlanPrefs();
}

/* Read the stored preferences back into state. Every field is validated and
 * clamped against the same bounds its control enforces: anything missing,
 * malformed or out of range leaves that preference at its default rather than
 * failing the whole restore, so one bad value can't cost the visitor the rest. */
function restorePlanPrefs() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(PREFS_KEY) || "null");
  } catch {
    return; // private mode, or a hand-edited value — the defaults are fine
  }
  if (!data || data.v !== 1) return;

  const int = (v, lo, hi, fallback) => (Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : fallback);

  // d1 first: it's the ceiling d0 is clamped against, so a stored window can
  // never restore inverted.
  state.d1 = int(data.d1, 1, DAYS_IN_MONTH, state.d1);
  state.d0 = int(data.d0, 1, state.d1, state.d0);
  state.dayStartMin = int(data.dayStartMin, 0, DAY_END_CEIL - 15, state.dayStartMin);
  state.dayEndMin = int(data.dayEndMin, state.dayStartMin + 15, DAY_END_CEIL, state.dayEndMin);
  if (MODE_META[data.mode]) state.mode = data.mode;

  if (Array.isArray(data.meals)) {
    // Matched by id rather than position, so reordering or adding a meal break
    // doesn't misapply a stored one.
    for (const meal of state.mealBreaks) {
      const saved = data.meals.find((m) => m && m.id === meal.id);
      if (!saved) continue;
      meal.enabled = Boolean(saved.enabled);
      meal.endMin = int(saved.endMin, 5, 1440, meal.endMin);
      meal.startMin = int(saved.startMin, 0, meal.endMin - 5, meal.startMin);
    }
  }
  if (data.arrival) {
    state.arrival.enabled = Boolean(data.arrival.enabled);
    state.arrival.endMin = int(data.arrival.endMin, 0, DAY_END_CEIL, state.arrival.endMin);
  }
  if (data.departure) {
    state.departure.enabled = Boolean(data.departure.enabled);
    state.departure.startMin = int(data.departure.startMin, 0, DAY_END_CEIL, state.departure.startMin);
  }
  // Must-sees are re-filtered against the catalogue when the favourites land
  // (applyFavourites' keepForced path), so a pin on a show no longer on the
  // grid drops itself there rather than needing a check here.
  if (Array.isArray(data.forced)) {
    state.forced = new Map(
      data.forced.filter(
        (e) => Array.isArray(e) && typeof e[0] === "string" && (e[1] === true || typeof e[1] === "string")
      )
    );
  }
  if (data.pacing) restorePacingControls(data.pacing);
  syncPlanControls();
}

/* The three pacing controls keep their value in the DOM rather than in `state`,
 * so they restore by writing it back — and only if the control still offers it,
 * so an option that has since been renamed falls back to the markup's default
 * instead of leaving the control blank. */
function restorePacingControls(pacing) {
  for (const [id, val] of [["ctlGap", pacing.gap], ["ctlMax", pacing.max], ["ctlMin", pacing.min]]) {
    const el = $(id);
    if (!el || typeof val !== "string") continue;
    const before = el.value;
    el.value = val;
    if (el.value === "") el.value = before;
  }
}

/* Push restored preferences out to the controls that display them. Arrival and
 * departure need nothing here — they have no static inputs, being drawn from
 * state straight onto the schedule overlay. */
function syncPlanControls() {
  syncDayInputs();
  for (const meal of state.mealBreaks) {
    const on = $(`meal${cap(meal.id)}On`);
    if (on) on.checked = meal.enabled;
    syncMealInputs(meal);
  }
  const modeWrap = $("ctlMode");
  if (!modeWrap) return;
  for (const b of modeWrap.querySelectorAll(".tmode-btn")) {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle("is-on", on);
    b.setAttribute("aria-pressed", String(on));
  }
}

function restoreStoredFavourites() {
  const data = loadStoredFavourites();
  if (!data || data.slugs.length === 0) return;
  // Restoring a stored board is not a fresh upload: the date window and the
  // must-sees that came back with the preferences are the visitor's own, so
  // they survive here rather than being reset to the defaults.
  applyFavourites(data.slugs, data.filename, data.savedAt, {
    source: "restore",
    keepWindow: true,
    keepForced: true,
  });
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
  state.schedule = null;
  state.scheduledSlugs = new Set();

  clearUploadError();
  syncSearchStars();
  showIntake();
}

// --- Favourites intake ----------------------------------------------------

// The edfringe.com export is a CSV, and it's the only thing this box takes: a
// PDF or a screenshot used to be run through the slug parser, which happily
// invented "favourites" out of any word-ish line it found and then reported them
// as loaded. Anything else is refused before it's read.
const CSV_RE = /\.csv$/i;

/** Could this dragged item plausibly be a CSV? Filenames aren't exposed during
 *  a drag, only MIME types — and a CSV often drags with an empty or
 *  spreadsheet-y type — so this only refuses what it can positively identify as
 *  something else. The filename check on drop is the real gate. */
function dragLooksLikeCsv(dataTransfer) {
  const items = dataTransfer && dataTransfer.items;
  if (!items || items.length === 0) return true; // nothing to judge on
  for (const item of items) {
    if (item.kind !== "file") continue;
    const type = (item.type || "").toLowerCase();
    if (type === "" || type.includes("csv") || type === "text/plain" || type.includes("excel")) return true;
  }
  return false;
}

function handleFile(file) {
  if (!file) return;
  if (!CSV_RE.test(file.name)) {
    showUploadError(
      "That's not a CSV file",
      "Export your favourites from edfringe.com as CSV, then drop that file here.",
      file.name
    );
    return;
  }
  const reader = new FileReader();
  reader.onload = () => processFavouritesText(String(reader.result || ""), file.name);
  reader.onerror = () => {
    console.error("Fringe Planner: failed to read file", reader.error);
    showUploadError("We couldn't read that file", "Try exporting your favourites again.", file.name);
  };
  reader.readAsText(file);
}

function processFavouritesText(text, filename) {
  const slugs = parseFavourites(text);
  // Nothing is stored — and nothing is claimed as loaded — until the file has
  // actually yielded shows we can put on the grid (see applyFavourites).
  applyFavourites(slugs, filename, Date.now(), { source: "upload" });
}

/**
 * The one funnel every favourites change goes through — an upload, a restored
 * list, or a single show starred / dropped. It matches the slugs against the
 * catalogue, persists the working set, and repaints the board.
 *
 * @param {"upload"|"restore"|"edit"} source what to do when nothing matches:
 *   an upload says so (and leaves the board alone), a stale stored list is
 *   quietly forgotten. An edit always matches, since it came from the catalogue.
 */
async function applyFavourites(
  slugs,
  filename,
  savedAt,
  { keepForced = false, keepWindow = false, source = "edit" } = {}
) {
  state.pendingUpload = { slugs, filename, savedAt, source };

  let index;
  try {
    index = await ensureData();
  } catch (err) {
    showLoadError(err);
    return;
  }

  const { matched, missingSlugs } = matchFavourites(slugs, index);
  state.pendingUpload = null;

  // Nothing to put on the grid: that's a failed upload, not an empty one. The
  // board — and the stored list behind it — stays exactly as it was.
  if (matched.length === 0) {
    if (source === "upload") reportUnusableFile(slugs, filename);
    else clearStoredFavourites(); // a stored list this year's catalogue no longer knows
    return;
  }

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
  saveFavourites(state.favSlugs, filename, savedAt);

  clearUploadError();
  syncSearchStars(); // the search popup's stars mirror the grid

  // A fresh upload starts from the default window; a one-by-one add/remove is
  // a quiet tweak to a grid in use, so it leaves the user's dates alone.
  if (!keepWindow) {
    state.d0 = DEFAULT_D0;
    state.d1 = DEFAULT_D1;
  }
  buildCalendar(); // builds the lanes DOM…
  refresh(); // …then the first plan + verdicts + counts
  showCalendar();
}

/** Say why a dropped file gave us nothing, without touching the board. */
function reportUnusableFile(slugs, filename) {
  if (slugs.length === 0) {
    showUploadError(
      "No favourites in that file",
      "It carries no edfringe.com show links — check you exported your favourites page as CSV.",
      filename
    );
  } else {
    showUploadError(
      `None of those ${slugs.length} favourites are in this year's programme`,
      "That looks like an export from a previous Fringe.",
      filename
    );
  }
}

// Where the file comes from. The empty board deliberately carries no how-to
// copy, so the one place that explains the export is the message you get when
// your file was the wrong thing — which is exactly when you need it.
const FAVOURITES_PAGE_URL = "https://www.edfringe.com/tickets/my-account/favourites";

function showUploadError(main, sub, filename) {
  $("usMain").textContent = main;
  $("usSub").innerHTML =
    `${escapeHtml(sub)} ` +
    `<a class="link-quiet" href="${FAVOURITES_PAGE_URL}" target="_blank" rel="noopener">Your favourites page</a>`;
  $("usFile").textContent = filename || "";
  $("usFile").hidden = !filename;
  $("uploadSummary").hidden = false;
}

function clearUploadError() {
  $("uploadSummary").hidden = true;
  $("dropzone").classList.remove("is-reject");
}

/**
 * Swap the board's body to the grid (and show the plan panel below it). Nothing
 * scrolls: the board is the same box in the same place either way, and a page
 * that jumps under you on the first added show was the whole complaint.
 */
function showCalendar() {
  $("intakeStage").hidden = true;
  $("calWrap").hidden = false;
  $("clearFavBtn").hidden = false;
  $("legendBtn").hidden = false;
  setLegendOpen(false); // a fresh board opens with the key closed
  $("planPanel").hidden = false;
  updatePlanWindowLabel();
  requestAnimationFrame(() => {
    layoutOverlay();
    refresh(); // schedule geometry needs a laid-out panel
  });
}

/** …and back: the empty board, with the drop stage in the body. */
function showIntake() {
  $("calWrap").hidden = true;
  setLegendOpen(false); // no grid to key
  $("intakeStage").hidden = false;
  $("clearFavBtn").hidden = true;
  $("legendBtn").hidden = true;
  $("planPanel").hidden = true;
  $("lanes").innerHTML = "";
  state.laneRefs = [];
  renderCounts();
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

  for (const [i, show] of ordered.entries()) {
    const lane = document.createElement("div");
    lane.className = "cal-row lane";
    lane.dataset.slug = show.slug;
    // Row half of the gold marks' sheen phase (see segSheen): each lane starts
    // its sweep fractionally after the one above, so the highlight travels down
    // the grid as well as across it. Wrapped so a long favourites list can't
    // wander off into an ever-growing offset.
    lane.style.setProperty("--sheen-lane", `${((i % 24) * 0.12).toFixed(2)}s`);

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
      // Which day this is; the popup (buildCellTip) reads the performances
      // themselves back off the show record, so the cell only has to say when.
      cell.dataset.day = String(d);
      // Column half of the gold marks' sheen phase (see segSheen). Set on every
      // day cell rather than only the gold ones: which performance the plan
      // picks changes on every replan, and the phase has to be a property of
      // *where the mark is*, not of when it turned gold.
      cell.style.setProperty("--sheen-col", `${((d - 1) * 0.055).toFixed(3)}s`);
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
  // Ahead of the empty-board bail: the controls are preferences in their own
  // right, and a change to them is worth keeping whether or not there is
  // anything on the grid to re-plan yet.
  schedulePrefsSave();
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
    arrival: planOpts.arrival,
    departure: planOpts.departure,
    venueCoords: state.venueCoords,
  });
  updateBlockLabels(state.diag);

  const bySlug = new Map(summ.shows.map((s) => [s.slug, s]));
  applyVerdicts(bySlug, filter);
  renderCounts(schedule.counts.scheduledShows);
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
 *   - lunch      : every performance lands on your lunch break  🍽 Lunch conflict
 *   - dinner     : …or on your dinner break                     🍽 Dinner conflict
 *   - meal       : both meal breaks, together, shut it out      🍽 Meal conflict
 *   - combo      : a mix of controls — some performances hit one setting, the
 *                  rest another (or every performance hits two at once); carries
 *                  `kinds`, the culpable controls, for the label and the tip
 *   - cantfit    : catchable in the window, but a clash / cap left no room
 *   - sold       : every performance in the window (or the whole run) is sold out
 *   - baddates   : has bookable performances, but all fall outside your dates
 */
function laneStatus(show, filter, sets) {
  if (sets.scheduled) return { kind: "scheduled" };
  const perfs = show.performances || [];
  const inWindow = perfs.filter((p) => p.date >= filter.dateStart && p.date <= filter.dateEnd);
  const availInWindow = inWindow.filter((p) => p.available);

  if (availInWindow.length > 0) {
    // placementDiagnostics lists a show under every control that would rescue it
    // on its own — name the culprit when there is one, and name the *mix* when
    // there are several, because "lunch + day end" is something the user can act
    // on where a flat "can't fit" is not. Display order: meals first (they're
    // the draggable bands), then the day edges.
    const culprits = ["lunch", "dinner", "early", "late"].filter((k) => sets[`${k}Set`].has(show.slug));
    if (culprits.length === 1) return { kind: culprits[0] };
    if (culprits.length === 2 && culprits[0] === "lunch" && culprits[1] === "dinner") return { kind: "meal" };
    if (culprits.length > 1) return { kind: "combo", kinds: culprits };
    // Blocked by the day-hours/meal filter, yet no *single* control would rescue
    // it: every performance trips two settings at once (say, a long show that
    // spans lunch and runs past the day end). Still a settings problem, not a
    // clash — say so, with no one control to name.
    if (sets.blockedSet.has(show.slug)) return { kind: "combo", kinds: [] };
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

/* The verdicts caused by a control the user owns — a meal break, the day's
 * start or end. Each is drawn as a button that carries you to the setting
 * responsible (see wireConflictJumps), because the useful next move on
 * "Lunch conflict" is to look at your lunch. */
const CONFLICT_KINDS = {
  early: { label: "Too early", control: "ctlDayStart" },
  late: { label: "Too late", control: "ctlDayEnd" },
  lunch: { label: "Lunch conflict", control: "mealLunchStart" },
  dinner: { label: "Dinner conflict", control: "mealDinnerStart" },
  meal: { label: "Meal conflict", control: "mealLunchStart" },
};

/* The combo verdict names each culpable control; two vocabularies because the
 * pill has ~14 characters of column and the tip title has room for full words. */
const COMBO_SHORT = { lunch: "lunch", dinner: "dinner", early: "early", late: "late" };
const COMBO_FULL = { lunch: "Lunch break", dinner: "Dinner break", early: "Day start", late: "Day end" };

/** "Lunch + late" — the combo pill's label. Three or more culprits (or none
 *  nameable, when every performance trips two settings at once) collapse to the
 *  control groups, since the point is "several of your settings", not a list. */
function comboLabel(kinds) {
  if (kinds.length === 2) {
    const s = kinds.map((k) => COMBO_SHORT[k]).join(" + ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  const mealsOn = state.mealBreaks.some((m) => m.enabled !== false);
  return mealsOn ? "Hours + meals" : "Day hours";
}

/** The kinds a combo pill's click should light up. An empty list (no single
 *  culprit) means the settings gang up in pairs — flash all of them. */
function comboJumpKinds(kinds) {
  if (kinds.length) return kinds;
  const all = ["early", "late"];
  for (const m of state.mealBreaks) if (m.enabled !== false && CONFLICT_KINDS[m.id]) all.push(m.id);
  return all;
}

/** The status pill HTML for a lane verdict (see laneStatus for the kinds). */
function statusPillHTML(status) {
  // No native title attributes — those are the browser's ugly tooltip; the short
  // pill label carries the verdict on its own, and the conflict pills below
  // open a real explanation on hover (see conflictTipHTML).
  const conflict = CONFLICT_KINDS[status.kind];
  if (conflict) {
    return (
      `<button type="button" class="st-blocked st-conflict" data-conflict="${status.kind}">` +
      `<span class="st-warn" aria-hidden="true">▲</span>${conflict.label}</button>`
    );
  }
  if (status.kind === "combo") {
    return (
      `<button type="button" class="st-blocked st-conflict" data-conflict="combo" data-kinds="${status.kinds.join(",")}">` +
      `<span class="st-warn" aria-hidden="true">▲</span>${comboLabel(status.kinds)}</button>`
    );
  }
  switch (status.kind) {
    case "scheduled":
      return `<span class="st-plan">&check;&nbsp;Scheduled!</span>`;
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
 * Play the one-shot "this just entered the plan" swell on a day mark. The class
 * is stripped first (and a reflow forced) so a mark that wins the slot twice in
 * quick succession restarts the animation rather than sitting still — without
 * that, `add` on an already-present class is a no-op.
 */
function flashLockIn(seg) {
  seg.classList.remove("seg--justlocked");
  void seg.offsetWidth; // reflow: makes the re-add a fresh animation
  seg.classList.add("seg--justlocked");
  seg.addEventListener("animationend", () => seg.classList.remove("seg--justlocked"), { once: true });
}

/**
 * Update each lane's state and right-hand verdict (see laneStatus for the
 * kinds). The lane also mirrors the plan on its performance marks, and a forced
 * (must-see) lane carries a pin.
 */
const BLOCKED_KINDS = new Set(["early", "late", "lunch", "dinner", "meal", "combo"]);

function applyVerdicts(bySlug, filter) {
  const diag = state.diag || {};
  const slugsOf = (list) => new Set((list || []).map((s) => s.slug));
  const sets = {
    earlySet: slugsOf(diag.dayStart),
    lateSet: slugsOf(diag.dayEnd),
    lunchSet: slugsOf(diag.meals && diag.meals.lunch),
    dinnerSet: slugsOf(diag.meals && diag.meals.dinner),
    // Every show the day-hours/meal filter shuts out — a superset of the four
    // above, because a show can be blocked with no single control to blame.
    blockedSet: diag.blockedSlugs || new Set(),
  };
  for (const ref of state.laneRefs) {
    const show = bySlug.get(ref.slug);
    if (!show) continue;
    const scheduled = state.scheduledSlugs.has(ref.slug);
    const forced = state.forced.has(ref.slug);
    const status = laneStatus(show, filter, { scheduled, ...sets });
    const dimmed = status.kind === "baddates" || status.kind === "sold";
    const amber = BLOCKED_KINDS.has(status.kind);

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
      // Gold arriving is news; gold that was already gold is not. Compare
      // against the mark's current state *before* toggling, so a replan only
      // animates the performances that actually changed hands.
      if (isSelected && !seg.classList.contains("seg--selected")) flashLockIn(seg);
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

/* --- Conflict pills: explain, then take you to the cause ------------------ */

/** "HH:MM" for a minute-of-day. */
function hhmm(min) {
  return `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** One combo-tip clause per culpable control, in the user's own numbers. */
function comboClause(kind) {
  const meal = state.mealBreaks.find((m) => m.id === kind);
  if (meal) return `some run during your ${kind} break (${hhmm(meal.startMin)}–${hhmm(meal.endMin)})`;
  if (kind === "early") return `some start before your day does (${hhmm(state.dayStartMin)})`;
  return `some run past the end of your day (${hhmm(effectiveDayEnd())})`;
}

/** The hover card for a conflict pill: what is blocking the show, in the user's
 *  own numbers, and what clicking will do about it. A combo pill carries the
 *  culpable kinds and gets a clause per culprit — the point being that no one
 *  setting is to blame, but changing any one of them frees a performance. */
function conflictTipHTML(kind, kinds) {
  if (kind === "combo") {
    if (kinds.length) {
      const title = kinds.map((k) => COMBO_FULL[k]).join(" + ");
      const what =
        `No single setting blocks this show — together they do: ` +
        `${kinds.map(comboClause).join("; ")}. ` +
        `Changing any one of these would free at least one performance.`;
      return (
        `<p class="tip-title">${title}</p>` +
        `<p class="tip-desc tip-desc--lead">${what}</p>` +
        `<p class="tip-hint">Click to go to the settings responsible</p>`
      );
    }
    return (
      `<p class="tip-title">Day hours + meal breaks</p>` +
      `<p class="tip-desc tip-desc--lead">Every performance of this show trips two of your settings at once ` +
      `(day hours, meal breaks), so no single change will free one — it takes two.</p>` +
      `<p class="tip-hint">Click to go to the settings responsible</p>`
    );
  }
  const meal = state.mealBreaks.find((m) => m.id === kind);
  let what;
  if (meal) {
    what =
      `Every performance of this show runs during your ${kind} break ` +
      `(${hhmm(meal.startMin)}–${hhmm(meal.endMin)}), so the plan can't take it.`;
  } else if (kind === "meal") {
    what = "Every performance of this show runs during one of your meal breaks, so the plan can't take it.";
  } else if (kind === "early") {
    what = `Every performance starts before your day does (${hhmm(state.dayStartMin)}).`;
  } else {
    what = `Every performance runs past the end of your day (${hhmm(effectiveDayEnd())}).`;
  }
  return (
    `<p class="tip-title">${CONFLICT_KINDS[kind].label}</p>` +
    `<p class="tip-desc tip-desc--lead">${what}</p>` +
    `<p class="tip-hint">Click to go to the setting and change it</p>`
  );
}

/**
 * Wire the conflict pills, delegated from the lanes container so it survives
 * every re-render: hover explains the block, clicking scrolls to the control
 * that caused it and flashes it — the shortest path from "why isn't this in my
 * plan?" to the thing that would fix it.
 */
function wireConflictJumps() {
  const lanes = $("lanes");
  const tip = $("calTip");

  lanes.addEventListener("click", (e) => {
    const btn = e.target.closest(".st-conflict");
    if (!btn) return;
    // A combo pill has several settings to answer for: scroll to the first and
    // flash them all, so the mix reads as a mix on arrival.
    const kinds =
      btn.dataset.conflict === "combo"
        ? comboJumpKinds((btn.dataset.kinds || "").split(",").filter(Boolean))
        : [btn.dataset.conflict];
    const els = kinds.map((k) => CONFLICT_KINDS[k] && $(CONFLICT_KINDS[k].control)).filter(Boolean);
    if (!els.length) return;
    tip.hidden = true;
    els[0].scrollIntoView({ behavior: "smooth", block: "center" });
    for (const el of els) {
      const ctl = el.closest(".ctl") || el;
      ctl.classList.remove("ctl--flash");
      void ctl.offsetWidth; // restart the animation
      ctl.classList.add("ctl--flash");
      ctl.addEventListener("animationend", () => ctl.classList.remove("ctl--flash"), { once: true });
    }
  });

  // Registered after wireCellTips, whose handler hides the popup for anything
  // that isn't a day cell — this one then claims it back for the pill.
  lanes.addEventListener("pointerover", (e) => {
    const btn = e.target.closest(".st-conflict");
    if (!btn) return;
    const kind = btn.dataset.conflict;
    // Two combo pills can name different mixes — key the "already up" check on
    // the whole identity, kinds included.
    const key = kind + ":" + (btn.dataset.kinds || "");
    if (!tip.hidden && tip.dataset.conflict === key) return; // already up
    tip.dataset.conflict = key;
    tip.innerHTML = conflictTipHTML(kind, (btn.dataset.kinds || "").split(",").filter(Boolean));
    tip.hidden = false;
    const r = btn.getBoundingClientRect();
    const x = Math.min(Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2),
                       window.innerWidth - tip.offsetWidth - 8);
    const above = r.top - tip.offsetHeight - 10;
    tip.style.left = `${x}px`;
    tip.style.top = `${above < 8 ? r.bottom + 10 : above}px`;
  });
}

/** Briefly highlight the shut-out shows' lanes on the availability grid. */
function flashBlockedLanes(list) {
  if (!list.length) return;
  const slugs = new Set(list.map((s) => s.slug));
  $("board")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  for (const ref of state.laneRefs) {
    if (!slugs.has(ref.slug)) continue;
    ref.el.classList.remove("lane--flash");
    void ref.el.offsetWidth; // restart the animation
    ref.el.classList.add("lane--flash");
    ref.el.addEventListener("animationend", () => ref.el.classList.remove("lane--flash"), { once: true });
  }
}

/**
 * The board's one line of text: how much of what you've picked is actually in
 * the plan. It's the whole top area, in both states — empty it reads as the
 * standing invitation, filled it reads as the score.
 *
 * @param {number} scheduled shows the current plan placed (0 when the board is
 *   empty, which is also the empty-state wording's cue)
 */
function renderCounts(scheduled = 0) {
  const el = $("boardCount");
  if (!el) return;
  const selected = state.matched.length;
  if (selected === 0) {
    el.classList.remove("is-live");
    el.textContent = "No shows planned, no shows selected";
    return;
  }
  const changed = el.dataset.planned !== String(scheduled);
  el.dataset.planned = String(scheduled);
  el.classList.add("is-live");
  el.innerHTML =
    `<span class="bc-planned">${scheduled}</span> show${scheduled === 1 ? "" : "s"} planned ` +
    `out of <span class="bc-selected">${selected}</span> selected!`;
  if (changed) {
    el.classList.remove("bump");
    void el.offsetWidth; // restart the animation
    el.classList.add("bump");
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

/* A faint stripe down every Sat/Sun column, the full height of the board. The
 * day header already bolds the weekend numbers, but on a tall grid the lanes
 * are far from that row — the stripe carries the same "this is a weekend" cue
 * all the way down. Built once, then re-placed with the rest of the overlay
 * geometry (the columns flex, so the widths move with the board). */
function layoutWeekendStripes(trackLeft, dayW) {
  const host = $("wkndCols");
  if (!host) return;
  if (host.childElementCount === 0) {
    for (let d = 1; d <= DAYS_IN_MONTH; d++) {
      if (!isWeekend(d)) continue;
      const stripe = document.createElement("div");
      stripe.className = "wknd-col";
      stripe.dataset.day = String(d);
      host.appendChild(stripe);
    }
  }
  for (const stripe of host.children) {
    const d = Number(stripe.dataset.day);
    stripe.style.left = trackLeft + (d - 1) * dayW + "px";
    stripe.style.width = dayW + "px";
  }
}

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

  layoutWeekendStripes(trackLeft, dayW);

  paintWindow();
}

/* Park the two date-window edge grips at the middle of the grid the visitor can
 * actually see. The overlay they live on spans the full scroll height, so CSS
 * alone can only centre them on the whole lane list — on a long list that puts
 * the knob off-screen, and the edges go back to looking like inert chrome.
 *
 * Measured against the scroller's visible band, below the sticky header that
 * covers its top, then clamped to the lanes so the knob never rides up into the
 * day header or past the last row. */
function positionWindowGrips() {
  const wrap = $("calWrap");
  const win = $("win");
  const lanes = $("lanes");
  if (!wrap || !win || !lanes) return;
  const stickyH = document.querySelector(".cal-sticky")?.offsetHeight || 0;
  const visibleTop = wrap.scrollTop + stickyH;
  const visibleBottom = wrap.scrollTop + wrap.clientHeight;
  const lanesTop = lanes.offsetTop;
  const lanesBottom = lanesTop + lanes.offsetHeight;
  // Half the grip's long side, so a clamped knob still sits fully on the lanes.
  const inset = 13;
  const mid = (visibleTop + visibleBottom) / 2;
  const y = lanesBottom - lanesTop < inset * 2
    ? (lanesTop + lanesBottom) / 2 // too few lanes to inset against — just centre
    : clamp(mid, lanesTop + inset, lanesBottom - inset);
  win.style.setProperty("--grip-y", `${Math.round(y)}px`);
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
  positionWindowGrips();
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
  // The box shows, mid-drag, whether it will take what's over it: a CSV gets the
  // violet "yes", anything we can already tell isn't one gets a red "no" and a
  // dropEffect of "none", so the browser's own cursor refuses it too.
  ["dragenter", "dragover"].forEach((evt) =>
    dz.addEventListener(evt, (e) => {
      e.preventDefault();
      const ok = dragLooksLikeCsv(e.dataTransfer);
      if (e.dataTransfer) e.dataTransfer.dropEffect = ok ? "copy" : "none";
      dz.classList.toggle("is-dragover", ok);
      dz.classList.toggle("is-reject", !ok);
    })
  );
  ["dragleave", "dragend"].forEach((evt) =>
    dz.addEventListener(evt, () => dz.classList.remove("is-dragover", "is-reject"))
  );
  dz.addEventListener("drop", (e) => {
    e.preventDefault();
    dz.classList.remove("is-dragover", "is-reject");
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
}

/* Clearing throws away every show on the board — an upload, or an evening of
 * searching and starring — and it sat one stray click away from doing it
 * silently. So the button asks first, in place: the first click arms it and
 * names what is about to go, the second does it. Anything else — five seconds,
 * Escape, a click elsewhere on the page — puts it back. No modal: the button is
 * small, and a dialog for this would be heavier than the action. */
function wireFavActions() {
  const btn = $("clearFavBtn");
  let armed = null; // the auto-disarm timer while it waits for a second click

  const disarm = () => {
    clearTimeout(armed);
    armed = null;
    btn.classList.remove("is-armed");
    btn.textContent = "× Clear";
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // don't trip the document listener that disarms it
    if (armed) {
      disarm();
      clearFavourites();
      return;
    }
    const n = state.totalFavourites || state.favSlugs.length;
    btn.textContent = `Clear all ${n} show${n === 1 ? "" : "s"}? Click again`;
    btn.classList.add("is-armed");
    armed = setTimeout(disarm, 5000);
  });

  document.addEventListener("click", () => {
    if (armed) disarm();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && armed) disarm();
  });
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
  const filename = `debug · ${slugs.length} random shows`;
  applyFavourites(slugs, filename, Date.now(), { keepForced: true });
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
  applyFavourites(slugs, state.filename, state.savedAt || Date.now(), {
    keepForced: true, keepWindow: true,
  });
}

// --- Show search: build / top up the grid one show at a time ---------------
//
// One component (#showSearch) in one place — under the board body, whichever
// state the board is in — so building a grid from scratch and topping up a full
// one are the same gesture in the same spot. Results render as one line per
// show; the star on the left adds the show to the working favourites through the
// same path an upload takes (applyFavourites), so persistence, matching and the
// live re-plan all follow. When the query names a genre, subgenre or venue, those
// come first as category rows that set the matching filter (see renderResultRows).
// The matching/filtering itself is pure and lives in ./lib/search.js.

const SEARCH_LIMIT = 30;
const FACET_SUGGESTION_LIMIT = 4;

const searchUi = {
  active: -1, // index of the keyboard-highlighted row, -1 = none
  // The popup's rows, in display order: the category suggestions first, then the
  // show hits. One list so arrow keys walk both.
  rows: [],
  total: 0,
  shown: 0,
  debounce: null,
  venues: [], // [{value: code, label: name}] — filled once the catalogue lands
  // One entry per facet: a Set for the multi-select lists, a string ("" = not
  // set) for the two single-answer ones.
  filters: {
    genre: new Set(),
    subgenre: new Set(),
    accessibility: new Set(),
    venue: new Set(),
    age: "",
    price: "",
  },
};

/** "AUDIO_DESCRIPTION" → "Audio description". */
function humanizeEnum(v) {
  const s = String(v).replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* The six search facets, each rendered as a chip that drops a panel of
 * options with a grey count of how many shows it would give you.
 *   multi    — a checkbox list (ticking a second box widens the search); the
 *              single-answer ones (age, price) are radios.
 *   values   — the option list, once the catalogue is in.
 *   valuesOf — a show's own value(s) for the facet, when it has a fixed set we
 *              can tally in one pass. Facets without it (the "up to X" caps)
 *              are counted by testing each option with `matches`.
 *   label    — how a value is written for people (venue codes, enums, caps).
 *   find     — the facet's panel gets a type-to-narrow box over a long list.
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
    // Keyed on the venue *code*, so picking "Pleasance Courtyard" takes every
    // room in it. 300-odd options, hence the find box.
    key: "venue",
    id: "Venue",
    multi: true,
    any: "Any venue",
    noun: "venues",
    find: true,
    values: () => searchUi.venues.map((v) => v.value),
    label: (v) => venueLabel(v),
    valuesOf: (show) => (show.venue != null ? [String(show.venue)] : []),
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
    // The same ladder the Now page's "$" chip offers, minus its "any" option —
    // this facet expresses "any" as no radio chosen. Sharing it is what keeps
    // the two pages from quoting different budgets for the same catalogue.
    values: () => PRICE_OPTIONS.filter((o) => o.value !== "any").map((o) => o.value),
    label: (v) => (PRICE_OPTIONS.find((o) => o.value === v) || {}).label || v,
    matches: (show, v) => matchesPrice(show, v),
    // The price cache is fetched once while the festival keeps adding shows, so
    // some shows have no amount; the caps stay offered as long as *any* paid
    // show is priced, and simply exclude the unknowns (shared/price.js).
    optionUnavailable: (v) => v !== "free" && !state.facets.hasPrice,
    optionUnavailableHint: "No ticket prices scraped yet — “Free” already works",
  },
];

const facetById = (key) => SEARCH_FACETS.find((f) => f.key === key);

/** The chosen value(s) of a facet, as a list. */
function facetChosen(facet) {
  const v = searchUi.filters[facet.key];
  return facet.multi ? [...v] : v ? [v] : [];
}

/** Is every option this facet offers already ticked? (Never true for the
 *  single-answer facets, which offer one radio at a time.) */
function allOptionsChosen(facet) {
  if (!facet.multi) return false;
  const values = facet.values();
  return values.length > 0 && values.every((v) => searchUi.filters[facet.key].has(v));
}

/** Read the facet state into a lib/search.js-shaped filters object. */
function currentSearchFilters() {
  const f = searchUi.filters;
  const filters = {
    genre: [...f.genre],
    subgenre: [...f.subgenre],
    accessibility: [...f.accessibility],
    venue: [...f.venue],
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

/** A venue code as people read it ("Pleasance Courtyard"). */
function venueLabel(code) {
  const venues = (state.lookups && state.lookups.venues) || {};
  const entry = venues[code];
  return (entry && entry.name) || String(code);
}

/** Narrow a long option list to the rows matching what's typed in its find box. */
function wireFacetFind(facet) {
  const box = $(`ssf${facet.id}Find`);
  const wrap = $(`ssf${facet.id}Options`);
  if (!box || !wrap) return;
  box.addEventListener("input", () => {
    const q = box.value.trim().toLowerCase();
    for (const row of wrap.querySelectorAll(".panel-option")) {
      const text = (row.textContent || "").toLowerCase();
      row.hidden = q !== "" && !text.includes(q);
    }
  });
  // Typing in the box must not be read as "pick the first row" by the bar's
  // keyboard handling, and Escape should clear the box before closing anything.
  box.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && box.value !== "") {
      e.stopPropagation();
      box.value = "";
      box.dispatchEvent(new Event("input"));
    }
  });
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
  searchUi.venues = catalogueVenues(state.catalogue, state.lookups.venues);
  buildAllFacetPanels();
  for (const facet of SEARCH_FACETS) if (facet.find) wireFacetFind(facet);
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

/* Focus has left the search for good: close the overlay and drop the query
 * text with it. A finished search is spent — coming back to the bar should
 * start a new one, not the leftovers of the one whose shows are already
 * starred. Filters are deliberately kept: they live on the tools line, which
 * stays as set. */
function dismissSearch() {
  const input = $("ssInput");
  input.value = "";
  searchUi.rows = [];
  searchUi.total = 0;
  searchUi.shown = 0;
  setSearchOpen(false);
}

function runSearch() {
  if (!state.index) return; // catalogue still loading — the input just holds the text
  const query = $("ssInput").value;
  const filters = currentSearchFilters();
  if (query.trim() === "" && !hasActiveFilters(filters)) {
    searchUi.rows = [];
    searchUi.total = 0;
    searchUi.shown = 0;
    setSearchOpen(false);
    return;
  }
  const { results, total } = searchShows(state.catalogue, query, filters, {
    limit: SEARCH_LIMIT,
    // Search the fullest text we have for each show: the sidecar's if it has
    // downloaded, the catalogue's blurb until then. Same query, deeper reach.
    describe: (show) => state.descriptions.get(show.slug) || show.blurb || "",
  });
  // Categories the query names, minus any already ticked — offering a filter
  // that's already on would be a dead row.
  const suggestions = matchFacets(
    query,
    { genres: state.lookups.genres, subgenres: state.lookups.subgenres, venues: searchUi.venues },
    { limit: FACET_SUGGESTION_LIMIT }
  ).filter((s) => !searchUi.filters[s.kind].has(s.value));

  searchUi.rows = [
    ...suggestions.map((facet) => ({ kind: "facet", facet })),
    ...results.map((show) => ({ kind: "show", show })),
  ];
  searchUi.total = total;
  searchUi.shown = results.length;
  renderSearchResults();
}

function renderSearchResults() {
  const list = $("ssResults");
  list.innerHTML = "";
  const favs = new Set(state.favSlugs);
  searchUi.rows.forEach((row, i) => {
    list.appendChild(
      row.kind === "facet" ? buildFacetRow(row.facet, i) : buildSearchRow(row.show, i, favs.has(row.show.slug))
    );
  });
  $("ssEmpty").hidden = searchUi.rows.length > 0;
  const foot = $("ssFoot");
  const capped = searchUi.total > searchUi.shown;
  foot.hidden = !capped;
  if (capped) {
    foot.textContent =
      `Showing ${searchUi.shown} of ${searchUi.total} matches — keep typing to narrow it down`;
  }
  setActiveRow(-1);
  setSearchOpen(true);
}

function starLabel(title, isOn) {
  return isOn ? `Remove ${title} from your grid` : `Add ${title} to your grid`;
}

const FACET_KIND_LABEL = { genre: "Genre", subgenre: "Subgenre", venue: "Venue" };

/** A category row: picking it sets a filter rather than adding a show, so it
 *  looks like the filter chips it feeds, not like the show rows below it. */
function buildFacetRow(facet, i) {
  const li = document.createElement("li");
  li.className = "ss-row ss-row--facet";
  li.id = `ssOpt${i}`;
  li.setAttribute("role", "option");
  li.setAttribute("aria-selected", "false");
  li.dataset.facetKind = facet.kind;
  li.dataset.facetValue = facet.value;

  const count = filterShows(state.catalogue, { [facet.kind]: [facet.value] }).length;
  li.innerHTML =
    `<span class="ss-facet-ico" aria-hidden="true">` +
    `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M7 12h10M10 17h4" /></svg>` +
    `</span>` +
    `<span class="ss-facet-kind">${FACET_KIND_LABEL[facet.kind]}</span>` +
    `<span class="ss-row-title">${escapeHtml(facet.label)}</span>` +
    `<span class="ss-facet-hint">Filter to ${count} show${count === 1 ? "" : "s"}</span>`;
  li.setAttribute("aria-label", `Filter to ${FACET_KIND_LABEL[facet.kind]} ${facet.label} — ${count} shows`);
  return li;
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
    // The real price where we have one ("£12", "£22.50–£29.50"), "Free" where
    // the flag says so, and nothing at all where we don't know — a search row
    // is no place to advertise a gap in the price cache.
    showPrice(show) === null ? null : priceLabel(show),
    show.genre,
    show.venueName,
    typicalStartTime(show.performances || []),
  ].filter(Boolean).join(" · ");

  li.append(star, title, meta);
  return li;
}

/**
 * Pick a category row: tick that value in its facet, drop the query it came from
 * (the text and the filter would fight — "comedy" as free text only matches
 * shows with the word in them), and open the tools so the chip that just changed
 * is on screen.
 */
function applyFacetSuggestion(kind, value) {
  searchUi.filters[kind].add(value);
  $("ssInput").value = "";
  setToolsOpen(true);
  onSearchFilterChange();
  $("ssInput").focus({ preventScroll: true });
}

/** Re-mark every rendered result row against the current favourites, so the
 *  stars always mirror the grid (called on any favourites change). */
function syncSearchStars() {
  const list = $("ssResults");
  if (!list) return;
  const favs = new Set(state.favSlugs);
  for (const row of list.querySelectorAll(".ss-row")) {
    if (!row.dataset.slug) continue; // a category row has no star to sync
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
  applyFavourites(slugs, state.filename, state.savedAt || Date.now(), {
    keepForced: true, keepWindow: true,
  });
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
    const link = document.querySelector(`.panel-everything[data-clear="${facet.key}"]`);
    if (link) {
      const all = allOptionsChosen(facet);
      link.textContent = all ? "nothing!" : "everything!";
      link.title = all ? "Untick every option" : facet.multi ? "Tick every option" : "Back to any";
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

/** Fold the facet-chip row under the bar open or shut. */
function setToolsOpen(open) {
  $("ssTools").hidden = !open;
  $("ssToolsBtn").setAttribute("aria-expanded", String(open));
  if (!open) closeFacetPanels();
}

/** What a result row does when it's clicked or Entered. */
function activateRow(row) {
  if (!row) return;
  if (row.kind === "facet") applyFacetSuggestion(row.facet.kind, row.facet.value);
  else toggleShowOnGrid(row.show.slug);
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
  // "everything!" ticks every option in a checkbox list; once they all are, it
  // reads "nothing!" and clears them. Near-equivalent searches — they differ
  // only by the shows declaring no value for the facet at all, which "all
  // ticked" excludes and "none ticked" keeps — but it hands you the slate you
  // want to pick from. The two single-answer facets can never be "all", so
  // theirs only ever clears.
  for (const link of document.querySelectorAll(".panel-everything[data-clear]")) {
    link.addEventListener("click", (e) => {
      e.stopPropagation();
      const facet = facetById(link.dataset.clear);
      if (!facet) return;
      if (!facet.multi) searchUi.filters[facet.key] = "";
      else if (allOptionsChosen(facet)) searchUi.filters[facet.key].clear();
      else for (const v of facet.values()) searchUi.filters[facet.key].add(v);
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
    const n = searchUi.rows.length;
    if (e.key === "ArrowDown" && n > 0) {
      e.preventDefault();
      if ($("ssPop").hidden) setSearchOpen(true);
      setActiveRow((searchUi.active + 1) % n);
    } else if (e.key === "ArrowUp" && n > 0) {
      e.preventDefault();
      setActiveRow((searchUi.active - 1 + n) % n);
    } else if (e.key === "Enter" && searchUi.active >= 0 && searchUi.active < n) {
      e.preventDefault();
      activateRow(searchUi.rows[searchUi.active]);
    } else if (e.key === "Escape" && !$("ssPop").hidden) {
      e.stopPropagation();
      setSearchOpen(false);
    }
  });

  // A row is one target: the star and the line do the same thing — add/remove
  // the show, or (on a category row) set that filter.
  $("ssResults").addEventListener("click", (e) => {
    const el = e.target.closest(".ss-row");
    if (!el) return;
    const i = [...$("ssResults").children].indexOf(el);
    if (i >= 0) activateRow(searchUi.rows[i]);
  });

  $("ssToolsBtn").addEventListener("click", () => setToolsOpen($("ssTools").hidden));

  wireFacetChips();
  $("ssReset").addEventListener("click", () => {
    clearSearchFilters();
    onSearchFilterChange();
    input.focus({ preventScroll: true });
  });

  // Click-away closes the results overlay and clears the query (the tools
  // line stays as set).
  document.addEventListener("click", (e) => {
    // Picking a category row re-renders the list, so by the time the click
    // reaches the document its target is a detached node — which is not "away".
    if (!e.target.isConnected) return;
    if (!root.contains(e.target)) dismissSearch();
  });
  // Same for tabbing out. Only a known destination outside the component
  // counts: a null relatedTarget is the ambiguous case (clicking a
  // non-focusable result row lands there too), and the click handler above
  // already covers the pointer path.
  root.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !root.contains(e.relatedTarget)) dismissSearch();
  });
}

// The debug menu starts hidden in the markup and is revealed only for a
// location confirmed outside the UK — the overseas-tester case. An unknown
// location (denied / unavailable / no geolocation API) is an ordinary visitor,
// not a tester, so the tools stay hidden.
function showDebugOutsideUK() {
  const menu = $("debugMenu");
  if (!menu || !("geolocation" in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (!isInUK([pos.coords.latitude, pos.coords.longitude])) menu.hidden = false;
    },
    () => {}, // denied / unavailable — keep the debug tools hidden
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
          arrival: state.diag.arrival,
          departure: state.diag.departure,
        }
      : null,
    perf: state.perf,
  };
  downloadText("fringe-plan-debug.json", JSON.stringify(snapshot, null, 2), "application/json");
}

function wireRetry() {
  $("retryBtn").addEventListener("click", () => {
    $("errorState").hidden = true;
    const retried = loadData();
    if (state.pendingUpload) {
      const { slugs, filename, savedAt, source } = state.pendingUpload;
      applyFavourites(slugs, filename, savedAt, { source }); // reports its own failure
    } else {
      // A boot-load retry: nothing downstream is watching, so this is the only
      // thing that would put the panel back if it fails again.
      retried.catch(showLoadError);
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

  // Scrolling the lane list moves what "the middle of the grid" means, and it's
  // the one thing that changes it without a repaint — so the grips follow it
  // directly. Passive: this only ever writes a custom property.
  $("calWrap")?.addEventListener("scroll", positionWindowGrips, { passive: true });
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

// --- The day-mark popup ----------------------------------------------------

/** The matched show a lane is showing, by slug. */
function showBySlug(slug) {
  return state.matched.find((s) => s.slug === slug) || null;
}

/** Text cut to `max` characters on a word boundary, with an ellipsis when it
 *  actually had to cut. */
function trimTo(text, max) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

/**
 * The popup for one day cell: the show, that day's performances with their
 * ticket status, what the plan did with them, and a line of description when
 * the sidecar has arrived (see loadDescriptions — it may never arrive, and the
 * card is complete without it).
 *
 * @param {HTMLElement} lane the .lane the cell belongs to (carries the slug)
 * @param {HTMLElement} cell the hovered .cell (carries the day of month)
 * @returns {string} popup HTML, or "" when there's nothing to say
 */
function buildCellTip(lane, cell) {
  const show = showBySlug(lane.dataset.slug);
  const day = Number(cell.dataset.day);
  if (!show || !day) return "";

  const date = `${YEAR}-${MONTH}-${String(day).padStart(2, "0")}`;
  const perfs = show.performances
    .filter((p) => p.date === date)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (perfs.length === 0) return "";

  const selectedKey = state.selectedSlot.get(show.slug) || null;
  const pin = state.forced.get(show.slug);
  const pinnedKey = typeof pin === "string" ? pin : null;

  const rows = perfs
    .map((p) => {
      const key = slotKey({ date: p.date, start: p.start });
      const planned = selectedKey != null && key === selectedKey;
      const pinned = pinnedKey != null && key === pinnedKey;
      const note = pinned ? "locked into your plan" : planned ? "in your plan" : statusLabel(p);
      return (
        `<li class="tip-perf${planned || pinned ? " tip-perf--planned" : ""}">` +
        // Same classes the grid mark itself wears, so the swatch and the bar it
        // describes can never drift apart.
        `<i class="seg ${planned || pinned ? "seg--selected" : segClass(p)}"></i>` +
        `<b>${escapeHtml(p.start)}</b>` +
        `<span class="tip-status">${escapeHtml(note)}</span>` +
        `</li>`
      );
    })
    .join("");

  const meta = [show.genre, show.venueName].filter(Boolean).map(escapeHtml).join(" · ");
  // A full description can run several paragraphs; the card is a glance, not a
  // programme entry, so it shows the opening and stops on a word boundary.
  const desc = trimTo(descriptionFor(show.slug), 240);
  const hint = pinnedKey != null && perfs.some((p) => slotKey(p) === pinnedKey)
    ? "Click the locked mark to unlock it"
    : "Click a mark to lock that performance in";

  return (
    `<p class="tip-title">${escapeHtml(show.title)}</p>` +
    (meta ? `<p class="tip-meta">${meta}</p>` : "") +
    `<p class="tip-date">${dowShort(day)} ${day} Aug</p>` +
    `<ul class="tip-perfs">${rows}</ul>` +
    (desc ? `<p class="tip-desc">${escapeHtml(desc)}</p>` : "") +
    `<p class="tip-hint">${hint}</p>`
  );
}

function wireCellTips() {
  const lanes = $("lanes");
  const tip = $("calTip");
  let shownFor = null; // the cell the popup currently describes

  /* Anchored to the cell, not the cursor: centred on the mark, above it when
   * there's room and below it when there isn't, and always clamped inside the
   * viewport. */
  const position = (cell) => {
    const gap = 10;
    const r = cell.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = r.left + r.width / 2 - w / 2;
    x = Math.min(Math.max(8, x), window.innerWidth - w - 8);
    let y = r.top - h - gap;
    if (y < 8) y = r.bottom + gap;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  };

  const hide = () => {
    tip.hidden = true;
    shownFor = null;
  };

  lanes.addEventListener("pointerover", (e) => {
    const cell = e.target.closest(".cell");
    const lane = cell && cell.closest(".lane");
    if (!cell || !lane || !cell.dataset.day) {
      hide();
      return;
    }
    if (cell === shownFor) return; // same mark — leave the card where it is
    const html = buildCellTip(lane, cell);
    if (!html) {
      hide();
      return;
    }
    tip.innerHTML = html;
    delete tip.dataset.conflict; // this card is a day mark, not a conflict
    tip.hidden = false;
    shownFor = cell;
    position(cell);
  });
  lanes.addEventListener("pointerleave", hide);
  calWrap().addEventListener("scroll", hide);
  window.addEventListener("resize", hide);
}

// --- Screen 3: the plan ----------------------------------------------------

const SCH_HOUR_PX = 34; // the axis now spans a fixed 09:00–27:00 (18h), so a
                        // shorter hour keeps the whole night on one calm board
const SCH_MIN_BLOCK = 34;
/* Below this, a block can't carry a two-line title *and* its meta line, so the
 * start–end time goes and the title clamps to one line — the axis beside the
 * block already says when it is, and the venue is the fact you can't get
 * anywhere else. Blocks never fall below SCH_MIN_BLOCK, and a floor-height
 * block still fits a title line plus the meta line comfortably. */
const SCH_TIGHT_PX = 42;
// The width of a day with nothing planned in it. Wide enough to carry the date
// and read as a day, narrow enough that a fortnight of blanks doesn't squeeze
// the days you're actually going out on.
const SCH_EMPTY_COL_PX = 30;
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
  // One sentence, and nothing after it. The old "3 forced in · by walk" tail
  // restated two things the page already shows — the pinned lanes carry their
  // own padlocks, and the travel mode is a lit button a few inches above.
  el.append("Planned ", strong, ` across ${days} day${days === 1 ? "" : "s"} (${planWindowText()}).`);
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

  // Days to draw: EVERY day in the window, not only the ones that got shows.
  // Drawing just the full days made a plan look denser than it was — three
  // columns side by side read as three consecutive days even when a blank
  // Wednesday sat between them. The blank days are still not worth a full
  // column, so they collapse to a narrow placeholder (.sch-day--empty): the gap
  // is visible, and it costs the real days almost nothing.
  const bySchedDate = new Map(schedule.days.map((d) => [d.date, d]));
  const renderDays = [];
  for (let d = state.d0; d <= state.d1; d++) {
    const date = dateStr(d);
    renderDays.push(bySchedDate.get(date) || { date, slots: [] });
  }
  // A scheduled day outside the current window shouldn't silently vanish.
  for (const day of schedule.days) {
    if (!renderDays.some((d) => d.date === day.date)) renderDays.push(day);
  }
  renderDays.sort((a, b) => a.date.localeCompare(b.date));

  // A day earns a full column when it has shows, or when it is a trip boundary
  // whose "getting there" / "getting out" block needs somewhere to live.
  // Everything else collapses to SCH_EMPTY_COL_PX.
  const isFullColumn = (day) =>
    day.slots.length > 0 ||
    (state.arrival.enabled && day.date === dateStr(state.d0)) ||
    (state.departure.enabled && day.date === dateStr(state.d1));

  // Columns flex to share the width, so on a many-day plan each one gets tight.
  // Flag two breakpoints the CSS uses to shed chrome the block can't afford:
  // narrow drops the tiny start–end time; tiny also drops the genre emoji, so
  // the show title always wins the space. The collapsed days are subtracted
  // first — they take a fixed sliver, not a share.
  const wrapW = ($("scheduleWrap").clientWidth || 800) - SCH_GUTTER_PX;
  const emptyCount = renderDays.filter((d) => !isFullColumn(d)).length;
  const fullCount = Math.max(1, renderDays.length - emptyCount);
  const colW = Math.max(1, (wrapW - emptyCount * SCH_EMPTY_COL_PX) / fullCount);
  host.classList.toggle("cols-narrow", colW < 78);
  host.classList.toggle("cols-tiny", colW < 56);

  // One column per day; the full ones flex to share the width, the empty ones
  // hold a fixed sliver so the gap in the plan is visible without costing the
  // days that have something in them.
  for (const day of renderDays) {
    const dayNum = Number(day.date.slice(8, 10));
    const full = isFullColumn(day);
    const col = document.createElement("div");
    col.className = "sch-day" + (isWeekend(dayNum) ? " wknd" : "") + (full ? "" : " sch-day--empty");
    col.dataset.date = day.date;

    const head = document.createElement("div");
    head.className = "sch-day-head";
    // A collapsed day has room for the date and nothing else; the day of the
    // week and the "0 shows" count would only be truncated into noise.
    head.innerHTML = full
      ? `<div class="sch-dow">${DOW_LONG[dow(dayNum)]} <span class="sch-date">${dayNum} Aug</span></div>` +
        `<div class="sch-day-count">${day.slots.length} show${day.slots.length === 1 ? "" : "s"}</div>`
      : `<div class="sch-dow sch-dow--empty">${dayNum}</div>`;
    if (!full) col.title = `${DOW_LONG[dow(dayNum)]} ${dayNum} Aug — nothing planned`;

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

  // Draggable overlay: day-start / day-end lines + meal bands. It needs the
  // real width of the first and last columns (as a percentage of the board) so
  // the day-start line + top zone can skip the first (arrival) column and the
  // day-end line + bottom zone the last (departure) one, where the trip blocks
  // own the boundary instead. Not 100/columns any more — the collapsed days
  // make the columns unequal.
  const boardW = emptyCount * SCH_EMPTY_COL_PX + fullCount * colW;
  const pctOf = (day) => ((isFullColumn(day) ? colW : SCH_EMPTY_COL_PX) / boardW) * 100;
  host.appendChild(buildScheduleOverlay(axisH, y, {
    start: pctOf(renderDays[0]),
    end: pctOf(renderDays[renderDays.length - 1]),
  }));
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
  // Column widths too: a day that gains or loses its last show collapses or
  // expands, and that is a change the eye should be able to follow.
  const widths = new Map();
  for (const col of host.querySelectorAll(".sch-day")) {
    widths.set(col.dataset.date, col.getBoundingClientRect().width);
  }
  const days = new Set(widths.keys());
  return { blocks, days, widths };
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

  // Whole new day columns ease in; surviving ones whose width changed (a day
  // that just lost its last show collapses, one that just gained a show opens
  // up) slide between the two widths instead of snapping.
  for (const col of host.querySelectorAll(".sch-day")) {
    if (newDays.has(col.dataset.date)) {
      col.classList.add("sch-day--enter");
      continue;
    }
    const was = prev.widths ? prev.widths.get(col.dataset.date) : undefined;
    if (was != null) widthTween(col, was);
  }

  // Departed shows: float a ghost where they sat and fade it out.
  for (const [slug, info] of prev.blocks) {
    if (seen.has(slug)) continue;
    ghostOut(host, info);
  }
}

/**
 * Width FLIP for a day column. The board is rebuilt from scratch on every
 * re-plan, so there is no element left to transition — instead the fresh column
 * is pinned to the width its predecessor had, then released on the next frame
 * so it animates to the width it actually wants. The inline flex is dropped
 * afterwards, handing the column back to the flex layout.
 *
 * @param {HTMLElement} col the freshly rendered column
 * @param {number} fromWidth the width the same date had a moment ago, in px
 */
function widthTween(col, fromWidth) {
  const to = col.getBoundingClientRect().width;
  if (Math.abs(to - fromWidth) < 1) return;
  const done = () => {
    col.style.transition = "";
    col.style.flex = "";
  };
  col.style.transition = "none";
  col.style.flex = `0 0 ${fromWidth}px`;
  requestAnimationFrame(() => {
    col.style.transition = "flex-basis 0.32s ease";
    col.style.flex = `0 0 ${to}px`;
    col.addEventListener("transitionend", done, { once: true });
    // A transition that never fires (an interrupted render, a tab in the
    // background) must not strand the column at a fixed width.
    setTimeout(done, 600);
  });
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
  // What actually fits, measured off the block's own height rather than the
  // column width — an hour-long slot is cramped on any screen. The title and
  // the venue are what survive; the clock is readable off the axis beside it.
  if (height < SCH_TIGHT_PX) block.classList.add("sch-show--tight");

  const timeStr = `${slot.startTime}–${slotEndTime(slot)}`;
  const venue = slot.venueName || slot.venueCode || "";
  // Title first, then one meta line carrying time and venue together — they used
  // to be a line each, which spent two thirds of a small block on chrome.
  // No native title — the rich hover card (fillShowCard) carries all of this, and
  // a title here would double up as a second, parallel tooltip on hover.
  block.innerHTML =
    (forced ? `<span class="sch-pin" aria-hidden="true">🔒</span>` : "") +
    `<span class="sch-emoji" aria-hidden="true">${genreEmoji(slot.genre)}</span>` +
    `<span class="sch-body-text">` +
    `<span class="sch-name">${escapeHtml(slot.title)}</span>` +
    `<span class="sch-meta">` +
    `<span class="sch-time">${escapeHtml(timeStr)}</span>` +
    (venue ? `<span class="sch-venue">${escapeHtml(venue)}</span>` : "") +
    `</span></span>`;
  return block;
}

/** A narrow travel-leg block in the gap between two shows < 1h apart. */
function buildTravelLeg(a, b, top, bottom) {
  const leg = document.createElement("div");
  leg.className = "sch-leg";
  leg.style.top = `${top}px`;
  leg.style.height = `${Math.max(0, bottom - top)}px`;

  // How long the gap actually is, so the leg can say what's left after the
  // journey rather than only how long the journey takes — "12 min walk" in a
  // 15-minute gap and in an hour-long one are very different facts.
  const gapMin = Math.max(0, b.startMinuteOfDay - a.endMinuteOfDay);
  const spareStr = (travelMin) => {
    const spare = Math.round(gapMin - travelMin);
    return spare >= 0 ? `+${spare}′` : `${spare}′`;
  };

  const sameVenue = a.venueCode && b.venueCode && a.venueCode === b.venueCode;
  let text;
  let title;
  if (sameVenue) {
    text = `same venue · ${gapMin}′ gap`;
    title = `${a.venueName || "Same venue"} — no travel, ${gapMin} min between shows`;
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
      text = `nearby · ${gapMin}′ gap`;
      title = "Travel time unknown (venue has no coordinates)";
    } else {
      const meta = MODE_META[state.mode];
      // Primes rather than "min": three facts fit on the line that one and a
      // half used to, and the leg is read at a glance, not parsed. The signed
      // slack goes unlabelled — spelling out "spare" pushed the line past the
      // pill in a normal-width column, and the hover title says it in full.
      text = `${Math.round(mins)}′ · ${km.toFixed(1)}km · ${spareStr(mins)}`;
      title =
        `${meta.emoji} ${Math.round(mins)} min ${meta.verb} · ${km.toFixed(1)} km ` +
        `from ${a.venueName || "there"} to ${b.venueName || "there"} — ` +
        `${gapMin} min gap, ${Math.round(gapMin - mins)} min spare`;
    }
  }
  leg.title = title;
  leg.innerHTML = `<span class="leg-emoji" aria-hidden="true">${MODE_META[state.mode].emoji}</span><span class="leg-text">${escapeHtml(text)}</span>`;
  return leg;
}

// --- The draggable day-hours / meal-break overlay --------------------------

function buildScheduleOverlay(axisH, y, boundaryPct = { start: 0, end: 0 }) {
  const overlay = document.createElement("div");
  overlay.className = "sch-overlay";
  overlay.style.left = `${SCH_GUTTER_PX}px`;
  overlay.style.top = `${SCH_HEAD_PX}px`;
  overlay.style.height = `${axisH}px`;
  overlay.dataset.axisTop = state.schedAxis.axisTopMin;
  // Kept on the element so the live drag pass (repositionOverlayLive) can
  // recompute the meal bands' boundary insets without re-measuring the columns.
  overlay.dataset.boundaryStart = boundaryPct.start;
  overlay.dataset.boundaryEnd = boundaryPct.end;

  const dayEnd = effectiveDayEnd();
  // Skip the boundary column where a trip block already owns the edge: the
  // getting-there block replaces day-start on the first column, getting-out
  // replaces day-end on the last.
  const insetStart = state.arrival.enabled ? boundaryPct.start : 0;
  const insetEnd = state.departure.enabled ? boundaryPct.end : 0;

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
  // "Need a place to sleep?" — the night is exactly where that question lands.
  const sleepNag = buildNag("sleep", axisH - y(dayEnd));
  if (sleepNag) zoneBottom.appendChild(sleepNag);
  overlay.append(zoneTop, zoneBottom);

  // Meal-break bands (enabled only), each stopping short of a boundary column
  // whose trip block already owns that stretch of the day.
  for (const meal of state.mealBreaks) {
    if (!meal.enabled) continue;
    overlay.appendChild(buildMealBand(meal, y, boundaryPct));
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
  line.innerHTML =
    `<span class="dl-grip" aria-hidden="true"></span>` +
    `<span class="dl-flag"><span class="ov-text">${label} ${clock}</span>${exclMarkHTML(blocks)}</span>`;
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

/** The conflict mark a blocker label carries when its constraint is shutting
 *  shows out — the same red triangle the lane's status pills use, so "conflict"
 *  reads the same on every board label (day lines, meal bands, trip blocks) as
 *  it does in the grid. Hover it for the list of what it excludes. */
function exclMarkHTML(list) {
  if (!list.length) return "";
  const label = `excludes ${list.length} show${list.length === 1 ? "" : "s"}`;
  return `<span class="excl-mark" data-excl="${exclData(list)}" aria-label="${label}">▲</span>`;
}

/* How far a meal band pulls back from the first / last day column, as a
 * percentage of the board width. The trip blocks own the top of the first day
 * and the bottom of the last, and two "you can't be here" hatches stacked on the
 * same minutes read as one confused region — so a band only spans a boundary
 * column when it clears that column's trip block: arriving *before* the meal
 * starts leaves a real meal window on day one, arriving after it doesn't.
 * Mirrored for the departure at the other end. */
function mealInsets(meal, boundaryPct = { start: 0, end: 0 }) {
  const left = state.arrival.enabled && state.arrival.endMin > meal.startMin ? boundaryPct.start : 0;
  const right = state.departure.enabled && state.departure.startMin < meal.endMin ? boundaryPct.end : 0;
  // A one-day window makes the first and last column the same one, so insetting
  // from both ends would leave nothing to draw (and nothing to grab). Let the
  // band span it instead — there is no other column to move it to.
  if (left + right >= 100) return { left: 0, right: 0 };
  return { left, right };
}

function buildMealBand(meal, y, boundaryPct) {
  const band = document.createElement("div");
  band.className = "sch-meal";
  band.style.top = `${y(meal.startMin)}px`;
  band.style.height = `${Math.max(6, y(meal.endMin) - y(meal.startMin))}px`;
  const inset = mealInsets(meal, boundaryPct);
  band.style.left = `${inset.left}%`;
  band.style.right = `${inset.right}%`;
  band.dataset.meal = meal.id;
  const name = meal.id.charAt(0).toUpperCase() + meal.id.slice(1);
  const blocks = (state.diag && state.diag.meals && state.diag.meals[meal.id]) || [];
  const timeStr = `${minToHHMM(meal.startMin)}–${minToHHMM(meal.endMin)}`;
  // A faint, playful scatter of food emoji — filled in once laid out
  // (populateDecors), so the count matches the band's actual area. The
  // centre label carries the time + meal + the red conflict triangle when the
  // break is shutting shows out (hover it for the list), instead of a separate
  // corner badge.
  band.innerHTML =
    decorSpan("food", meal.id) +
    `<span class="meal-resize meal-resize--top" data-edge="top"></span>` +
    `<span class="meal-label"><span class="ov-text">${timeStr} · 🍽 ${name}</span>${exclMarkHTML(blocks)}</span>` +
    `<span class="meal-resize meal-resize--bottom" data-edge="bottom"></span>`;
  wireMealDrag(band, meal);
  return band;
}

/* --- Partner nags -------------------------------------------------------
 *
 * The board already draws the two gaps a Fringe trip has to fill and this site
 * doesn't sell: the night below "day ends" (where are you sleeping?) and the
 * getting-there / getting-out blocks (how are you getting here?). Each grows one
 * small partner link — the question, not a pitch — closed for good with its ×.
 *
 * The link itself (and the affiliate tagging on it) comes from
 * ../shared/affiliates.js; everything here is presentation.
 */
const NAGS = {
  sleep: {
    emoji: "🛏️",
    question: "Need a place to sleep?",
    // The whole trip window: you need a bed for the nights between arriving on
    // the first day and leaving on the last.
    link: () => stayLink({ checkinISO: dateStr(state.d0), checkoutISO: dateStr(state.d1) }),
  },
  travel: {
    emoji: "🎟️", // tickets — the block's own 🚆 / 🧳 already carry the journey
    question: "Transportation sorted?",
    link: () => travelLink(),
  },
};

// A region shorter than this can't hold the pill without it spilling over the
// region's edges, so the nag is simply left out (drag the boundary back and it
// returns on the next re-plan).
const NAG_MIN_PX = 30;

/** The nag element for a region of `heightPx`, or null when it's dismissed or
 *  the region is too short to host it. */
function buildNag(kind, heightPx) {
  if (state.nagsDismissed.has(kind) || heightPx < NAG_MIN_PX) return null;
  const nag = NAGS[kind];
  const { text, partner, url } = nag.link();

  const el = document.createElement("div");
  el.className = "sch-nag";
  el.dataset.nag = kind;

  const cta = document.createElement("a");
  cta.className = "nag-cta";
  cta.href = url;
  cta.target = "_blank";
  // sponsored: paid placement, per rel-attribute conventions. noopener/noreferrer
  // keep the partner's tab away from ours.
  cta.rel = "sponsored noopener noreferrer";
  cta.title = `${nag.question} ${text} on ${partner} — partner link, we may earn a commission`;
  cta.innerHTML =
    `<span class="nag-emoji" aria-hidden="true">${nag.emoji}</span>` +
    `<span class="nag-text">${escapeHtml(nag.question)}</span>`;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "nag-x";
  close.setAttribute("aria-label", `Hide the “${nag.question}” suggestion`);
  close.textContent = "×";
  close.addEventListener("click", (e) => {
    // The nag sits on draggable furniture (the night zone's day-end line, the
    // trip block's edge) — don't let the click reach it.
    e.preventDefault();
    e.stopPropagation();
    dismissNag(kind);
  });

  el.append(cta, close);
  return el;
}

/** Hide a region's nag while a drag squeezes that region below the pill's size,
 *  instead of letting it spill past the edges; dropping the drag re-plans and
 *  rebuilds the region from scratch. */
function toggleNagFit(region, heightPx) {
  const nag = region.querySelector(".sch-nag");
  if (nag) nag.hidden = heightPx < NAG_MIN_PX;
}

/** Close a nag everywhere it's drawn (the travel one appears on both boundary
 *  days) and remember it, so it stays closed on the next visit. */
function dismissNag(kind) {
  state.nagsDismissed.add(kind);
  saveDismissedNags();
  for (const el of $("schedule").querySelectorAll(`.sch-nag[data-nag="${kind}"]`)) el.remove();
}

/* "Getting there" (top of the first day) / "getting out" (bottom of the last
 * day) block. Rendered inside its own day-column body so it stays on that one
 * day; you drag the inner edge to set how much of the day travel eats. */
function buildTripBlock(which, y, axisH) {
  const block = document.createElement("div");
  block.className = `sch-trip sch-trip--${which}`;
  block.dataset.trip = which;
  // The trip block's label carries the same conflict triangle as the day lines
  // and meal bands when the block alone is shutting shows out of the plan.
  const blocks = (state.diag && (which === "arrival" ? state.diag.arrival : state.diag.departure)) || [];
  let blockH;
  if (which === "arrival") {
    blockH = y(state.arrival.endMin);
    block.style.top = "0px";
    block.style.height = `${y(state.arrival.endMin)}px`;
    block.title = "Getting there — drag the lower edge; no shows are placed before this on your first day";
    block.innerHTML =
      decorSpan("travel", "arrival") +
      `<span class="sch-trip-label"><span class="ov-text">🚆 Arrive ${minToHHMM(state.arrival.endMin)}</span>${exclMarkHTML(blocks)}</span>` +
      `<span class="meal-resize meal-resize--bottom" data-edge="bottom"></span>`;
  } else {
    blockH = Math.max(6, axisH - y(state.departure.startMin));
    block.style.top = `${y(state.departure.startMin)}px`;
    block.style.height = `${blockH}px`;
    block.title = "Getting out — drag the upper edge; no shows are placed after this on your last day";
    block.innerHTML =
      decorSpan("travel", "departure") +
      `<span class="meal-resize meal-resize--top" data-edge="top"></span>` +
      `<span class="sch-trip-label"><span class="ov-text">🧳 Leave ${minToDayClock(state.departure.startMin)}</span>${exclMarkHTML(blocks)}</span>`;
  }
  // "Transportation sorted?" on both trip blocks — the same question whether
  // you're getting in or getting out. It hugs the block's *outer* edge (top of
  // arrival, bottom of departure) so it never lands on the draggable inner one.
  const travelNag = buildNag("travel", blockH);
  if (travelNag) block.appendChild(travelNag);
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
        block.querySelector(".sch-trip-label .ov-text").textContent = `🚆 Arrive ${minToHHMM(v)}`;
        toggleNagFit(block, yy(v));
      } else {
        const v = clamp(min, state.dayStartMin, axis.axisBottomMin);
        const h = Math.max(6, axisH - yy(v));
        state.departure.startMin = v;
        block.style.top = `${yy(v)}px`;
        block.style.height = `${h}px`;
        block.querySelector(".sch-trip-label .ov-text").textContent = `🧳 Leave ${minToDayClock(v)}`;
        toggleNagFit(block, h);
      }
      // The meal bands stop at this column only while it overlaps them, so they
      // follow the edge as it's dragged past a meal break.
      repositionOverlayLive();
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
    toggleNagFit(zones[1], axisH - y(dayEnd));
  }
  const startLine = overlay.querySelector(".sch-dayline--start");
  if (startLine) {
    startLine.style.top = `${y(state.dayStartMin)}px`;
    startLine.querySelector(".dl-flag .ov-text").textContent = `Day starts ${minToHHMM(state.dayStartMin)}`;
  }
  const endLine = overlay.querySelector(".sch-dayline--end");
  if (endLine) {
    endLine.style.top = `${y(dayEnd)}px`;
    endLine.querySelector(".dl-flag .ov-text").textContent = `Day ends ${minToDayClock(dayEnd)}`;
  }
  const boundaryPct = {
    start: Number(overlay.dataset.boundaryStart) || 0,
    end: Number(overlay.dataset.boundaryEnd) || 0,
  };
  for (const meal of state.mealBreaks) {
    if (!meal.enabled) continue;
    const band = overlay.querySelector(`.sch-meal[data-meal="${meal.id}"]`);
    if (!band) continue;
    band.style.top = `${y(meal.startMin)}px`;
    band.style.height = `${Math.max(6, y(meal.endMin) - y(meal.startMin))}px`;
    // Dragging the band (or a trip block) can cross a boundary block, so the
    // first/last-column pull-back is recomputed on every frame, not just on drop.
    const inset = mealInsets(meal, boundaryPct);
    band.style.left = `${inset.left}%`;
    band.style.right = `${inset.right}%`;
    const name = meal.id.charAt(0).toUpperCase() + meal.id.slice(1);
    band.querySelector(".meal-label .ov-text").textContent = `${minToHHMM(meal.startMin)}–${minToHHMM(meal.endMin)} · 🍽 ${name}`;
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
 * A cursor-following popup listing the shows a day-hours line, meal break, or
 * trip block excludes. Delegated over the schedule for any [data-excl] target
 * (the conflict triangle on any board label pill) — a nicer, narrower cousin
 * of the show hover card.
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
    downloadText(
      "fringe-plan.ics",
      toIcs(state.schedule.scheduled, {
        now: new Date(),
        calendarName: `Fringe ${YEAR} · ${planWindowText()}`,
      }),
      "text/calendar;charset=utf-8"
    );
    // A downloaded .ics is only half the job — most people then stall on
    // Google Calendar's import, or import into their main calendar and can't
    // get the plan back out. Say how, at the moment they need it.
    const howto = $("icsHowto");
    howto.hidden = false;
    howto.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  $("icsHowtoClose").addEventListener("click", () => {
    $("icsHowto").hidden = true;
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

  // The pill is hidden for most visitors, so the footer copyright carries the
  // version too — in a popup of its own (shared with the Now page).
  const copy = $("footerVersion");
  if (copy && state.version) attachVersionPopup(copy, `EdFringeNow v${state.version}`);

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
showDebugOutsideUK();
wireRetry();
wireCalendarControls();
wireWindowOptimizer();
wireLegendFold();
wireCellTips();
wireConflictJumps(); // after wireCellTips — see the comment on its pointerover
wireScheduleInteractions();
wireExcludePopup();
wirePlanControls();
wireExports();

// After the controls are wired (so syncPlanControls has them to write to) and
// before loadData(), whose restoreStoredFavourites plans against these values.
restorePlanPrefs();
window.addEventListener("pagehide", flushPlanPrefs);

renderPerfPill(); // paint the version placeholder immediately
loadVersion();
loadData().catch(showLoadError);
