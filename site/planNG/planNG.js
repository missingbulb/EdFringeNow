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

import { eligibleSlots, slotKey } from "../plan/lib/engine.js";
import { draftCalendar, instanceKey } from "../plan/lib/contention.js";
import { slotEndTime } from "../plan/lib/itinerary.js";
import { distanceKm, travelMinutes } from "../plan/lib/travel.js";
import { carHireLink, flightFareLink, flightSearchLink } from "../shared/affiliates.js";
import { attachVersionPopup } from "../shared/version-popup.js";
import { readVersionStamp } from "../shared/version.js";
import { currentEdition, loadEdition, loadFestivalIndex, venueCoords } from "../shared/festival-catalogue.js";
import { dayTripKm, originReach, poolReach } from "../shared/feasibility.js";
import {
  FACET_OPTIONS,
  MAX_PERIOD_DAYS,
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
  presentationOf,
} from "./festivals.js";
import { buildPool, daysOf, festivalOf, shiftDay } from "./lib/pool.js";
import { GENRES, GENRE_EMOJI, nextTagMode, passesFilters, sharedGenre } from "./lib/filters.js";
import { migrateLegacy } from "./lib/migrate.js";
import { AGES, PARTIES, suggestedAnswers } from "./lib/party.js";
import { ASSUMED_LENGTH_MIN, NIGHT_END_MIN, flightHours, mealAt, seedDay, slotRule } from "./lib/days.js";
import { airportCode, fareCurrency, fetchFares, originAirport } from "./lib/flights.js";
import { GROUND, arrivalOf, hasCar } from "./lib/arrival.js";
import { animateCalendar, snapshotCalendar } from "./motion.js";
import { holidayBreaks, holidaysUrl, homeCountry } from "./lib/holidays.js";
import { editionKey, timelineSpan } from "./lib/timeline.js";
import { leadEdition, normalizeTrip, tripForEdition, tripFromQuery } from "./lib/trip.js";
import { showCityPhoto } from "./city-backdrop.js";
import { cheer, layoutRows, renderTimeline, wireTimelineCards, wireTripHandles } from "./timeline-view.js";
import { currentDir, currentIntlLocale, currentLocale, escapeHtml, initI18n, t, tHtml } from "./i18n/i18n.js";

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));


// The calendar's axis is the same every day, whatever is drafted and wherever
// the reader's own day starts or ends, so nothing they change resizes it: from
// 08:00 to 01:00 the next morning, and with the night opened, from 23:00 the
// evening before. An hour is drawn the height that fits the daytime axis in
// SCH_AXIS_TARGET_PX.
const AXIS_DAY_TOP_MIN = 8 * 60;
const AXIS_NIGHT_TOP_MIN = -60;
const AXIS_BOTTOM_MIN = 25 * 60;
const SCH_AXIS_TARGET_PX = 780;
const SCH_HOUR_PX = Math.round(SCH_AXIS_TARGET_PX / ((AXIS_BOTTOM_MIN - AXIS_DAY_TOP_MIN) / 60));
const SCH_HEAD_PX = 42;
// A card's face carries the show and nothing else — its name, its hour and its
// venue — so its floor is what those two rows measure. Everything the page has
// to say about the card is in the popup.
const SCH_MIN_BLOCK = 44;
const SCH_TIGHT_PX = 52;
const SCH_GUTTER_PX = 44;
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
const KEY_TRIP = STORAGE_PREFIX + "trip";
const KEY_DAYS = STORAGE_PREFIX + "days";

/* The countries the origin question offers by name, beyond the festival's own.
 * Named by Intl in the reader's language, so there is no list of country names
 * to translate; any other country is "somewhere else abroad". */
const ORIGIN_COUNTRIES = ["GB", "US", "FR", "DE", "RU", "UA", "IT", "ES", "NL", "PL", "JP", "CA", "AU"];

const state = {
  // The registry, and the edition that leads the trip: the one its dates
  // cover most (lib/trip.js), whose theme the page wears.
  registry: null,
  focus: null,        // { festival, edition, key }
  // The trip: the reader's first and last day, set on the timeline. Every day
  // in it is a column of the calendar.
  period: null,       // { from, to } inclusive ISO dates
  // The festival the reader chose on the timeline, as an edition key: it
  // leads the trip for as long as the trip reaches its run.
  pick: null,
  // The flights either side of the trip, as the fare service last answered:
  // `status` is "idle" (no flight to look for), "wait", "found" or "none".
  fares: { out: { status: "idle", fares: [] }, back: { status: "idle", fares: [] } },
  // The cheapest flight each way, which is what the calendar's first and last
  // day can be bounded by: { departAt, durationMin } or null.
  flights: { out: null, back: null },
  reach: [],          // poolReach() for every edition overlapping the period
  origin: null,       // what the reader said about where they come from
  asking: false,      // the origin question is open, asked from the flight blocks
  guess: null,        // the country the reader connects from, until they say
  // The reader's own public holidays: whose, and the file's contents once read.
  holidays: { country: null, guessed: false, doc: null },
  editions: new Map(), // dataUrl -> Promise of an adapted catalogue
  browsePages: 1,
  poolSlugs: new Set(),
  kinds: new Map(), // slug -> the shared kind it is filed under
  // The pool: every reachable show in the period, ids made unique by pool.js.
  catalogue: null,
  dates: [],          // every day of the period, ascending — the grid's columns
  venues: new Map(),
  coords: new Map(),
  starred: new Set(),
  dayStartMin: 9 * 60,
  dayEndMin: 25 * 60,
  meals: [
    { id: "breakfast", enabled: false, startMin: 8 * 60, endMin: 9 * 60, place: "" },
    { id: "lunch", enabled: false, startMin: 12 * 60 + 30, endMin: 13 * 60 + 30, place: "" },
    { id: "dinner", enabled: false, startMin: 18 * 60, endMin: 19 * 60, place: "" },
  ],
  // The reader's own days: what a kept day is for (date -> {kind, festival}),
  // and the blocks they put on the calendar — meals and personal time, each
  // on its own day. `seededFor` is the trip a first draft last kept a day
  // for, so a day the reader cleared is not kept again; `mealDates` are the
  // days the food answer has already laid its meals on.
  kept: new Map(),
  own: [],
  seededFor: null,
  mealDates: new Set(),
  maxPerDay: 3,
  minGap: 30,
  minGapSame: 0,
  mode: "walk",
  // The axis and column widths held still for the duration of a blocker drag.
  drag: null,
  // The kinds the reader said they came for, from lib/filters.js's GENRES.
  // Empty is the honest default and means no taste stated at all, which is not
  // the same as having chosen every kind — see MAX_OFF_INTEREST_PER_DAY.
  interests: new Set(),
  // Who is coming, and which questions the reader has answered themselves:
  // every other one takes the answer who is coming suggests (lib/party.js).
  party: null,        // { type, ages } or null: nobody said yet
  answered: new Set(), // "pace" | "interests" | "food" | "dayEnd" | "travel"
  // Between the airport and town, for a reader who flies: a GROUND id or null.
  ground: null,
  // Whether the calendar shows the night, 23:00 to 08:00: see nightToggle().
  nightOpen: false,
  // The filters, which unlike a kind drop shows from the draft outright:
  // festivals left out, and tags (a festival's own categories, by pool id)
  // required ("only") or ruled out ("out").
  festivalsOut: new Set(),
  tags: new Map(),
  // Which chip's panel is open, and what the tag box holds. Not stored: it is
  // where the reader has got to, not something they decided.
  openChip: null,
  tagQuery: "",
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
  return `<span ${foreignAttrs(id)}>${escapeHtml(text)}</span>`;
}

