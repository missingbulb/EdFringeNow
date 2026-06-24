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
  Walking: 5,
  "Taxi/Car": 30,
  Bus: 18,
  Bicycle: 15,
};

/* Reachability window. We show shows you could reach within REACH_MINUTES of
 * travel (the circle on the map). A show that starts up to GRACE_MINUTES before
 * you'd actually arrive is still shown, but faded — you'd only just miss it. */
const REACH_MINUTES = 15;
const GRACE_MINUTES = 5;

/* ===== DEBUG: simulated "now" =====================================
 * The whole flow is scoped to "the next few hours today", so for testing we
 * pin a fixed clock instead of the real one. A red on-screen badge makes it
 * obvious the app is running against a faked time. */
const NOW = {
  dateLabel: "Thu 14 Aug",
  time: "15:44",
  tz: "BST",            // British Summer Time
  minutes: 15 * 60 + 44,
};

const state = {
  shows: [],
  markers: {},                 // id -> Leaflet marker
  map: null,
  selectedGenres: new Set(["Comedy", "Cabaret and Variety"]),
  travelMode: "Walking",
  selectedTime: "",            // chosen exact start time, e.g. "16:30"
  selectedShowId: "",          // the pinned "next show"
  freeOnly: false,             // "Only Free Shows" toggle
  userLatLng: USER_DEFAULT,    // current "you are here" location
  userMarker: null,            // Leaflet marker for the user
  reachCircle: null,           // Leaflet circle for the travel radius
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  renderDebugBanner();
  initMap();
  setUserLocation(USER_DEFAULT, { recenter: false }); // central-Edinburgh default
  requestUserLocation();                              // then ask for the real thing
  buildGenrePanel();
  buildTravelPanel();
  wireFreeToggle();
  wirePanels();
  try {
    const res = await fetch("data/shows.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.shows = data.shows || [];
  } catch (err) {
    console.error("Could not load shows.json:", err);
    state.shows = [];
  }
  buildConstraintPanel();
  refreshMap();
  renderShowList();
  updateGenreValue();
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
      "width:34px;height:34px;border:none;background:#c62024;color:#fff;font-size:18px;cursor:pointer;border-radius:4px;";
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

function isFree(show) {
  return /free/i.test(show.price);
}

/* Shows passing the current genre + free filters (empty genre set = all). */
function visibleShows() {
  let list = state.shows;
  if (state.selectedGenres.size) {
    list = list.filter((s) => state.selectedGenres.has(s.genre));
  }
  if (state.freeOnly) list = list.filter(isFree);
  return list;
}

/* Genre/free-filtered shows that haven't started yet by the simulated "now". */
function upcomingShows() {
  return visibleShows().filter((s) => timeToMinutes(s.time) >= NOW.minutes);
}

/* Minutes of travel, by the selected mode, from A to B ([lat,lng] each). */
function travelMinutes(a, b) {
  const speed = TRAVEL_SPEEDS_KMH[state.travelMode] || TRAVEL_SPEEDS_KMH.Walking;
  return (distanceKm(a, b) / speed) * 60;
}

/* Metres covered in REACH_MINUTES at the selected travel speed. */
function reachRadiusMeters() {
  const speed = TRAVEL_SPEEDS_KMH[state.travelMode] || TRAVEL_SPEEDS_KMH.Walking;
  return speed * (REACH_MINUTES / 60) * 1000;
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
  if (travel > REACH_MINUTES) return "hidden"; // outside the walk/ride circle

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
  // Draw the selected pin last so it sits on top.
  out.sort((a, b) => (a.status === "selected") - (b.status === "selected"));
  return out;
}

const MARKER_STYLE = {
  selected: { radius: 13, color: "#141414", weight: 3, fillOpacity: 1 },
  ok: { radius: 9, color: "#fff", weight: 2, fillOpacity: 1 },
  tight: { radius: 8, color: "#9aa0a6", weight: 2, fillOpacity: 0.32 },
};

/* Re-draw the reach circle and all show markers together. */
function refreshMap() {
  renderReachCircle();
  renderMarkers();
}

function renderReachCircle() {
  if (!state.map) return;
  const opts = {
    radius: reachRadiusMeters(),
    color: "#2f6bd6",
    weight: 1.5,
    fillColor: "#2f6bd6",
    fillOpacity: 0.08,
    interactive: false,
  };
  if (state.reachCircle) {
    state.reachCircle.setLatLng(state.userLatLng).setRadius(opts.radius);
  } else {
    state.reachCircle = L.circle(state.userLatLng, opts).addTo(state.map);
  }
  state.reachCircle.bindTooltip(`~${REACH_MINUTES} min by ${state.travelMode}`, {
    permanent: false,
    direction: "top",
  });
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
    state.markers[show.id] = marker;
  });
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
function renderShowList() {
  const grid = document.getElementById("showsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const shows = visibleShows();
  if (!shows.length) {
    grid.innerHTML = '<p class="show-meta">No shows match your current filters.</p>';
    return;
  }

  shows
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time))
    .forEach((show) => {
      const item = document.createElement("article");
      item.className = "show-item";
      item.innerHTML = `
        <span class="show-genre">${escapeHtml(show.genre)}</span>
        <h3 class="show-name">${escapeHtml(show.title)}</h3>
        <p class="show-meta">${escapeHtml(show.venue)}</p>
        <p class="show-meta"><span class="show-time">${escapeHtml(NOW.dateLabel)} ${escapeHtml(show.time)}</span> · ${escapeHtml(show.price)}</p>`;
      item.addEventListener("click", () => focusShow(show));
      grid.appendChild(item);
    });
}

