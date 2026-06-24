/* Fringe Discover — front-end logic
 * - loads mock show data
 * - renders an interactive Leaflet map of Edinburgh venues
 * - renders the "Happening Now" list
 * - makes the constraint cards editable
 * - tracks a gamified "discovery journey" as genres are explored
 */

const EDINBURGH = [55.9486, -3.1881];
const TOTAL_CATEGORIES = 10;

const state = {
  shows: [],
  markers: {},        // id -> Leaflet marker
  exploredGenres: new Set(),
  map: null,
};

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  initMap();
  wireCardEditing();
  try {
    const res = await fetch("data/shows.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.shows = data.shows || [];
  } catch (err) {
    console.error("Could not load shows.json:", err);
    state.shows = [];
  }
  renderMarkers();
  renderShowList();
  updateJourney(); // initialise badge/bar from defaults
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
    Dance: "#c79a36",
    Music: "#2f6bd6",
    Cabaret: "#8e44ad",
    Magic: "#16a085",
    Circus: "#e67e22",
    "Spoken Word": "#34495e",
    "Children's": "#27ae60",
  };
  return map[genre] || "#141414";
}

function renderMarkers() {
  state.shows.forEach((show) => {
    const marker = L.circleMarker([show.lat, show.lng], {
      radius: 9,
      color: "#fff",
      weight: 2,
      fillColor: genreColor(show.genre),
      fillOpacity: 1,
    }).addTo(state.map);

    marker.bindPopup(popupHtml(show));
    marker.on("popupopen", () => exploreGenre(show.genre));
    state.markers[show.id] = marker;
  });
}

function popupHtml(show) {
  return `
    <div class="popup">
      <span class="popup-genre">${escapeHtml(show.genre)}</span>
      <p class="popup-title">${escapeHtml(show.title)}</p>
      <p class="popup-meta">${escapeHtml(show.venue)}</p>
      <p class="popup-meta">${escapeHtml(show.time)} · ${show.duration} min · ${escapeHtml(show.price)}</p>
    </div>`;
}

/* ---------- Show list ---------- */
function renderShowList() {
  const grid = document.getElementById("showsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!state.shows.length) {
    grid.innerHTML = '<p class="show-meta">No shows available right now.</p>';
    return;
  }

  state.shows.forEach((show) => {
    const item = document.createElement("article");
    item.className = "show-item";
    item.innerHTML = `
      <span class="show-genre">${escapeHtml(show.genre)}</span>
      <h3 class="show-name">${escapeHtml(show.title)}</h3>
      <p class="show-meta">${escapeHtml(show.venue)}</p>
      <p class="show-meta"><span class="show-time">${escapeHtml(show.time)}</span> · ${escapeHtml(show.price)}</p>`;
    item.addEventListener("click", () => focusShow(show));
    grid.appendChild(item);
  });
}

function focusShow(show) {
  exploreGenre(show.genre);
  const marker = state.markers[show.id];
  if (marker && state.map) {
    state.map.setView([show.lat, show.lng], 16, { animate: true });
    marker.openPopup();
  }
  document.getElementById("map").scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------- Discovery journey ---------- */
function exploreGenre(genre) {
  if (!genre) return;
  const before = state.exploredGenres.size;
  state.exploredGenres.add(genre);
  if (state.exploredGenres.size !== before) updateJourney();
}

function updateJourney() {
  // Start at the mockup's baseline of 6, plus any genres explored this session
  const explored = Math.min(TOTAL_CATEGORIES, 6 + state.exploredGenres.size);
  const pct = Math.round((explored / TOTAL_CATEGORIES) * 100);

  const bar = document.getElementById("progressBar");
  const badge = document.getElementById("journeyBadge");
  const hint = document.getElementById("journeyHint");
  const wrapper = document.querySelector(".progress");

  if (bar) bar.style.width = pct + "%";
  if (badge) badge.textContent = `${explored}/${TOTAL_CATEGORIES} categories explored`;
  if (wrapper) wrapper.setAttribute("aria-valuenow", String(explored));

  if (hint) {
    hint.textContent =
      explored >= TOTAL_CATEGORIES
        ? "🎉 All categories explored — your free venue drink voucher is unlocked!"
        : "Try a Dance show to unlock a free venue drink voucher!";
  }
}

/* ---------- Editable constraint cards ---------- */
function wireCardEditing() {
  document.querySelectorAll(".card-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".card");
      const valueEl = card.querySelector(".card-value");
      const label = card.querySelector(".card-label").textContent.trim();
      const next = window.prompt(`Edit “${label}”`, valueEl.textContent.trim());
      if (next && next.trim()) valueEl.textContent = next.trim();
    });
  });
}

/* ---------- utils ---------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