/** The language and direction of a festival's own words, as attributes. */
function foreignAttrs(id) {
  const festival = festivalById(festivalOf(id)) || (state.focus && state.focus.festival);
  const lang = festival ? festival.lang : "und";
  const dir = festival ? festival.dir : "auto";
  return `lang="${lang}" dir="${dir}"`;
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

const tripStartISO = () => state.dates[0];
const tripEndISO = () => state.dates[state.dates.length - 1];

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

/* The date window is remembered per edition, so going back to a festival finds
 * it as it was left; everything else is the reader's own and holds on every
 * festival. The trip itself is KEY_TRIP's. */
function savePrefs() {
  writeStore(KEY_PREFS, {
    dayStartMin: state.dayStartMin,
    dayEndMin: state.dayEndMin,
    meals: state.meals,
    maxPerDay: state.maxPerDay,
    minGap: state.minGap,
    minGapSame: state.minGapSame,
    mode: state.mode,
    interests: [...state.interests],
    festivalsOut: [...state.festivalsOut],
    tags: Object.fromEntries(state.tags),
    party: state.party,
    answered: [...state.answered],
    ground: state.ground,
    nightOpen: state.nightOpen,
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
  state.maxPerDay = Number.isFinite(saved.maxPerDay) ? Math.max(0, saved.maxPerDay) : state.maxPerDay;
  state.minGap = Number.isFinite(saved.minGap) ? saved.minGap : state.minGap;
  state.minGapSame = Number.isFinite(saved.minGapSame) ? saved.minGapSame : state.minGapSame;
  if (MODE_META[saved.mode]) state.mode = saved.mode;
  // A kind stored before the kinds were shared across festivals was a
  // category slug; it names no shared kind and is dropped.
  if (Array.isArray(saved.interests)) state.interests = new Set(saved.interests.filter((g) => GENRES.includes(g)));
  if (Array.isArray(saved.festivalsOut)) state.festivalsOut = new Set(saved.festivalsOut);
  if (saved.party && PARTIES.includes(saved.party.type)) {
    state.party = { type: saved.party.type, ages: (saved.party.ages || []).filter((n) => AGES.includes(n)) };
  }
  if (Array.isArray(saved.answered)) state.answered = new Set(saved.answered);
  if (GROUND.includes(saved.ground)) state.ground = saved.ground;
  state.nightOpen = saved.nightOpen === true;
  if (saved.tags && typeof saved.tags === "object") {
    state.tags = new Map(Object.entries(saved.tags).filter(([, mode]) => mode === "only" || mode === "out"));
  }
}

function saveDays() {
  writeStore(KEY_DAYS, {
    kept: Object.fromEntries(state.kept),
    own: state.own,
    seededFor: state.seededFor,
    mealDates: [...state.mealDates],
  });
}

function restoreDays() {
  const saved = readStore(KEY_DAYS, null);
  if (!saved) return;
  if (saved.kept && typeof saved.kept === "object") {
    state.kept = new Map(Object.entries(saved.kept).filter(([, d]) => d && KEEP_META[d.kind]));
  }
  if (Array.isArray(saved.own)) {
    state.own = saved.own.filter(
      (b) => b && OWN_META[b.kind] && typeof b.date === "string" && Number.isFinite(b.startMin) && b.endMin > b.startMin
    );
  }
  state.seededFor = typeof saved.seededFor === "string" ? saved.seededFor : null;
  if (Array.isArray(saved.mealDates)) state.mealDates = new Set(saved.mealDates);
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

  // The credit for the city photograph behind the page, which its licence asks for.
  const photo = festival && photoOf(festival);
  $("footerPhoto").innerHTML = photo
    ? tHtml(
        "footer.photo",
        {},
        {
          photo: `<a href="${escapeHtml(photo.source)}" target="_blank" rel="noopener">${escapeHtml(photo.title)}</a>`,
          author: escapeHtml(photo.author),
          licence: `<a href="${escapeHtml(photo.licenceUrl)}" target="_blank" rel="noopener">${escapeHtml(photo.licence)}</a>`,
        }
      )
    : "";
}

/** The photograph of the festival's city, or null when there is none. */
function photoOf(festival) {
  const p = presentationOf(festival.id);
  return (p && p.photo) || null;
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

// --- the preference questions ---------------------------------------------
//
// The row between the year's strip and the calendar: one chip per question,
// each naming its current answer, and behind each a panel that floats over the
// calendar with the picture answers and — where a picture is shorthand for
// numbers — the numbers themselves. The chip is one line whatever the answer,
// so the calendar never moves. A picture is never a coarser control than the
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
  late: { emoji: "\u{1F35C}", nameKey: "meal.late" },
  snack: { emoji: "\u{1F36A}", nameKey: "meal.snack" },
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

/** Every show of a kind the reader named — the drafter's `preferred`. */
function preferredSlugs() {
  if (!state.interests.size || !state.catalogue) return [];
  return state.catalogue.shows
    .filter((show) => state.interests.has(sharedGenre(show.genreId)))
    .map((show) => show.slug);
}

/** The pool the draft is drawn from: every show the filters keep. */
function filteredShows() {
  const filters = { festivalsOut: state.festivalsOut, tags: state.tags };
  return state.catalogue.shows.filter((show) => passesFilters(show, filters));
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

/** A kind's name, in the reader's language. */
const GENRE_KEY = {
  film: "genre.film",
  comedy: "genre.comedy",
  theatre: "genre.theatre",
  dance: "genre.dance",
  music: "genre.music",
  family: "genre.family",
  talk: "genre.talk",
  other: "genre.other",
};

/** One question: a chip naming its answer, and the panel behind it. */
function questionHtml(id, askKey, answer, body) {
  const open = state.openChip === id;
  return (
    `<section class="pref${open ? " is-open" : ""}${isSuggested(id) ? " is-suggested" : ""}" data-q="${id}">` +
    `<button type="button" class="pref-chip" data-open="${id}" aria-expanded="${open}"` +
    ` aria-controls="panel-${id}" aria-haspopup="true">` +
    `<span class="pref-ask">${escapeHtml(t(askKey))}` +
    `<span class="pref-suggested" role="img" aria-label="${escapeHtml(t("prefs.suggested"))}"` +
    ` title="${escapeHtml(t("prefs.suggested"))}">✨</span></span>` +
    `<span class="pref-answer">${answer}</span>` +
    `<span class="pref-caret" aria-hidden="true">▾</span></button>` +
    `<div class="pref-panel" id="panel-${id}" role="group" aria-label="${escapeHtml(t(askKey))}"` +
    `${open ? "" : " hidden"}>${body}</div>` +
    `</section>`
  );
}

/** A chip's answer: the lit picture, or the words for an answer no picture is. */
const answerHtml = (emoji, words) =>
  `<span class="pref-answer-ico" aria-hidden="true">${emoji}</span>` +
  `<span class="pref-answer-word">${escapeHtml(words)}</span>`;

/** The festivals the pool holds, the one the trip is about first. */
function poolFestivals() {
  const ids = [...new Set(state.catalogue.shows.map((show) => festivalOf(show.slug)))];
  const focusId = state.focus && state.focus.festival.id;
  return ids
    .sort((a, b) => (b === focusId) - (a === focusId))
    .map(festivalById)
    .filter(Boolean);
}

function festivalsAnswer() {
  const festivals = poolFestivals();
  const kept = festivals.filter((f) => !state.festivalsOut.has(f.id));
  if (kept.length === festivals.length) return answerHtml("🎪", t("prefs.festivals.all"));
  if (kept.length === 1) return answerHtml("🎪", festivalName(kept[0]));
  return answerHtml("🎪", t("prefs.festivals.some", { count: kept.length }));
}

/* Each festival marked as its shows are on the calendar, with how far it is
 * from the one leading the trip: a trip reaching several festivals says so
 * here rather than in a line above the calendar for each. A festival too far
 * to reach is named too, with nothing to tick, so it is never silently
 * missing. */
function festivalsHtml() {
  const km = (n) => new Intl.NumberFormat(currentIntlLocale(), { maximumFractionDigits: 0 }).format(n);
  const reachOf = new Map((state.reach || []).map((r) => [r.edition.festival.id, r]));
  const distance = (id) => {
    const r = reachOf.get(id);
    if (!r || r.verdict === "focus") return "";
    const key = r.verdict === "partly" ? "prefs.festivals.partly" : "prefs.festivals.dayTrip";
    return `<span class="fest-km">${escapeHtml(t(key, { km: km(r.km) }))}</span>`;
  };
  const inPool = poolFestivals();
  const inIds = new Set(inPool.map((f) => f.id));
  const out = (state.reach || []).filter((r) => r.verdict === "out" && !inIds.has(r.edition.festival.id));
  return (
    `<div class="pref-checks">` +
    inPool
      .map((festival) => {
        const on = !state.festivalsOut.has(festival.id);
        return (
          `<label class="pref-check fest-row">` +
          `<input type="checkbox" data-festival-on="${escapeHtml(festival.id)}"${on ? " checked" : ""} />` +
          `<span class="fest-stripe" data-festival-colour="${escapeHtml(festival.id)}" aria-hidden="true"></span>` +
          `<span class="fest-words"><span class="pref-check-word">${escapeHtml(festivalName(festival))}</span>` +
          `${distance(festival.id)}</span></label>`
        );
      })
      .join("") +
    out
      .map((r) => {
        const festival = r.edition.festival;
        return (
          `<div class="pref-check fest-row fest-row--out">` +
          `<span class="fest-stripe" data-festival-colour="${escapeHtml(festival.id)}" aria-hidden="true"></span>` +
          `<span class="fest-words"><span class="pref-check-word">${escapeHtml(festivalName(festival))}</span>` +
          `<span class="fest-km">${escapeHtml(t("prefs.festivals.out", { km: km(r.km ?? 0) }))}</span></span></div>`
        );
      })
      .join("") +
    `</div>`
  );
}

function interestsAnswer() {
  const tags = state.tags.size
    ? ` · ${t("prefs.tags.count", { count: state.tags.size })}`
    : "";
  if (!state.interests.size) return answerHtml("✨", t("prefs.interests.all") + tags);
  const chosen = GENRES.filter((g) => state.interests.has(g));
  const words = chosen.length === 1 ? t(GENRE_KEY[chosen[0]]) : t("prefs.interests.some", { count: chosen.length });
  return answerHtml(GENRE_EMOJI[chosen[0]], words + tags);
}

/* The shared kinds, then each festival's own tags. The tags are capped at
 * FACET_OPTIONS — a trip that pools the Fringe with three more festivals has
 * dozens — except a tag already ruled on, which is always shown; the box above
 * them finds the rest by name. */
function interestsHtml() {
  const kinds = GENRES.map((g) => pickHtml("interest", g, GENRE_EMOJI[g], escapeHtml(t(GENRE_KEY[g])), state.interests.has(g))).join("");
  const everything = pickHtml("interest", "*", "✨", escapeHtml(t("prefs.interests.all")), state.interests.size === 0);
  return (
    `<div class="pref-answers pref-answers--kinds">${everything}${kinds}</div>` +
    `<div class="pref-tags">` +
    `<p class="pref-label pref-tags-title">${escapeHtml(t("prefs.tags.title"))}</p>` +
    `<input class="pref-tag-find" type="search" data-tag-find="1" value="${escapeHtml(state.tagQuery)}"` +
    ` placeholder="${escapeHtml(t("prefs.tags.find"))}" aria-label="${escapeHtml(t("prefs.tags.find"))}" />` +
    `<div class="pref-tag-list">${tagListHtml()}</div>` +
    `<p class="pref-note">${escapeHtml(t("prefs.tags.hint"))}</p>` +
    `</div>` +
    varietyFineHtml()
  );
}

function tagListHtml() {
  const query = state.tagQuery.trim().toLocaleLowerCase();
  const byFestival = new Map();
  for (const tag of state.catalogue.categories) {
    if (query && !tag.name.toLocaleLowerCase().includes(query)) continue;
    if (!byFestival.has(tag.festivalId)) byFestival.set(tag.festivalId, []);
    byFestival.get(tag.festivalId).push(tag);
  }
  const ordered = poolFestivals()
    .filter((f) => byFestival.has(f.id))
    .flatMap((f) => byFestival.get(f.id));
  const { rows, more } = capOptions(ordered, (tag) => state.tags.has(tag.slug), FACET_OPTIONS);
  if (!rows.length) return `<p class="pref-note">${escapeHtml(t("prefs.tags.none"))}</p>`;
  let html = "";
  let festivalId = null;
  for (const tag of rows) {
    if (tag.festivalId !== festivalId) {
      if (festivalId) html += `</div></div>`;
      festivalId = tag.festivalId;
      html +=
        `<div class="pref-tag-group"><p class="pref-tag-festival">` +
        `<span class="fest-dot" data-festival-colour="${escapeHtml(festivalId)}" aria-hidden="true"></span>` +
        `${escapeHtml(festivalName(festivalById(festivalId)))}</p><div class="pref-tag-row">`;
    }
    const mode = state.tags.get(tag.slug) || "";
    const mark = mode === "only" ? "✓" : mode === "out" ? "⊘" : "";
    html +=
      `<button type="button" class="pref-tag${mode ? ` is-${mode}` : ""}" data-tag="${escapeHtml(tag.slug)}"` +
      ` aria-pressed="${mode ? "true" : "false"}">` +
      (mark ? `<span class="pref-tag-mark" aria-hidden="true">${mark}</span>` : "") +
      `${foreign(tag.name, tag.slug)}</button>`;
  }
  html += `</div></div>`;
  if (more) {
    html += `<p class="pref-note" data-i18n-slot="prefs.tags.more">${escapeHtml(t("prefs.tags.more", { count: more }))}</p>`;
  }
  return html;
}

function varietyFineHtml() {
  return (
    `<div class="pref-variety">` +
    `<div class="pref-row pref-row--soon">` +
    `<span class="pref-label">${escapeHtml(t("prefs.variety.q"))}</span>` +
    `<span class="pref-soon">${escapeHtml(t("prefs.variety.soon"))}</span>` +
    `</div>` +
    `<div class="pref-answers pref-answers--soon" role="group" aria-label="${escapeHtml(t("prefs.variety.q"))}">` +
    VARIETY_ANSWERS.map((a) =>
      pickHtml("variety", a.id, a.emoji, escapeHtml(t(a.key)), false, { disabled: true })
    ).join("") +
    `</div>` +
    `<p class="pref-note">${escapeHtml(t("prefs.variety.note", { count: MAX_OFF_INTEREST_PER_DAY }))}</p>` +
    `</div>`
  );
}

function paceFineHtml() {
  return (
    `<div class="pref-row">` +
    `<span class="pref-label">${escapeHtml(t("prefs.pace.atMost"))}</span>` +
    `<input class="ctl-num" type="number" min="0" step="1" inputmode="numeric"` +
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

function paceChipAnswer() {
  const step = PACE_STEPS.find((p) => p.id === paceAnswer());
  return step
    ? answerHtml(step.emoji, t(step.key))
    : answerHtml("⏱", t("prefs.pace.custom", { count: state.maxPerDay }));
}

function foodChipAnswer() {
  const answer = FOOD_ANSWERS.find((a) => a.id === foodAnswer());
  return answer ? answerHtml(answer.emoji, t(answer.key)) : answerHtml("🍴", t("prefs.food.custom"));
}

/** Build the whole row. Called once the programme is in, on every answer, and on retranslation. */
const PARTY_META = {
  solo: { emoji: "\u{1F392}", key: "prefs.who.solo" },
  couple: { emoji: "\u{1F377}", key: "prefs.who.couple" },
  family: { emoji: "\u{1F9D2}", key: "prefs.who.family" },
  group: { emoji: "\u{1F37A}", key: "prefs.who.group" },
};

// The questions who is coming answers for the reader until they answer
// themselves; the evening's end is one too, though it is a line on the
// calendar rather than a chip.
const SUGGESTED = ["pace", "interests", "food"];
const isSuggested = (q) =>
  q === "travel"
    ? carWithUs() && !state.answered.has("travel")
    : Boolean(state.party) && SUGGESTED.includes(q) && !state.answered.has(q);

/** Whether the reader has a car with them, from how they said they arrive. */
const carWithUs = () => hasCar(arrivalOf(state.origin), state.ground);

/* A car suggests driving between shows, for a reader who has not chosen how
 * they get around; losing the car takes the suggestion back. */
function applyCar() {
  if (state.answered.has("travel")) return;
  if (carWithUs()) state.mode = "car";
  else if (state.mode === "car") state.mode = "walk";
}

function whoAnswer() {
  if (!state.party) return answerHtml("\u{1F4DD}", t("prefs.who.unset"));
  const meta = PARTY_META[state.party.type];
  return answerHtml(meta.emoji, t(meta.key));
}

function whoHtml() {
  const party = state.party || {};
  const ages =
    party.type === "family"
      ? `<div class="pref-ages"><span class="pref-ages-label">${escapeHtml(t("prefs.who.ages"))}</span>` +
        AGES.map(
          (n) =>
            `<button type="button" class="pref-age${(party.ages || []).includes(n) ? " is-on" : ""}"` +
            ` data-age="${n}" aria-pressed="${(party.ages || []).includes(n)}">${n}</button>`
        ).join("") +
        `</div>`
      : "";
  return (
    `<div class="pref-answers">` +
    PARTIES.map((id) => pickHtml("who", id, PARTY_META[id].emoji, escapeHtml(t(PARTY_META[id].key)), party.type === id)).join("") +
    `</div>` +
    ages
  );
}

/* Every question the reader has not answered takes who-is-coming's suggestion. */
function applySuggestions() {
  const suggested = suggestedAnswers(state.party);
  if (!suggested) return;
  if (!state.answered.has("pace")) {
    const step = PACE_STEPS.find((p) => p.id === suggested.pace);
    state.maxPerDay = step.maxPerDay;
    state.minGap = step.minGap;
  }
  if (!state.answered.has("interests")) state.interests = new Set(suggested.interests);
  if (!state.answered.has("dayEnd")) state.dayEndMin = suggested.dayEndMin;
  if (!state.answered.has("food")) {
    const answer = FOOD_ANSWERS.find((a) => a.id === suggested.food);
    const changed = state.meals.some((m) => m.enabled !== answer.meals.includes(m.id));
    for (const meal of state.meals) meal.enabled = answer.meals.includes(meal.id);
    if (changed) relayMeals();
  }
}

function renderPrefs() {
  const pace = paceAnswer();
  const food = foodAnswer();
  const travel = MODE_META[state.mode];
  $("prefs").innerHTML =
    questionHtml("who", "prefs.who.q", whoAnswer(), whoHtml()) +
    questionHtml("festivals", "prefs.festivals.q", festivalsAnswer(), festivalsHtml()) +
    questionHtml("interests", "prefs.interests.q", interestsAnswer(), interestsHtml()) +
    questionHtml(
      "pace",
      "prefs.pace.q",
      paceChipAnswer(),
      `<div class="pref-answers">` +
        PACE_STEPS.map((p) => pickHtml("pace", p.id, p.emoji, escapeHtml(t(p.key)), p.id === pace)).join("") +
        `</div>` +
        paceFineHtml()
    ) +
    questionHtml(
      "travel",
      "prefs.travel.q",
      answerHtml(travel.emoji, t(travel.nameKey)),
      `<div class="pref-answers">` +
        Object.entries(MODE_META)
          .map(([mode, meta]) =>
            pickHtml("travel", mode, meta.emoji, escapeHtml(t(meta.nameKey)), mode === state.mode, {
              tip: t(meta.tipKey),
            })
          )
          .join("") +
        `</div>` +
        travelFineHtml()
    ) +
    questionHtml(
      "food",
      "prefs.food.q",
      foodChipAnswer(),
      `<div class="pref-answers">` +
        FOOD_ANSWERS.map((a) => pickHtml("food", a.id, a.emoji, escapeHtml(t(a.key)), a.id === food)).join("") +
        `</div>` +
        foodFineHtml()
    );
}

/* Read every answer back off the state without rebuilding the row, so the
 * control the reader just used keeps its focus. */
function syncPrefs() {
  const answers = {
    who: whoAnswer(),
    festivals: festivalsAnswer(),
    interests: interestsAnswer(),
    pace: paceChipAnswer(),
    travel: answerHtml(MODE_META[state.mode].emoji, t(MODE_META[state.mode].nameKey)),
    food: foodChipAnswer(),
  };
  for (const pref of $("prefs").querySelectorAll(".pref")) {
    pref.querySelector(".pref-answer").innerHTML = answers[pref.dataset.q];
    pref.classList.toggle("is-suggested", isSuggested(pref.dataset.q));
  }
  const lit = {
    interest: (id) => (id === "*" ? state.interests.size === 0 : state.interests.has(id)),
    pace: (id) => id === paceAnswer(),
    travel: (id) => id === state.mode,
    food: (id) => id === foodAnswer(),
    who: (id) => Boolean(state.party) && id === state.party.type,
    variety: () => false,
  };
  for (const btn of $("prefs").querySelectorAll("[data-pick]")) {
    const [question, id] = btn.dataset.pick.split(":");
    const on = lit[question](id);
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", String(on));
  }
  for (const box of $("prefs").querySelectorAll("[data-mealon]")) {
    box.checked = mealOf(box.dataset.mealon).enabled;
  }
  for (const [num, value] of [["maxPerDay", state.maxPerDay], ["minGap", state.minGap], ["minGapSame", state.minGapSame]]) {
    const el = $("prefs").querySelector(`[data-num="${num}"]`);
    if (el) el.value = value;
  }
}

/** Open one chip's panel, or none; at most one is open at a time. */
function openChip(id) {
  state.openChip = id;
  for (const pref of $("prefs").querySelectorAll(".pref")) {
    const open = pref.dataset.q === id;
    pref.classList.toggle("is-open", open);
    pref.querySelector(".pref-chip").setAttribute("aria-expanded", String(open));
    pref.querySelector(".pref-panel").hidden = !open;
  }
}

/* One click, one change, one re-draft. Delegated from the row so nothing here
 * has to be re-wired when a chip is rebuilt with its new answer. */
/* A new answer to who is coming: its suggestions land, the panel redraws its
 * ages, and the draft follows. */
function whoChanged() {
  applySuggestions();
  applyCar();
  const panel = $("panel-who");
  if (panel) panel.innerHTML = whoHtml();
  syncPrefs();
  redraftAndSave();
}

function wirePrefs() {
  const host = $("prefs");

  host.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-open]");
    if (chip) {
      openChip(state.openChip === chip.dataset.open ? null : chip.dataset.open);
      return;
    }
    const tag = e.target.closest("[data-tag]");
    if (tag) {
      const mode = nextTagMode(state.tags.get(tag.dataset.tag));
      const slug = tag.dataset.tag;
      if (mode) state.tags.set(slug, mode);
      else state.tags.delete(slug);
      host.querySelector(".pref-tag-list").innerHTML = tagListHtml();
      const again = host.querySelector(`[data-tag="${CSS.escape(slug)}"]`);
      if (again) again.focus();
      syncPrefs();
      redraftAndSave();
      return;
    }
    const age = e.target.closest("[data-age]");
    if (age && state.party) {
      const n = Number(age.dataset.age);
      const ages = new Set(state.party.ages);
      if (ages.has(n)) ages.delete(n);
      else ages.add(n);
      state.party.ages = AGES.filter((a) => ages.has(a));
      whoChanged();
      return;
    }
    const pick = e.target.closest("[data-pick]");
    if (!pick || pick.disabled) return;
    const [question, id] = pick.dataset.pick.split(":");
    if (question === "who") {
      state.party = { type: id, ages: id === "family" && state.party ? state.party.ages : [] };
      whoChanged();
      return;
    }
    if (question === "interest") state.answered.add("interests");
    if (question === "pace" || question === "food") state.answered.add(question);
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
      state.answered.add("travel");
      state.mode = id;
    } else if (question === "food") {
      const answer = FOOD_ANSWERS.find((a) => a.id === id);
      for (const meal of state.meals) meal.enabled = answer.meals.includes(meal.id);
      relayMeals();
    } else {
      return;
    }
    syncPrefs();
    redraftAndSave();
  });

  // Typing in the tag box narrows the list in place: rebuilding the row would
  // take the caret out of the box mid-word.
  host.addEventListener("input", (e) => {
    if (!e.target.dataset.tagFind) return;
    state.tagQuery = e.target.value;
    host.querySelector(".pref-tag-list").innerHTML = tagListHtml();
  });

  // The exact numbers. `change` rather than `input`, so a half-typed time or a
  // place being spelled out does not re-draft the calendar under the reader.
  host.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.num) state.answered.add("pace");
    if (el.dataset.mealon || el.dataset.time) state.answered.add("food");
    if (el.dataset.num === "maxPerDay") {
      const count = Math.round(Number(el.value));
      state.maxPerDay = Number.isFinite(count) ? Math.max(0, count) : state.maxPerDay;
    } else if (el.dataset.num === "minGap") {
      state.minGap = Number(el.value);
    } else if (el.dataset.num === "minGapSame") {
      state.minGapSame = Number(el.value);
    } else if (el.dataset.festivalOn) {
      if (el.checked) state.festivalsOut.delete(el.dataset.festivalOn);
      else state.festivalsOut.add(el.dataset.festivalOn);
    } else if (el.dataset.mealon) {
      mealOf(el.dataset.mealon).enabled = el.checked;
      relayMeals();
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
      relayMeals();
    } else if (el.dataset.place) {
      // A place named in the question names that meal on every day it is on.
      const meal = mealOf(el.dataset.place);
      meal.place = el.value.trim();
      for (const b of state.own) if (b.kind === "meal" && b.meal === meal.id) b.place = meal.place;
      saveDays();
    } else {
      return;
    }
    syncPrefs();
    redraftAndSave();
  });

  // A click anywhere else, or Escape, puts the open panel away. The path is
  // read rather than the target's ancestors: a tag clicked is replaced by its
  // redrawn self before the click reaches the document, and a detached button
  // has no ancestors left.
  document.addEventListener("click", (e) => {
    if (state.openChip && !e.composedPath().includes(host)) openChip(null);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !state.openChip) return;
    const chip = host.querySelector(`[data-open="${state.openChip}"]`);
    openChip(null);
    if (chip) chip.focus();
  });
}