function focusShow(show) {
  if (state.map) state.map.setView([show.lat, show.lng], 16, { animate: true });
  const marker = state.markers[show.id];
  if (marker) marker.openPopup();
  document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
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
}

function onGenreChange() {
  updateGenreValue();
  refreshMap();
  renderShowList();
  buildConstraintPanel(); // time/show options depend on the genre filter
}

function updateGenreValue() {
  const el = document.querySelector('[data-value="genre"]');
  if (!el) return;
  const list = [...state.selectedGenres];
  el.textContent = list.length ? list.join(", ") : "All genres";
}

/* ---------- Travel mode ---------- */
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
      const el = document.querySelector('[data-value="travel"]');
      if (el) el.textContent = mode;
      refreshMap(); // travel speed changes the reach circle and what's reachable
    });
    wrap.appendChild(label);
  });
}

/* ---------- "Only Free Shows" toggle ---------- */
function wireFreeToggle() {
  const btn = document.getElementById("freeToggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    state.freeOnly = !state.freeOnly;
    btn.classList.toggle("is-active", state.freeOnly);
    btn.setAttribute("aria-pressed", String(state.freeOnly));
    refreshMap();
    renderShowList();
    buildConstraintPanel();
  });
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
      `It's ${NOW.time} — we only show start times still to come today.`;
  }

  // Unique *upcoming* start times among the genre-filtered shows (shows that
  // already started by the simulated "now" are dropped), sorted chronologically.
  const times = [...new Set(upcomingShows().map((s) => s.time))].sort((a, b) =>
    a.localeCompare(b)
  );

  // Keep the previously chosen time if it's still available.
  if (!times.includes(state.selectedTime)) state.selectedTime = "";

  timeSelect.innerHTML =
    '<option value="">— choose a time —</option>' +
    times.map((t) => `<option value="${t}">${NOW.dateLabel}, ${t}</option>`).join("");
  timeSelect.value = state.selectedTime;

  timeSelect.onchange = () => {
    state.selectedTime = timeSelect.value;
    state.selectedShowId = "";
    populateShowSelect();
    refreshConstraintValue();
    refreshMap();
  };

  showSelect.onchange = () => {
    state.selectedShowId = showSelect.value;
    refreshConstraintValue();
    refreshMap();
    const show = state.shows.find((s) => s.id === state.selectedShowId);
    if (show) focusShow(show);
  };

  populateShowSelect();
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

  const atTime = visibleShows().filter((s) => s.time === state.selectedTime);
  showSelect.disabled = false;
  showSelect.innerHTML =
    `<option value="">— ${atTime.length} show${atTime.length === 1 ? "" : "s"} at ${state.selectedTime} —</option>` +
    atTime
      .map(
        (s) =>
          `<option value="${s.id}">${escapeHtml(s.title)} · ${escapeHtml(s.venue)}</option>`
      )
      .join("");
  if (state.selectedShowId) showSelect.value = state.selectedShowId;
}

function refreshConstraintValue() {
  const el = document.querySelector('[data-value="constraint"]');
  if (!el) return;
  const show = state.shows.find((s) => s.id === state.selectedShowId);
  if (show) {
    el.textContent = `${show.venue} – ${show.time}`;
  } else if (state.selectedTime) {
    el.textContent = `Shows at ${state.selectedTime}`;
  } else {
    el.textContent = "Pick a start time";
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
  const el = document.getElementById("debugBanner");
  if (!el) return;
  el.innerHTML =
    `<strong>DEBUG MODE</strong> — Simulated “now”: ` +
    `${escapeHtml(NOW.dateLabel)}, ${escapeHtml(NOW.time)} ${escapeHtml(NOW.tz)}`;
}

/* ---------- utils ---------- */
/* "HH:MM" -> minutes since midnight. */
function timeToMinutes(t) {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + m;
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
