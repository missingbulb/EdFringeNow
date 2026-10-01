/* The globe beside the year: a lens onto a flat, cut-paper earth, turned by
 * dragging and left spinning by a flick (23.29). Over it float badges, one per
 * place the page offers at the globe's level: areas at first, then an area's
 * countries, then a country's cities, each with its count of festivals.
 * Choosing a badge, or the lit land it stands for, hands its place to
 * `onPick` (23.30); the page decides what that means and tells the globe where
 * to look next, and the globe turns and zooms there.
 *
 * The badges are buttons, so the keyboard reaches them; the place menu under
 * the globe is the other accessible way to choose.
 */

import { project, invert, dragged, glide, spun, inRing, between } from "./lib/globe.js";

const LAND_URL = new URL("./globe/land.json", import.meta.url);
/* A press that moves less than this, in CSS pixels, is a click. */
const CLICK_SLOP = 4;
/* How much of the drag's end is read for the speed of the flick. */
const FLICK_WINDOW_MS = 80;
const TURN_MS = 620;
/* Room kept between two badges. */
const BADGE_GAP = 2;
/* How far a badge set beside its place stands off its pin. */
const PIN_GAP = 10;

let landPromise = null;
function loadLand() {
  landPromise ||= fetch(LAND_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`land ${r.status}`))))
    .then((doc) =>
      Object.fromEntries(Object.entries(doc.countries).map(([code, rings]) => [code, rings.map((r) => r.map((v) => v / 10))]))
    );
  return landPromise;
}

/* The colours are the page's tokens, resolved through a probe element because
 * a canvas cannot read `light-dark()` itself. */
const TOKENS = [
  "--globe-sea",
  "--globe-sea-deep",
  "--globe-dot",
  "--globe-land",
  "--globe-land-shadow",
  "--globe-lit",
  "--globe-picked",
  "--globe-line",
  "--globe-ring",
  "--globe-home",
  "--globe-home-ink",
];
function readColours(el) {
  const probe = document.createElement("span");
  probe.hidden = true;
  el.appendChild(probe);
  const out = {};
  for (const token of TOKENS) {
    probe.style.color = `var(${token})`;
    out[token.slice(8)] = canvasColour(getComputedStyle(probe).color);
  }
  probe.remove();
  return out;
}

/* A mixed colour resolves as `color(srgb r g b / a)`, which a canvas does not
 * take; it is handed over as the `rgb()` the canvas does. */
function canvasColour(css) {
  const m = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(css);
  if (!m) return css;
  const [r, g, b] = m.slice(1, 4).map((v) => Math.round(Number(v) * 255));
  return `rgba(${r}, ${g}, ${b}, ${m[4] ?? 1})`;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/* The mean of a country's largest ring: where its home sign stands. */
function middleOf(rings) {
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a), []);
  let lng = 0;
  let lat = 0;
  for (let i = 0; i < ring.length; i += 2) {
    lng += ring[i];
    lat += ring[i + 1];
  }
  const n = ring.length / 2 || 1;
  return { lng: lng / n, lat: lat / n };
}

/**
 * @param {HTMLElement} lens the round frame holding the canvas and the badges
 * @param {{onPick: (place: string) => void}} options
 */