const mealOf = (id) => state.meals.find((m) => m.id === id);

// --- the reader's own days -------------------------------------------------
//
// A day kept for something other than the festival, the flights' hours at
// either end of the trip, and the meals and personal time the reader puts on
// the calendar. All of it is the reader's, day by day; the draft is told what
// it may not use (lib/days.js) and plans around it.

const KEEP_META = {
  rest: { emoji: "\u{1F634}", nameKey: "day.rest" },
  excursion: { emoji: "\u{1F68C}", nameKey: "day.excursion" },
  festival: { emoji: "\u{1F3AA}", nameKey: "day.festival" },
};

const OWN_META = {
  meal: { emoji: null },
  personal: { emoji: "\u2615", nameKey: "own.personal" },
};

// A block added by a click is an hour long, and snaps to the quarter hour.
const OWN_DEFAULT_MIN = 60;
const OWN_SNAP_MIN = 15;

const tripKey = () => (state.period ? `${state.period.from}/${state.period.to}` : null);

function keptInTrip() {
  const days = new Set(state.dates);
  return new Map([...state.kept].filter(([date]) => days.has(date)));
}

/** The flights' hours at either end of the trip, on the festival's clock. */
function flightBlocks() {
  if (!state.dates.length || !state.focus) return [];
  const tz = state.focus.festival.timezone || "UTC";
  return [
    ["out", flightHours("out", state.flights.out, tripStartISO(), tz)],
    ["back", flightHours("back", state.flights.back, tripEndISO(), tz)],
  ]
    .filter(([, hours]) => hours)
    .map(([which, hours]) => ({ ...hours, which }));
}

/** Every hour the draft may not use, by night: the flights' and the reader's own blocks. */
function busyHours() {
  const busy = new Map();
  for (const b of [...flightBlocks(), ...state.own]) {
    const list = busy.get(b.date) || [];
    list.push({ startMin: b.startMin, endMin: b.endMin });
    busy.set(b.date, list);
  }
  return busy;
}

const mealsOf = (date) => state.own.filter((b) => b.kind === "meal" && b.date === date).map((b) => b.meal);
let ownSeq = 0;
const newOwnId = () => `o${Date.now().toString(36)}${(ownSeq++).toString(36)}`;

