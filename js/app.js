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

/* How the user might travel between shows. */
const TRAVEL_MODES = ["Walking", "Taxi/Car", "Bus", "Bicycle"];

const state = {
  shows: [],
  markers: {},                 // id -> Leaflet marker
  map: null,
  selectedGenres: new Set(["Comedy", "Cabaret and Variety"]),
  travelMode: "Walking",
  selectedTime: "",            // chosen exact start time, e.g. "16:30"
  selectedShowId: "",          // the pinned "next show"
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  initMap();
  buildGenrePanel();
  buildTravelPanel();
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
  renderMarkers();
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

  // "Locate me" control
  const locate = L.control({ position: "topright" });
  locate.onAdd = function () {
    const btn = L.DomUtil.create("button", "locate-btn");
    btn.innerHTML = "◎";
    btn.title = "Find me";
    btn.style.cssText =
      "width:34px;height:34px;border:none;background:#c62024;color:#fff;font-size:18px;cursor:pointer;border-radius:4px;";
    L.DomEvent.on(btn, "click", (e) => {
      L.DomEvent.stop(e);
      map.locate({ setView: true, maxZoom: 15 });
    });
    return btn;
  };
  locate.addTo(map);

  state.map = map;
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

/* Shows passing the current genre filter (empty selection = show all). */
function visibleShows() {
  if (!state.selectedGenres.size) return state.shows;
  return state.shows.filter((s) => state.selectedGenres.has(s.genre));
}

function renderMarkers() {
  // Clear any existing markers
  Object.values(state.markers).forEach((m) => state.map.removeLayer(m));
  state.markers = {};

  visibleShows().forEach((show) => {
    const isPinned = show.id === state.selectedShowId;
    const marker = L.circleMarker([show.lat, show.lng], {
      radius: isPinned ? 13 : 9,
      color: isPinned ? "#141414" : "#fff",
      weight: isPinned ? 3 : 2,
      fillColor: genreColor(show.genre),
      fillOpacity: 1,
    }).addTo(state.map);

    marker.bindPopup(popupHtml(show));
    state.markers[show.id] = marker;
  });
}

function popupHtml(show) {
  const pinned = show.id === state.selectedShowId
    ? '<span class="popup-genre">★ Your next show</span>'
    : "";
  return `
    <div class="popup">
      ${pinned}
      <span class="popup-genre">${escapeHtml(show.genre)}</span>
      <p class="popup-title">${escapeHtml(show.title)}</p>
      <p class="popup-meta">${escapeHtml(show.venue)}</p>
      <p class="popup-meta">Today · ${escapeHtml(show.time)} · ${show.duration} min · ${escapeHtml(show.price)}</p>
    </div>`;
}

/* ---------- Show list ---------- */
function renderShowList() {
  const grid = document.getElementById("showsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const shows = visibleShows();
  if (!shows.length) {
    grid.innerHTML = '<p class="show-meta">No shows match your selected genres.</p>';
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
        <p class="show-meta"><span class="show-time">Today ${escapeHtml(show.time)}</span> · ${escapeHtml(show.price)}</p>`;
      item.addEventListener("click", () => focusShow(show));
      grid.appendChild(item);
    });
}

function focusShow(show) {
  const marker = state.markers[show.id];
  if (marker && state.map) {
    state.map.setView([show.lat, show.lng], 16, { animate: true });
    marker.openPopup();
  }
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
  renderMarkers();
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
    });
    wrap.appendChild(label);
  });
}

/* ---------- Next-show (time + place) constraint ---------- */
function buildConstraintPanel() {
  const timeSelect = document.getElementById("timeSelect");
  const showSelect = document.getElementById("showSelect");
  if (!timeSelect || !showSelect) return;

  // Unique start times among the genre-filtered shows, sorted chronologically.
  const times = [...new Set(visibleShows().map((s) => s.time))].sort((a, b) =>
    a.localeCompare(b)
  );

  // Keep the previously chosen time if it's still available.
  if (!times.includes(state.selectedTime)) state.selectedTime = "";

  timeSelect.innerHTML =
    '<option value="">— choose a time —</option>' +
    times.map((t) => `<option value="${t}">Today ${t}</option>`).join("");
  timeSelect.value = state.selectedTime;

  timeSelect.onchange = () => {
    state.selectedTime = timeSelect.value;
    state.selectedShowId = "";
    populateShowSelect();
    refreshConstraintValue();
    renderMarkers();
  };

  showSelect.onchange = () => {
    state.selectedShowId = showSelect.value;
    refreshConstraintValue();
    renderMarkers();
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

/* ---------- utils ---------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