export function createGlobe(lens, { onPick }) {
  const canvas = lens.querySelector("canvas");
  const layer = lens.querySelector(".tl-badges");
  let land = null;
  let view = null;
  let zoom = 1;
  let lit = new Set();
  let picked = new Set();
  let badges = [];
  let home = null;
  let homeCountry = null;
  let focusKey = "";
  let shownBadges = "";
  let spin = null;
  let turn = null;
  let frame = 0;
  let press = null;
  let colour = null;
  let colourOf = "";

  const size = () => canvas.clientWidth || canvas.width;
  const radius = () => size() / 2 - 3;

  function draw() {
    frame = 0;
    if (!land || !view) return;
    const css = size();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    // Drawn in software: the browser would otherwise move a canvas drawn
    // often onto the graphics card, whose edges come out a shade apart.
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    // The page's own colours, which every globe colour is made from: read
    // again only when they have moved.
    const style = getComputedStyle(lens);
    const palette = ["--violet", "--paper", "--ink"].map((token) => style.getPropertyValue(token)).join();
    if (palette !== colourOf) {
      colourOf = palette;
      colour = readColours(lens);
    }
    const r = radius();
    const R = r * zoom;
    const c = css / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.clip();

    // The sea, and over it a halftone that swells towards the far rim, so the
    // lens reads as a ball without pretending to be a photograph.
    const sea = ctx.createRadialGradient(c - r * 0.35, c - r * 0.4, r * 0.1, c, c, r * 1.05);
    sea.addColorStop(0, colour.sea);
    sea.addColorStop(1, colour["sea-deep"]);
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, css, css);
    ctx.fillStyle = colour.dot;
    const step = 6;
    for (let row = 0, y = step / 2; y < css; y += step, row++) {
      for (let x = row % 2 ? step / 2 : 0; x < css; x += step) {
        const d = Math.hypot(x - c + r * 0.4, y - c + r * 0.45) / (r * 1.6);
        const dot = Math.min(1, d) * 1.5;
        if (dot < 0.3) continue;
        ctx.beginPath();
        ctx.arc(x, y, dot, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // A few dotted lines of latitude and longitude, only on the near side.
    ctx.beginPath();
    const line = (points) => {
      let open = false;
      for (const [lng, lat] of points) {
        const p = project(view, lng, lat);
        if (!p.facing) {
          open = false;
          continue;
        }
        const x = c + p.x * R;
        const y = c + p.y * R;
        if (open) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        open = true;
      }
    };
    for (let lng = -180; lng < 180; lng += 30) line(Array.from({ length: 37 }, (_, i) => [lng, -90 + i * 5]));
    for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
    ctx.strokeStyle = colour.line;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // A ring's far side is pressed onto the limb, so a country part-way round
    // still closes along the edge of the globe.
    const outline = (codes) => {
      const path = new Path2D();
      for (const code of codes) {
        for (const flat of land[code] || []) {
          const pts = [];
          let any = false;
          for (let i = 0; i < flat.length; i += 2) {
            const p = project(view, flat[i], flat[i + 1]);
            let { x, y } = p;
            if (p.facing) any = true;
            else {
              const len = Math.hypot(x, y) || 1;
              x /= len;
              y /= len;
            }
            pts.push(c + x * R, c + y * R);
          }
          if (!any) continue;
          path.moveTo(pts[0], pts[1]);
          for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
          path.closePath();
        }
      }
      return path;
    };
    // Cut paper: every land a flat sheet lifted off the sea by its shadow, the
    // festivals' countries in the page's own colour.
    const land$ = outline(Object.keys(land));
    ctx.save();
    ctx.translate(1, 1.8);
    ctx.fillStyle = colour["land-shadow"];
    ctx.fill(land$);
    ctx.restore();
    ctx.fillStyle = colour.land;
    ctx.fill(land$);
    ctx.fillStyle = colour.lit;
    ctx.fill(outline([...lit].filter((code) => !picked.has(code))));
    ctx.fillStyle = colour.picked;
    ctx.fill(outline([...picked]));

    if (home) {
      const p = project(view, home.lng, home.lat);
      if (p.facing) drawHome(ctx, c + p.x * R, c + p.y * R);
    }
    ctx.restore();

    // The lens: a light from the upper left, and its rim.
    const shine = ctx.createRadialGradient(c - r * 0.45, c - r * 0.5, r * 0.02, c - r * 0.2, c - r * 0.25, r * 0.9);
    shine.addColorStop(0, "rgba(255,255,255,0.45)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colour.ring;
    ctx.stroke();

    placeBadges(ctx, r, R, c);
    canvas.dataset.view = `${view.lng.toFixed(1)},${view.lat.toFixed(1)}`;
    canvas.dataset.zoom = zoom.toFixed(2);
  }

  // A little house where the reader lives, its door on the spot.
  function drawHome(ctx, x, y) {
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x - 5, y - 7);
    ctx.lineTo(x, y - 12);
    ctx.lineTo(x + 5, y - 7);
    ctx.lineTo(x + 5, y);
    ctx.closePath();
    ctx.fillStyle = colour.home;
    ctx.strokeStyle = colour["home-ink"];
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour["home-ink"];
    ctx.fillRect(x - 1.5, y - 4.5, 3, 4.5);
  }

  // Where a badge of a size may stand, nearest its place first: on it, then
  // slid along its own row, then in the rows above and below.
  function beside(w, h) {
    const row = h + BADGE_GAP;
    const out = [];
    for (let dy = -3; dy <= 3; dy++) {
      for (const dx of [0, w / 4, -w / 4, w / 2 + PIN_GAP, -(w / 2 + PIN_GAP)]) out.push([dx, dy * row]);
    }
    return out.sort((p, q) => Math.hypot(p[0] * 0.5, p[1]) - Math.hypot(q[0] * 0.5, q[1]));
  }

  // Each badge stands on its place where there is room, else beside it, the
  // way a map sets a name by its town, with a pin on the spot; one with no
  // room anywhere shrinks to its count, and one with none even then, or off
  // the near side, waits for the globe to turn.
  function placeBadges(ctx, r, R, c) {
    const placed = [];
    const pins = [];
    const inLens = (px, py) => Math.hypot(px - c, py - c) <= r - 2;
    // Measured afresh each time, since a font arriving late widens a name.
    for (const b of badges) {
      b.el.hidden = false;
      b.el.classList.remove("is-compact");
    }
    for (const b of badges) {
      b.w = b.el.offsetWidth;
      b.h = b.el.offsetHeight;
    }
    // The reader's house is never covered: badges make room for it.
    if (home) {
      const p = project(view, home.lng, home.lat);
      const x = c + p.x * R;
      const y = c + p.y * R;
      if (p.facing) placed.push({ l: x - 7, r: x + 7, t: y - 14, b: y + 2 });
    }
    for (const b of badges) {
      const p = project(view, b.lng, b.lat);
      const x = c + p.x * R;
      const y = c + p.y * R;
      let spot = null;
      let compact = false;
      if (p.facing && inLens(x, y)) {
        const room = (w, dx, dy) => {
          const box = { l: x + dx - w / 2, r: x + dx + w / 2, t: y + dy - b.h / 2, b: y + dy + b.h / 2 };
          const inset = b.h / 2;
          const inside = inLens(box.l + inset, box.t + 2) && inLens(box.r - inset, box.t + 2) && inLens(box.l + inset, box.b - 2) && inLens(box.r - inset, box.b - 2);
          const clear = !placed.some((o) => box.l < o.r + BADGE_GAP && box.r > o.l - BADGE_GAP && box.t < o.b + BADGE_GAP && box.b > o.t - BADGE_GAP);
          return inside && clear ? { box, dx, dy } : null;
        };
        const tryAll = (w) => {
          for (const [dx, dy] of beside(w, b.h)) {
            const fit = room(w, dx, dy);
            if (fit) return fit;
          }
          return null;
        };
        spot = tryAll(b.w);
        if (!spot) {
          compact = true;
          spot = tryAll(b.h);
        }
      }
      b.el.hidden = !spot;
      b.el.classList.toggle("is-compact", compact);
      if (!spot) continue;
      placed.push(spot.box);
      if (spot.dx || spot.dy) pins.push({ x, y, to: spot });
      b.el.style.transform = `translate(${(x + spot.dx).toFixed(1)}px, ${(y + spot.dy).toFixed(1)}px) translate(-50%, -50%)`;
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = colour.ring;
    for (const pin of pins) {
      const tx = Math.max(pin.to.box.l, Math.min(pin.x, pin.to.box.r));
      const ty = Math.max(pin.to.box.t, Math.min(pin.y, pin.to.box.b));
      ctx.beginPath();
      ctx.moveTo(pin.x, pin.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.fillStyle = colour.ring;
    for (const pin of pins) {
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colour.home;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  const redraw = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  let last = 0;
  function tick(now) {
    const ms = last ? Math.min(now - last, 50) : 16;
    last = now;
    if (turn) {
      const share = Math.min(1, (now - turn.start) / TURN_MS);
      const eased = share < 0.5 ? 4 * share ** 3 : 1 - (-2 * share + 2) ** 3 / 2;
      view = between(turn.from, turn.to, eased);
      zoom = turn.fromZoom * (turn.toZoom / turn.fromZoom) ** eased;
      if (share >= 1) turn = null;
    } else if (spin) {
      view = spun(view, spin, ms);
      spin = glide(spin, ms);
    }
    draw();
    if (turn || spin) requestAnimationFrame(tick);
    else {
      last = 0;
      delete canvas.dataset.moving;
    }
  }
  const animate = () => {
    const idle = !canvas.dataset.moving;
    canvas.dataset.moving = "1";
    if (idle) requestAnimationFrame(tick);
  };

  function turnTo(target, toZoom) {
    spin = null;
    if (!view || reducedMotion()) {
      view = { ...target };
      zoom = toZoom;
      turn = null;
      redraw();
      return;
    }
    turn = { from: view, to: target, fromZoom: zoom, toZoom, start: performance.now() };
    animate();
  }

  // The badge whose land lies under a point on the lens, or null.
  function landAt(event) {
    if (!view || !land) return null;
    const rect = canvas.getBoundingClientRect();
    const R = radius() * zoom;
    const spot = invert(view, (event.clientX - rect.left - rect.width / 2) / R, (event.clientY - rect.top - rect.height / 2) / R);
    if (!spot) return null;
    const code = [...lit].find((c) => (land[c] || []).some((rg) => inRing(rg, spot.lng, spot.lat)));
    return code ? badges.find((b) => b.countries.includes(code)) || null : null;
  }

  lens.addEventListener("pointerdown", (e) => {
    // The way back out is the page's own button, not a hold on the globe.
    if (e.button !== 0 || !view || !e.target.closest(".tl-badges, canvas")) return;
    lens.setPointerCapture(e.pointerId);
    spin = null;
    turn = null;
    const badge = e.target.closest(".tl-badge");
    press = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, badge, trail: [{ t: e.timeStamp, view }] };
  });
  lens.addEventListener("pointermove", (e) => {
    if (!press) {
      if (!e.target.closest(".tl-badge")) canvas.style.cursor = landAt(e) ? "pointer" : "grab";
      return;
    }
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < CLICK_SLOP) return;
    press.moved = true;
    lens.classList.add("is-dragging");
    const R = radius() * zoom;
    view = dragged(view, (e.clientX - press.lastX) / R, (e.clientY - press.lastY) / R);
    press.lastX = e.clientX;
    press.lastY = e.clientY;
    press.trail.push({ t: e.timeStamp, view });
    while (press.trail.length > 2 && e.timeStamp - press.trail[0].t > FLICK_WINDOW_MS) press.trail.shift();
    redraw();
  });
  const release = (e, cancelled) => {
    if (!press) return;
    const { moved, trail, badge } = press;
    press = null;
    lens.classList.remove("is-dragging");
    if (cancelled) return;
    if (!moved) {
      const place = badge ? badge.dataset.place : landAt(e)?.place;
      if (place) onPick(place);
      return;
    }
    const first = trail[0];
    const lastSample = trail[trail.length - 1];
    const ms = e.timeStamp - first.t;
    // A drag that rested before letting go leaves no spin.
    if (reducedMotion() || ms <= 0 || e.timeStamp - lastSample.t > FLICK_WINDOW_MS) return;
    const dl = ((((lastSample.view.lng - first.view.lng + 540) % 360) + 360) % 360) - 180;
    spin = glide({ lng: dl / ms, lat: (lastSample.view.lat - first.view.lat) / ms }, 0);
    if (spin) animate();
  };
  lens.addEventListener("pointerup", (e) => release(e, false));
  lens.addEventListener("pointercancel", (e) => release(e, true));
  // A pointer's click is read on its release above; a key's click lands here.
  layer.addEventListener("click", (e) => {
    const badge = e.target.closest(".tl-badge");
    if (badge && e.detail === 0) onPick(badge.dataset.place);
  });

  new ResizeObserver(redraw).observe(canvas);
  // The theme's colours change under it.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-genre"] });
  document.documentElement.addEventListener("transitionend", (e) => {
    if (e.target === document.documentElement) redraw();
  });

  const placeHome = () => {
    home = land && homeCountry && land[homeCountry] ? middleOf(land[homeCountry]) : null;
  };

  loadLand()
    .then((l) => {
      land = l;
      placeHome();
      redraw();
    })
    .catch(() => {
      lens.hidden = true;
    });

  function showBadges(list) {
    layer.innerHTML = list
      .map(
        (b) =>
          `<button type="button" class="tl-chip tl-badge${b.picked ? " is-picked" : ""}${b.count ? "" : " is-empty"}" data-place="${escapeHtml(b.place)}"` +
          ` aria-pressed="${b.picked}">` +
          `<span class="tl-badge-name"${b.slot ? ` data-i18n-slot="${b.slot}"` : ""}>${escapeHtml(b.text)}</span>` +
          `<span class="tl-badge-count">${b.count}</span></button>`
      )
      .join("");
    const els = [...layer.children];
    badges = list.map((b, i) => ({ ...b, el: els[i] }));
    // The picked badge, then the fuller ones, get the first room.
    badges.sort((a, b) => b.picked - a.picked || b.count - a.count);
  }

  return {
    /**
     * @param {object} next
     * @param {string[]} next.lit the countries holding a festival
     * @param {string[]} next.picked the countries the chosen place covers
     * @param {{place: string, text: string, slot: string|null, count: number, lng: number, lat: number, countries: string[], picked: boolean}[]} next.badges
     * @param {{lng: number, lat: number, zoom: number}|null} next.focus where to
     *   look, or null for the whole world, from wherever the globe is turned
     * @param {{lng: number, lat: number}} next.start where the whole world is
     *   first seen from
     * @param {string|null} next.home the reader's country
     */
    set(next) {
      lit = new Set(next.lit);
      picked = new Set(next.picked);
      homeCountry = next.home;
      placeHome();
      // The same badges again keep their buttons and sizes.
      const same = JSON.stringify(next.badges);
      if (same !== shownBadges) {
        shownBadges = same;
        showBadges(next.badges);
      }
      const { focus } = next;
      const key = focus ? `${focus.lng.toFixed(2)},${focus.lat.toFixed(2)},${focus.zoom.toFixed(2)}` : "";
      if (!view) {
        view = focus ? { lng: focus.lng, lat: focus.lat } : { ...next.start };
        zoom = focus ? focus.zoom : 1;
        focusKey = key;
        redraw();
      } else if (key !== focusKey) {
        focusKey = key;
        // Back out to the whole world, the globe stays turned where it was
        // going.
        const here = turn ? turn.to : view;
        turnTo(focus ? { lng: focus.lng, lat: focus.lat } : here, focus ? focus.zoom : 1);
      } else redraw();
    },
  };
}