/* The food answer lays its meals on every day of the trip that has not had
 * them yet; answering again lays them afresh. Personal time is never touched. */
function layMeals() {
  for (const date of state.dates) {
    if (state.mealDates.has(date)) continue;
    state.mealDates.add(date);
    for (const meal of state.meals) {
      if (!meal.enabled) continue;
      state.own.push({
        id: newOwnId(),
        kind: "meal",
        meal: meal.id,
        date,
        startMin: meal.startMin,
        endMin: meal.endMin,
        place: meal.place,
      });
    }
  }
}

function relayMeals() {
  state.own = state.own.filter((b) => b.kind !== "meal");
  state.mealDates = new Set();
  layMeals();
  saveDays();
}

/* A first draft of a trip keeps one of its days (lib/days.js's seedDay), once:
 * a day the reader has since cleared is not kept again. */
function seedDays() {
  const key = tripKey();
  if (!key || state.seededFor === key || !state.catalogue) return;
  state.seededFor = key;
  if (keptInTrip().size) return;
  const slots = eligibleSlots(filteredShows(), {
    dateStart: tripStartISO(),
    dateEnd: tripEndISO(),
    windowStart: `${tripStartISO()}T00:00`,
    windowEnd: `${tripEndISO()}T23:59`,
  });
  const seed = seedDay({ dates: state.dates, lead: state.focus.festival.id, slots });
  if (seed) state.kept.set(seed.date, seed.kind === "festival" ? { kind: "festival", festival: seed.festival } : { kind: seed.kind });
}

function keptName(day) {
  if (day.kind === "festival") {
    const festival = festivalById(day.festival);
    return t("day.festival", { festival: festival ? festivalName(festival) : day.festival });
  }
  return t(KEEP_META[day.kind].nameKey);
}

function ownName(block) {
  if (block.kind === "meal") return block.place || t(MEAL_META[block.meal].nameKey);
  return t(OWN_META[block.kind].nameKey);
}

const ownEmoji = (block) => (block.kind === "meal" ? MEAL_META[block.meal].emoji : OWN_META[block.kind].emoji);

// --- planning -------------------------------------------------------------

function planOptions() {
  return {
    dateStart: tripStartISO(),
    dateEnd: tripEndISO(),
    windowStart: `${tripStartISO()}T00:00`,
    windowEnd: `${tripEndISO()}T23:59`,
    dayStartMin: state.dayStartMin,
    dayEndMin: state.dayEndMin,
    allowSlot: slotRule(keptInTrip(), busyHours()),
    assumedLengthMin: ASSUMED_LENGTH_MIN,
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
  seedDays();
  layMeals();
  const draft = draftCalendar(filteredShows(), planOptions());
  state.draft = draft;
  state.picked = draft.picked;

  renderCalendar(draft);
  renderCounts(draft);
  buildLanes();
  applyVerdicts(draft);
  renderDrawerCount(draft);
  showBoard();
  syncStars();
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
  const before = snapshotCalendar(host);
  host.innerHTML = "";
  host.hidden = false;
  // The note says what the constraints have cost; the calendar under it is
  // where they are loosened, so an empty draft shows both rather than swapping
  // one for the other.
  empty.hidden = Boolean(draft.counts.picked);
  renderFestivalLegend(draft);

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
  gHead.appendChild(nightToggle(draft));
  const gBody = document.createElement("div");
  gBody.className = "sch-gutter-body";
  gBody.style.height = `${axisH}px`;
  for (let h = minHour; h <= maxHour; h++) {
    const label = document.createElement("div");
    label.className = "sch-hour" + (h >= 24 || h < 0 ? " sch-hour--late" : "");
    label.style.top = `${(h - minHour) * hourPx}px`;
    label.textContent = `${pad2(((h % 24) + 24) % 24)}:00`;
    gBody.appendChild(label);
  }
  gutter.append(gHead, gBody);
  host.appendChild(gutter);

  const byDate = new Map(draft.days.map((d) => [d.date, d]));
  const kept = keptInTrip();
  const flights = flightBlocks();
  state.dates.forEach((iso) => {
    const day = byDate.get(iso) || { date: iso, slots: [] };
    const keep = kept.get(iso) || null;
    const own = [
      ...flights.filter((f) => f.date === iso).map((f) => ({ ...f, kind: "flight" })),
      ...state.own.filter((b) => b.date === iso),
    ];
    const col = document.createElement("div");
    col.className =
      "sch-day" +
      (isWeekend(iso) ? " wknd" : "") +
      (keep ? ` sch-day--kept sch-day--${keep.kind}` : "") +
      // A blank night collapses to a sliver, but only while the calendar has
      // something to show: when the whole draft is empty every column is
      // blank, and slivers would leave the blockers nothing to sit on. A day
      // holding something of the reader's own is never blank. A drag keeps
      // the slivers it began with, whatever the day holds meanwhile.
      ((state.drag
        ? state.drag.slivers.has(iso)
        : !day.slots.length && !keep && !own.length && draft.counts.picked)
        ? " sch-day--empty"
        : "");
    col.dataset.date = iso;
    if (keep && keep.kind === "festival") col.dataset.festivalColour = keep.festival;

    const head = document.createElement("div");
    head.className = "sch-day-head";
    head.dataset.dayHead = iso;
    head.tabIndex = 0;
    head.setAttribute("role", "button");
    head.setAttribute("aria-haspopup", "menu");
    head.setAttribute("aria-label", t("day.menuLabel", { day: dayAndDate(iso) }));
    head.innerHTML =
      `<div class="sch-dow">${escapeHtml(dates({ weekday: "short" }).format(dateOf(iso)))} ` +
      `<span class="sch-date">${escapeHtml(dayLabel(iso))}</span></div>` +
      `<div class="sch-day-count" data-i18n-slot="schedule.dayCount">` +
      `${escapeHtml(t("schedule.dayCount", { count: day.slots.length }))}</div>`;

    const body = document.createElement("div");
    body.className = "sch-body";
    body.style.height = `${axisH}px`;

    // The hours the reader's day does not cover: drawn in the column rather
    // than over the calendar, so each one is clipped by the night it applies to.
    body.appendChild(zone("top", 0, y(state.dayStartMin)));
    body.appendChild(zone("bottom", y(dayEndMin()), axisH - y(dayEndMin())));

    if (keep && keep.kind !== "festival") {
      body.appendChild(keepBlock(iso, keep, axisH, y(state.dayStartMin)));
    } else {
      if (keep) body.appendChild(keepBanner(iso, keep, y(state.dayStartMin)));
      for (const block of own) body.appendChild(ownBlock(block, y));
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
        // the calendar would claim a clash the scheduler took care to avoid,
        // and never past the day's end, or it would claim hours the reader
        // gave up.
        const next = day.slots[i2 + 1];
        const ceiling = Math.min(next ? y(next.startMinuteOfDay) - 2 : axisH, y(dayEndMin()));
        body.appendChild(
          buildScheduleBlock(slot, y(slot.startMinuteOfDay), y(slot.endMinuteOfDay), ceiling)
        );
      });
    }

    col.append(head, body);
    host.appendChild(col);
  });

  host.appendChild(buildBlockers(axis, y, gutter.getBoundingClientRect().width));
  markColumnWidth();
  titleKeptRuns(host);
  animateCalendar(host, before);
}

/* A column squeezed to share the width sheds what a show's block can't
 * afford, through plan.css's own classes and at the Fringe planner's widths
 * (site/plan/plan.js sets the same two). */
const COL_NARROW_PX = 78;
const COL_TINY_PX = 56;
function markColumnWidth() {
  const host = $("schedule");
  // The widest column is a full day's: an empty day is drawn as a sliver.
  const width = Math.max(0, ...[...host.querySelectorAll(".sch-day")].map((c) => c.getBoundingClientRect().width));
  // Drawn before it is laid out (a hidden panel): the observer below asks again.
  if (!width) return;
  host.classList.toggle("cols-narrow", width < COL_NARROW_PX);
  host.classList.toggle("cols-tiny", width < COL_TINY_PX);
}

/* The night, from 23:00 the evening before to 08:00, is folded away until the
 * reader opens it: most sleep through it. Folded, the button says how many
 * things it hides, so a breakfast or an early show is never silently gone. */
function nightToggle(draft) {
  const days = new Set(state.dates);
  const hidden = state.nightOpen
    ? 0
    : draft.days.reduce((n, day) => n + day.slots.filter((s) => s.startMinuteOfDay < AXIS_DAY_TOP_MIN).length, 0) +
      state.own.filter((b) => days.has(b.date) && b.startMin < AXIS_DAY_TOP_MIN).length;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sch-night" + (state.nightOpen ? " is-open" : "");
  btn.dataset.night = "";
  btn.setAttribute("aria-expanded", String(state.nightOpen));
  const label = t(state.nightOpen ? "night.hide" : "night.show");
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML =
    `<span class="sch-night-sign" aria-hidden="true">${state.nightOpen ? "\u2212" : "+"}</span>` +
    (hidden ? `<span class="sch-night-count">${hidden}</span>` : "");
  return btn;
}

/* The hours the calendar draws: fixed, see AXIS_DAY_TOP_MIN. Only a show or a
 * block of the reader's own running past 01:00 stretches the bottom, to the
 * hour it ends in, so nothing drafted is ever cut off. */
function calendarAxis(draft) {
  if (state.drag) return axisOf(state.drag.topMin, state.drag.botMin);
  let latest = AXIS_BOTTOM_MIN;
  for (const day of draft.days) for (const slot of day.slots) latest = Math.max(latest, slot.endMinuteOfDay);
  const days = new Set(state.dates);
  for (const block of state.own) if (days.has(block.date)) latest = Math.max(latest, block.endMin);
  return axisOf(state.nightOpen ? AXIS_NIGHT_TOP_MIN : AXIS_DAY_TOP_MIN, Math.ceil(latest / 60) * 60);
}

/** An axis's height at the fixed height of an hour. */
function axisOf(topMin, botMin) {
  const hours = (botMin - topMin) / 60;
  return { topMin, botMin, hourPx: SCH_HOUR_PX, axisH: hours * SCH_HOUR_PX };
}

function zone(which, top, height) {
  const el = document.createElement("div");
  el.className = `sch-zone sch-zone--${which}`;
  el.style.top = `${top}px`;
  el.style.height = `${Math.max(0, height)}px`;
  return el;
}

/* A day kept for rest or an excursion: one block over the whole column. */
/* Its label, and a nearby festival's strip, hang just under the day's start
 * line, whose flag would otherwise sit over them. */
const KEEP_LABEL_GAP_PX = 16;

function keepBlock(iso, keep, axisH, dayTop) {
  const el = document.createElement("div");
  el.className = `sch-keep sch-keep--${keep.kind}`;
  el.dataset.keep = iso;
  el.dataset.kind = keep.kind;
  el.style.height = `${axisH}px`;
  el.style.paddingTop = `${dayTop + KEEP_LABEL_GAP_PX}px`;
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-haspopup", "menu");
  el.innerHTML =
    `<span class="keep-label"><span class="keep-emoji" aria-hidden="true">${KEEP_META[keep.kind].emoji}</span> ` +
    `<span class="keep-name">${escapeHtml(keptName(keep))}</span></span>`;
  return el;
}

/* Days in a row kept for the same thing read as one stretch: one title across
 * them, drawn over the calendar where it can span the days, while each day's
 * own block stays the target that opens that day's menu. */
