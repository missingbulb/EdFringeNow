/* Fringe Discover — front-end logic
 * - loads mock show data (all happening *today*, scoped to the next few hours)
 * - renders an interactive Leaflet map of Edinburgh venues
 * - renders the "Happening Now" list
 * - three interactive constraint filters:
 *     1. Genre      — multi-select of Fringe categories (filters map + list)
 *     2. Travel     — how you're getting to the next show
 *     3. Next show  — pick the exact start time, then the show, and pin it
 */

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

/* During the testing period, ignore a real location that's nowhere near
 * Edinburgh (in km) and keep the central default instead. */
const MAX_DISTANCE_KM = 40;

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

/* Price filter — the source data only distinguishes free vs paid (no amounts),
 * so it's a three-way choice: both | free | paid. */
const PRICE_FILTERS = ["both", "free", "paid"];

/* ===== DEBUG: simulated "now" =====================================
 * The whole flow is scoped to "the next few hours today", so for testing we
 * pin a fixed clock instead of the real one. A red on-screen badge makes it
 * obvious the app is running against a faked time. */
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
  priceFilter: "both",         // "both" | "free" | "paid" (genre card)
  travelMode: "Walking",
  maxTravelMinutes: DEFAULT_MAX_TRAVEL, // reach window from the travel card
  selectedTime: "",            // chosen exact start time, e.g. "16:30"
  selectedShowId: "",          // the pinned "next show" (destination)
  destLabel: "",               // editable destination text (defaults to the show's venue)
  legShowId: "",               // a show clicked on the map (stop before the destination)
  editingCommitment: false,    // constraint panel opened from the plan to change it
  spareCtaDismissed: false,    // user hid the in-plan "time to spare" prompt
  sortBy: "time",              // reachable-list order: "time" | "distance"
  userLatLng: USER_DEFAULT,    // current "you are here" location
  userMarker: null,            // Leaflet marker for the user
  reachCircle: null,           // Leaflet circle for the travel radius
  routeLayers: [],             // Leaflet layers for the journey arrows/labels
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  renderDebugBanner();
  wireDebugControls();
  initMap();
  setUserLocation(USER_DEFAULT, { recenter: false }); // central-Edinburgh default
  requestUserLocation();                              // then ask for the real thing
  buildGenrePanel();
  buildTravelPanel();
  wirePanels();
  wireSortControls();
  // The header pin re-asks the browser for the user's location (same as the
  // map's ◎ control) and recentres on it.
  const locBtn = document.getElementById("locBtn");
  if (locBtn) locBtn.addEventListener("click", requestUserLocation);
  await loadShows();
  buildConstraintPanel();
  refreshMap();
  renderShowList();
  updateGenreValue();
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
    state.venues = await venuesRes.json();
    const day = await dayRes.json();
    // Drop shows whose venue we couldn't geocode — they can't be placed on the map.
    state.shows = day
      .map((entry, i) => adaptShow(entry, state.venues, i))
      .filter((s) => s.lat != null && s.lng != null);
  } catch (err) {
    console.error("Could not load show data:", err);
    state.shows = [];
  }
}

/* Join a minimal per-day record with its venue and expand to the model the map
 * and list expect ({ id, title, genre, venue, lat, lng, time, duration, price,
 * blurb }). A show can perform more than once a day, so the internal id is made
 * unique per performance. */
function adaptShow(entry, venues, index) {
  const v = venues[entry.venue] || {};
  const venueName = v.name || (entry.venue ? `Venue ${entry.venue}` : "Venue TBC");
  return {
    id: `${entry.id}__${entry.start}__${index}`,
    showId: entry.id,
    slug: entry.slug,
    title: entry.title,
    genre: entry.genre,
    venue: entry.room ? `${venueName} — ${entry.room}` : venueName,
    lat: v.lat ?? null,
    lng: v.lng ?? null,
    time: entry.start,
    duration: entry.duration || 60,
    free: !!entry.free,
    price: entry.free ? "Free" : "Paid",
    soldOut: !!entry.soldOut,
    blurb: entry.blurb || "",
  };
}

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
      // Testing guard: if we're way outside Edinburgh, stay on the default pin.
      if (distanceKm(here, EDINBURGH) > MAX_DISTANCE_KM) {
        console.info(
          `Real location is ${Math.round(distanceKm(here, EDINBURGH))} km from ` +
            "Edinburgh — keeping the central default for testing."
        );
        return;
      }
      setUserLocation(here, { recenter: true, real: true });
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

