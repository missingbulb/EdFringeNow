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
 * (km/h) used to estimate travel time. */
const TRAVEL_MODES = ["Walking", "Taxi/Car", "Bus", "Bicycle"];
const TRAVEL_SPEEDS_KMH = {
  // Walking dialled down to ~2/3 of a brisk 5 km/h — Edinburgh's closes, hills,
  // stairs and festival crowds make real walking slower than the crow flies.
  Walking: (5 * 2) / 3,
  "Taxi/Car": 30,
  Bus: 18,
  Bicycle: 15,
};

/* Reachability window. The user picks how far they'll travel (in minutes) in
 * the travel card; DEFAULT_MAX_TRAVEL seeds it. A show that starts up to
 * GRACE_MINUTES before you'd actually arrive is still shown, but faded — you'd
 * only just miss it. */
const DEFAULT_MAX_TRAVEL = 10;
const TRAVEL_TIME_STOPS = [5, 10, 15, 20, 30, 45, 60];
const GRACE_MINUTES = 5;

/* Price filter. The source data only distinguishes free vs paid (no amounts),
 * so this is a two-stop toggle: free-only … all shows. */
const PRICE_STOPS = [0, Infinity];

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
  map: null,
  selectedGenres: new Set(["Comedy"]),
  maxPrice: Infinity,          // £ cap from the genre card's price slider
  travelMode: "Walking",
  maxTravelMinutes: DEFAULT_MAX_TRAVEL, // reach window from the travel card
  selectedTime: "",            // chosen exact start time, e.g. "16:30"
  selectedShowId: "",          // the pinned "next show" (destination)
  destLabel: "",               // editable destination text (defaults to the show's venue)
  legShowId: "",               // a show clicked on the map (stop before the destination)
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

  // "Locate me" control — (re)asks the browser for the real location
  const locate = L.control({ position: "topright" });
  locate.onAdd = function () {
    const btn = L.DomUtil.create("button", "locate-btn");
    btn.innerHTML = "◎";
    btn.title = "Use my location";
    btn.style.cssText =
      "width:34px;height:34px;border:none;background:#0f8f86;color:#fff;font-size:18px;cursor:pointer;border-radius:8px;";
    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.stop(e);
      requestUserLocation();
    });
    return btn;
  };
  locate.addTo(map);

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

/* Shows passing the current genre + max-price filters (empty genre set = all). */
function visibleShows() {
  let list = state.shows;
  if (state.selectedGenres.size) {
    list = list.filter((s) => state.selectedGenres.has(s.genre));
  }
  list = list.filter((s) => priceValue(s) <= state.maxPrice);
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
  // Highlight the show the user clicked as their stop before the destination.
  if (constraint && state.legShowId) {
    const leg = out.find((o) => o.show.id === state.legShowId && o.status === "ok");
    if (leg) leg.status = "leg";
  }
  // Draw highlighted pins last so they sit on top.
  const z = { ok: 0, tight: 0, leg: 1, selected: 2 };
  out.sort((a, b) => (z[a.status] || 0) - (z[b.status] || 0));
  return out;
}

const MARKER_STYLE = {
  selected: { radius: 13, color: "#141414", weight: 3, fillOpacity: 1 },
  leg: { radius: 11, color: "#1e7d34", weight: 4, fillOpacity: 1 },
  ok: { radius: 9, color: "#fff", weight: 2, fillOpacity: 1 },
  tight: { radius: 8, color: "#9aa0a6", weight: 2, fillOpacity: 0.32 },
};

/* Re-draw the reach circle, show markers, journey arrows and the (mirrored)
 * show list together. */
function refreshMap() {
  renderReachCircle();
  renderMarkers();
  renderRoute();
  renderShowList();
  renderJourneyStrip();
}