function titleKeptRuns(host) {
  const kept = keptInTrip();
  const same = (a, b) => a && b && a.kind === b.kind && a.festival === b.festival;
  const runs = [];
  for (const col of host.querySelectorAll(".sch-day")) {
    const keep = kept.get(col.dataset.date) || null;
    const last = runs[runs.length - 1];
    if (keep && last && same(last.keep, keep) && last.cols[last.cols.length - 1].nextElementSibling === col) {
      last.cols.push(col);
    } else if (keep) {
      runs.push({ keep, cols: [col] });
    }
  }
  const at = host.getBoundingClientRect();
  for (const { cols } of runs) {
    if (cols.length < 2) continue;
    const blocks = cols.map((col) => col.querySelector(".sch-keep"));
    if (blocks.some((b) => !b)) continue;
    blocks.forEach((b, i) => {
      b.classList.add("sch-keep--run", i === 0 ? "sch-keep--run-first" : i === blocks.length - 1 ? "sch-keep--run-last" : "sch-keep--run-mid");
    });
    const label = blocks[0].querySelector(".keep-label").getBoundingClientRect();
    const first = blocks[0].getBoundingClientRect();
    const end = blocks[blocks.length - 1].getBoundingClientRect();
    const left = Math.min(first.left, end.left);
    const right = Math.max(first.right, end.right);
    const title = document.createElement("div");
    title.className = `sch-keep-title sch-keep-title--${blocks[0].dataset.kind}`;
    title.setAttribute("aria-hidden", "true");
    title.style.top = `${label.top - at.top}px`;
    title.style.left = `${left - at.left}px`;
    title.style.width = `${right - left}px`;
    title.appendChild(blocks[0].querySelector(".keep-label").cloneNode(true));
    host.appendChild(title);
  }
}

/* A day given to a nearby festival still holds shows — that festival's — so it
 * says so in a strip at its top rather than covering the column. */
function keepBanner(iso, keep, dayTop) {
  const el = document.createElement("div");
  el.className = "sch-keep sch-keep--festival";
  el.style.top = `${dayTop + KEEP_LABEL_GAP_PX}px`;
  el.dataset.keep = iso;
  el.dataset.kind = keep.kind;
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-haspopup", "menu");
  el.innerHTML =
    `<span class="keep-label"><span class="keep-emoji" aria-hidden="true">${KEEP_META.festival.emoji}</span> ` +
    `<span class="keep-name">${escapeHtml(keptName(keep))}</span></span>`;
  return el;
}

/* A block of the reader's own — a meal, personal time — or a flight's hours.
 * The reader's own are moved by dragging and stretched by their lower edge;
 * a flight's are the fare's, and move with the trip's dates. */
function ownBlock(block, y) {
  const el = document.createElement("div");
  const flight = block.kind === "flight";
  el.className = `sch-own sch-own--${block.kind}` + (flight ? ` sch-own--${block.which}` : "");
  el.style.top = `${y(block.startMin)}px`;
  el.style.height = `${Math.max(14, y(block.endMin) - y(block.startMin))}px`;
  if (flight) {
    el.dataset.which = block.which;
    if (state.ground) el.dataset.ground = state.ground;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-haspopup", "menu");
    const clock = block.which === "out" ? minToDayClock(block.endMin) : minToDayClock(block.startMin);
    const ground = state.ground
      ? `<span class="own-ground"><span aria-hidden="true">${GROUND_META[state.ground].emoji}</span> ` +
        `${escapeHtml(t(GROUND_META[state.ground].labelKey))}</span>`
      : `<span class="own-ground own-ground--ask">${escapeHtml(t("ground.ask"))}</span>`;
    el.innerHTML =
      `<span class="own-label"><span aria-hidden="true">\u2708\uFE0F</span> ` +
      `${escapeHtml(t(block.which === "out" ? "flight.arrive" : "flight.depart", { time: clock }))}</span>` +
      ground;
    return el;
  }
  el.dataset.own = block.id;
  el.dataset.kind = block.kind;
  el.dataset.start = String(block.startMin);
  el.dataset.end = String(block.endMin);
  if (block.meal) el.dataset.meal = block.meal;
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-haspopup", "menu");
  el.innerHTML =
    `<span class="own-label"><span aria-hidden="true">${ownEmoji(block)}</span> ${escapeHtml(ownName(block))}</span>` +
    `<span class="own-time">${escapeHtml(`${minToDayClock(block.startMin)}–${minToDayClock(block.endMin)}`)}</span>` +
    `<span class="own-resize" aria-hidden="true"></span>`;
  return el;
}

// --- the day's two lines ---------------------------------------------------
//
// Where the day starts and ends, drawn against the hours they rule out rather
// than typed into a strip above them. One overlay holds both; it is rebuilt
// with the calendar, and the gestures are delegated from the calendar itself
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
    dayLine("end", dayEndMin(), y, axis)
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
  state.answered.add("dayEnd");
  return true;
}

/** What a drag holds still: the axis, and which days are drawn as slivers. */
function holdLayout(ov) {
  const slivers = new Set([...document.querySelectorAll("#schedule .sch-day--empty")].map((c) => c.dataset.date));
  return { topMin: Number(ov.dataset.topMin), botMin: Number(ov.dataset.botMin), slivers };
}

/* A drag holds the axis and the column widths still for its duration. Without
 * that, moving a line re-drafts, the re-draft re-fits the axis, and the same
 * pointer position then means a different minute — the line would chase the
 * pointer instead of following it. */
function startBlockerDrag(onMove) {
  const ov = document.querySelector(".sch-blockers");
  state.drag = holdLayout(ov);
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
    }
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
    }
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
/** The shared kind a show is filed under, the one the kinds chip offers. */
function kindOf(slug) {
  return state.kinds.get(slug) || "other";
}

