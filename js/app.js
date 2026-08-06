/* Fringe Discover — front-end logic
 * - loads mock show data (all happening *today*, scoped to the next few hours)
 * - renders an interactive Leaflet map of Edinburgh venues
 * - renders the "Happening Now" list
 * - three interactive constraint filters:
 *     1. Genre      — multi-select of Fringe categories (filters map + list)
 *     2. Travel     — how you're getting to the next show
 *     3. Next show  — pick the exact start time, then the show, and pin it
 *
 * Loaded as an ES module (`<script type="module">` in index.html) so it can share
 * real code with the planner instead of copy-pasting it — see shared/geo.js.
 */

import { isInUK } from "../shared/geo.js";
import { friendlyDuration } from "../shared/duration.js";
import { PRICE_OPTIONS, matchesPrice, priceLabel, showPrice } from "../shared/price.js";
import { geocodeUrl, parsePlaces, placeIcon, partnerLink, AFFILIATES } from "./places.js";

const EDINBURGH = [55.9486, -3.1881];

/* Default "you are here" pin — central Edinburgh (Princes Street / Royal Mile
 * area) so the UI has a sensible starting point before / unless the user shares
 * their real location. */
const USER_DEFAULT = [55.9523946827963, -3.188258484671504];

/* Google Maps logo (marks the "Open in Maps" link that opens Google Maps).
 * Inline SVG so it needs no network and inherits crisp scaling. */
const GMAPS_LOGO =
  '<svg class="gmaps-logo" viewBox="0 0 40 40" width="15" height="15" aria-hidden="true" focusable="false">' +
  '<defs><clipPath id="gmapsPin"><path d="M20 2C12.8 2 7 7.8 7 15c0 8.6 10.3 19.5 12.2 21.5.4.5 1.2.5 1.6 0C22.7 34.5 33 23.6 33 15 33 7.8 27.2 2 20 2z"/></clipPath></defs>' +
  '<g clip-path="url(#gmapsPin)">' +
  '<path fill="#4285F4" d="M20 15 L0 40 L0 0 Z"/>' +
  '<path fill="#EA4335" d="M20 15 L0 0 L40 0 Z"/>' +
  '<path fill="#FBBC04" d="M20 15 L40 0 L40 40 Z"/>' +
  '<path fill="#34A853" d="M20 15 L40 40 L0 40 Z"/>' +
  '</g><circle cx="20" cy="15" r="4.6" fill="#fff"/></svg>';

/* The official-style Fringe genre categories. */
const GENRES = [
  "Cabaret and Variety",
  "Children's Shows",
  "Comedy",
  "Dance, Physical Theatre & Circus",
  "Events",
  "Exhibitions",
  "Music",
  "Musicals and Opera",
  "Spoken Word",
  "Theatre",
];

/* How the user might travel between shows, and rough door-to-door speeds
 * (km/h) used to estimate travel time. (No bus mode — we can't give honest
 * schedules, so it would mislead more than help.) */
const TRAVEL_MODES = ["Walking", "Taxi/Car", "Bicycle"];
const TRAVEL_SPEEDS_KMH = {
  // Walking dialled down to ~2/3 of a brisk 5 km/h — Edinburgh's closes, hills,
  // stairs and festival crowds make real walking slower than the crow flies.
  Walking: (5 * 2) / 3,
  "Taxi/Car": 30,
  Bicycle: 15,
};

/* Reachability window. The user picks how far they'll travel (in minutes) in
 * the travel card; DEFAULT_MAX_TRAVEL seeds it. The slider runs 1–60 min in
 * one-minute steps. A show that starts up to GRACE_MINUTES before you'd
 * actually arrive is still shown, but faded — you'd only just miss it. */
const DEFAULT_MAX_TRAVEL = 10;
const MIN_TRAVEL_MINUTES = 1;
const MAX_TRAVEL_MINUTES = 60;
const GRACE_MINUTES = 5;

/* Price filter — real ticket amounts, shared with the planner so the two pages
 * offer the same money: "any", "free", then a ladder of inclusive caps
 * (shared/price.js). The day files carry each show's cheapest band as `pm`. */
const PRICE_FILTERS = PRICE_OPTIONS.map((o) => o.value);

/* ===== DEBUG: simulated "now" =====================================
 * The whole flow is scoped to "the next few hours today", so for testing we
 * pin a fixed clock instead of the real one. This is a testing pre-set exactly
 * like the pre-set location: a confirmed in-UK location replaces it with the
 * device's real clock (see requestUserLocation / adoptRealClock). */
const NOW = {
  date: "2026-08-14",   // which day's data file to load (data/days/<date>.json)
  dateLabel: "Fri 14 Aug",
  time: "15:44",
  tz: "BST",            // British Summer Time
  minutes: 15 * 60 + 44,
};

/* Backing Date for the simulated clock. The debug date/time picker reads and
 * writes this, and we project it onto NOW (which is used throughout the app).
 * The year is arbitrary — only the day/time matter to the demo. */
let simNowDate = new Date(2026, 7, 14, 15, 44); // Fri 14 Aug 2026, 15:44 (matches the data year)

const state = {
  shows: [],
  venues: {},                  // venue code -> { name, address, postcode, lat, lng }
  markers: {},                 // id -> Leaflet marker
  clusterGroup: null,          // Leaflet.markercluster group for the non-focused pins
  map: null,
  selectedGenres: new Set(["Comedy"]),
  selectedSubgenres: new Set(), // finer descriptors; empty (or all) = every subgenre
  subgenreOptions: [],         // the subgenre values the panel currently offers
  priceFilter: "any",          // "any" | "free" | a cap in pounds, e.g. "15" ($ chip)
  travelMode: "Walking",
  maxTravelMinutes: DEFAULT_MAX_TRAVEL, // reach window from the travel card
  selectedTime: "",            // chosen exact start time, e.g. "16:30"
  selectedShowId: "",          // the pinned "next show" (destination)
  destLabel: "",               // editable destination text (defaults to the show's venue)
  destPlace: null,             // geocoded non-show destination { label, area, lat, lng, kind }
  destNote: "",                // label-only non-show destination (couldn't/didn't geocode)
  placeMarker: null,           // Leaflet marker for the geocoded place
  legShowId: "",               // a show clicked on the map (stop before the destination)
  editingCommitment: false,    // constraint panel opened from the plan to change it
  spareCtaDismissed: false,    // user hid the in-plan "time to spare" prompt
  bookCtaDismissed: false,     // user hid the "Need to book it?" question on a committed place
  viewMode: "closest",         // the one selector under the filters: "closest" | "soonest" | "map"
  view: "list",                // pane the mode implies: "map" | "list" (the list is default)
  sortBy: "distance",          // reachable-list order the mode implies: "time" | "distance"
  userLatLng: USER_DEFAULT,    // current "you are here" location
  userMarker: null,            // Leaflet marker for the user
  reachCircle: null,           // Leaflet circle for the travel radius
  routeLayers: [],             // Leaflet layers for the journey arrows/labels
  ready: false,                // booted + restored — only then do we write the cache
  savedPlan: null,             // cached plan awaiting judgement (see adoptRestoredPlan)
  stalePlan: null,             // a passed plan the restore bar can offer back
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  renderDebugBanner();
  wireDebugControls();
  initMap();
  setUserLocation(USER_DEFAULT, { recenter: false }); // central-Edinburgh default
  requestUserLocation();                              // then ask for the real thing
  restoreNowState();      // last visit's filters (+ its plan, if still ahead of us)
  initIntro();            // the first-run explainer, unless it's been dismissed
  buildGenrePanel();
  buildPricePanel();
  buildTravelPanel();
  wirePanels();
  wireRestoreBar();
  wireViewSwitch();
  // The header pin re-asks the browser for the user's location (same as the
  // map's ◎ control) and recentres on it.
  const locBtn = document.getElementById("locBtn");
  if (locBtn) locBtn.addEventListener("click", requestUserLocation);
  await loadShows();
  adoptRestoredPlan();    // the cached plan, now that we know today's shows
  buildSubgenrePanel();   // the option set comes from the loaded shows
  buildConstraintPanel();
  refreshMap();
  renderShowList();
  updateGenreValue();
  updateSubgenreValue();
  refreshFacetCounts();
  state.ready = true;     // from here on, every change is written to the cache
  saveNowState();
}

/* ---------- Data loading ---------- */
/* Load today's shows: the per-day file (only today's performances, kept small)
 * joined with the venue lookup (names + coordinates), reshaped for the map and
 * list. Only the current day is fetched, so the payload stays light. */
async function loadShows() {
  try {
    const [venuesRes, dayRes] = await Promise.all([
      fetch("data/venues.json"),
      fetch(`data/days/${NOW.date}.json`),
    ]);
    if (!venuesRes.ok) throw new Error(`venues HTTP ${venuesRes.status}`);
    if (!dayRes.ok) throw new Error(`day ${NOW.date} HTTP ${dayRes.status}`);
    // The shared lookup file carries the venue map plus the global rooms/genres
    // lists that the day records index into. Fetched once.
    const lookups = await venuesRes.json();
    state.venues = lookups.venues;
    state.rooms = lookups.rooms || [];
    state.genres = lookups.genres || [];
    state.subgenres = lookups.subgenres || [];
    state.ticketStatuses = lookups.ticketStatuses || [];
    const day = await dayRes.json();
    // Drop shows whose venue we couldn't geocode — they can't be placed on the map.
    state.shows = day
      .map((entry, i) => adaptShow(entry, state, i))
      .filter((s) => s.lat != null && s.lng != null);
  } catch (err) {
    console.error("Could not load show data:", err);
    state.shows = [];
  }
}

/* Join a minimal per-day record with its venue and expand to the model the map
 * and list expect ({ id, title, genre, venue, lat, lng, time, duration, price }).
 * The day record references genre, room, subgenres and ticket status by index
 * into the global `state.genres`/`state.rooms`/`state.subgenres`/
 * `state.ticketStatuses` lookup lists (room index -1, or an unknown room,
 * resolves to no room), and stores free/soldOut as 1/0. A show can perform more
 * than once a day, so the internal id is made unique per performance. */
function adaptShow(entry, { venues, rooms, genres, subgenres, ticketStatuses }, index) {
  const v = venues[entry.venue] || {};
  const venueName = v.name || (entry.venue ? `Venue ${entry.venue}` : "Venue TBC");
  const room = rooms[entry.room];
  const ticketStatus = (ticketStatuses || [])[entry.ts] || null;
  const price = typeof entry.pm === "number" ? entry.pm : entry.free ? 0 : null;
  return {
    id: `${entry.id}__${entry.start}__${index}`,
    showId: entry.id,
    slug: entry.slug,
    title: entry.title,
    genre: genres[entry.genre],
    subgenres: (entry.subs || []).map((i) => (subgenres || [])[i]).filter(Boolean),
    venue: room ? `${venueName} — ${room}` : venueName,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    time: entry.start,
    duration: entry.duration || 60,
    free: !!entry.free,
    // `pm` is the show's cheapest band in pounds, absent when the price cache
    // doesn't know it — which is NOT the same as free (see shared/price.js).
    // priceMin is what the filter reads; `price` is the label a card renders.
    priceMin: price,
    price: priceLabel({ priceMin: price, free: !!entry.free }),
    soldOut: !!entry.soldOut,
    ticketStatus,
    // Can you actually get a ticket online? ticketStatus is the reliable signal
    // (the soldOut flag isn't — see scraper/SCRAPING.md). Unknown ⇒ assume yes.
    available: !NO_TICKETS_STATUSES.has(ticketStatus),
  };
}

/* Ticket statuses that mean "no ticket available online" → SOLD OUT stamp.
 * Anything else (incl. unknown) is treated as available. */
const NO_TICKETS_STATUSES = new Set(["SOLD_OUT", "NO_ALLOCATION_CONTACT_VENUE"]);

/* ---------- Map ---------- */
function initMap() {
  const map = L.map("leaflet-map", { scrollWheelZoom: false }).setView(EDINBURGH, 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);


  state.map = map;
}