/* Price bucket for filtering: free -> 0, paid -> 1. The source data has no
 * ticket amounts, so paid shows are only distinguished from free ones. */
function priceValue(show) {
  return show.free || /free/i.test(show.price) ? 0 : 1;
}

/* Shows passing the current genre + price filters (empty genre set = all). */
function visibleShows() {
  let list = state.shows;
  if (state.selectedGenres.size) {
    list = list.filter((s) => state.selectedGenres.has(s.genre));
  }
  if (state.priceFilter === "free") list = list.filter((s) => priceValue(s) === 0);
  else if (state.priceFilter === "paid") list = list.filter((s) => priceValue(s) === 1);
  return list;
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
function displayedShows() {
  const constraint = state.selectedShowId
    ? state.shows.find((s) => s.id === state.selectedShowId)
    : null;

  const out = [];
  visibleShows().forEach((show) => {
    const status = classifyShow(show, constraint);
    if (status !== "hidden") out.push({ show, status });
  });
  // Always keep the chosen next show pinned, even if it's beyond the circle.
  if (constraint && !out.some((o) => o.show.id === constraint.id)) {
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
  const size = 22;
  const font = Math.round(size * 0.74);
  const html = `<span class="gpin gpin--${status}" style="width:${size}px;height:${size}px;font-size:${font}px">${genreIcon(show.genre)}</span>`;
  return L.divIcon({
    html,
    className: "genre-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2],
  });
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
  renderRoute();
  renderShowList();
  renderJourneyStrip();
  updateCtaVisibility();
}

/* Once a show is committed, the big top "Set my next commitment" box is
 * redundant — the plan carries it, and its destination node reopens the editor.
 * Hide the box while a commitment exists (or while editing one). */
function updateCtaVisibility() {
  const editing = state.editingCommitment;
  document.body.classList.toggle("has-plan", Boolean(state.selectedShowId) || editing);
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
  state.editingCommitment = false;
  state.spareCtaDismissed = false;
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

  const dest = state.selectedShowId
    ? state.shows.find((s) => s.id === state.selectedShowId)
    : null;

  // No commitment yet, but a show is selected: still draw the walk to it, with
  // the same travel pill and the ✓ "you make its start" check.
  if (!dest) {
    const sel = state.legShowId ? state.shows.find((s) => s.id === state.legShowId) : null;
    if (sel) {
      drawLeg(state.userLatLng, [sel.lat, sel.lng], {
        departMin: NOW.minutes,
        arriveMin: NOW.minutes + travelMinutes(state.userLatLng, [sel.lat, sel.lng]),
        checkMin: timeToMinutes(sel.time),
      });
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
    const arriveLeg = NOW.minutes + travelMinutes(state.userLatLng, legPt);
    drawLeg(state.userLatLng, legPt, {
      departMin: NOW.minutes,
      arriveMin: arriveLeg,
      checkMin: timeToMinutes(leg.time), // show start (your arrival is before this)
    });
    // Leg 2: leave when this show ends, arrive before your next commitment.
    const showEnd = timeToMinutes(leg.time) + leg.duration;
    drawLeg(legPt, destPt, {
      departMin: showEnd,
      arriveMin: showEnd + travelMinutes(legPt, destPt),
      checkMin: timeToMinutes(dest.time), // constraint start
    });
  } else {
    // Single leg: leave now, arrive before your next commitment.
    drawLeg(state.userLatLng, destPt, {
      departMin: NOW.minutes,
      arriveMin: NOW.minutes + travelMinutes(state.userLatLng, destPt),
      checkMin: timeToMinutes(dest.time),
    });
  }
}

/* Draw one animated arrow leg. The pill shows the leg's clock window
 * (depart → arrive); the green check at the end shows the deadline that
 * arrival comfortably beats (a show start, or your next commitment). */
function drawLeg(from, to, { departMin, arriveMin, checkMin } = {}) {
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

  // Journey-window pill at the midpoint: "🚶 15:44 → 15:52".
  const pill = L.marker(midpoint(from, to), {
    icon: L.divIcon({
      className: "route-label route-pill",
      html: `${escapeHtml(travelGlyph())} ${minutesToTime(departMin)} &rarr; ${minutesToTime(arriveMin)}`,
    }),
    interactive: false,
    keyboard: false,
  }).addTo(state.map);
  state.routeLayers.push(pill);

  // Green check with the deadline you're beating, near the end point.
  if (checkMin != null) {
    const chk = L.marker(to, {
      icon: L.divIcon({
        className: "route-label route-check",
        html: `<span class="tick">✓</span> ${minutesToTime(checkMin)}`,
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
function fittingShows() {
  const constrained = Boolean(state.selectedShowId);
  let all = displayedShows().filter(({ show }) => show.id !== state.selectedShowId);
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

  const constraint = state.selectedShowId
    ? state.shows.find((s) => s.id === state.selectedShowId)
    : null;

  const all = fittingShows();
  // Walk minutes: computed once, reused for the row label and distance sort.
  all.forEach((o) => {
    o.walk = Math.max(1, Math.round(travelMinutes(state.userLatLng, [o.show.lat, o.show.lng])));
  });
  const byDistance = state.sortBy === "distance";
  if (byDistance) all.sort((a, b) => a.walk - b.walk || a.show.time.localeCompare(b.show.time));
  else all.sort((a, b) => a.show.time.localeCompare(b.show.time));
  updateSortButtons();

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
    item.className = `show-item show-item--${status}`;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.innerHTML = `
      <span class="si-main">
        <span class="show-genre">${escapeHtml(show.genre)}</span>
        <span class="show-name">${escapeHtml(show.title)}</span>
        <span class="show-meta">${escapeHtml(show.venue)}</span>
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

/* Reflect the active sort on the Time / Distance toggle. */
function updateSortButtons() {
  document.querySelectorAll(".sort-btn[data-sort]").forEach((b) => {
    const on = b.dataset.sort === state.sortBy;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

/* Wire the centred Time / Distance toggle — a two-position switch, so the
 * inactive side is always visible to click. */
function wireSortControls() {
  document.querySelectorAll(".sort-btn[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.sortBy === btn.dataset.sort) return;
      state.sortBy = btn.dataset.sort;
      state.showCap = SHOW_PAGE; // a new order starts from the first page
      renderShowList();
    });
  });
  updateSortButtons();
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
  const constraint = state.selectedShowId
    ? state.shows.find((s) => s.id === state.selectedShowId)
    : null;
  // The selected show to slip in — kept independent of the commitment. It shows
  // in the plan whenever one is selected (and it isn't the commitment itself),
  // even if it no longer neatly fits: the slack chip tells that story.
  const leg =
    state.legShowId && (!constraint || state.legShowId !== constraint.id)
      ? state.shows.find((s) => s.id === state.legShowId)
      : null;

  // Nothing chosen at all — no plan to show; the list heading carries the state.
  if (!constraint && !leg) {
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
    parts.push(planLeg(travelMinutes(origin, legPt)));
    parts.push(
      planNode(
        genreIcon(leg.genre),
        "stop",
        `${leg.time}–${minutesToTime(timeToMinutes(leg.time) + leg.duration)}`,
        leg.title,
        `${leg.venue} · ${leg.genre}`,
        planSlack(timeToMinutes(leg.time) - arriveLeg),
        planBuy(leg)
      )
    );
    if (constraint) {
      const destPt = [constraint.lat, constraint.lng];
      const departFromLeg = timeToMinutes(leg.time) + leg.duration;
      const arriveDest = departFromLeg + travelMinutes(legPt, destPt);
      parts.push(planLeg(travelMinutes(legPt, destPt)));
      parts.push(
        planNode(genreIcon(constraint.genre), "dest", constraint.time, destinationLabel(), "Your next commitment",
          planSlack(timeToMinutes(constraint.time) - arriveDest), "")
      );
    }
  } else {
    const destPt = [constraint.lat, constraint.lng];
    const arriveDest = NOW.minutes + travelMinutes(origin, destPt);
    // Middle slot: until a show is slipped in, offer the plan's spare time as a
    // prompt where the chosen show will go. It's dismissable, and gets replaced
    // by the show's own node once one is picked (the `leg` branch above). When
    // there's nothing to offer it falls back to a plain walk connector.
    const spareNode = spareCtaNode();
    parts.push(spareNode || planLeg(travelMinutes(origin, destPt)));
    parts.push(
      planNode(genreIcon(constraint.genre), "dest", constraint.time, destinationLabel(), "Your next commitment",
        planSlack(timeToMinutes(constraint.time) - arriveDest), "")
    );
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

  const destShow = state.selectedShowId
    ? state.shows.find((s) => s.id === state.selectedShowId)
    : null;
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
  const constraint = state.selectedShowId
    ? state.shows.find((s) => s.id === state.selectedShowId)
    : null;
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
 * slipped-in show will go): "X min to spare — want to see a show? (N fit below)".
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
    `<p class="spare-line">You have <b>${spare} min</b> to spare — want to see a show? ${count}</p>` +
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
  // the payoff of the walk connector just above ("N min walk" → "made it, X to
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

/* A walking connector between two plan nodes. */
function planLeg(mins) {
  return `<div class="plan-leg">${escapeHtml(travelGlyph())} ${formatMins(mins)} walk</div>`;
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
  if (show.soldOut) return `<span class="plan-soldout">Sold out</span>`;
  const url = ticketUrl(show) || "#";
  return `<a class="plan-buy-inline" href="${escapeHtml(url)}" target="_blank" rel="noopener"
            title="Buy ahead on edfringe.com — skips the box-office queue (~5 min)"
          >&#127915; Buy ahead &middot; skip the queue</a>`;
}

/* A chip noting the cushion before a show starts (or by how much you'd miss it). */
function planSlack(mins) {
  const m = Math.round(mins);
  return m >= 0
    ? `<span class="plan-slack ok">${m} min to spare</span>`
    : `<span class="plan-slack late">${-m} min late</span>`;
}

/* Travel duration rounded to whole minutes (never below 1). */
function formatMins(mins) {
  return `${Math.max(1, Math.round(mins))} min`;
}

/* ---------- Genre filter ---------- */
function buildGenrePanel() {
  const wrap = document.getElementById("genreOptions");
  if (!wrap) return;
  wrap.innerHTML = "";
  GENRES.forEach((genre) => {
    const id = "genre-" + genre.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const label = document.createElement("label");
    label.className = "panel-option";
    label.innerHTML = `
      <input type="checkbox" id="${id}" value="${escapeHtml(genre)}"
        ${state.selectedGenres.has(genre) ? "checked" : ""} />
      <span><span class="opt-ico" aria-hidden="true">${genreIcon(genre)}</span> ${escapeHtml(genre)}</span>`;
    const input = label.querySelector("input");
    input.addEventListener("change", () => {
      if (input.checked) state.selectedGenres.add(genre);
      else state.selectedGenres.delete(genre);
      onGenreChange();
    });
    wrap.appendChild(label);
  });

  // Price: Free / Paid / Both segmented control (idempotent handlers so a
  // Reset-driven rebuild can't double-bind).
  document.querySelectorAll("#priceOptions .seg-btn").forEach((btn) => {
    btn.onclick = () => {
      state.priceFilter = btn.dataset.price;
      updatePriceButtons();
      onGenreChange();
    };
  });
  updatePriceButtons();

  // Reset every show filter back to "show everything".
  const reset = document.getElementById("filterReset");
  if (reset) {
    reset.onclick = () => {
      state.selectedGenres = new Set(GENRES);
      state.priceFilter = "both";
      buildGenrePanel(); // re-render checkboxes + price state
      onGenreChange();
    };
  }
}

/* Reflect the active price choice on the Both/Free/Paid segmented control. */
function updatePriceButtons() {
  document.querySelectorAll("#priceOptions .seg-btn").forEach((b) => {
    const on = b.dataset.price === state.priceFilter;
    b.classList.toggle("is-active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

function onGenreChange() {
  state.showCap = SHOW_PAGE; // a changed filter resets the list to the first page
  updateGenreValue();
  buildConstraintPanel(); // time/show options depend on the genre + price filter
  refreshMap();           // also re-renders the (mirrored) show list
}

/* Concise label for the genre filter chip. All (or none) selected reads as
 * "All genres"; a price filter is appended. */
function updateGenreValue() {
  const el = document.querySelector('[data-value="genre"]');
  if (!el) return;
  const n = state.selectedGenres.size;
  let label =
    n === 0 || n === GENRES.length
      ? "All genres"
      : n === 1
      ? [...state.selectedGenres][0]
      : `${n} genres`;
  if (state.priceFilter === "free") label += " · free";
  else if (state.priceFilter === "paid") label += " · paid";
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
  if (state.selectedTime && !times.includes(state.selectedTime)) {
    state.selectedTime = "";
    state.selectedShowId = "";
    state.legShowId = "";
    state.destLabel = "";
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
      refreshConstraintValue();
      renderRoute();
    };
  }
  // "Find on map" resolves a typed place: it commits it as the next commitment
  // and closes the picker. (We can't geocode free text yet, so there's no route
  // to draw — but the constraint is set and the panel gets out of the way.)
  if (destFind && destInput) {
    destFind.disabled = !destInput.value.trim();
    destFind.onclick = () => {
      const val = destInput.value.trim();
      if (!val) return;
      state.destLabel = val;
      state.selectedShowId = ""; // a typed place isn't one of our shows
      state.legShowId = "";
      refreshConstraintValue();
      refreshMap();
      closeAllPanels();
    };
  }

  syncWheels(false);
  renderConstraintShows(false);
  refreshConstraintValue();
}

/* Point the picker at a new time: browse the shows starting then (no commitment
 * until the user taps one). */
function setConstraintTime(hhmm) {
  if (!hhmm) return;
  state.selectedTime = hhmm;
  state.selectedShowId = "";
  state.spareCtaDismissed = false;
  state.destLabel = "";
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
        <span class="sp-genre">${escapeHtml(s.genre)}${s.free ? " · Free" : ""}</span>
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

function openPanel(trigger, panel) {
  panel.removeAttribute("hidden");
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
function renderDebugBanner() {
  const el = document.getElementById("debugNowText");
  if (el) el.textContent = `${NOW.dateLabel}, ${NOW.time} ${NOW.tz}`;
}

/* Wire up the debug panel: the header toggle chip, the date/time picker and the
 * four "move my location" buttons. */
function wireDebugControls() {
  // The debug panel is hidden by default behind a red header chip.
  const toggle = document.getElementById("debugToggle");
  const banner = document.getElementById("debugBanner");
  if (toggle && banner) {
    toggle.addEventListener("click", () => {
      const show = banner.hasAttribute("hidden");
      banner.toggleAttribute("hidden", !show);
      toggle.setAttribute("aria-expanded", String(show));
    });
  }

  const dt = document.getElementById("debugDateTime");
  if (dt) {
    dt.value = toDatetimeLocalValue(simNowDate);
    dt.addEventListener("change", () => {
      const d = new Date(dt.value);
      if (!isNaN(d.getTime())) applySimulatedNow(d);
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

/* Project a chosen Date onto the simulated NOW and re-render everything that
 * depends on the current time. Changing the day loads that day's data file. */
async function applySimulatedNow(date) {
  const prevDate = NOW.date;
  simNowDate = date;
  NOW.date = toISODate(date);
  NOW.dateLabel = formatDateLabel(date);
  NOW.time = formatClock(date);
  NOW.minutes = date.getHours() * 60 + date.getMinutes();
  renderDebugBanner();
  // A different day means a different per-day file; reload before re-rendering.
  if (NOW.date !== prevDate) {
    await loadShows();
  }
  // Reachability, the "happening now" list and the time picker all key off NOW.
  buildConstraintPanel();
  refreshMap();
  renderShowList();
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

/* Midpoint and linear interpolation between two [lat,lng] points. */
function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}
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