/** Each festival with a show in the draft, in its colour, under the calendar. */
function renderFestivalLegend(draft) {
  const ids = new Set(draft.days.flatMap((day) => day.slots.map((slot) => festivalOf(slot.slug))));
  const festivals = poolFestivals().filter((f) => ids.has(f.id));
  const host = $("festLegend");
  host.hidden = !festivals.length;
  host.innerHTML = festivals
    .map(
      (f) =>
        `<span class="fest-legend-item"><span class="fest-dot" data-festival-colour="${escapeHtml(f.id)}" aria-hidden="true"></span>` +
        `${escapeHtml(festivalName(f))}</span>`
    )
    .join("");
}

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
    "sch-show" + (locked ? " sch-show--locked" : "") + (favourite ? " sch-show--fav" : "");
  block.dataset.slug = slot.slug;
  block.dataset.festivalColour = festivalOf(slot.slug);
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
    `<span class="sch-name"><span class="sch-kind" aria-hidden="true">${GENRE_EMOJI[kindOf(slot.slug)]}</span>` +
    `${foreign(slot.title, slot.slug)}</span>` +
    `<span class="sch-meta">` +
    `<span class="sch-time">${escapeHtml(timeStr)}</span>` +
    (slot.status === "FREE_NON_TICKETED"
      ? `<span class="sch-free" data-i18n="block.free">${escapeHtml(t("block.free"))}</span>`
      : "") +
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
  leg.dataset.after = `${a.slug}@${slotKey(a)}`;
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
  for (const id of ["calPreview", "calRivals", "calMenu"]) {
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

/* The show's popup beside its card rather than over or under it: it is tall,
 * and beside the card it covers neither the card nor the hours around it. It
 * keeps clear of the page's sticky header. */
function placeBeside(pop, block) {
  const host = $("planResult").getBoundingClientRect();
  const box = block.getBoundingClientRect();
  pop.hidden = false;
  pop.classList.remove("cal-pop--below");
  const popBox = pop.getBoundingClientRect();
  const header = document.querySelector(".site-header");
  const clear = header ? header.getBoundingClientRect().bottom + 8 : 8;
  const after = box.right - host.left + 8;
  const before = box.left - host.left - popBox.width - 8;
  const fitsAfter = after + popBox.width <= host.width - 4;
  const rtl = document.documentElement.dir === "rtl";
  const left = rtl ? (before >= 4 ? before : after) : fitsAfter || before < 4 ? after : before;
  const ideal = box.top + box.height / 2 - popBox.height / 2;
  const top = Math.max(Math.min(ideal, window.innerHeight - popBox.height - 8), clear);
  pop.style.left = `${Math.round(clamp(left, 4, Math.max(4, host.width - popBox.width - 4)))}px`;
  pop.style.top = `${Math.round(top - host.top)}px`;
}

/* Everything the page has to say about one card, in one place: its picture,
 * where and when, a few lines about it, how few nights its show has — which is the reason it holds the hour — every night it plays,
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

  const [date, start] = key.split("T");
  const perf = show.performances.find((p) => p.date === date && p.start === start);
  const venue = (perf && state.venues.get(perf.venue)) || null;
  const venueName = venue ? venue.name : show.venueName;
  const where = [venueName && foreign(venueName, show.slug), escapeHtml(`${dayAndDate(date)} · ${start}`)]
    .filter(Boolean)
    .join(" · ");
  pop.innerHTML =
    popArtHtml(show) +
    `<p class="pop-title">${foreign(show.title, show.slug)}</p>` +
    `<p class="pop-where">${where}</p>` +
    (show.blurb ? `<p class="pop-about" ${foreignAttrs(show.slug)}>${escapeHtml(show.blurb)}</p>` : "") +
    (show.url
      ? `<a class="pop-link" href="${escapeHtml(show.url)}" target="_blank" rel="noopener" data-i18n="preview.more">` +
        `${escapeHtml(t("preview.more"))}</a>`
      : "") +
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
  const img = pop.querySelector(".pop-art img");
  if (img) {
    img.addEventListener(
      "error",
      () => {
        img.parentNode.replaceWith(artFallback(show));
        placeBeside(pop, block);
      },
      { once: true }
    );
  }
  placeBeside(pop, block);
}

/* The show's picture, from the festival's own site; where there is none, or it
 * does not load, its kind's emoji on its festival's colour. */
function popArtHtml(show) {
  if (!show.image) return artFallback(show).outerHTML;
  return (
    `<div class="pop-art"><img src="${escapeHtml(show.image)}" alt="" referrerpolicy="no-referrer" /></div>`
  );
}

function artFallback(show) {
  const art = document.createElement("div");
  art.className = "pop-art pop-art--emoji";
  art.dataset.festivalColour = festivalOf(show.slug);
  art.setAttribute("aria-hidden", "true");
  art.textContent = GENRE_EMOJI[kindOf(show.slug)];
  return art;
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
  const perKind = new Map();
  for (const show of state.catalogue.shows) perKind.set(show.genreSlug, (perKind.get(show.genreSlug) || 0) + 1);
  // Capped like the venues below: pooling several festivals brings dozens of
  // kinds, the busiest make the cut and the query matches the rest by name.
  const rankedKinds = [...state.catalogue.categories].sort(
    (a, b) => (perKind.get(b.slug) || 0) - (perKind.get(a.slug) || 0) || a.name.localeCompare(b.name)
  );
  const kinds = capOptions(rankedKinds, (c) => state.search.genres.has(c.slug), FACET_OPTIONS);
  const listedKinds = new Set(kinds.rows);
  genreOptions.innerHTML =
    state.catalogue.categories
      .filter((c) => listedKinds.has(c))
      .map(
        (c) =>
          `<label class="panel-option"><input type="checkbox" data-facet="genre" value="${escapeHtml(c.slug)}" />` +
          `<span>${foreign(c.name, c.slug)}</span>` +
          `<span class="opt-count">${perKind.get(c.slug) || 0}</span></label>`
      )
      .join("") +
    (kinds.more
      ? `<p class="panel-more" data-i18n-slot="search.moreKinds">${escapeHtml(t("search.moreKinds", { count: kinds.more }))}</p>`
      : "");
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

// --- the reader's own days, on the calendar ---------------------------------
//
// A day's head asks what the day is for; a kept day's block asks again, and is
// dragged to move it. An empty hour offers a meal or personal time there, and
// what is added is dragged to move it, stretched by its lower edge, and
// clicked to remove it. One small menu serves all three.

function calMenu() {
  let menu = $("calMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "calMenu";
    menu.className = "cal-pop cal-menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    $("planResult").appendChild(menu);
  }
  return menu;
}

function openMenu(anchor, html, data) {
  closePops();
  const menu = calMenu();
  menu.innerHTML = html;
  for (const key of Object.keys(menu.dataset)) delete menu.dataset[key];
  Object.assign(menu.dataset, data);
  placePop(menu, anchor);
  const first = menu.querySelector("button");
  if (first) first.focus({ preventScroll: true });
}

const menuItem = (attrs, emoji, label, on = false) =>
  `<button type="button" class="menu-item${on ? " is-on" : ""}" role="menuitemradio" aria-checked="${on}" ${attrs}>` +
  `<span class="menu-emoji" aria-hidden="true">${emoji}</span>${escapeHtml(label)}</button>`;

function openDayMenu(iso, anchor) {
  const keep = state.kept.get(iso) || null;
  const lead = state.focus.festival.id;
  const nearby = poolFestivals().filter((f) => f.id !== lead);
  const html =
    `<div class="menu-title">${escapeHtml(dayAndDate(iso))}</div>` +
    menuItem(`data-keep="shows"`, "\u{1F3AD}", t("day.shows"), !keep) +
    menuItem(`data-keep="rest"`, KEEP_META.rest.emoji, t("day.rest"), keep?.kind === "rest") +
    menuItem(`data-keep="excursion"`, KEEP_META.excursion.emoji, t("day.excursion"), keep?.kind === "excursion") +
    nearby
      .map((f) =>
        menuItem(
          `data-keep="festival:${escapeHtml(f.id)}" data-festival-colour="${escapeHtml(f.id)}"`,
          KEEP_META.festival.emoji,
          t("day.festival", { festival: festivalName(f) }),
          keep?.kind === "festival" && keep.festival === f.id
        )
      )
      .join("");
  openMenu(anchor, html, { date: iso });
}

function openAddMenu(iso, min, anchor) {
  const start = clamp(Math.round(min / OWN_SNAP_MIN) * OWN_SNAP_MIN, 0, NIGHT_END_MIN - OWN_SNAP_MIN);
  const meal = mealAt(start, mealsOf(iso));
  const clock = minToDayClock(start);
  const html =
    `<div class="menu-title">${escapeHtml(`${dayAndDate(iso)} · ${clock}`)}</div>` +
    menuItem(`data-add="meal" data-meal="${meal}"`, MEAL_META[meal].emoji, t(MEAL_META[meal].nameKey)) +
    menuItem(`data-add="personal"`, OWN_META.personal.emoji, t("own.personal"));
  openMenu(anchor, html, { date: iso, min: String(start) });
}

function openOwnMenu(block, anchor) {
  const html =
    `<div class="menu-title"><span aria-hidden="true">${ownEmoji(block)}</span> ${escapeHtml(ownName(block))} · ` +
    `${escapeHtml(`${minToDayClock(block.startMin)}–${minToDayClock(block.endMin)}`)}</div>` +
    `<button type="button" class="menu-item" role="menuitem" data-own-remove="${escapeHtml(block.id)}">` +
    `<span class="menu-emoji" aria-hidden="true">\u2715</span>${escapeHtml(t("own.remove"))}</button>`;
  openMenu(anchor, html, { own: block.id });
}

/* Between the airport and town: the three ways, each beside where to book it. */
const GROUND_META = {
  taxi: { emoji: "\u{1F695}", labelKey: "ground.taxi" },
  train: { emoji: "\u{1F686}", labelKey: "ground.train" },
  car: { emoji: "\u{1F697}", labelKey: "ground.car" },
};

function groundLink(ground) {
  const p = state.focus && presentationOf(state.focus.festival.id);
  if (!p) return null;
  if (ground === "taxi") return p.region.airport();
  if (ground === "train") return p.region.rail();
  return carHireLink(p.region.flyTo);
}

function openGroundMenu(anchor) {
  const html =
    `<div class="menu-title">${escapeHtml(t("ground.title"))}</div>` +
    GROUND.map((g) => {
      const link = groundLink(g);
      return (
        `<div class="menu-row">` +
        menuItem(`data-ground="${g}"`, GROUND_META[g].emoji, t(GROUND_META[g].labelKey), state.ground === g) +
        (link
          ? `<a class="menu-book" data-ground-book="${g}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">` +
            `${escapeHtml(link.partner)}</a>`
          : "") +
        `</div>`
      );
    }).join("");
  openMenu(anchor, html, { ground: "1" });
}

function setGround(ground) {
  state.ground = ground;
  carChanged();
  savePrefs();
  closePops();
  syncPrefs();
  redraft();
}

/* Having a car or not moves the suggested way between shows and how far a day
 * trip reaches; the pool is judged again only when the reach moved. */
function carChanged() {
  applyCar();
  if (state.focus && state.period && state.reachByCar !== undefined && state.reachByCar !== carWithUs()) loadPool();
}

function setKept(iso, choice) {
  if (choice === "shows") state.kept.delete(iso);
  else if (choice.startsWith("festival:")) state.kept.set(iso, { kind: "festival", festival: choice.slice(9) });
  else state.kept.set(iso, { kind: choice });
  // Whatever the reader says about a day, the page's own guess is done with.
  state.seededFor = tripKey();
  saveDays();
  redraft();
}

/* Drag a block of the reader's own — or stretch it by its lower edge — holding
 * the axis still the way a day line's drag does; a press that never moves is a
 * click, and opens the block's menu instead. */
function dragOwn(e, el) {
  const block = state.own.find((b) => b.id === el.dataset.own);
  const ov = document.querySelector(".sch-blockers");
  if (!block || !ov) return;
  e.preventDefault();
  const stretch = Boolean(e.target.closest(".own-resize"));
  const from = { ...block };
  const m0 = minuteAt(e.clientY);
  const x0 = e.clientX;
  const y0 = e.clientY;
  let moved = false;
  state.drag = holdLayout(ov);
  const move = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
    moved = true;
    const delta = Math.round(((minuteAt(ev.clientY) ?? m0) - m0) / OWN_SNAP_MIN) * OWN_SNAP_MIN;
    if (stretch) {
      block.endMin = clamp(from.endMin + delta, from.startMin + OWN_SNAP_MIN, NIGHT_END_MIN);
    } else {
      const length = from.endMin - from.startMin;
      block.startMin = clamp(from.startMin + delta, 0, NIGHT_END_MIN - length);
      block.endMin = block.startMin + length;
      block.date = state.dates[dayAtX(ev.clientX) - 1] || from.date;
    }
    redraft();
  };
  const up = () => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    state.drag = null;
    suppressClick();
    if (moved) saveDays();
    redraft();
    if (!moved) {
      const again = $("schedule").querySelector(`.sch-own[data-own="${CSS.escape(block.id)}"]`);
      if (again) openOwnMenu(block, again);
    }
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
}

/* Drag a kept day onto another; a press that never moves opens its menu. */
function dragKeep(e, el) {
  e.preventDefault();
  const from = el.dataset.keep;
  const x0 = e.clientX;
  let at = from;
  let moved = false;
  const move = (ev) => {
    if (!moved && Math.abs(ev.clientX - x0) < 4) return;
    moved = true;
    const to = state.dates[dayAtX(ev.clientX) - 1];
    if (!to || to === at || state.kept.has(to)) return;
    state.kept.set(to, state.kept.get(at));
    state.kept.delete(at);
    at = to;
    state.seededFor = tripKey();
    saveDays();
    redraft();
  };
  const up = () => {
    removeEventListener("pointermove", move);
    removeEventListener("pointerup", up);
    suppressClick();
    if (!moved) {
      const again = $("schedule").querySelector(`.sch-keep[data-keep="${at}"]`);
      if (again) openDayMenu(at, again);
    }
  };
  addEventListener("pointermove", move);
  addEventListener("pointerup", up);
}

// The click that ends a drag lands on whatever the redraw left under the
// pointer, which must not read as a click on an empty hour.
let clickSuppressed = false;
function suppressClick() {
  clickSuppressed = true;
  setTimeout(() => {
    clickSuppressed = false;
  }, 0);
}

function wireDays() {
  const host = $("schedule");
  host.addEventListener("click", (e) => {
    if (!e.target.closest("[data-night]")) return;
    state.nightOpen = !state.nightOpen;
    savePrefs();
    redraft();
    host.querySelector("[data-night]").focus();
  });
  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    const own = e.target.closest(".sch-own[data-own]");
    if (own) {
      dragOwn(e, own);
      return;
    }
    const keep = e.target.closest(".sch-keep");
    if (keep) dragKeep(e, keep);
  });

  host.addEventListener("click", (e) => {
    if (clickSuppressed) {
      e.stopPropagation();
      return;
    }
    const head = e.target.closest("[data-day-head]");
    if (head) {
      e.stopPropagation();
      openDayMenu(head.dataset.dayHead, head);
      return;
    }
    const flight = e.target.closest(".sch-own--flight");
    if (flight) {
      e.stopPropagation();
      openGroundMenu(flight);
      return;
    }
    // An empty hour: the column's body itself, or the shading of hours
    // outside the day, and nothing drawn on top of it.
    const body = e.target.classList.contains("sch-body") || e.target.classList.contains("sch-zone")
      ? e.target.closest(".sch-body")
      : null;
    if (!body) return;
    const iso = body.closest(".sch-day").dataset.date;
    const min = minuteAt(e.clientY);
    if (min == null) return;
    e.stopPropagation();
    const anchor = document.createElement("div");
    anchor.className = "sch-add-anchor";
    anchor.style.top = `${e.clientY - body.getBoundingClientRect().top}px`;
    body.appendChild(anchor);
    openAddMenu(iso, min, anchor);
  });

  host.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const head = e.target.closest("[data-day-head]");
    const keep = e.target.closest(".sch-keep");
    const own = e.target.closest(".sch-own[data-own]");
    const flight = e.target.closest(".sch-own--flight");
    if (!head && !keep && !own && !flight) return;
    e.preventDefault();
    if (flight) openGroundMenu(flight);
    else if (head) openDayMenu(head.dataset.dayHead, head);
    else if (keep) openDayMenu(keep.dataset.keep, keep);
    else openOwnMenu(state.own.find((b) => b.id === own.dataset.own), own);
  });

  calMenu().addEventListener("click", (e) => {
    const menu = calMenu();
    const ground = e.target.closest("[data-ground]");
    if (ground) {
      e.stopPropagation();
      setGround(ground.dataset.ground);
      return;
    }
    const keep = e.target.closest("[data-keep]");
    const add = e.target.closest("[data-add]");
    const remove = e.target.closest("[data-own-remove]");
    if (!keep && !add && !remove) return;
    e.stopPropagation();
    if (keep) {
      setKept(menu.dataset.date, keep.dataset.keep);
    } else if (add) {
      const startMin = Number(menu.dataset.min);
      state.own.push({
        id: newOwnId(),
        kind: add.dataset.add,
        ...(add.dataset.add === "meal" ? { meal: add.dataset.meal, place: "" } : {}),
        date: menu.dataset.date,
        startMin,
        endMin: Math.min(NIGHT_END_MIN, startMin + OWN_DEFAULT_MIN),
      });
    } else {
      state.own = state.own.filter((b) => b.id !== remove.dataset.ownRemove);
    }
    saveDays();
    redraft();
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
  renderTripRow();
  renderPoolNote();
  renderOriginCard();
  renderPrefs();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  rebuild();
}

// --- the year, and which festival the page is zoomed in on -----------------

/** Today on the festival's own calendar — the pinned clock in a case. */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function renderTimelineStrip() {
  const monthFmt = (options) => new Intl.DateTimeFormat(currentIntlLocale(), { timeZone: "UTC", ...options });
  renderTimeline($("timelineYear"), {
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
    dayText: dayAndDate,
    lengthText: (count) => t("trip.length", { count }),
    todayText: t("timeline.today"),
    festivalCard,
    breaks: state.holidays.doc ? holidayBreaks(state.holidays.doc, timelineSpan(todayISO()), currentLocale()) : [],
    breakCard,
  });
}

const cardLine = (key, text, cls = "") => `<span class="tl-card-line${cls}" data-i18n-slot="${key}">${escapeHtml(text)}</span>`;
const dateRange = (from, to) =>
  dates({ day: "numeric", month: "short", year: "numeric" }).formatRange(dateOf(from), dateOf(to));

/* A festival's genre, as the registry's `kind` names it. */
const GENRE_KEYS = { comedy: "genre.comedy", film: "genre.film", theatre: "genre.theatre", fringe: "genre.fringe" };

/* What a festival on the strip says about itself when pointed at. */
function festivalCard(festival, edition, hasData) {
  const days = Math.round((dateOf(edition.lastDate) - dateOf(edition.firstDate)) / 86400000) + 1;
  const genreKey = GENRE_KEYS[festival.kind];
  const place = [festivalCity(festival), regionName(festival.country)].join(", ");
  return (
    `<strong class="tl-card-title">${escapeHtml(festivalName(festival))}</strong>` +
    `<span class="tl-card-line">${escapeHtml(place)}${
      genreKey ? ` · <span data-i18n-slot="${genreKey}">${escapeHtml(t(genreKey))}</span>` : ""
    }</span>` +
    `<span class="tl-card-line">${escapeHtml(dateRange(edition.firstDate, edition.lastDate))} · ${escapeHtml(t("trip.length", { count: days }))}</span>` +
    cardLine(hasData ? "card.programme" : "card.noProgramme", t(hasData ? "card.programme" : "card.noProgramme"), hasData ? " is-good" : " is-muted")
  );
}

/* What an orb says: the holidays in the break, how long a break it makes and
 * how, and whose holidays they are. */
function breakCard(brk) {
  const { country, guessed } = state.holidays;
  const names = brk.names.join(" · ");
  const title = brk.weekend && brk.days > 1 ? t("holiday.weekend", { name: names }) : names;
  const span = brk.from === brk.to ? dayAndDate(brk.from) : dateRange(brk.from, brk.to);
  const length =
    t("holiday.days", { count: brk.days }) + (brk.workdays ? ` (${t("holiday.bridge", { count: brk.workdays })})` : "");
  const whose = guessed ? "holidays.guess" : "holidays.note";
  return (
    `<strong class="tl-card-title">${escapeHtml(title)}</strong>` +
    `<span class="tl-card-line">${escapeHtml(span)} · ${escapeHtml(length)}</span>` +
    cardLine(whose, t(whose, { country: regionName(country) }), " is-muted")
  );
}

/* Read the holidays of whoever the reader is, as far as the page knows: a
 * country with no file, or no country at all, marks nothing. */
async function refreshHolidays() {
  const home = homeCountry(state.origin, state.guess);
  const country = home ? home.country : null;
  if (country === state.holidays.country) {
    if (home && home.guessed !== state.holidays.guessed) {
      state.holidays.guessed = home.guessed;
      if (state.registry) renderTimelineStrip();
    }
    return;
  }
  state.holidays = { country, guessed: home ? home.guessed : false, doc: null };
  if (country) {
    try {
      const res = await fetch(holidaysUrl(country));
      const doc = res.ok ? await res.json() : null;
      if (state.holidays.country !== country) return;
      state.holidays.doc = doc && Array.isArray(doc.holidays) ? doc : null;
    } catch {
      /* no file for this country: nothing marked */
    }
  }
  if (state.registry) renderTimelineStrip();
}

/* The country the reader connects from, as the site's own service reads it
 * off the connection (api/where.js): a guess the reader's answer replaces. */
async function guessCountry() {
  try {
    const res = await fetch("/api/where");
    const body = res.ok ? await res.json() : null;
    state.guess = body && typeof body.country === "string" ? body.country : null;
  } catch {
    state.guess = null;
  }
  refreshHolidays();
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

/* Which trip to open on: the one the URL names (its dates, or a festival's
 * run), else the one last set, else the run of the next festival to start (or
 * running) of every festival with a programme. A festival the URL names is the
 * trip's pick either way. */
function initialTrip() {
  const url = new URLSearchParams(location.search);
  const named = tripFromQuery(url);
  const asked = url.get("festival");
  const festival = asked && state.registry.festivals.find((f) => f.id === asked);
  if (named) {
    const edition = festival && festival.editions.find((e) => e.firstDate <= named.to && e.lastDate >= named.from);
    return { ...named, pick: edition ? editionKey(festival.id, edition.id) : null };
  }
  if (festival) {
    const edition =
      festival.editions.find((e) => e.id === url.get("edition")) ||
      currentEdition(festival, todayISO()) ||
      festival.editions[festival.editions.length - 1];
    if (edition) return { ...tripForEdition(edition), pick: editionKey(festival.id, edition.id) };
  }
  const stored = readStore(KEY_TRIP, null);
  if (stored && stored.from && stored.to) return stored;
  const today = todayISO();
  const candidates = state.registry.festivals
    .map((f) => ({ festival: f, edition: currentEdition(f, today) }))
    .filter((c) => c.edition)
    .sort((a, b) => {
      // Running or upcoming before finished; then soonest.
      const past = (c) => (c.edition.lastDate < today ? 1 : 0);
      return past(a) - past(b) || a.edition.firstDate.localeCompare(b.edition.firstDate);
    });
  const first = candidates[0];
  return first ? { ...tripForEdition(first.edition), pick: editionKey(first.festival.id, first.edition.id) } : null;
}

/* Set the trip: its dates, the festival that leads it (whose theme the page
 * wears and whose city reach is judged from), the pool across it and the
 * flights either side. `fresh` is a reader's change, which also writes the
 * address and remembers the trip; the page's own first trip writes nothing.
 * `moved` is the end the reader set, which holds if the trip must give way. */
async function setTrip(trip, { fresh = false, moved = null } = {}) {
  state.period = normalizeTrip(trip, { moved, maxDays: MAX_PERIOD_DAYS, span: timelineSpan(todayISO()) });
  const lead = leadEdition(state.registry, { ...state.period, pick: trip.pick || null });
  state.focus = lead ? editionByKey(editionKey(lead.festival.id, lead.edition.id)) : null;
  // A pick the trip has moved off is dropped rather than kept for later: a
  // festival the reader left is not one they are still choosing.
  state.pick = state.focus && state.focus.key === trip.pick ? trip.pick : null;
  if (state.focus) applyTheme(state.focus.festival);
  if (fresh) {
    writeStore(KEY_TRIP, { ...state.period, pick: state.pick });
    const url = new URL(location.href);
    url.searchParams.delete("edition");
    url.searchParams.set("from", state.period.from);
    url.searchParams.set("to", state.period.to);
    if (state.pick) url.searchParams.set("festival", state.focus.festival.id);
    else url.searchParams.delete("festival");
    history.replaceState(null, "", url);
  }
  renderTimelineStrip();
  renderTripRow();
  refreshFares();
  if (!state.focus) return;
  await loadPool();
}

/* The palette is its genre's, in CSS (planNG.css, keyed by `data-genre`);
 * `data-festival` names the festival itself. */
function applyTheme(festival) {
  document.documentElement.dataset.festival = festival.id;
  if (festival.kind) document.documentElement.dataset.genre = festival.kind;
  else delete document.documentElement.dataset.genre;
  showCityPhoto($("cityBackdrop"), photoOf(festival));
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
async function loadPool() {
  const { festival, edition } = state.focus;
  const overlapping = [];
  for (const f of state.registry.festivals) {
    for (const e of f.editions) {
      if (e.lastDate < state.period.from || e.firstDate > state.period.to) continue;
      overlapping.push({ festivalId: f.id, lat: f.lat, lng: f.lng, firstDate: e.firstDate, lastDate: e.lastDate, festival: f, entry: e });
    }
  }
  const focusShape = { festivalId: festival.id, lat: festival.lat, lng: festival.lng, firstDate: edition.firstDate, lastDate: edition.lastDate };
  state.reach = poolReach(focusShape, overlapping, state.period, { dayTripKm: dayTripKm(carWithUs()) });
  state.reachByCar = carWithUs();

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
  state.kinds = new Map(state.catalogue.shows.map((s) => [s.slug, sharedGenre(s.genreId)]));
  state.poolSlugs = new Set(state.catalogue.shows.map((s) => s.slug));
  state.venues = state.catalogue.venues;
  state.coords = venueCoords(state.venues);
  state.dates = daysOf(state.period.from, state.period.to);
  document.documentElement.style.setProperty("--fest-days", String(state.dates.length));
  state.browsePages = 1;
  state.search.genres.clear();
  state.search.venues.clear();

  $("planPanel").hidden = false;
  $("boardDrawer").hidden = false;
  renderChrome();
  renderTimelineStrip();
  renderTripRow();
  renderPoolNote();
  renderOriginCard();
  renderPrefs();
  buildDayHeader();
  buildFacets();
  syncFacetChrome();
  rebuild();
}

/* A festival leading the trip whose programme is not out yet. What else the
 * pool holds, and what it left out, is the festivals chip's to say. */
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
  host.innerHTML = lines.join("");
  host.hidden = !lines.length;
}

// --- the trip's dates, and the flights either side ----------------------------

/* The ways of getting here, drawn rather than typed, so each is the same
 * picture in every font and turns with the block it sits in. */
const WAY_PATHS = {
  fly: "M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z",
  train:
    "M12 2c-4 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z",
  drive:
    "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
  local: "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
};
const wayIcon = (way) =>
  `<svg class="flight-plane way-${way}" data-way="${way}" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">` +
  `<path fill="currentColor" d="${WAY_PATHS[way]}"/></svg>`;

/* Not yet said: the three ways take turns on one spot. */
const UNSETTLED_ICON = `<span class="arrive-icons" aria-hidden="true">${wayIcon("fly") + wayIcon("train") + wayIcon("drive")}</span>`;

/* The airport a festival is flown to, from its presentation; null for a
 * festival the page has none for, which then shows no flight blocks. */
function destinationAirport() {
  const p = state.focus && presentationOf(state.focus.festival.id);
  return p ? p.region.flyTo : null;
}

/* What the travel blocks can say: "none" for a festival with no airport to
 * fly to, "unsettled" until the reader has said how they are getting here,
 * else that answer. */
function flightNeed() {
  if (!state.focus || !destinationAirport()) return "none";
  return arrivalOf(state.origin) || "unsettled";
}

function renderTripRow() {
  const host = $("tripRow");
  if (!state.period) {
    host.innerHTML = "";
    return;
  }
  const span = timelineSpan(todayISO());
  const { from, to } = state.period;
  const date = (id, key, value) =>
    `<label class="trip-date"><span class="trip-date-word" data-i18n-slot="${key}">${escapeHtml(t(key))}</span>` +
    `<input type="date" class="trip-date-input" id="${id}" value="${value}" min="${span.from}" max="${span.to}" required /></label>`;
  host.innerHTML =
    flightBlock("out") +
    `<div class="trip-dates">` +
    date("tripFrom", "trip.from", from) +
    `<span class="trip-length" data-i18n-slot="trip.length">${escapeHtml(t("trip.length", { count: daysOf(from, to).length }))}</span>` +
    date("tripTo", "trip.to", to) +
    `</div>` +
    flightBlock("back");
}

/* One travel block: the way out on the trip's first day, or home on its last.
 * Unsettled, the whole block asks how the reader is getting here. */
const ARRIVE_NOTE = { local: "flight.none", drive: "arrive.drive", train: "arrive.train" };
function flightBlock(which) {
  const need = flightNeed();
  if (need === "none") return `<div class="flight flight--${which} flight--empty" aria-hidden="true"></div>`;
  const day = which === "out" ? state.period.from : state.period.to;
  const titleKey = which === "out" ? "flight.out" : "flight.back";
  const head =
    `<div class="flight-head">${need === "unsettled" ? UNSETTLED_ICON : wayIcon(need)}` +
    `<span class="flight-title" data-i18n-slot="${titleKey}">${escapeHtml(t(titleKey))}</span>` +
    `<span class="flight-day">${escapeHtml(dayAndDate(day))}</span></div>`;
  const change = `<button type="button" class="flight-change" data-origin="change" data-i18n-slot="flight.change">${escapeHtml(t("flight.change"))}</button>`;
  if (need === "unsettled") {
    return (
      `<div class="flight flight--${which} flight--unsettled" data-flight="${which}" data-origin="ask" data-fares="idle">${head}` +
      `<p class="flight-note"><button type="button" class="flight-change" data-origin="ask" data-i18n-slot="flight.say">${escapeHtml(t("flight.say"))}</button></p></div>`
    );
  }
  const body =
    need === "fly"
      ? flightRoute(which) + flightFare(which, day) + change
      : `<p class="flight-note" data-i18n-slot="${ARRIVE_NOTE[need]}">${escapeHtml(t(ARRIVE_NOTE[need]))}</p>` + change;
  return `<div class="flight flight--${which} flight--${need}" data-flight="${which}" data-fares="${state.fares[which].status}">${head}${body}</div>`;
}

/* From where to where. The reader's airport is typed on the way out and read
 * back on the way home. */
function flightRoute(which) {
  const home = originAirport(state.origin);
  const there = destinationAirport();
  const mine =
    which === "out"
      ? `<input type="text" class="flight-from" id="flightFrom" value="${escapeHtml(home || "")}" maxlength="3" size="3"` +
        ` autocomplete="off" spellcheck="false" placeholder="···" aria-label="${escapeHtml(t("flight.from"))}" />`
      : `<span class="flight-code">${escapeHtml(home || "···")}</span>`;
  const theirs = `<span class="flight-code">${escapeHtml(there)}</span>`;
  const arrow = `<span class="flight-arrow" aria-hidden="true">→</span>`;
  return `<p class="flight-route">${which === "out" ? mine + arrow + theirs : theirs + arrow + mine}</p>`;
}

function flightFare(which, day) {
  const home = originAirport(state.origin);
  if (!home) return `<p class="flight-note" data-i18n-slot="flight.typeAirport">${escapeHtml(t("flight.typeAirport"))}</p>`;
  const { status, fares } = state.fares[which];
  if (status === "wait") return `<p class="flight-note" data-i18n-slot="flight.looking">${escapeHtml(t("flight.looking"))}</p>`;
  const route = which === "out" ? { from: home, to: destinationAirport() } : { from: destinationAirport(), to: home };
  if (status === "found" && fares.length) {
    const fare = fares[0];
    const link = flightFareLink(fare.link);
    const hm = (min) => {
      const unit = (u, n) => new Intl.NumberFormat(currentIntlLocale(), { style: "unit", unit: u, unitDisplay: "narrow" }).format(n);
      return min >= 60 ? `${unit("hour", Math.floor(min / 60))} ${unit("minute", min % 60)}` : unit("minute", min);
    };
    const parts = [
      `<span class="flight-time">${escapeHtml(fare.departAt.slice(11, 16))}</span>`,
      fare.durationMin != null ? `<span class="flight-length">${escapeHtml(hm(fare.durationMin))}</span>` : "",
      fare.stops == null
        ? ""
        : fare.stops === 0
          ? `<span class="flight-stops" data-i18n-slot="flight.direct">${escapeHtml(t("flight.direct"))}</span>`
          : `<span class="flight-stops" data-i18n-slot="flight.stops">${escapeHtml(t("flight.stops", { count: fare.stops }))}</span>`,
      `<span class="flight-price">${escapeHtml(
        new Intl.NumberFormat(currentIntlLocale(), { style: "currency", currency: fare.currency.toUpperCase(), maximumFractionDigits: 0 }).format(fare.price)
      )}</span>`,
    ].filter(Boolean);
    return (
      `<a class="flight-fare" href="${escapeHtml(link.url)}" target="_blank" rel="noopener sponsored" title="${escapeHtml(t("flight.recent"))}">` +
      parts.join(`<span class="flight-dot" aria-hidden="true">·</span>`) +
      `<span class="flight-partner">${escapeHtml(link.partner)}</span></a>`
    );
  }
  const search = flightSearchLink({ ...route, dateISO: day });
  return (
    `<a class="flight-search" href="${escapeHtml(search.url)}" target="_blank" rel="noopener sponsored">` +
    `<span data-i18n-slot="flight.search">${escapeHtml(t("flight.search"))}</span>` +
    `<span class="flight-partner">${escapeHtml(search.partner)}</span></a>`
  );
}

/* Ask the fare service for the day each way, once per route and day: an answer
 * that arrives after the trip or the airport moved on is dropped rather than
 * drawn against the wrong day. */
let faresAsked = { out: "", back: "" };
function refreshFares() {
  const flightsBefore = JSON.stringify(state.flights);
  const need = flightNeed();
  const home = originAirport(state.origin);
  for (const which of ["out", "back"]) {
    if (need !== "fly" || !home) {
      faresAsked[which] = "";
      state.fares[which] = { status: "idle", fares: [] };
      state.flights[which] = null;
      continue;
    }
    const there = destinationAirport();
    const params = {
      from: which === "out" ? home : there,
      to: which === "out" ? there : home,
      dateISO: which === "out" ? state.period.from : state.period.to,
      currency: fareCurrency(state.origin),
    };
    const key = JSON.stringify(params);
    if (faresAsked[which] === key) continue;
    faresAsked[which] = key;
    state.fares[which] = { status: "wait", fares: [] };
    state.flights[which] = null;
    fetchFares(fetch, params).then((fares) => {
      if (faresAsked[which] !== key) return;
      state.fares[which] = { status: fares.length ? "found" : "none", fares };
      state.flights[which] = fares.length ? { departAt: fares[0].departAt, durationMin: fares[0].durationMin } : null;
      renderTripRow();
      if (state.draft) redraft();
    });
  }
  renderTripRow();
  if (state.draft && JSON.stringify(state.flights) !== flightsBefore) redraft();
}

// --- where the reader is coming from ----------------------------------------

function regionName(code) {
  try {
    return new Intl.DisplayNames([currentIntlLocale()], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

/* Asked once per browser, and only when the reader asks from a travel block:
 * the card opens beneath the trip's dates, the calendar drafts regardless, and
 * the answer is stored so it never comes back. */
function renderOriginCard() {
  const card = $("originCard");
  const show = state.asking && Boolean(state.focus);
  card.hidden = !show;
  if (!show) return;
  const festival = state.focus.festival;
  const abroad = ORIGIN_COUNTRIES.filter((c) => c !== festival.country)
    .map((c) => ({ code: c, name: regionName(c) }))
    .sort((a, b) => a.name.localeCompare(b.name, currentIntlLocale()));
  const answer = (way, key, params = {}) =>
    `<button type="button" class="pref-pick origin-pick" data-origin="${way}">` +
    `<span class="pref-ico">${wayIcon(way)}</span>` +
    `<span class="pref-word" data-i18n-slot="${key}">${escapeHtml(t(key, params))}</span></button>`;
  card.innerHTML =
    `<div class="origin-head">` +
    `<p class="origin-ask" data-i18n-slot="origin.q">${escapeHtml(t("origin.q", { festival: festivalName(festival) }))}</p>` +
    `<p class="origin-why" data-i18n-slot="origin.why">${escapeHtml(t("origin.why"))}</p>` +
    `</div>` +
    `<div class="origin-answers" role="group" aria-label="${escapeHtml(t("origin.q", { festival: festivalName(festival) }))}">` +
    answer("local", "origin.city", { city: festivalCity(festival) }) +
    answer("drive", "origin.drive") +
    answer("train", "origin.train") +
    `<label class="pref-pick origin-pick origin-abroad">` +
    `<span class="pref-ico">${wayIcon("fly")}</span>` +
    `<span class="pref-word" data-i18n-slot="origin.abroad">${escapeHtml(t("origin.abroad"))}</span>` +
    `<select class="opt-select origin-select" id="originCountry" aria-label="${escapeHtml(t("origin.abroad"))}">` +
    `<option value="">${escapeHtml(t("origin.abroad.pick"))}</option>` +
    abroad.map((c) => `<option value="${c.code}">${escapeHtml(c.name)}</option>`).join("") +
    `<option value="*">${escapeHtml(t("origin.abroad.other"))}</option>` +
    `</select></label>` +
    `</div>` +
    `<button type="button" class="origin-skip" data-origin="skip" data-i18n-slot="origin.skip">${escapeHtml(t("origin.skip"))}</button>`;
}

function setOrigin(origin) {
  state.origin = origin;
  state.asking = false;
  writeStore(KEY_ORIGIN, origin);
  carChanged();
  savePrefs();
  renderOriginCard();
  renderTripRow();
  refreshFares();
  refreshHolidays();
}

function wireOrigin() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-origin]");
    if (!btn || btn.tagName === "SELECT") return;
    const festival = state.focus && state.focus.festival;
    if (!festival) return;
    const kind = btn.dataset.origin;
    if (kind === "ask" || kind === "change") {
      // The answer given stays stored until another replaces it, so a reader
      // who changes their mind about changing it loses nothing.
      state.asking = true;
      renderOriginCard();
      $("originCard").scrollIntoView({ block: "nearest" });
    } else if (kind === "skip") {
      state.asking = false;
      renderOriginCard();
    } else if (kind === "local") {
      setOrigin({ kind: "city", city: festival.city, cityName: festivalCity(festival), country: festival.country, lat: festival.lat, lng: festival.lng, arrive: "local" });
    } else if (kind === "drive" || kind === "train") {
      setOrigin({ kind: "country", country: festival.country, arrive: kind });
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.id !== "originCountry" || !e.target.value) return;
    const code = e.target.value;
    setOrigin(code === "*" ? { kind: "abroad", arrive: "fly" } : { kind: "abroad", country: code, arrive: "fly" });
  });
}

function wireTrip() {
  const year = $("timelineYear");
  const span = () => timelineSpan(todayISO());
  const normalize = (trip, moved) => normalizeTrip(trip, { moved, maxDays: MAX_PERIOD_DAYS, span: span() });
  // A festival is a shortcut to its run and a day either side.
  year.addEventListener("click", (e) => {
    const item = e.target.closest(".tl-item");
    if (!item) return;
    const next = editionByKey(item.dataset.edition);
    if (next) setTrip({ ...tripForEdition(next.edition), pick: next.key }, { fresh: true });
  });
  wireTimelineCards(year);
  // Today's figure cheers every choice the reader makes on the page.
  document.addEventListener("change", () => cheer(year));
  document.addEventListener("click", (e) => {
    if (e.target.closest("button, [aria-pressed], [role='option']") && !e.target.closest(".tl-orb")) cheer(year);
  });
  wireTripHandles(year, {
    span,
    trip: () => state.period,
    normalize,
    commit: async (trip, moved) => {
      // The strip is redrawn under the handle a key just stepped, so the
      // reader's focus is put back on its replacement.
      const keyed = document.activeElement && document.activeElement.closest(".tl-handle");
      const refocus = () => keyed && year.querySelector(`.tl-handle--${moved}`)?.focus();
      const done = setTrip({ ...trip, pick: state.pick }, { fresh: true, moved });
      cheer(year);
      refocus();
      await done;
      refocus();
    },
  });
  $("tripRow").addEventListener("change", (e) => {
    const input = e.target;
    if (input.id === "tripFrom" || input.id === "tripTo") {
      if (!input.value) return;
      const moved = input.id === "tripFrom" ? "from" : "to";
      setTrip({ ...state.period, [moved]: input.value, pick: state.pick }, { fresh: true, moved });
    } else if (input.id === "flightFrom") {
      const code = airportCode(input.value);
      if (!code && input.value.trim()) {
        input.setAttribute("aria-invalid", "true");
        return;
      }
      setOrigin({ ...state.origin, airport: code });
    }
  });
  $("browseMore").addEventListener("click", (e) => {
    if (!e.target.closest("#browseMoreBtn")) return;
    state.browsePages += 1;
    renderBrowse();
    syncStars();
  });
  addEventListener("resize", () => layoutRows($("timelineYear")));
  new ResizeObserver(markColumnWidth).observe($("schedule"));
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
  applySuggestions();
  applyCar();
  restoreDays();
  state.origin = readStore(KEY_ORIGIN, null);
  refreshHolidays();
  guessCountry();

  wireBoard();
  wireCalendar();
  wireBlockers();
  wireDays();
  wireSearch();
  wirePrefs();
  wireOrigin();
  wireTrip();

  const trip = initialTrip();
  if (!trip) {
    $("loadingState").hidden = true;
    renderTimelineStrip();
    return;
  }
  await setTrip(trip);
}

/* The site version in the footer's popup, exactly as the other two pages carry
 * it — read from the stamp the release wrote into this page. */
function showVersion() {
  const version = readVersionStamp();
  if (version) attachVersionPopup($("footerVersion"), `v${version}`);
}

showVersion();
boot();