function renderReachCircle() {
  if (!state.map) return;
  const opts = {
    radius: reachRadiusMeters(),
    color: "#0f8f86",
    weight: 1.5,
    fillColor: "#0f8f86",
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
  // Clear any existing markers
  Object.values(state.markers).forEach((m) => state.map.removeLayer(m));
  state.markers = {};

  displayedShows().forEach(({ show, status }) => {
    const style = MARKER_STYLE[status] || MARKER_STYLE.ok;
    const marker = L.circleMarker([show.lat, show.lng], {
      ...style,
      fillColor: status === "tight" ? "#b9bcc1" : genreColor(show.genre),
    }).addTo(state.map);

    marker.bindPopup(popupHtml(show, status));
    marker.on("click", () => onShowClick(show));
    state.markers[show.id] = marker;
  });
}

/* Clicking a show: if a destination is chosen, treat the click as the stop the
 * user wants to make on the way there; otherwise just show its popup. */
function onShowClick(show) {
  if (state.selectedShowId && show.id !== state.selectedShowId) {
    state.legShowId = state.legShowId === show.id ? "" : show.id; // toggle
    refreshMap();
  }
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
  if (!dest) return; // arrows only exist once a "next show" is chosen
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
  return { Walking: "🚶", "Taxi/Car": "🚕", Bus: "🚌", Bicycle: "🚲" }[state.travelMode] || "🚶";
}

function statusNote(show, status) {
  if (status === "selected") return "★ Your next show";
  if (status === "tight") return "Cuts it fine — starts before you'd arrive";
  if (status === "ok" && state.selectedShowId) return "Fits before your next show";
  return "";
}

function popupHtml(show, status = "ok") {
  const note = statusNote(show, status);
  const noteHtml = note ? `<span class="popup-genre">${escapeHtml(note)}</span>` : "";
  return `
    <div class="popup">
      ${noteHtml}
      <span class="popup-genre">${escapeHtml(show.genre)}</span>
      <p class="popup-title">${escapeHtml(show.title)}</p>
      <p class="popup-meta">${escapeHtml(show.venue)}</p>
      <p class="popup-meta">${escapeHtml(NOW.dateLabel)} · ${escapeHtml(show.time)} · ${show.duration} min · ${escapeHtml(show.price)}</p>
    </div>`;
}

/* ---------- Show list ---------- */
/* The list mirrors what's on the map, minus the chosen next commitment: that
 * show is a future destination the user has already locked in, not something
 * "Happening Now", so we pin it on the map but keep it out of this list. */
function renderShowList() {
  const grid = document.getElementById("showsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const shows = displayedShows().filter(({ show }) => show.id !== state.selectedShowId);
  if (!shows.length) {
    grid.innerHTML =
      '<p class="show-meta">No reachable shows match your current filters.</p>';
    return;
  }

  shows
    .slice()
    .sort((a, b) => a.show.time.localeCompare(b.show.time))
    .forEach(({ show, status }) => {
      const item = document.createElement("article");
      item.className = `show-item show-item--${status}`;
      item.innerHTML = `
        <span class="show-genre">${escapeHtml(show.genre)}</span>
        <h3 class="show-name">${escapeHtml(show.title)}</h3>
        <p class="show-meta">${escapeHtml(show.venue)}</p>
        <p class="show-meta"><span class="show-time">${escapeHtml(NOW.dateLabel)} ${escapeHtml(show.time)}</span> · ${escapeHtml(show.price)}</p>`;
      item.addEventListener("click", () => {
        onShowClick(show);
        document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
        const marker = state.markers[show.id];
        if (marker) marker.openPopup();
      });
      grid.appendChild(item);
    });
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

  // A clicked stop only counts when it's a valid leg on the way to the
  // constraint (same rule the map uses for the green "leg" pin).
  let leg = null;
  if (constraint && state.legShowId && state.legShowId !== constraint.id) {
    const cand = state.shows.find((s) => s.id === state.legShowId);
    if (cand && classifyShow(cand, constraint) === "ok") leg = cand;
  }

  const parts = [originNodeHtml()];

  if (!constraint) {
    // Nothing chosen — idle walker, then nothing.
    parts.push(idleSegHtml());
  } else if (leg) {
    const legPt = [leg.lat, leg.lng];
    const destPt = [constraint.lat, constraint.lng];
    // Leg 1: leave now, arrive before the stop's show starts.
    const arriveLeg = NOW.minutes + travelMinutes(origin, legPt);
    parts.push(segHtml(travelMinutes(origin, legPt)));
    parts.push(stopNodeHtml(leg, timeToMinutes(leg.time) - arriveLeg));
    // Leg 2: leave when the stop's show ends, arrive before the commitment.
    const departFromLeg = timeToMinutes(leg.time) + leg.duration;
    const arriveDest = departFromLeg + travelMinutes(legPt, destPt);
    parts.push(segHtml(travelMinutes(legPt, destPt)));
    parts.push(destNodeHtml(constraint, timeToMinutes(constraint.time) - arriveDest));
  } else {
    // Constraint only — one long line straight to your next commitment.
    const destPt = [constraint.lat, constraint.lng];
    const arriveDest = NOW.minutes + travelMinutes(origin, destPt);
    parts.push(segHtml(travelMinutes(origin, destPt), { long: true }));
    parts.push(destNodeHtml(constraint, timeToMinutes(constraint.time) - arriveDest));
  }

  strip.innerHTML = parts.join("");
  updateMapsRouteLink();
}

/* Google Maps travel mode matching the user's currently selected one. */
function googleMapsTravelMode() {
  return (
    { Walking: "walking", "Taxi/Car": "driving", Bus: "transit", Bicycle: "bicycling" }[
      state.travelMode
    ] || "walking"
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

/* Keep the Google Maps link pointed at the current plan. The link is always
 * available: with no stops it opens the map at the user; with one or two shows
 * it opens directions through them. The label drops "route" when there's no
 * actual route to draw. */
function updateMapsRouteLink() {
  const link = document.getElementById("mapsRouteLink");
  if (!link) return;
  link.hidden = false;
  link.href = googleMapsUrl();
  const hasRoute = Boolean(state.selectedShowId || state.legShowId);
  const text = link.querySelector(".maps-route-btn__text");
  if (text) {
    text.textContent = hasRoute ? "Open route in Google Maps" : "Open in Google Maps";
  }
}

/* Left "you are here, now" node. */
function originNodeHtml() {
  return `
    <div class="journey-node journey-node--origin">
      <span class="journey-flag journey-flag--dull">&#9873; You are here</span>
      <span class="journey-sub">(now) &middot; ${escapeHtml(NOW.time)}</span>
    </div>`;
}

/* Idle middle: a walker bobbing in place, then dots, then nothing. */
function idleSegHtml() {
  return `
    <div class="journey-seg journey-seg--idle">
      <span class="journey-idle-row">
        <span class="journey-walker" aria-hidden="true">&#128694;</span>
        <span class="journey-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      </span>
      <span class="journey-hint">Pick where you need to be next</span>
    </div>`;
}

/* A travel connector: glyph + duration above a dashed line with a walker
 * tracking across it. `opts.long` lets the single direct leg stretch wider. */
function segHtml(mins, { long = false } = {}) {
  return `
    <div class="journey-seg journey-seg--line${long ? " journey-seg--long" : ""}">
      <span class="journey-line-label">${escapeHtml(travelGlyph())} ${formatMins(mins)}</span>
      <span class="journey-line"><span class="journey-line-walker" aria-hidden="true">&#128694;</span></span>
    </div>`;
}

/* The intermediate stop the user clicked on the map. */
function stopNodeHtml(show, slackMin) {
  return `
    <div class="journey-node journey-node--stop">
      <span class="journey-flag journey-flag--stop">&#9873; ${escapeHtml(show.title)}</span>
      <span class="journey-sub">${escapeHtml(show.venue)}</span>
      <span class="journey-sub">Starts ${escapeHtml(show.time)}</span>
      ${slackHtml(slackMin)}
      ${buyHtml(show)}
    </div>`;
}

/* The user's next commitment (the destination). This is somewhere they already
 * need to be — not a show we sell a ticket for — so it carries no buy CTA. */
function destNodeHtml(show, slackMin) {
  return `
    <div class="journey-node journey-node--dest">
      <span class="journey-flag journey-flag--dest">&#9873; ${escapeHtml(destinationLabel())}</span>
      <span class="journey-sub">Your next commitment</span>
      <span class="journey-sub">Starts ${escapeHtml(show.time)}</span>
      ${slackHtml(slackMin)}
    </div>`;
}

/* Booking link for a show on the official Fringe box office. Every show in the
 * data carries a `slug`; the page lives at /tickets/whats-on/<slug>. */
function ticketUrl(show) {
  return show && show.slug
    ? `https://www.edfringe.com/tickets/whats-on/${encodeURIComponent(show.slug)}`
    : "";
}

/* A "buy now" call-to-action for the chosen show (the middle stop the user
 * selected to go see). Buying ahead skips the on-site box-office queue — worth
 * ~5 minutes, which matters when the plan is tight. Clicking opens the show's
 * official Fringe booking page. Free shows need no ticket; sold-out shows say so. */
function buyHtml(show) {
  if (!show || show.free) return "";
  if (show.soldOut) return `<span class="journey-soldout">Sold out</span>`;
  const url = ticketUrl(show) || "#";
  return `<a class="journey-buy" href="${escapeHtml(url)}" target="_blank" rel="noopener"
            title="Buy a ticket on edfringe.com — booking ahead skips the box-office queue and saves about 5 minutes on the spot"
          >&#127915; Buy now &middot; save 5 min at the door</a>`;
}

/* A chip noting the cushion before a show starts (or by how much you'd miss it). */
function slackHtml(mins) {
  const m = Math.round(mins);
  if (m >= 0) {
    return `<span class="journey-slack journey-slack--ok">${m} min to spare</span>`;
  }
  return `<span class="journey-slack journey-slack--late">${-m} min late</span>`;
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
      <span>${escapeHtml(genre)}</span>`;
    const input = label.querySelector("input");
    input.addEventListener("change", () => {
      if (input.checked) state.selectedGenres.add(genre);
      else state.selectedGenres.delete(genre);
      onGenreChange();
    });
    wrap.appendChild(label);
  });

  // Price toggle (Free only … All shows).
  const range = document.getElementById("priceRange");
  if (range) {
    range.max = String(PRICE_STOPS.length - 1);
    range.value = String(PRICE_STOPS.indexOf(state.maxPrice));
    updatePriceLabel();
    range.addEventListener("input", () => {
      state.maxPrice = PRICE_STOPS[Number(range.value)];
      updatePriceLabel();
      onGenreChange();
    });
  }
}

function priceStopLabel(v) {
  return v === 0 ? "Free only" : "All shows";
}

function updatePriceLabel() {
  const el = document.getElementById("priceValue");
  if (el) el.textContent = priceStopLabel(state.maxPrice);
}

function onGenreChange() {
  updateGenreValue();
  buildConstraintPanel(); // time/show options depend on the genre + price filter
  refreshMap();           // also re-renders the (mirrored) show list
}

function updateGenreValue() {
  const el = document.querySelector('[data-value="genre"]');
  if (!el) return;
  const list = [...state.selectedGenres];
  const genres = list.length ? list.join(", ") : "All genres";
  const price = state.maxPrice === 0 ? "free only" : "any price";
  el.textContent = `${genres} · ${price}`;
}

/* ---------- Travel mode + reach window ---------- */
function buildTravelPanel() {
  const wrap = document.getElementById("travelOptions");
  if (!wrap) return;
  wrap.innerHTML = "";
  TRAVEL_MODES.forEach((mode) => {
    const label = document.createElement("label");
    label.className = "panel-option";
    label.innerHTML = `
      <input type="radio" name="travel" value="${escapeHtml(mode)}"
        ${state.travelMode === mode ? "checked" : ""} />
      <span>${escapeHtml(mode)}</span>`;
    label.querySelector("input").addEventListener("change", () => {
      state.travelMode = mode;
      updateTravelLabels();
      refreshMap(); // travel speed changes the reach circle and what's reachable
    });
    wrap.appendChild(label);
  });

  // Max-travel-time slider (replaces the old fixed reach window).
  const range = document.getElementById("travelRange");
  if (range) {
    range.max = String(TRAVEL_TIME_STOPS.length - 1);
    range.value = String(TRAVEL_TIME_STOPS.indexOf(state.maxTravelMinutes));
    updateTravelLabels();
    range.addEventListener("input", () => {
      state.maxTravelMinutes = TRAVEL_TIME_STOPS[Number(range.value)];
      updateTravelLabels();
      refreshMap();
    });
  }
}

function updateTravelLabels() {
  const v = document.getElementById("travelValue");
  if (v) v.textContent = `${state.maxTravelMinutes} min max`;
  const card = document.querySelector('[data-value="travel"]');
  if (card) card.textContent = `${state.travelMode} · ≤ ${state.maxTravelMinutes} min`;
}

/* ---------- Next-show (time + place) constraint ---------- */
function buildConstraintPanel() {
  const timeSelect = document.getElementById("timeSelect");
  const showSelect = document.getElementById("showSelect");
  if (!timeSelect || !showSelect) return;

  // Reflect the simulated date in the panel.
  const dateLabel = document.getElementById("constraintDateLabel");
  if (dateLabel) dateLabel.textContent = NOW.dateLabel;
  const note = document.getElementById("constraintNote");
  if (note) {
    note.textContent =
      `It's ${NOW.time} — we only show start times at least ${CONSTRAINT_LEAD_MINUTES} min away.`;
  }

  // Unique start times among the constraint candidates — every show today, not
  // just the genre/price-filtered ones, and only those starting at least
  // CONSTRAINT_LEAD_MINUTES from now — sorted chronologically.
  const times = [...new Set(constraintShows().map((s) => s.time))].sort((a, b) =>
    a.localeCompare(b)
  );

  // Drop a stale selection if its time is no longer available.
  if (!times.includes(state.selectedTime)) {
    state.selectedTime = "";
    state.selectedShowId = "";
    state.legShowId = "";
    state.destLabel = "";
  }

  timeSelect.innerHTML =
    '<option value="">— choose a time —</option>' +
    times.map((t) => `<option value="${t}">${NOW.dateLabel}, ${t}</option>`).join("");
  timeSelect.value = state.selectedTime;

  timeSelect.onchange = () => {
    state.selectedTime = timeSelect.value;
    state.legShowId = "";
    populateShowSelect();
    // Auto-pick the first available show — no need for a second click.
    const first = showSelect.querySelector('option[value]:not([value=""])');
    state.selectedShowId = first ? first.value : "";
    showSelect.value = state.selectedShowId;
    syncDestInput();
    refreshConstraintValue();
    refreshMap();
  };

  showSelect.onchange = () => {
    state.selectedShowId = showSelect.value;
    state.legShowId = "";
    syncDestInput();
    refreshConstraintValue();
    refreshMap(); // highlight on the map (no zoom)
  };

  const destInput = document.getElementById("destInput");
  if (destInput) {
    destInput.oninput = () => {
      state.destLabel = destInput.value;
      refreshConstraintValue();
      renderRoute();
    };
  }

  populateShowSelect();
  if (state.selectedShowId) {
    showSelect.value = state.selectedShowId;
    syncDestInput();
  } else {
    syncDestInput();
  }
  refreshConstraintValue();
}

function populateShowSelect() {
  const showSelect = document.getElementById("showSelect");
  if (!showSelect) return;

  if (!state.selectedTime) {
    showSelect.innerHTML = '<option value="">Pick a time first</option>';
    showSelect.disabled = true;
    return;
  }

  const atTime = constraintShows().filter((s) => s.time === state.selectedTime);
  showSelect.disabled = false;
  showSelect.innerHTML = atTime
    .map(
      (s) => `<option value="${s.id}">${escapeHtml(s.title)} · ${escapeHtml(s.venue)}</option>`
    )
    .join("");
}

/* Mirror the chosen show's venue into the editable destination box. The user
 * can overwrite it if their next commitment isn't actually a Fringe show. */
function syncDestInput() {
  const show = state.shows.find((s) => s.id === state.selectedShowId);
  state.destLabel = show ? show.venue : "";
  const destInput = document.getElementById("destInput");
  if (destInput) {
    destInput.value = state.destLabel;
    destInput.disabled = !show;
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
  if (show) {
    el.textContent = `${destinationLabel()} – by ${show.time}`;
  } else if (state.selectedTime) {
    el.textContent = `Shows at ${state.selectedTime}`;
  } else {
    el.textContent = "Set my next commitment";
  }
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
}

function closeAllPanels() {
  document.querySelectorAll(".card-panel").forEach((p) => p.setAttribute("hidden", ""));
  document.querySelectorAll(".card-trigger").forEach((t) => t.setAttribute("aria-expanded", "false"));
  document.querySelectorAll(".card.is-open").forEach((c) => c.classList.remove("is-open"));
}

/* ---------- Debug clock ---------- */
function renderDebugBanner() {
  const el = document.getElementById("debugNowText");
  if (!el) return;
  el.textContent = `${NOW.dateLabel}, ${NOW.time} ${NOW.tz}`;
}

/* Wire up the debug panel: the date/time picker and the four "move my
 * location" buttons. */
function wireDebugControls() {
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