/* ---------- User location ---------- */
function userIcon() {
  return L.divIcon({
    className: "user-marker",
    html: '<span class="user-dot"></span>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

/* Drop or move the "you are here" marker. opts.recenter pans the map to it. */
function setUserLocation(latlng, { recenter = true, real = false } = {}) {
  state.userLatLng = latlng;
  const label = real ? "You are here" : "You are here (approx. central Edinburgh)";

  if (state.userMarker) {
    state.userMarker.setLatLng(latlng);
  } else {
    state.userMarker = L.marker(latlng, {
      icon: userIcon(),
      zIndexOffset: 1000,
      keyboard: false,
    }).addTo(state.map);
  }
  state.userMarker.bindPopup(`<p class="popup-title">${label}</p>`);

  if (recenter && state.map) state.map.setView(latlng, 15, { animate: true });
  if (state.shows.length) refreshMap(); // reachable set depends on where we are
}

/* Ask the browser for the user's real location and move the pin there. */
function requestUserLocation() {
  if (!("geolocation" in navigator)) {
    console.warn("Geolocation not supported; keeping default location.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const here = [pos.coords.latitude, pos.coords.longitude];
      // Testing guard: outside the UK (e.g. an overseas tester) keep the
      // central-Edinburgh default and show the pre-set values instead.
      if (!isInUK(here)) {
        console.info(
          `Real location (${here[0].toFixed(3)}, ${here[1].toFixed(3)}) is outside the UK — ` +
            "keeping the central Edinburgh default for testing."
        );
        return;
      }
      // In the UK we trust the device, so every pre-set goes: the real location
      // replaces the default pin, the real clock replaces the simulated "now",
      // and the debug tools that tweak them are hidden.
      setUserLocation(here, { recenter: true, real: true });
      setDebugVisible(false);
      adoptRealClock();
    },
    (err) => {
      // Denied / unavailable / timed out — keep the central-Edinburgh default.
      console.info("Using default location:", err && err.message);
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

function genreColor(genre) {
  const map = {
    Comedy: "#c62024",
    Theatre: "#9c181b",
    "Dance, Physical Theatre & Circus": "#c79a36",
    Music: "#2f6bd6",
    "Cabaret and Variety": "#8e44ad",
    "Musicals and Opera": "#16a085",
    "Spoken Word": "#34495e",
    "Children's Shows": "#27ae60",
    Events: "#e67e22",
    Exhibitions: "#2c3e50",
  };
  return map[genre] || "#141414";
}


/* Does a show carry any of the selected subgenres? */
function matchesSubgenres(show) {
  return (show.subgenres || []).some((s) => state.selectedSubgenres.has(s));
}

/* Both ends of a checkbox panel mean "don't narrow": none ticked is the obvious
 * one, and every box ticked is the same answer said the other way round. They
 * only look different — so a full panel filters nothing at all, which also
 * keeps the handful of shows carrying no subgenre (or a genre outside the ten
 * headline ones) in view instead of quietly dropping them. */
function genreFilterActive() {
  return state.selectedGenres.size > 0 && !allGenresSelected();
}

function subgenreFilterActive() {
  return state.selectedSubgenres.size > 0 && !allSubgenresSelected();
}

/* Shows passing the current taste filters (an empty *or* full genre/subgenre
 * set = all). `except` names one facet to leave unapplied — that's the pool a
 * facet's own per-option counts are measured against, so each count answers
 * "how many shows would ticking this give me", not "how many are already
 * showing". */
function filteredShows(except) {
  let list = state.shows;
  if (except !== "genre" && genreFilterActive()) {
    list = list.filter((s) => state.selectedGenres.has(s.genre));
  }
  if (except !== "subgenre" && subgenreFilterActive()) list = list.filter(matchesSubgenres);
  if (except !== "price") list = list.filter((s) => matchesPrice(s, state.priceFilter));
  return list;
}

/* Shows passing every taste filter — what the map and list draw from. The
 * `except` argument is passed straight down from the count queries. */
function visibleShows(except) {
  return filteredShows(except);
}

/* How far ahead a "next commitment" must start to be worth picking. There's no
 * point letting the user constrain their search to something starting in the
 * next few minutes — they couldn't act on it — so we only offer start times at
 * least CONSTRAINT_LEAD_MINUTES from now. */
const CONSTRAINT_LEAD_MINUTES = 40;

/* Candidate shows for the "next commitment" constraint. This is whatever the
 * user already has lined up, NOT part of the current genre/price search, so it
 * deliberately ignores the genre + price filter. Only start times at least
 * CONSTRAINT_LEAD_MINUTES from now are offered. */
function constraintShows() {
  return state.shows.filter(
    (s) => timeToMinutes(s.time) >= NOW.minutes + CONSTRAINT_LEAD_MINUTES
  );
}

/* Minutes of travel, by the selected mode, from A to B ([lat,lng] each). */
function travelMinutes(a, b) {
  const speed = TRAVEL_SPEEDS_KMH[state.travelMode] || TRAVEL_SPEEDS_KMH.Walking;
  return (distanceKm(a, b) / speed) * 60;
}

/* Metres covered in the chosen max-travel window at the selected travel speed. */
function reachRadiusMeters() {
  const speed = TRAVEL_SPEEDS_KMH[state.travelMode] || TRAVEL_SPEEDS_KMH.Walking;
  return speed * (state.maxTravelMinutes / 60) * 1000;
}

/* The committed next commitment as a route/classification constraint: the
 * pinned show, or — when a typed place has been found on the map — a pseudo-show
 * carrying the place's coordinates and the picked time. Null while nothing with
 * coordinates is committed (a label-only place can't constrain anything
 * measurable). Everything downstream (classify, route, plan, Maps link) reads
 * the constraint through this, so shows and places behave identically. */
const PLACE_ID = "__place__"; // can't collide with show ids (`<id>__<start>__<index>`)
function commitmentConstraint() {
  const show = state.shows.find((s) => s.id === state.selectedShowId);
  if (show) return show;
  if (state.destPlace && state.selectedTime) {
    const p = state.destPlace;
    return { id: PLACE_ID, isPlace: true, time: state.selectedTime, lat: p.lat, lng: p.lng, duration: 0 };
  }
  return null;
}

/* Classify a show for the map relative to the user and (optionally) the chosen
 * "next show" constraint. Returns "selected" | "ok" | "tight" | "hidden".
 *   - ok     : you can travel there and arrive before it starts
 *   - tight  : you'd arrive up to GRACE_MINUTES after it starts (faded)
 *   - hidden : out of reach, already missed, or won't leave time for your
 *              next show
 */
function classifyShow(show, constraint) {
  if (constraint && show.id === constraint.id) return "selected";

  const here = state.userLatLng;
  const there = [show.lat, show.lng];
  const travel = travelMinutes(here, there);
  if (travel > state.maxTravelMinutes) return "hidden"; // beyond chosen travel window

  const arrival = NOW.minutes + travel;
  const start = timeToMinutes(show.time);
  const reachInTime = arrival <= start;
  const tight = !reachInTime && arrival - start <= GRACE_MINUTES;

  // With a next show chosen, also require leaving in time to make it.
  if (constraint) {
    const end = start + show.duration;
    const onward = travelMinutes(there, [constraint.lat, constraint.lng]);
    const makesConstraint = end + onward <= timeToMinutes(constraint.time);
    if (!makesConstraint) return "hidden";
    // Once committed to a plan, only keep shows you can comfortably reach.
    return reachInTime ? "ok" : "hidden";
  }

  if (reachInTime) return "ok";
  if (tight) return "tight";
  return "hidden";
}

/* The shows to draw on the map, each with its status. */
function displayedShows(except) {
  const constraint = commitmentConstraint();

  const out = [];
  visibleShows(except).forEach((show) => {
    const status = classifyShow(show, constraint);
    if (status !== "hidden") out.push({ show, status });
  });
  // Always keep the chosen next show pinned, even if it's beyond the circle.
  // (A committed place isn't a show — it gets its own pin in renderPlaceMarker.)
  if (constraint && !constraint.isPlace && !out.some((o) => o.show.id === constraint.id)) {
    out.push({ show: constraint, status: "selected" });
  }
  // Keep the user's selected show pinned too — it stays selected until they
  // change it, even if the current commitment/window would otherwise hide it.
  if (
    state.legShowId &&
    state.legShowId !== state.selectedShowId &&
    !out.some((o) => o.show.id === state.legShowId)
  ) {
    const sel = state.shows.find((s) => s.id === state.legShowId);
    if (sel) out.push({ show: sel, status: "leg" });
  }
  // Highlight the show the user selected — a stop before the destination when a
  // plan exists, or just the highlighted pin otherwise.
  if (state.legShowId) {
    const focus = out.find((o) => o.show.id === state.legShowId && o.status !== "selected");
    if (focus) focus.status = "leg";
  }
  // Draw highlighted pins last so they sit on top.
  const z = { ok: 0, tight: 0, leg: 1, selected: 2 };
  out.sort((a, b) => (z[a.status] || 0) - (z[b.status] || 0));
  return out;
}

/* A little emoji per genre — shown in the genre filter and as the map pin. */
const GENRE_ICONS = {
  "Cabaret and Variety": "🎩",
  "Children's Shows": "🧸",
  Comedy: "😄",
  "Dance, Physical Theatre & Circus": "💃",
  Events: "🎟️",
  Exhibitions: "🖼️",
  Music: "🎵",
  "Musicals and Opera": "🎼",
  "Spoken Word": "🗣️",
  Theatre: "🎭",
};
function genreIcon(genre) {
  return GENRE_ICONS[genre] || "🎭";
}

/* A map pin as the genre emoji inside a subtle transparent ring — a thin,
 * semi-transparent white border defines the marker without the heavy white disc
 * crowding the map. Every pin is the same size; the focused show and committed
 * destination are highlighted by a violet ring (see .gpin--selected/--leg), not
 * by growing, so they never disturb the map's density. */
function genrePin(show, status) {
  return pinIcon(genreIcon(show.genre), status);
}

/* The shared emoji-in-a-ring pin: show pins use their genre emoji, the committed
 * non-show place uses its kind's emoji with the same "selected" violet ring. */
function pinIcon(emoji, status) {
  const size = 22;
  const font = Math.round(size * 0.74);
  const html = `<span class="gpin gpin--${status}" style="width:${size}px;height:${size}px;font-size:${font}px">${emoji}</span>`;
  return L.divIcon({
    html,
    className: "genre-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
}

/* Pin (or clear) the committed non-show place. Styled like a committed show —
 * violet ring — with the place's name as a hover tooltip, since no card or
 * list row describes it on the map itself. */
function renderPlaceMarker() {
  if (!state.map) return;
  if (state.placeMarker) {
    state.map.removeLayer(state.placeMarker);
    state.placeMarker = null;
  }
  const p = state.destPlace;
  if (!p) return;
  state.placeMarker = L.marker([p.lat, p.lng], {
    icon: pinIcon(placeIcon(p.kind), "selected"),
    zIndexOffset: 1000,
    keyboard: false,
  }).addTo(state.map);
  state.placeMarker.bindTooltip(p.label, { direction: "top" });
}

/* Cluster bubble for Leaflet.markercluster — a violet count disc in the page's
 * palette, sized up a touch for busier clusters. */
function clusterIcon(cluster) {
  const n = cluster.getChildCount();
  const size = n < 10 ? 30 : n < 50 ? 36 : 42;
  // When a show is focused, the individual pins step back — so the count bubbles
  // must fade too, or they'd sit there loud and opaque while everything else dims.
  const dim = state.legShowId ? " gcluster--dim" : "";
  return L.divIcon({
    html: `<span class="gcluster${dim}" style="width:${size}px;height:${size}px">${n}</span>`,
    className: "genre-cluster",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* Re-draw the reach circle, show markers, journey arrows and the (mirrored)
 * show list together. */
function refreshMap() {
  renderReachCircle();
  renderMarkers();
  renderPlaceMarker();
  renderRoute();
  renderShowList();
  renderJourneyStrip();
  updateCtaVisibility();
  saveNowState(); // every mutation lands here, so this is the one save point
}

/* Once a show is committed, the big top "Set my next commitment" box is
 * redundant — the plan carries it, and its destination node reopens the editor.
 * Hide the box while a commitment exists (or while editing one). */
function updateCtaVisibility() {
  const editing = state.editingCommitment;
  const committed = Boolean(commitmentConstraint()) || Boolean(state.destNote);
  document.body.classList.toggle("has-plan", committed || editing);
}

/* Reopen the constraint panel from the plan's destination node, so the user can
 * change the time / show / place without the top box hanging around. */
function openConstraintEditor() {
  const trigger = document.querySelector(".cta-trigger");
  const panel = document.getElementById("constraintPanel");
  if (!trigger || !panel) return;
  state.editingCommitment = true;
  closeAllPanels();
  state.editingCommitment = true; // closeAllPanels cleared it; we're re-opening
  openPanel(trigger, panel);
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* Drop the next commitment entirely (the plan's "×"), returning to the initial
 * "Set my next commitment" state. The selected show is intentionally kept — the
 * commitment and the show you picked are independent choices. */
function clearCommitment() {
  state.selectedShowId = "";
  state.selectedTime = "";
  state.destLabel = "";
  state.destPlace = null;
  state.destNote = "";
  clearPlaceResults();
  state.editingCommitment = false;
  state.spareCtaDismissed = false;
  state.bookCtaDismissed = false;
  syncDestInput();
  refreshConstraintValue();
  refreshMap();
}

function renderReachCircle() {
  if (!state.map) return;
  const opts = {
    radius: reachRadiusMeters(),
    color: "#6c4cf1",
    weight: 1.5,
    fillColor: "#6c4cf1",
    fillOpacity: 0.08,
    interactive: false,
  };
  if (state.reachCircle) {
    state.reachCircle.setLatLng(state.userLatLng).setRadius(opts.radius);
  } else {
    state.reachCircle = L.circle(state.userLatLng, opts).addTo(state.map);
  }
  state.reachCircle.bindTooltip(
    `~${state.maxTravelMinutes} min by ${state.travelMode}`,
    { permanent: false, direction: "top" }
  );
}

function renderMarkers() {
  if (!state.map) return;

  // Cluster group for the ordinary pins — collapses dense / overlapping shows
  // into a count bubble that splits (and spiderfies coincident pins) on zoom.
  // Guarded: if the plugin CDN failed to load, we degrade to plain markers so
  // the map still works rather than throwing.
  if (!state.clusterGroup && typeof L.markerClusterGroup === "function") {
    state.clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 26,      // px; smaller = only genuinely close pins merge
      spiderfyOnMaxZoom: true,   // fan out pins sharing a spot when fully zoomed
      showCoverageOnHover: false,
      iconCreateFunction: clusterIcon,
    });
    state.map.addLayer(state.clusterGroup);
  }

  // Clear the previous render: clustered pins live in the group, the focused /
  // destination pins are added straight to the map, so clear both.
  if (state.clusterGroup) state.clusterGroup.clearLayers();
  Object.values(state.markers).forEach((m) => {
    if (state.map.hasLayer(m)) state.map.removeLayer(m);
  });
  state.markers = {};

  // Only when the user has actually tapped a show to focus it do the other pins
  // step back — a committed next commitment on its own shouldn't grey out the
  // options you're browsing to fill the gap.
  const anyFocus = Boolean(state.legShowId);
  displayedShows().forEach(({ show, status }) => {
    const prominent = status === "selected" || status === "leg";
    const dim = anyFocus && !prominent;
    const marker = L.marker([show.lat, show.lng], {
      icon: genrePin(show, status),
      zIndexOffset: status === "selected" ? 1000 : status === "leg" ? 600 : 0,
      keyboard: false,
    });
    marker.setOpacity(dim ? 0.25 : status === "tight" ? 0.55 : 1);

    if (prominent) {
      // Keep the highlighted pins out of clusters so they're always visible.
      // (No name tooltip — the focus card / plan carries the title; a permanent
      // label here just added noise. The ✓-arrival time sits above instead.)
      marker.addTo(state.map);
    } else if (state.clusterGroup) {
      state.clusterGroup.addLayer(marker);
    } else {
      marker.addTo(state.map); // plugin unavailable — plain marker fallback
    }

    // Tapping a pin selects the show (updates the map + draws its path) but,
    // unlike the list, does NOT scroll the page — map browsing stays put.
    marker.on("click", () => onShowClick(show));
    state.markers[show.id] = marker;
  });
}

/* Select a show (from the list or a map pin): it becomes the stop on the way to
 * any commitment, draws its path, and the other pins dim. Selecting it again
 * clears it. The list additionally scrolls up to the plan; the map does not. The
 * committed destination itself isn't a re-selectable focus. */
function onShowClick(show) {
  if (show.id === state.selectedShowId) return; // already the committed destination
  state.legShowId = state.legShowId === show.id ? "" : show.id; // toggle selection
  refreshMap();
}

/* ---------- Journey arrows ---------- */
function renderRoute() {
  if (!state.map) return;
  // Clear previous arrows/labels.
  state.routeLayers.forEach((l) => state.map.removeLayer(l));
  state.routeLayers = [];

  const dest = commitmentConstraint();

  // No commitment yet, but a show is selected: still draw the walk to it, with
  // the same travel pill and the ✓ "you make its start" check.
  if (!dest) {
    const sel = state.legShowId ? state.shows.find((s) => s.id === state.legShowId) : null;
    if (sel) {
      drawLeg(state.userLatLng, [sel.lat, sel.lng], { checkMin: timeToMinutes(sel.time) });
    }
    return;
  }
  const destPt = [dest.lat, dest.lng];

  // Is there a valid intermediate stop the user clicked?
  let leg = null;
  if (state.legShowId && state.legShowId !== dest.id) {
    const cand = state.shows.find((s) => s.id === state.legShowId);
    if (cand && classifyShow(cand, dest) === "ok") leg = cand;
  }

  if (leg) {
    const legPt = [leg.lat, leg.lng];
    // Leg 1: leave now, arrive before this show starts.
    drawLeg(state.userLatLng, legPt, {
      checkMin: timeToMinutes(leg.time), // show start (your arrival is before this)
    });
    // Leg 2: leave when this show ends, arrive before your next commitment.
    drawLeg(legPt, destPt, {
      checkMin: timeToMinutes(dest.time), // constraint start
    });
  } else {
    // Single leg: leave now, arrive before your next commitment.
    drawLeg(state.userLatLng, destPt, { checkMin: timeToMinutes(dest.time) });
  }
}

/* Draw one animated arrow leg. The green check above the destination pin shows
 * the deadline that arrival comfortably beats (a show start, or your next
 * commitment). The leg's clock window lives in the itinerary, not on the map. */
function drawLeg(from, to, { checkMin } = {}) {
  const line = L.polyline([from, to], {
    className: "route-line",
    color: "#141414",
    weight: 3,
    opacity: 0.9,
    interactive: false,
  }).addTo(state.map);
  state.routeLayers.push(line);

  // Arrowhead near the destination end, rotated to the bearing.
  const head = L.marker(lerp(from, to, 0.82), {
    icon: L.divIcon({
      className: "route-arrow-wrap",
      html: `<span class="route-arrow" style="transform:rotate(${bearing(from, to)}deg)"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    }),
    interactive: false,
    keyboard: false,
  }).addTo(state.map);
  state.routeLayers.push(head);

  // Green check with the deadline you're beating, sitting directly above the
  // destination pin. The marker root is a zero-size anchor pinned exactly on the
  // point; the visible pill is an inner span, so its centring transform survives
  // (Leaflet writes its own inline transform on the root to place it, which would
  // otherwise clobber a transform set on the root itself).
  if (checkMin != null) {
    const chk = L.marker(to, {
      icon: L.divIcon({
        className: "route-check-marker",
        html: `<span class="route-label route-check"><span class="tick">✓</span> ${minutesToTime(checkMin)}</span>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1100,
    }).addTo(state.map);
    state.routeLayers.push(chk);
  }
}

function travelGlyph() {
  return { Walking: "🚶", "Taxi/Car": "🚕", Bicycle: "🚲" }[state.travelMode] || "🚶";
}

/* The verb for a leg, matching the selected travel mode: "5 min walk" /
 * "5 min by taxi" / "5 min by bike". Keeps the itinerary honest when the mode
 * switches away from walking. */
function travelVerb() {
  return { Walking: "walk", "Taxi/Car": "by taxi", Bicycle: "by bike" }[state.travelMode] || "walk";
}

/* ---------- Show list ---------- */
/* The list mirrors what's on the map, minus the chosen next commitment: that
 * show is a future destination the user has already locked in, not something
 * "Happening Now", so we pin it on the map but keep it out of this list. */
/* How many list rows to show before the "Show more" button; grows on demand. */
const SHOW_PAGE = 12;

/* The reachable shows to list (excluding the chosen next show). Without a
 * commitment, "on now" means the next couple of hours — not the whole day — so
 * the list stays about spontaneity, not a full catalogue. Order-independent:
 * the caller sorts by time or distance. */
function fittingShows(except) {
  const constraint = commitmentConstraint();
  const constrained = Boolean(constraint);
  let all = displayedShows(except).filter(({ show }) => show.id !== state.selectedShowId);
  // A selected show that can't actually be slipped in before the commitment isn't
  // a real option — keep it on the map and the itinerary, but out of this list
  // and its count (so "N shows you can slip in" stays honest).
  if (constraint && state.legShowId) {
    const leg = state.shows.find((s) => s.id === state.legShowId);
    if (leg && classifyShow(leg, constraint) !== "ok") {
      all = all.filter(({ show }) => show.id !== state.legShowId);
    }
  }
  if (!constrained) {
    all = all.filter(({ show }) => timeToMinutes(show.time) <= NOW.minutes + 120);
  }
  return all;
}

function renderShowList() {
  const grid = document.getElementById("showsGrid");
  const title = document.querySelector(".shows-title");
  const moreBtn = document.getElementById("showMore");
  if (!grid) return;
  grid.innerHTML = "";

  const constraint = commitmentConstraint();

  const all = fittingShows();
  // Walk minutes: computed once, reused for the row label and distance sort.
  all.forEach((o) => {
    o.walk = Math.max(1, Math.round(travelMinutes(state.userLatLng, [o.show.lat, o.show.lng])));
  });
  const byDistance = state.sortBy === "distance";
  if (byDistance) all.sort((a, b) => a.walk - b.walk || a.show.time.localeCompare(b.show.time));
  else all.sort((a, b) => a.show.time.localeCompare(b.show.time));

  if (title) {
    const n = all.length;
    const shows = n === 1 ? "show" : "shows";
    title.textContent = constraint
      ? `${n} ${shows} you can slip in before ${constraint.time}`
      : `${n} ${shows} you could wander into right now`;
  }

  if (!all.length) {
    grid.innerHTML =
      '<p class="show-meta">' +
      (constraint
        ? "Nothing fits before your next commitment — try a later time or a wider travel window."
        : "Nothing reachable in the next couple of hours — widen your travel window or taste.") +
      "</p>";
    if (moreBtn) moreBtn.hidden = true;
    return;
  }

  const cap = state.showCap || SHOW_PAGE;
  const shown = all.slice(0, cap);

  // Compact rows. Sorting by time groups under start-time headings; sorting by
  // distance is a flat nearest-first list (each row still shows its time).
  let group = null;
  shown.forEach(({ show, status, walk }) => {
    if (!byDistance && show.time !== group) {
      group = show.time;
      const head = document.createElement("h3");
      head.className = "shows-group-head";
      head.textContent = show.time;
      grid.appendChild(head);
    }
    const item = document.createElement("article");
    item.className = `show-item show-item--${status}${show.available ? "" : " show-item--soldout"}`;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.innerHTML = `
      ${showStamp(show, status)}
      <span class="si-main">
        <span class="show-genre">${escapeHtml(show.genre)}</span>
        <span class="show-name">${escapeHtml(show.title)}</span>
        <span class="show-meta">${escapeHtml(show.venue)}</span>
        ${subgenreTags(show)}
      </span>
      <span class="si-side">
        <span class="si-time">${escapeHtml(show.time)}</span><br />
        <span class="si-walk">🚶 ${walk} min · ${escapeHtml(show.price)}</span>
        ${constraint ? '<br /><span class="si-fits">fits</span>' : ""}
      </span>`;
    const activate = () => {
      onShowClick(show);
      // Selecting from the list promotes the show into the plan at the top of the
      // page — scroll all the way up so the whole itinerary reads top-to-bottom
      // (scrolling only to the plan tucked its header under the sticky nav).
      if (state.legShowId === show.id) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    item.addEventListener("click", activate);
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
    grid.appendChild(item);
  });

  if (moreBtn) {
    const remaining = all.length - shown.length;
    moreBtn.hidden = remaining <= 0;
    moreBtn.textContent = `Show ${Math.min(SHOW_PAGE, remaining)} more · ${remaining} left`;
  }
}

/* ---------- View selector: Closest | Soonest | Map ---------- */
/* One control carries both decisions. The map and the reachable list are two
 * views of the same shows, and the list only ever has two useful orders — so
 * rather than a view toggle plus a sort toggle, the three positions here are
 * the three things you can actually be looking at. The filters above act on all
 * three, so nothing here touches them.
 *
 * "Closest" leads and is the default: a ranked list answers "what can I make?"
 * directly, where the map asks the user to do the ranking themselves by eye.
 * The map sits third as the orientation view you reach for once you know what
 * the options are. */
const VIEW_MODES = {
  closest: { view: "list", sortBy: "distance" },
  soonest: { view: "list", sortBy: "time" },
  map: { view: "map" },
};

function applyViewMode(mode) {
  const spec = VIEW_MODES[mode] || VIEW_MODES.closest;
  const orderChanged = spec.sortBy && spec.sortBy !== state.sortBy;
  state.viewMode = mode;
  state.view = spec.view;
  if (spec.sortBy) state.sortBy = spec.sortBy;

  const mapPane = document.getElementById("map");
  const listPane = document.getElementById("shows");
  if (mapPane) mapPane.hidden = state.view !== "map";
  if (listPane) listPane.hidden = state.view !== "list";

  const area = document.querySelector(".view-area");
  if (area) area.dataset.view = state.view;

  updateViewButtons();

  // A new order starts from the first page, so the top of the list is the part
  // that actually answers "closest" / "soonest".
  if (orderChanged) {
    state.showCap = SHOW_PAGE;
    renderShowList();
  }

  // Leaflet can't measure a display:none container, so a map hidden while the
  // list showed comes back mis-sized — re-measure once it's visible again.
  if (state.view === "map" && state.map) state.map.invalidateSize();

  saveNowState(); // the chosen view is part of what we remember
}

/* Reflect the active mode on the three-position selector. */
function updateViewButtons() {
  document.querySelectorAll(".view-btn[data-mode]").forEach((b) => {
    const on = b.dataset.mode === state.viewMode;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

/* Wire the selector. All three positions stay visible, so any of them is one
 * click away from any other. */
function wireViewSwitch() {
  document.querySelectorAll(".view-btn[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.viewMode === btn.dataset.mode) return;
      applyViewMode(btn.dataset.mode);
    });
  });
  applyViewMode(state.viewMode); // establish the default (closest)
}

/* ---------- First-run explainer ---------- */
/* The page opens on a constraint card that asks for a commitment before saying
 * why one helps, so a first-time visitor gets the idea stated once, in the
 * order the app works. It earns its space exactly once: dismissing it writes a
 * flag that survives the visit, and the markup starts `hidden` so a returning
 * visitor never sees it flash before the flag is read. */
function initIntro() {
  const el = document.getElementById("intro");
  if (!el || readStore(INTRO_KEY)) return;
  el.hidden = false;

  const dismiss = () => {
    el.hidden = true;
    writeStore(INTRO_KEY, { dismissed: true });
  };
  const x = document.getElementById("introDismiss");
  const got = document.getElementById("introGot");
  if (x) x.addEventListener("click", dismiss);
  if (got) got.addEventListener("click", dismiss);
}

/* ---------- Journey strip ---------- */
/* A narrow, always-visible timeline between the filters and the map. It mirrors
 * the journey the map is drawing, left → right:
 *   • origin  — "You are here", now (always shown, styled dull)
 *   • middle  — nothing chosen yet: an animated walker idling in place;
 *               a destination chosen: the leg(s) to it with travel time + slack
 *   • right   — your next commitment, once chosen
 * The slack chip notes how long you'd have before each show starts. */
function renderJourneyStrip() {
  const strip = document.getElementById("journeyStrip");
  if (!strip) return;

  const origin = state.userLatLng;
  const constraint = commitmentConstraint();
  // The selected show to slip in — kept independent of the commitment. It shows
  // in the plan whenever one is selected (and it isn't the commitment itself),
  // even if it no longer neatly fits: the slack chip tells that story.
  const leg =
    state.legShowId && (!constraint || state.legShowId !== constraint.id)
      ? state.shows.find((s) => s.id === state.legShowId)
      : null;

  // Nothing chosen at all — no plan to show; the list heading carries the state.
  if (!constraint && !leg && !state.destNote) {
    strip.innerHTML = "";
    return;
  }

  // The plan header carries a mild "open in Maps" link on its right (only useful
  // once there's a commitment to route toward) — a quiet offer, not a big button.
  const parts = [
    '<div class="plan-head-row">' +
      '<p class="plan-head">Your plan</p>' +
      (constraint
        ? '<a id="mapsRouteLink" class="plan-maps-mild" href="#" target="_blank" rel="noopener" ' +
          'title="Open this route in Google Maps">' + GMAPS_LOGO + " Open in Maps</a>"
        : "") +
    "</div>",
  ];
  parts.push(planNode("📍", "you", `${NOW.time} · now`, "You are here", state.travelMode.toLowerCase(), "", ""));

  if (leg) {
    const legPt = [leg.lat, leg.lng];
    const arriveLeg = NOW.minutes + travelMinutes(origin, legPt);
    // Can you slip this show in and still make the commitment? If not, the show —
    // not the commitment — is where the problem belongs.
    const legFits = !constraint || classifyShow(leg, constraint) === "ok";

    parts.push(planLeg(travelMinutes(origin, legPt)));
    parts.push(
      planNode(
        genreIcon(leg.genre),
        "stop",
        `${leg.time}–${minutesToTime(timeToMinutes(leg.time) + leg.duration)}`,
        leg.title,
        `${leg.venue} · ${leg.genre}`,
        legFits
          ? planSlack(timeToMinutes(leg.time) - arriveLeg)
          : '<span class="plan-slack wontfit">You\'ll be late</span>',
        `${subgenreTags(leg)}${planBuy(leg)}`
      )
    );
    if (constraint) {
      const destPt = [constraint.lat, constraint.lng];
      if (legFits) {
        // Sequential detour: leave when the show ends, then on to the commitment.
        const departFromLeg = timeToMinutes(leg.time) + leg.duration;
        const arriveDest = departFromLeg + travelMinutes(legPt, destPt);
        parts.push(planLeg(travelMinutes(legPt, destPt)));
        parts.push(destNode(constraint, planSlack(timeToMinutes(constraint.time) - arriveDest)));
      } else {
        // The show breaks this plan — present the commitment as reachable directly
        // (skip the show), with no alarming pill of its own: it isn't the problem.
        const arriveDest = NOW.minutes + travelMinutes(origin, destPt);
        parts.push(planLeg(travelMinutes(origin, destPt)));
        parts.push(destNode(constraint, planSlack(timeToMinutes(constraint.time) - arriveDest)));
      }
    } else if (state.destNote) {
      parts.push(noteLeg(), noteDestNode());
    }
  } else if (!constraint) {
    // A note commitment only: no coordinates, so no travel time or slack — the
    // node keeps the commitment visible and editable, nothing more.
    parts.push(noteLeg(), noteDestNode());
  } else {
    const destPt = [constraint.lat, constraint.lng];
    const arriveDest = NOW.minutes + travelMinutes(origin, destPt);
    // Middle slot: until a show is slipped in, offer the plan's spare time as a
    // prompt where the chosen show will go. It's dismissable, and gets replaced
    // by the show's own node once one is picked (the `leg` branch above). When
    // there's nothing to offer it falls back to a plain walk connector.
    const spareNode = spareCtaNode();
    parts.push(spareNode || planLeg(travelMinutes(origin, destPt)));
    parts.push(destNode(constraint, planSlack(timeToMinutes(constraint.time) - arriveDest)));
  }

  strip.innerHTML = parts.join("");

  // Small, explicit controls (top-right, on the hour line) instead of a whole-
  // node mystery click. Same design on both the selected show and the commitment.
  wireNodeControls(strip.querySelector(".plan-node.stop"), {
    change: () =>
      document.getElementById("shows")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    remove: () => { state.legShowId = ""; refreshMap(); },
    changeLabel: "Pick a different show",
    removeLabel: "Remove selected show",
  });
  wireNodeControls(strip.querySelector(".plan-node.dest"), {
    change: openConstraintEditor,
    remove: clearCommitment,
    changeLabel: "Change your next commitment",
    removeLabel: "Remove your next commitment",
  });

  updateMapsRouteLink();
  wireSpareCta(strip);
  wireBookCta(strip);
}

/* Attach the shared "Change ▾ / ×" controls to a plan node (top-right, on the
 * hour line). Both callbacks stop propagation so the doc click-outside handler
 * doesn't interfere. */
function wireNodeControls(node, { change, remove, changeLabel, removeLabel }) {
  if (!node) return;
  node.classList.add("has-node-controls");
  const controls = document.createElement("div");
  controls.className = "node-controls";
  controls.innerHTML =
    `<button type="button" class="chg-link" data-act="change" aria-label="${changeLabel}">Change ▾</button>` +
    `<button type="button" class="chg-x" data-act="remove" aria-label="${removeLabel}">&times;</button>`;
  node.appendChild(controls);
  controls.querySelector('[data-act="change"]').addEventListener("click", (e) => {
    e.stopPropagation();
    change();
  });
  controls.querySelector('[data-act="remove"]').addEventListener("click", (e) => {
    e.stopPropagation();
    remove();
  });
}

/* Google Maps travel mode matching the user's currently selected one. */
function googleMapsTravelMode() {
  return (
    { Walking: "walking", "Taxi/Car": "driving", Bicycle: "bicycling" }[state.travelMode] ||
    "walking"
  );
}

/* Build the Google Maps URL for the current plan. The journey always starts at
 * "you are here"; the shape depends on how many stops are chosen on top of it:
 *   • none           → just open the map centred on the user.
 *   • one (chosen OR
 *     destination)   → directions from here to that single show.
 *   • two (chosen +
 *     destination)   → directions here → chosen show → destination, with the
 *                      chosen show passed as a waypoint.
 * Travel mode follows the user's selection. */
function googleMapsUrl() {
  const origin = state.userLatLng; // [lat, lng] — "you are here"
  const fmt = ([lat, lng]) => `${lat},${lng}`;

  const destShow = commitmentConstraint(); // a committed place routes the same way
  let legShow = null;
  if (state.legShowId && (!destShow || state.legShowId !== destShow.id)) {
    legShow = state.shows.find((s) => s.id === state.legShowId) || null;
  }

  // Ordered geographic stops after the origin: chosen show first, then the
  // destination. The final one is the route's destination; any before it are
  // waypoints.
  const stops = [];
  if (legShow) stops.push([legShow.lat, legShow.lng]);
  if (destShow) stops.push([destShow.lat, destShow.lng]);

  // Nothing chosen — just open the map centred on the user.
  if (stops.length === 0) {
    return `https://www.google.com/maps/@${fmt(origin)},15z`;
  }

  const destination = stops[stops.length - 1];
  const waypoints = stops.slice(0, -1);
  let url =
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${encodeURIComponent(fmt(origin))}` +
    `&destination=${encodeURIComponent(fmt(destination))}` +
    `&travelmode=${googleMapsTravelMode()}`;
  if (waypoints.length) {
    url += `&waypoints=${encodeURIComponent(waypoints.map(fmt).join("|"))}`;
  }
  return url;
}

/* Point the plan-header Maps link at the current route. The link only exists in
 * the DOM while a plan is rendered (renderJourneyStrip builds it), so there's
 * nothing to show/hide here — just keep its href current. */
function updateMapsRouteLink() {
  const link = document.getElementById("mapsRouteLink");
  if (!link) return;
  link.href = googleMapsUrl();
}

/* Minutes of slack before the next commitment on the current plan — i.e. the
 * free time you could still fill with a show. Accounts for a chosen leg. Returns
 * null when no commitment is set. */
function planSpareMinutes() {
  const constraint = commitmentConstraint();
  if (!constraint) return null;

  const origin = state.userLatLng;
  const destPt = [constraint.lat, constraint.lng];

  let leg = null;
  if (state.legShowId && state.legShowId !== constraint.id) {
    const cand = state.shows.find((s) => s.id === state.legShowId);
    if (cand && classifyShow(cand, constraint) === "ok") leg = cand;
  }

  let arriveDest;
  if (leg) {
    const departFromLeg = timeToMinutes(leg.time) + leg.duration;
    arriveDest = departFromLeg + travelMinutes([leg.lat, leg.lng], destPt);
  } else {
    arriveDest = NOW.minutes + travelMinutes(origin, destPt);
  }
  return Math.round(timeToMinutes(constraint.time) - arriveDest);
}

/* The plan's spare-time prompt, rendered in the plan's middle slot (where a
 * slipped-in show will go): "You have about 2½ hours to spare — want to see a
 * show? (N fit below)". The gap is phrased rather than counted in minutes (see
 * shared/duration.js): a raw "287 min" is a number nobody converts in their head.
 * The count mirrors the reachable list. Returns "" when there's nothing to
 * offer — no spare time, nothing fits, or the user dismissed it — so the plan
 * falls back to a plain walk connector. */
function spareCtaNode() {
  if (state.spareCtaDismissed) return "";
  const spare = planSpareMinutes();
  if (spare === null || spare <= 0) return "";
  const n = fittingShows().length;
  if (!n) return "";
  const count = `<a class="spare-count spare-jump" href="#shows">${n} ${n === 1 ? "fits" : "fit"} below</a>`;
  return (
    '<div class="plan-spare">' +
    '<button type="button" class="plan-spare-x" aria-label="Dismiss — hide this suggestion" title="Dismiss">&times;</button>' +
    `<p class="spare-line">You have <b>${friendlyDuration(spare)}</b> to spare — want to see a show? ${count}</p>` +
    "</div>"
  );
}

/* Wire the in-plan spare prompt: the × dismisses it (revealing a clean plan)
 * and the "N fit below" link jumps down to the selectable show list. */
function wireSpareCta(strip) {
  const x = strip.querySelector(".plan-spare-x");
  if (x) {
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      state.spareCtaDismissed = true;
      renderJourneyStrip();
    });
  }
  const jump = strip.querySelector(".spare-jump");
  if (jump) {
    jump.addEventListener("click", (e) => {
      e.preventDefault();
      const shows = document.getElementById("shows");
      if (shows) shows.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

/* One node in the vertical plan: a leading glyph (📍 for "you", the genre emoji
 * for a show), time, title, subtitle, an optional slack chip and an optional
 * extra (e.g. a buy button). */
function planNode(icon, kind, time, title, sub, slackHtmlStr, extraHtml) {
  // Slack chip sits on the time line, to the left of the event time: it reads as
  // the payoff of the travel connector just above ("N min walk" → "made it, X to
  // spare · 15:30–16:30").
  return `
    <div class="plan-node ${kind}">
      <span class="plan-ico" aria-hidden="true">${icon}</span>
      <div class="plan-timerow">${slackHtmlStr || ""}<span class="plan-time">${escapeHtml(time)}</span></div>
      <div class="plan-title">${escapeHtml(title)}</div>
      ${sub ? `<div class="plan-sub">${escapeHtml(sub)}</div>` : ""}
      ${extraHtml || ""}
    </div>`;
}

/* The plan's destination node — the next commitment. A committed show wears its
 * genre icon; a committed place wears its kind's icon (🍽️ 🚆 …) and carries the
 * partner booking link where one exists. */
function destNode(constraint, slackHtmlStr) {
  const icon = constraint.isPlace ? placeIcon(state.destPlace.kind) : genreIcon(constraint.genre);
  const extra = constraint.isPlace ? planPartnerLink() : "";
  return planNode(icon, "dest", constraint.time, destinationLabel(), "Your next commitment", slackHtmlStr, extra);
}

/* Booking link for the committed non-show place — a table, train tickets, a
 * room, tour tickets. It first asks outright ("Need to book it?") with a big
 * button; the × shrinks it to a quiet pill rather than losing the link, and a
 * fresh commitment re-asks. The link is useful on its own and doubles as the
 * referral once the affiliate IDs in js/places.js are configured
 * (rel="sponsored" declares that honestly). The deep link pre-fills what the
 * user already told us: the committed time (a table) or tonight (a room). */
function planPartnerLink() {
  if (!state.destPlace) return "";
  const link = partnerLink(state.destPlace, AFFILIATES, { dateISO: NOW.date, time: state.selectedTime });
  if (!link) return "";
  const btnLabel = `${placeIcon(state.destPlace.kind)} ${escapeHtml(link.text)} &middot; ${escapeHtml(link.partner)}`;
  const anchor = (cls) =>
    `<a class="${cls}" href="${escapeHtml(link.url)}" target="_blank"
       rel="noopener sponsored" title="Opens ${escapeHtml(link.partner)} — booking via this link supports EdFringeNow"
     >${btnLabel}</a>`;
  if (state.bookCtaDismissed) return anchor("plan-buy-inline");
  return (
    '<div class="plan-book-cta">' +
    '<button type="button" class="plan-book-x" aria-label="Dismiss — hide the booking question" title="Dismiss">&times;</button>' +
    '<p class="book-q">Need to book it?</p>' +
    anchor("plan-book-btn") +
    "</div>"
  );
}

/* Wire the booking question's ×: dismissing keeps the quiet pill (the link
 * survives, the question doesn't). */
function wireBookCta(strip) {
  const x = strip.querySelector(".plan-book-x");
  if (x) {
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      state.bookCtaDismissed = true;
      renderJourneyStrip();
    });
  }
}

/* A travel connector between two plan nodes; verb follows the selected mode. */
function planLeg(mins) {
  return `<div class="plan-leg">${escapeHtml(travelGlyph())} ${formatMins(mins)} ${travelVerb()}</div>`;
}

/* The connector and destination node for a label-only note commitment ("My
 * cousin's flat") — we can't route to a place we couldn't pin, so the
 * connector says so instead of faking a travel time. */
function noteLeg() {
  return `<div class="plan-leg">${escapeHtml(travelGlyph())} make your own way</div>`;
}

function noteDestNode() {
  return planNode("📝", "dest", state.selectedTime, state.destNote, "Your next commitment", "", "");
}

/* Booking link for a show on the official Fringe box office. Every show in the
 * data carries a `slug`; the page lives at /tickets/whats-on/<slug>. */
function ticketUrl(show) {
  return show && show.slug
    ? `https://www.edfringe.com/tickets/whats-on/${encodeURIComponent(show.slug)}`
    : "";
}

/* Buy-ahead link for the chosen stop. Buying ahead skips the on-site box-office
 * queue (~5 min), which matters when a plan is tight. Free shows need no ticket;
 * sold-out shows say so. */
function planBuy(show) {
  if (!show || show.free) return "";
  // `available` (from ticketStatus) is the reliable signal, not the soldOut flag.
  if (show.available === false) return `<span class="plan-soldout">Sold out</span>`;
  const url = ticketUrl(show) || "#";
  return `<a class="plan-buy-inline" href="${escapeHtml(url)}" target="_blank" rel="noopener"
            title="Buy ahead on edfringe.com — skips the box-office queue (~5 min)"
          >&#127915; Buy ahead &middot; skip the queue</a>`;
}

/* A chip noting the cushion before a show starts (or by how much you'd miss it).
 * The cushion is phrased (shared/duration.js); being late is not — "20 min late"
 * is a number you want exactly, however big it is. */
function planSlack(mins) {
  const m = Math.round(mins);
  return m >= 0
    ? `<span class="plan-slack ok">${friendlyDuration(m)} to spare</span>`
    : `<span class="plan-slack late">${-m} min late</span>`;
}

/* Travel duration rounded to whole minutes (never below 1). */
function formatMins(mins) {
  return `${Math.max(1, Math.round(mins))} min`;
}

/* ---------- Taste filters: genre, subgenre, price ----------
 * Three chips sharing one idiom: a dropdown listing every option with a grey
 * count of how many of today's shows it would give you, and an "everything!"
 * link beside the question that clears the filter. Price is the odd one out —
 * a single either/or answer, so it gets a narrow "$" button and a tiny
 * dropdown carrying just the current selection. */

/* Build one checkbox option row: emoji (optional), label, grey count. */
function facetOption(value, { icon, checked, count, onToggle }) {
  const label = document.createElement("label");
  label.className = "panel-option" + (count === 0 ? " is-empty" : "");
  label.innerHTML = `
    <input type="checkbox" value="${escapeHtml(value)}" ${checked ? "checked" : ""} />
    <span>${icon ? `<span class="opt-ico" aria-hidden="true">${icon}</span> ` : ""}${escapeHtml(value)}</span>
    <span class="opt-count" aria-label="${count} ${count === 1 ? "show" : "shows"}">${count}</span>`;
  const input = label.querySelector("input");
  input.addEventListener("change", () => onToggle(input.checked));
  return label;
}

/* The pool a facet's per-option counts are measured against: the shows you
 * could actually wander into — reachable in your travel window, not already
 * started, and leaving time for your next commitment — with every filter
 * applied *except* this facet's own. So a count answers "how many more could I
 * catch if I ticked this", and the numbers add up against the heading above
 * the filters rather than against the whole day's 3,800-show programme. */
function facetPool(facet) {
  return fittingShows(facet).map((o) => o.show);
}

/* How many shows in `pool` fall under each value of a facet. `values` pulls the
 * facet's value(s) out of a show (a genre is one, subgenres are many). */
function facetCounts(pool, values) {
  const counts = new Map();
  for (const show of pool) {
    for (const v of values(show)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return counts;
}

function buildGenrePanel() {
  const wrap = document.getElementById("genreOptions");
  if (!wrap) return;
  const counts = facetCounts(facetPool("genre"), (s) => [s.genre]);
  wrap.innerHTML = "";
  GENRES.forEach((genre) => {
    wrap.appendChild(
      facetOption(genre, {
        icon: genreIcon(genre),
        checked: state.selectedGenres.has(genre),
        count: counts.get(genre) || 0,
        onToggle: (on) => {
          if (on) state.selectedGenres.add(genre);
          else state.selectedGenres.delete(genre);
          onTasteChange({ rebuildSubgenres: true });
        },
      })
    );
  });

  const reset = document.getElementById("filterReset");
  if (reset) {
    reset.onclick = () => {
      // Ticked everything already → the link is "nothing!", clearing the boxes
      // so you can pick a few from a blank slate.
      state.selectedGenres = allGenresSelected() ? new Set() : new Set(GENRES);
      buildGenrePanel(); // re-render the checkboxes
      onTasteChange({ rebuildSubgenres: true });
    };
  }
  updateEverythingLinks();
}

/* The "everything!" links flip to "nothing!" once every box in their panel is
 * ticked — at which point the useful move is to clear them and start picking.
 * Both ends run the same search: all ticked and none ticked alike leave the
 * facet unfiltered (see genreFilterActive/subgenreFilterActive). */
function updateEverythingLinks() {
  const links = [
    ["filterReset", allGenresSelected()],
    ["subgenreReset", allSubgenresSelected()],
  ];
  for (const [id, all] of links) {
    const link = document.getElementById(id);
    if (!link) continue;
    link.textContent = all ? "nothing!" : "everything!";
    link.title = all ? "Untick every option" : "Tick every option";
  }
}

/* Is every genre ticked? */
function allGenresSelected() {
  return state.selectedGenres.size >= GENRES.length;
}

/* Is every subgenre currently offered already ticked? The option set is the one
 * the panel last built (state.subgenreOptions), not the DOM — the filter asks
 * this question too, and it must answer the same before any render. */
function allSubgenresSelected() {
  const values = state.subgenreOptions;
  return values.length > 0 && values.every((v) => state.selectedSubgenres.has(v));
}

/* The subgenre options: only the finer descriptors actually present in the
 * shows the other filters leave standing (plus anything already ticked, so a
 * selection never silently vanishes from its own list). */
function subgenreOptionValues(counts) {
  const values = new Set(counts.keys());
  for (const s of state.selectedSubgenres) values.add(s);
  return [...values].sort((a, b) => a.localeCompare(b));
}

function buildSubgenrePanel() {
  const wrap = document.getElementById("subgenreOptions");
  if (!wrap) return;
  const counts = facetCounts(facetPool("subgenre"), (s) => s.subgenres || []);
  wrap.innerHTML = "";
  const values = subgenreOptionValues(counts);
  state.subgenreOptions = values;
  if (!values.length) {
    wrap.innerHTML = '<p class="panel-note">No subgenres in what\'s left — widen your genres.</p>';
  }
  values.forEach((sub) => {
    wrap.appendChild(
      facetOption(sub, {
        checked: state.selectedSubgenres.has(sub),
        count: counts.get(sub) || 0,
        onToggle: (on) => {
          if (on) state.selectedSubgenres.add(sub);
          else state.selectedSubgenres.delete(sub);
          onTasteChange();
        },
      })
    );
  });

  const reset = document.getElementById("subgenreReset");
  if (reset) {
    reset.onclick = () => {
      // "everything!" ticks every subgenre on offer; once they all are, the
      // link reads "nothing!" and clears them (both mean "don't narrow").
      if (allSubgenresSelected()) state.selectedSubgenres.clear();
      else for (const v of values) state.selectedSubgenres.add(v);
      buildSubgenrePanel();
      onTasteChange();
    };
  }
  updateEverythingLinks();
}

/* The $ chip's tiny dropdown: Any / Free / Up to £N…, built from the shared
 * ladder rather than spelled out in the markup, so the Now page and the planner
 * can never drift into offering different budgets. */
function buildPricePanel() {
  const row = document.getElementById("priceOptions");
  if (row) {
    row.innerHTML = PRICE_OPTIONS.map(
      (o) => `<button type="button" class="seg-btn" data-price="${o.value}">` +
             `${escapeHtml(o.short)}<span class="seg-count"></span></button>`
    ).join("");
  }
  document.querySelectorAll("#priceOptions .seg-btn").forEach((btn) => {
    btn.onclick = () => {
      state.priceFilter = btn.dataset.price;
      updatePriceButtons();
      onTasteChange({ rebuildSubgenres: true });
    };
  });
  updatePriceButtons();
}

/* How many reachable shows each price choice would leave you — the same
 * question the genre/subgenre counts answer, measured over the same pool. */
function refreshPriceCounts() {
  const pool = facetPool("price");
  const labels = new Map(PRICE_OPTIONS.map((o) => [o.value, o.label]));
  document.querySelectorAll("#priceOptions .seg-btn").forEach((b) => {
    const choice = b.dataset.price;
    const n = pool.filter((s) => matchesPrice(s, choice)).length;
    const out = b.querySelector(".seg-count");
    if (out) out.textContent = String(n);
    b.setAttribute("aria-label",
      `${labels.get(choice) || choice} — ${n} ${n === 1 ? "show" : "shows"}`);
  });
}

/* Reflect the active price choice on the segmented control, and on the chip
 * itself: "$" alone while every price is in, "$ Free" / "$ Up to £15" once the
 * filter actually narrows anything. */
function updatePriceButtons() {
  document.querySelectorAll("#priceOptions .seg-btn").forEach((b) => {
    const on = b.dataset.price === state.priceFilter;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
  const set = state.priceFilter !== "any";
  const chip = document.querySelector(".card--price");
  if (chip) chip.classList.toggle("is-set", set);
  const value = document.querySelector('[data-value="price"]');
  if (value) {
    value.hidden = !set;
    const chosen = PRICE_OPTIONS.find((o) => o.value === state.priceFilter);
    value.textContent = chosen ? chosen.label : "";
  }
}

/* A taste filter changed: re-label the chips, refresh every facet's counts and
 * redraw. The subgenre option *set* only shifts when a genre or the price
 * changes, so only those ask for a rebuild. */
function onTasteChange({ rebuildSubgenres = false } = {}) {
  state.showCap = SHOW_PAGE; // a changed filter resets the list to the first page
  if (rebuildSubgenres) buildSubgenrePanel();
  updateGenreValue();
  updateSubgenreValue();
  refreshFacetCounts();
  updateEverythingLinks();
  // A re-labelled chip is a different width, which can re-flow the wrapped
  // filter row under a panel that's still open — so re-fit whatever is open.
  document.querySelectorAll(".card-panel:not([hidden])").forEach(clampPanel);
  buildConstraintPanel(); // time/show options depend on the taste filters
  refreshMap();           // also re-renders the (mirrored) show list
}

/* Re-count the already-rendered option rows in place. Rebuilding the panels
 * instead would drop focus mid-click, so only the numbers are rewritten. */
function refreshFacetCounts() {
  refreshPriceCounts();
  const facets = [
    ["genreOptions", facetCounts(facetPool("genre"), (s) => [s.genre])],
    ["subgenreOptions", facetCounts(facetPool("subgenre"), (s) => s.subgenres || [])],
  ];
  for (const [id, counts] of facets) {
    const wrap = document.getElementById(id);
    if (!wrap) continue;
    wrap.querySelectorAll(".panel-option").forEach((row) => {
      const n = counts.get(row.querySelector("input").value) || 0;
      const out = row.querySelector(".opt-count");
      out.textContent = String(n);
      out.setAttribute("aria-label", `${n} ${n === 1 ? "show" : "shows"}`);
      row.classList.toggle("is-empty", n === 0);
    });
  }
}

/* Concise label for the subgenre chip; none ticked — or every option ticked,
 * which is the same search — reads as "All subgenres". */
function updateSubgenreValue() {
  const el = document.querySelector('[data-value="subgenre"]');
  if (!el) return;
  const n = state.selectedSubgenres.size;
  el.textContent =
    n === 0 || allSubgenresSelected()
      ? "All subgenres"
      : n === 1
      ? [...state.selectedSubgenres][0]
      : `${n} subgenres`;
}

/* Concise label for the genre filter chip. All (or none) selected reads as
 * "All genres". */
function updateGenreValue() {
  const el = document.querySelector('[data-value="genre"]');
  if (!el) return;
  const n = state.selectedGenres.size;
  const label =
    n === 0 || allGenresSelected()
      ? "All genres"
      : n === 1
      ? [...state.selectedGenres][0]
      : `${n} genres`;
  el.textContent = label;
  // Mirror the single-genre icon onto the chip; a generic mask stands in for
  // "all" or a mix.
  const ico = document.querySelector(".card--genre .fc-ico");
  if (ico) ico.textContent = n === 1 ? genreIcon([...state.selectedGenres][0]) : "🎭";
}

/* ---------- Travel mode + reach window ---------- */
function buildTravelPanel() {
  const wrap = document.getElementById("travelOptions");
  if (!wrap) return;
  wrap.innerHTML = "";
  TRAVEL_MODES.forEach((mode) => {
    const label = document.createElement("label");
    label.className = "panel-option";
    // The parenthetical shows the speed we actually estimate with, so the
    // reachability maths isn't a black box.
    label.innerHTML = `
      <input type="radio" name="travel" value="${escapeHtml(mode)}"
        ${state.travelMode === mode ? "checked" : ""} />
      <span>${escapeHtml(mode)} <small class="opt-speed">(${modeSpeedLabel(mode)} km/h)</small></span>`;
    label.querySelector("input").addEventListener("change", () => {
      state.travelMode = mode;
      state.showCap = SHOW_PAGE;
      updateTravelLabels();
      refreshMap(); // travel speed changes the reach circle and what's reachable
    });
    wrap.appendChild(label);
  });

  // Max-travel-time slider: continuous 1–60 min in one-minute steps.
  const range = document.getElementById("travelRange");
  if (range) {
    range.min = String(MIN_TRAVEL_MINUTES);
    range.max = String(MAX_TRAVEL_MINUTES);
    range.step = "1";
    range.value = String(state.maxTravelMinutes);
    updateTravelLabels();
    range.addEventListener("input", () => {
      state.maxTravelMinutes = Number(range.value);
      state.showCap = SHOW_PAGE;
      updateTravelLabels();
      refreshMap();
    });
  }
}

/* The estimated speed for a mode, rounded to one decimal (e.g. 3.3, 30, 15). */
function modeSpeedLabel(mode) {
  const s = TRAVEL_SPEEDS_KMH[mode] || TRAVEL_SPEEDS_KMH.Walking;
  return Number(s.toFixed(1));
}

function updateTravelLabels() {
  const v = document.getElementById("travelValue");
  if (v) v.textContent = `${state.maxTravelMinutes} min max`;
  const card = document.querySelector('[data-value="travel"]');
  if (card) {
    const short = { Walking: "Walk", "Taxi/Car": "Taxi", Bicycle: "Bike" }[state.travelMode] || state.travelMode;
    card.textContent = `${short} ≤ ${state.maxTravelMinutes} min`;
  }
}

/* ---------- Next-show (time + place) constraint ----------
 * A rolling hour/minute picker over the real start times we have, a live count
 * of shows at the chosen time, and a tappable list of those shows. Rolling the
 * wheels *browses* (updates the list + count); tapping a show *commits* it as
 * the next commitment (its venue becomes the destination). A free-text box is a
 * fallback for a non-show place. */

/* Distinct start times worth aiming for (>= now + lead), chronological. */
function availableTimes() {
  return [...new Set(constraintShows().map((s) => s.time))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/* The n times (from `times`) closest to `target`, in chronological order. */
function nearestTimes(times, target, n) {
  const t = timeToMinutes(target);
  return times
    .slice()
    .sort((a, b) => Math.abs(timeToMinutes(a) - t) - Math.abs(timeToMinutes(b) - t))
    .slice(0, n)
    .sort((a, b) => a.localeCompare(b));
}

/* The next commitment is set with a scroll-snap time WHEEL (real native momentum
 * scrolling, like an iOS picker) plus a live list of the shows we know start at
 * that time. Scrolling a wheel browses; tapping a show commits it. */
const WHEEL_ITEM_H = 40;
const WHEEL_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

function populateWheel(el, values) {
  el._values = values;
  el.innerHTML =
    '<div class="wheel-pad"></div>' +
    values.map((v) => `<div class="wheel-item" data-v="${v}">${v}</div>`).join("") +
    '<div class="wheel-pad"></div>';
}
function wheelIndex(el) {
  const n = (el._values || []).length;
  return Math.max(0, Math.min(n - 1, Math.round(el.scrollTop / WHEEL_ITEM_H)));
}
function readWheel(el) {
  return (el._values || [])[wheelIndex(el)];
}
function markWheelSel(el) {
  const idx = wheelIndex(el);
  el.querySelectorAll(".wheel-item").forEach((it, i) => it.classList.toggle("sel", i === idx));
}
function scrollWheelTo(el, v, smooth) {
  const i = Math.max(0, (el._values || []).indexOf(v));
  el.scrollTo({ top: i * WHEEL_ITEM_H, behavior: smooth ? "smooth" : "auto" });
  markWheelSel(el);
}
/* Point both wheels at state.selectedTime (used on init and suggestion jumps). */
function syncWheels(smooth) {
  const hw = document.getElementById("hourWheel");
  const mw = document.getElementById("minWheel");
  if (!hw || !mw || !state.selectedTime) return;
  const [hh, mm] = state.selectedTime.split(":");
  scrollWheelTo(hw, hh, smooth);
  const mmVal = WHEEL_MINUTES.includes(mm)
    ? mm
    : WHEEL_MINUTES.reduce((a, b) => (Math.abs(+b - +mm) < Math.abs(+a - +mm) ? b : a), WHEEL_MINUTES[0]);
  scrollWheelTo(mw, mmVal, smooth);
}

function buildConstraintPanel() {
  const hw = document.getElementById("hourWheel");
  const mw = document.getElementById("minWheel");
  if (!hw || !mw) return;

  const dateLabel = document.getElementById("constraintDateLabel");
  if (dateLabel) dateLabel.textContent = NOW.dateLabel;

  const times = availableTimes();
  // A commitment with something real behind it — a show still in today's data,
  // or a typed place — survives even when its start time is no longer offered
  // as a *new* choice (too soon to aim for, or restored from a past plan). A
  // time with nothing behind it is dropped.
  const stillReal =
    (state.selectedShowId && state.shows.some((s) => s.id === state.selectedShowId)) ||
    Boolean(state.destLabel && state.destLabel.trim());
  if (state.selectedTime && !times.includes(state.selectedTime) && !stillReal) {
    state.selectedTime = "";
    state.selectedShowId = "";
    state.legShowId = "";
    state.destLabel = "";
    state.destPlace = null;
    state.destNote = "";
  }
  if (!state.selectedTime && times.length) state.selectedTime = times[0];

  // Hours from the first offered hour to end of day; minutes in fives.
  const hours = [];
  const h0 = times.length ? parseInt(times[0].slice(0, 2), 10) : 0;
  for (let h = h0; h <= 23; h++) hours.push(String(h).padStart(2, "0"));
  populateWheel(hw, hours);
  populateWheel(mw, WHEEL_MINUTES);

  [hw, mw].forEach((el) => {
    // Read the settled value ~130 ms after scrolling stops (native snap handles
    // the visual settle; this reads it and re-runs the query).
    el.onscroll = () => {
      markWheelSel(el);
      clearTimeout(el._settle);
      el._settle = setTimeout(() => {
        // Closing the panel display:nones the wheels, which clamps their
        // scrollTop to 0 and fires one last scroll event — a layout artifact,
        // not the user picking hours[0]. Acting on it would wipe the very
        // commitment that closed the panel, so only read visible wheels.
        if (el.offsetParent === null) return;
        const t = `${readWheel(hw)}:${readWheel(mw)}`;
        if (t !== state.selectedTime) setConstraintTime(t); // wheels already positioned
      }, 130);
    };
    el.onkeydown = (e) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const i = wheelIndex(el) + (e.key === "ArrowDown" ? 1 : -1);
      const clamped = Math.max(0, Math.min((el._values || []).length - 1, i));
      el.scrollTo({ top: clamped * WHEEL_ITEM_H, behavior: "smooth" });
    };
  });

  const list = document.getElementById("showPickList");
  if (list) {
    list.onclick = (e) => {
      const row = e.target.closest(".show-pick");
      if (row) selectConstraintShow(row.dataset.id);
    };
  }
  const destInput = document.getElementById("destInput");
  const destFind = document.getElementById("destFind");
  if (destInput) {
    destInput.oninput = () => {
      state.destLabel = destInput.value;
      if (destFind) destFind.disabled = !destInput.value.trim();
      // Editing the text invalidates a previously found place or note — a pin
      // or plan mustn't outlive the label that produced it.
      const hadCommitment = Boolean(state.destPlace) || Boolean(state.destNote);
      state.destPlace = null;
      state.destNote = "";
      clearPlaceResults();
      refreshConstraintValue();
      if (hadCommitment) refreshMap();
      else renderRoute();
    };
    destInput.onkeydown = (e) => {
      if (e.key === "Enter" && destInput.value.trim()) {
        e.preventDefault();
        findPlaceOnMap();
      }
    };
  }
  // "Find on map" geocodes the typed place (see findPlaceOnMap) so a
  // restaurant, a station or a hotel becomes a real destination: pinned on the
  // map, routed to, and planned around — exactly like a committed show.
  if (destFind && destInput) {
    destFind.disabled = !destInput.value.trim();
    destFind.onclick = () => findPlaceOnMap();
  }

  syncWheels(false);
  renderConstraintShows(false);
  refreshConstraintValue();
}

/* ---------- Non-show places ---------- */
/* "Find on map" geocodes the typed place — Nominatim, bounded to Edinburgh (see
 * js/places.js) — then commits a single match directly, or lists the candidates
 * to pick from. If the search fails or finds nothing, the place can still be
 * kept as a plain text note (the pre-geocoding behaviour), so the box keeps
 * working offline and for places the map doesn't know. */
let placeSearchInFlight = false; // one search at a time — also Nominatim's rate policy

async function findPlaceOnMap() {
  const input = document.getElementById("destInput");
  const btn = document.getElementById("destFind");
  const q = input ? input.value.trim() : "";
  if (!q || placeSearchInFlight) return;

  let places = null; // null = search unavailable, [] = searched, nothing found
  placeSearchInFlight = true;
  const idleLabel = btn ? btn.textContent : "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Finding…";
  }
  try {
    const res = await fetch(geocodeUrl(q));
    if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
    places = parsePlaces(await res.json());
  } catch (err) {
    console.warn("Place search unavailable:", err);
  }
  placeSearchInFlight = false;
  if (btn) {
    btn.disabled = false;
    btn.textContent = idleLabel;
  }

  if (places && places.length === 1) {
    commitPlace(places[0]); // unambiguous — straight onto the plan
    return;
  }
  renderPlaceResults(q, places);
}

/* The candidate rows under the place box: tap one to commit it. A trailing
 * "keep as a note" row covers the search-failed / nothing-found / none-of-these
 * cases without blocking the user on the geocoder. */
function renderPlaceResults(q, places) {
  const box = document.getElementById("destResults");
  if (!box) return;
  const msg =
    places === null
      ? "Map search isn’t reachable right now."
      : places.length
        ? "Which one?"
        : `Couldn’t find “${q}” around Edinburgh.`;
  const rows = (places || [])
    .map(
      (p, i) => `
    <button type="button" class="place-hit" data-i="${i}">
      <span class="ph-ico" aria-hidden="true">${placeIcon(p.kind)}</span>
      <span class="ph-body">
        <span class="ph-title">${escapeHtml(p.label)}</span>
        ${p.area ? `<span class="ph-area">${escapeHtml(p.area)}</span>` : ""}
      </span>
    </button>`
    )
    .join("");
  box.innerHTML =
    `<p class="place-msg">${escapeHtml(msg)}</p>` +
    rows +
    `<button type="button" class="place-hit place-hit--note">
      <span class="ph-ico" aria-hidden="true">📝</span>
      <span class="ph-body"><span class="ph-title">Keep “${escapeHtml(q)}” as a note</span></span>
    </button>`;
  box.hidden = false;
  box.querySelectorAll(".place-hit[data-i]").forEach((row) => {
    row.onclick = () => commitPlace((places || [])[Number(row.dataset.i)]);
  });
  const note = box.querySelector(".place-hit--note");
  if (note) note.onclick = () => commitPlaceNote(q);
}

function clearPlaceResults() {
  const box = document.getElementById("destResults");
  if (box) {
    box.innerHTML = "";
    box.hidden = true;
  }
}

/* Commit a geocoded place as the next commitment: it gets pinned, routed to and
 * planned around like a committed show. A selected show (the stop on the way)
 * is kept — whether it still fits is the plan's story to tell. */
function commitPlace(place) {
  if (!place) return;
  state.destPlace = place;
  state.destNote = "";
  state.destLabel = place.label;
  state.selectedShowId = ""; // a typed place isn't one of our shows
  state.spareCtaDismissed = false; // a fresh commitment re-offers the spare-time prompt
  state.bookCtaDismissed = false; // …and re-asks the booking question
  state.showCap = SHOW_PAGE;
  const input = document.getElementById("destInput");
  if (input) input.value = place.label;
  clearPlaceResults();
  refreshConstraintValue();
  refreshMap();
  closeAllPanels();
}

/* Commit the typed text as a label-only note — no coordinates, so no pin or
 * route; the constraint card still records it. This is the pre-geocoding
 * behaviour, kept as the fallback for offline / unfindable places. */
function commitPlaceNote(label) {
  state.destPlace = null;
  state.destNote = label;
  state.destLabel = label;
  state.selectedShowId = "";
  state.legShowId = ""; // without coordinates we can't tell whether a stop fits
  clearPlaceResults();
  refreshConstraintValue();
  refreshMap();
  closeAllPanels();
}

/* Point the picker at a new time: browse the shows starting then (no commitment
 * until the user taps one). */
function setConstraintTime(hhmm) {
  if (!hhmm) return;
  state.selectedTime = hhmm;
  state.selectedShowId = "";
  state.spareCtaDismissed = false;
  state.destLabel = "";
  state.destPlace = null;
  state.destNote = "";
  clearPlaceResults();
  state.showCap = SHOW_PAGE;
  syncDestInput();
  renderConstraintShows(true);
  refreshConstraintValue();
  refreshMap();
}

/* Commit a show as the next commitment, then close the picker to reveal the
 * plan and the shows that now fit the gap. Any previously selected show is kept
 * (unless it's the very show now being committed — it can't be both). */
function selectConstraintShow(id) {
  state.selectedShowId = id;
  state.destPlace = null; // a show commitment replaces any found place or note
  state.destNote = "";
  clearPlaceResults();
  forgetStalePlan(); // a fresh commitment supersedes the offer of the old one
  if (state.legShowId === id) state.legShowId = "";
  state.spareCtaDismissed = false; // a fresh commitment re-offers the spare-time prompt
  state.showCap = SHOW_PAGE;
  syncDestInput();
  refreshConstraintValue();
  refreshMap();
  closeAllPanels();
}

/* The live count + the list of shows at the chosen time. If no show starts at
 * exactly that minute, suggest the nearest times that do. */
function renderConstraintShows(animate) {
  const countEl = document.getElementById("constraintCount");
  const countLab = document.getElementById("constraintCountLab");
  const list = document.getElementById("showPickList");
  if (!list) return;

  const times = availableTimes();
  if (!times.length) {
    if (countEl) countEl.textContent = "0";
    if (countLab) countLab.textContent = "shows later today";
    list.innerHTML = '<p class="picklist-empty">No later shows to aim for today.</p>';
    return;
  }

  const atTime = constraintShows().filter((s) => s.time === state.selectedTime);
  if (countEl) tweenCount(countEl, atTime.length);
  if (countLab) {
    countLab.textContent =
      (atTime.length === 1 ? "show starts at " : "shows start at ") + state.selectedTime;
  }

  if (!atTime.length) {
    const nearest = nearestTimes(times, state.selectedTime, 4);
    list.innerHTML =
      '<p class="picklist-empty">No shows start exactly then. Nearest:</p>' +
      '<div class="timepick-suggest">' +
      nearest
        .map(
          (t) =>
            `<button type="button" data-time="${t}">${t} · ${
              constraintShows().filter((s) => s.time === t).length
            }</button>`
        )
        .join("") +
      "</div>";
    list.querySelectorAll(".timepick-suggest button").forEach((b) => {
      b.onclick = () => {
        setConstraintTime(b.dataset.time);
        syncWheels(true);
      };
    });
    return;
  }

  const anim = animate ? " anim" : "";
  list.innerHTML = atTime
    .map(
      (s, i) => `
    <button type="button" class="show-pick${s.id === state.selectedShowId ? " is-sel" : ""}${anim}" data-id="${s.id}" style="animation-delay:${i * 40}ms">
      <span class="sp-radio" aria-hidden="true"></span>
      <span class="sp-body">
        <span class="sp-title">${escapeHtml(s.title)}</span>
        <span class="sp-venue">${escapeHtml(s.venue)}</span>
        <span class="sp-genre">${escapeHtml(s.genre)}${showPrice(s) === null ? "" : ` · ${escapeHtml(priceLabel(s))}`}</span>
        ${subgenreTags(s)}
      </span>
    </button>`
    )
    .join("");
}

/* Animate a counter from its current value to `to`. */
function tweenCount(el, to) {
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
  const from = parseInt(el.textContent, 10);
  if (reduce || isNaN(from) || from === to) {
    el.textContent = String(to);
    return;
  }
  let t0 = null;
  const dur = 380;
  function step(ts) {
    if (t0 === null) t0 = ts;
    const p = Math.min(1, (ts - t0) / dur);
    el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* Mirror the chosen show's venue into the editable destination box. The user
 * can overwrite it if their next commitment isn't actually a Fringe show. */
function syncDestInput() {
  const show = state.shows.find((s) => s.id === state.selectedShowId);
  if (show) state.destLabel = show.venue;
  const destInput = document.getElementById("destInput");
  if (destInput) {
    destInput.value = show ? show.venue : state.destLabel || "";
    destInput.disabled = false; // always a usable free-text fallback
  }
}

function destinationLabel() {
  const show = state.shows.find((s) => s.id === state.selectedShowId);
  return (state.destLabel && state.destLabel.trim()) || (show ? show.venue : "");
}

function refreshConstraintValue() {
  const el = document.querySelector('[data-value="constraint"]');
  if (!el) return;
  const show = state.shows.find((s) => s.id === state.selectedShowId);
  const place = state.destLabel && state.destLabel.trim();
  if (show) el.textContent = `${destinationLabel()} · by ${show.time}`;
  else if (place && state.selectedTime) el.textContent = `${place} · by ${state.selectedTime}`;
  else el.textContent = "Set my next commitment";
}

/* ---------- Remembering the page between visits ----------
 * Everything the user set on this page — the taste filters, how they're
 * travelling, which view they're in, and the plan itself — is cached in
 * localStorage and restored on the next visit, so coming back doesn't mean
 * setting it all up again.
 *
 * The filters are timeless and always come back. The plan isn't: a commitment
 * at 18:00 or a show you'd picked that has already started is no longer a plan,
 * it's history. Those are dropped from the live state rather than restored —
 * but they're kept in a second "stale" slot so the restore bar can offer them
 * back on one tap, rather than the choice just evaporating. */
const STORE_KEY = "edfringenow.now.v1";
const STALE_KEY = "edfringenow.now.stale.v1";
/* The first-run explainer's own key, deliberately separate from the settings
 * snapshot above: "I've read this" is a fact about the person, not about this
 * visit's filters, and it must not be cleared when a plan goes stale. */
const INTRO_KEY = "edfringenow.now.intro.v1";

function readStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.info("EdFringeNow: couldn't read saved settings", err);
    return null;
  }
}

function writeStore(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Private browsing / a full quota — the page works fine unsaved.
    console.info("EdFringeNow: couldn't save settings", err);
  }
}

/* The plan half of a snapshot: what the user is heading to, and when. A
 * non-show destination is part of the plan too — destPlace is a plain
 * { label, area, lat, lng, kind } object, so it round-trips through JSON. */
function planSnapshot() {
  return {
    selectedTime: state.selectedTime,
    selectedShowId: state.selectedShowId,
    legShowId: state.legShowId,
    destLabel: state.destLabel,
    destPlace: state.destPlace,
    destNote: state.destNote,
  };
}

function saveNowState() {
  if (!state.ready) return; // still booting — don't overwrite with defaults
  writeStore(STORE_KEY, {
    date: NOW.date,
    genres: [...state.selectedGenres],
    subgenres: [...state.selectedSubgenres],
    price: state.priceFilter,
    travelMode: state.travelMode,
    maxTravelMinutes: state.maxTravelMinutes,
    viewMode: state.viewMode,
    ...planSnapshot(),
  });
}

/* Restore the timeless settings (before the shows load), and park the plan for
 * adoptRestoredPlan to judge once we know what's on today. */
function restoreNowState() {
  state.stalePlan = readStore(STALE_KEY);
  const saved = readStore(STORE_KEY);
  if (!saved) return;

  if (Array.isArray(saved.genres)) {
    state.selectedGenres = new Set(saved.genres.filter((g) => GENRES.includes(g)));
  }
  if (Array.isArray(saved.subgenres)) state.selectedSubgenres = new Set(saved.subgenres);
  if (PRICE_FILTERS.includes(saved.price)) state.priceFilter = saved.price;
  if (TRAVEL_MODES.includes(saved.travelMode)) state.travelMode = saved.travelMode;
  if (Number.isFinite(saved.maxTravelMinutes)) {
    state.maxTravelMinutes = Math.min(
      MAX_TRAVEL_MINUTES,
      Math.max(MIN_TRAVEL_MINUTES, Math.round(saved.maxTravelMinutes))
    );
  }
  if (VIEW_MODES[saved.viewMode]) state.viewMode = saved.viewMode;
  state.savedPlan = {
    date: saved.date,
    selectedTime: saved.selectedTime || "",
    selectedShowId: saved.selectedShowId || "",
    legShowId: saved.legShowId || "",
    destLabel: saved.destLabel || "",
    destPlace: saved.destPlace || null,
    destNote: saved.destNote || "",
  };
}

/* Has this moment already gone by on the simulated clock? */
function isPastTime(hhmm) {
  return Boolean(hhmm) && timeToMinutes(hhmm) <= NOW.minutes;
}

/* Bring back the cached plan, dropping whatever has since happened. Anything
 * dropped moves to the stale slot, which the restore bar offers back. */
function adoptRestoredPlan() {
  const saved = state.savedPlan;
  state.savedPlan = null;
  if (!saved) return renderRestoreBar();

  const sameDay = saved.date === NOW.date;
  const show = (id) => (id ? state.shows.find((s) => s.id === id) : null);
  const commitment = sameDay ? show(saved.selectedShowId) : null;
  const leg = sameDay ? show(saved.legShowId) : null;

  // A commitment is stale when its time has passed (or its show has vanished
  // from today's data); a picked show is stale once it has started.
  const commitmentStale =
    !sameDay ||
    isPastTime(saved.selectedTime) ||
    (saved.selectedShowId && !commitment) ||
    (commitment && isPastTime(commitment.time));
  const legStale = !sameDay || (saved.legShowId && (!leg || isPastTime(leg.time)));

  if (!commitmentStale) {
    state.selectedTime = saved.selectedTime;
    state.selectedShowId = commitment ? commitment.id : "";
    state.destLabel = saved.destLabel;
    state.destPlace = saved.destPlace;
    state.destNote = saved.destNote;
  }
  if (!legStale) state.legShowId = leg ? leg.id : "";

  const droppedSomething =
    (commitmentStale && (saved.selectedTime || saved.selectedShowId || saved.destLabel)) ||
    (legStale && saved.legShowId);
  if (droppedSomething) {
    state.stalePlan = saved;
    writeStore(STALE_KEY, saved);
  }
  syncDestInput();
  renderRestoreBar();
}

/* The offer to reinstate a plan we declined to restore. Quiet, and dismissable
 * — it's a courtesy, not a task. */
function renderRestoreBar() {
  const bar = document.getElementById("restoreBar");
  const text = document.getElementById("restoreText");
  const stale = state.stalePlan;
  if (!bar || !text) return;
  if (!stale) {
    bar.hidden = true;
    return;
  }
  const legShow = stale.legShowId ? state.shows.find((s) => s.id === stale.legShowId) : null;
  const where = stale.destLabel || (legShow && legShow.title) || "";
  const when = stale.selectedTime || (legShow && legShow.time) || "";
  text.innerHTML =
    where && when
      ? `Last time you were heading to <b>${escapeHtml(where)}</b> by ${escapeHtml(when)} — that has passed.`
      : "You had a plan here last time — it has since passed.";
  bar.hidden = false;
}

function wireRestoreBar() {
  const restore = document.getElementById("restoreBtn");
  const dismiss = document.getElementById("restoreDismiss");
  if (restore) {
    restore.addEventListener("click", () => {
      const stale = state.stalePlan;
      if (!stale) return;
      // Deliberate: the user asked for it back, so it's reinstated as-is even
      // though the clock has moved on — the plan's own slack chips say how badly.
      state.selectedTime = stale.selectedTime || "";
      state.selectedShowId = state.shows.some((s) => s.id === stale.selectedShowId)
        ? stale.selectedShowId
        : "";
      state.legShowId = state.shows.some((s) => s.id === stale.legShowId) ? stale.legShowId : "";
      state.destLabel = stale.destLabel || "";
      state.destPlace = stale.destPlace || null;
      state.destNote = stale.destNote || "";
      forgetStalePlan();
      syncDestInput();
      refreshConstraintValue();
      renderConstraintShows(false);
      syncWheels(false);
      refreshMap();
    });
  }
  if (dismiss) dismiss.addEventListener("click", forgetStalePlan);
}

function forgetStalePlan() {
  state.stalePlan = null;
  writeStore(STALE_KEY, null);
  renderRestoreBar();
}

/* ---------- Panel open/close plumbing ---------- */
function wirePanels() {
  const triggers = document.querySelectorAll(".card-trigger");

  triggers.forEach((trigger) => {
    const panel = document.getElementById(trigger.dataset.panel);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const willOpen = panel.hasAttribute("hidden");
      closeAllPanels();
      if (willOpen) openPanel(trigger, panel);
    });
  });

  // Click outside closes any open panel.
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".card")) closeAllPanels();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPanels();
  });
}

/* Keep an open panel inside the viewport. The filter chips wrap and re-flow as
 * their labels change, so whichever edge a panel is anchored to, it can end up
 * hanging off one side — nudge it back rather than guessing per chip in CSS. */
function clampPanel(panel) {
  panel.style.transform = "";
  const rect = panel.getBoundingClientRect();
  const pad = 8;
  let dx = 0;
  if (rect.left < pad) dx = pad - rect.left;
  else if (rect.right > window.innerWidth - pad) dx = window.innerWidth - pad - rect.right;
  if (dx) panel.style.transform = `translateX(${Math.round(dx)}px)`;
}

function openPanel(trigger, panel) {
  panel.removeAttribute("hidden");
  clampPanel(panel);
  trigger.setAttribute("aria-expanded", "true");
  trigger.closest(".card").classList.add("is-open");
  // The wheels can't be positioned while the panel is display:none (no layout),
  // so align them to the current time now that the panel is visible.
  if (panel.id === "constraintPanel") {
    requestAnimationFrame(() => syncWheels(false));
  }
  updateCtaVisibility();
}

function closeAllPanels() {
  document.querySelectorAll(".card-panel").forEach((p) => p.setAttribute("hidden", ""));
  document.querySelectorAll(".card-trigger").forEach((t) => t.setAttribute("aria-expanded", "false"));
  document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
  state.editingCommitment = false;
  updateCtaVisibility();
}

/* ---------- Debug clock ---------- */
/* Show or hide the whole debug menu (pill + dropdown). The testing tools only
 * make sense alongside the pre-set values, so a confirmed in-UK location hides
 * them; overseas / unknown locations keep them (the default). */
function setDebugVisible(visible) {
  const menu = document.getElementById("debugMenu");
  if (menu) menu.hidden = !visible;
}

function renderDebugBanner() {
  const el = document.getElementById("debugNowText");
  if (el) el.textContent = `${NOW.dateLabel}, ${NOW.time} ${NOW.tz}`;
}

/* Keep the debug date/time picker showing whatever "now" currently is, so it
 * doesn't contradict the clock the app is actually running against. */
function syncDebugPicker() {
  const dt = document.getElementById("debugDateTime");
  if (dt) dt.value = toDatetimeLocalValue(simNowDate);
}

/* Stamp the app version onto the debug pill (single-sourced from package.json,
 * the same file the planner reads). Best-effort — the pill stays "debug" if the
 * fetch fails (e.g. local file:// with no server). */
async function loadAppVersion() {
  const pill = document.getElementById("debugToggle");
  if (!pill) return;
  try {
    const res = await fetch("package.json");
    if (!res.ok) return;
    const pkg = await res.json();
    if (pkg && typeof pkg.version === "string") pill.textContent = `debug v${pkg.version}`;
  } catch (err) {
    console.warn("EdFringeNow: couldn't read app version", err);
  }
}

/* Wire up the debug panel: the header toggle chip, the date/time picker and the
 * four "move my location" buttons. */
function wireDebugControls() {
  // The debug tools live in a dropdown behind a neutral header pill.
  const menu = document.getElementById("debugMenu");
  const toggle = document.getElementById("debugToggle");
  const pop = document.getElementById("debugPop");
  if (toggle && pop) {
    const setOpen = (open) => {
      pop.toggleAttribute("hidden", !open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", () => setOpen(pop.hasAttribute("hidden")));
    document.addEventListener("click", (e) => {
      if (menu && !menu.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pop.hasAttribute("hidden")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  // The pill shows the app version (single-sourced from package.json), not the
  // build time. Best-effort: on failure it just stays "debug".
  loadAppVersion();

  const dt = document.getElementById("debugDateTime");
  if (dt) {
    syncDebugPicker();
    dt.addEventListener("change", () => {
      const d = new Date(dt.value);
      if (!isNaN(d.getTime())) applyNow(d);
    });
  }

  document.querySelectorAll(".debug-btn[data-move]").forEach((btn) => {
    btn.addEventListener("click", () => moveUserLocation(btn.dataset.move));
  });

  // "Show more" grows the list a page at a time.
  const moreBtn = document.getElementById("showMore");
  if (moreBtn) {
    moreBtn.addEventListener("click", () => {
      state.showCap = (state.showCap || SHOW_PAGE) + SHOW_PAGE;
      renderShowList();
    });
  }
}

/* Switch from the pre-set clock to the device's real one. Called once the real
 * location confirms we're in the UK — the fake date/time is a testing pre-set
 * just like the fake location, so it goes at the same moment. */
function adoptRealClock() {
  return applyNow(new Date());
}

/* Project a chosen Date onto NOW and re-render everything that depends on the
 * current time. Changing the day loads that day's data file. Driven by the
 * debug date/time picker and by adoptRealClock. */
async function applyNow(date) {
  const prevDate = NOW.date;
  simNowDate = date;
  NOW.date = toISODate(date);
  NOW.dateLabel = formatDateLabel(date);
  NOW.time = formatClock(date);
  NOW.tz = timeZoneLabel(date) || NOW.tz;
  NOW.minutes = date.getHours() * 60 + date.getMinutes();
  renderDebugBanner();
  syncDebugPicker();
  // A different day means a different per-day file; reload before re-rendering.
  if (NOW.date !== prevDate) {
    await loadShows();
  }
  // Reachability, the "happening now" list and the time picker all key off NOW.
  // A different day is a different set of shows, so the facet options and their
  // counts are rebuilt from it too.
  buildGenrePanel();
  buildSubgenrePanel();
  buildConstraintPanel();
  refreshMap();
  renderShowList();
  renderRestoreBar();
}

/* Shift the "you are here" pin 100 m in a compass direction. */
function moveUserLocation(direction) {
  const metres = 100;
  const [lat, lng] = state.userLatLng;
  const dLat = metres / 111320;                               // metres per degree latitude
  const dLng = metres / (111320 * Math.cos((lat * Math.PI) / 180));
  let nLat = lat;
  let nLng = lng;
  if (direction === "north") nLat += dLat;
  else if (direction === "south") nLat -= dLat;
  else if (direction === "east") nLng += dLng;
  else if (direction === "west") nLng -= dLng;
  setUserLocation([nLat, nLng], { recenter: false });
}

/* "Thu 14 Aug" from a Date. */
function formatDateLabel(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/* "2026-08-14" (local date) from a Date — selects the per-day data file. */
function toISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

/* "15:44" from a Date. */
function formatClock(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}

/* "BST" / "GMT" for the device's own zone — the label beside the clock. Empty
 * if the browser won't tell us, in which case the caller keeps the old label. */
function timeZoneLabel(date) {
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZoneName: "short" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return part ? part.value : "";
  } catch (err) {
    return "";
  }
}

/* "YYYY-MM-DDTHH:MM" for a datetime-local input. */
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/* ---------- utils ---------- */
/* "HH:MM" -> minutes since midnight, and back. */
function timeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins) {
  const r = Math.round(mins);
  const h = Math.floor(r / 60) % 24;
  const m = ((r % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* Linear interpolation between two [lat,lng] points. */
function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/* Compass bearing (degrees clockwise from north) from A to B. */
function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0]));
  const x =
    Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1]));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/* Great-circle distance between two [lat, lng] points, in kilometres. */
function distanceKm([lat1, lng1], [lat2, lng2]) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

/* Subgenre tags for a show, e.g. Stand-up · Improv. These are finer descriptors
 * than the ten headline genres, and the subgenre chip filters on them. Returns ""
 * for the ~2% of shows the festival tags with none, so callers can drop the row. */
function subgenreTags(show) {
  const subs = show.subgenres || [];
  if (!subs.length) return "";
  return `<span class="show-subs">${subs
    .map((s) => `<span class="show-sub">${escapeHtml(s)}</span>`)
    .join("")}</span>`;
}

/* A diagonal stamp for a card: "SOLD OUT!" when no ticket is available online,
 * else "TOO LATE!" for a show you can no longer reach in time (status "tight").
 * Both are display-only — the card stays selectable. */
function showStamp(show, status) {
  if (!show.available) return '<span class="show-stamp show-stamp--soldout">Sold out!</span>';
  if (status === "tight") return '<span class="show-stamp show-stamp--late">Too late!</span>';
  return "";
}
