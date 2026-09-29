/* The globe beside the year: the earth on a canvas, the countries that hold a
 * festival lit and each festival's city marked, turned by dragging and left
 * spinning by a flick (23.28). Choosing a lit country or a mark hands its code
 * to `onPick` (23.29); the page decides what that means and tells the globe
 * which country is chosen.
 *
 * The canvas is drawn for the eye only: the place menu under it is the
 * accessible way to choose a place.
 */

import { project, invert, dragged, glide, spun, inRing, centreOf, between } from "./lib/globe.js";

const LAND_URL = new URL("./globe/land.json", import.meta.url);
/* A press that moves less than this, in CSS pixels, is a click. */
const CLICK_SLOP = 4;
/* How far from a mark, in CSS pixels, a click still lands on it. */
const MARK_REACH = 8;
/* How much of the drag's end is read for the speed of the flick. */
const FLICK_WINDOW_MS = 80;
const TURN_MS = 600;

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
const TOKENS = ["--globe-sea", "--globe-sea-deep", "--globe-land", "--globe-lit", "--globe-picked", "--globe-line", "--globe-edge"];
function readColours(el) {
  const probe = document.createElement("span");
  probe.hidden = true;
  el.parentNode.appendChild(probe);
  const out = {};
  for (const token of TOKENS) {
    probe.style.color = `var(${token})`;
    out[token.slice(8)] = getComputedStyle(probe).color;
  }
  probe.remove();
  return out;
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{onPick: (country: string) => void}} options
 */
export function createGlobe(canvas, { onPick }) {
  let land = null;
  let view = null;
  let lit = new Set();
  let marks = [];
  let picked = "";
  let hover = "";
  let spin = null;
  let turn = null;
  let frame = 0;
  let press = null;

  const size = () => canvas.clientWidth || canvas.width;

  function draw() {
    frame = 0;
    if (!land || !view) return;
    const css = size();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    const ctx = canvas.getContext("2d");
    const colour = readColours(canvas);
    const r = css / 2 - 2;
    const cx = css / 2;
    const cy = css / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, css, css);

    const sea = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    sea.addColorStop(0, colour.sea);
    sea.addColorStop(1, colour["sea-deep"]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = sea;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // The graticule: every thirty degrees, only the side that faces us.
    ctx.beginPath();
    const line = (points) => {
      let open = false;
      for (const [lng, lat] of points) {
        const p = project(view, lng, lat);
        if (!p.facing) {
          open = false;
          continue;
        }
        const x = cx + p.x * r;
        const y = cy + p.y * r;
        if (open) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
        open = true;
      }
    };
    for (let lng = -180; lng < 180; lng += 30) line(Array.from({ length: 37 }, (_, i) => [lng, -90 + i * 5]));
    for (let lat = -60; lat <= 60; lat += 30) line(Array.from({ length: 73 }, (_, i) => [-180 + i * 5, lat]));
    ctx.strokeStyle = colour.line;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // A ring's far side is pressed onto the rim, so a country part-way round
    // still closes along the edge of the globe.
    const ring = (flat) => {
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
        pts.push(cx + x * r, cy + y * r);
      }
      if (!any) return;
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
    };
    const fillCountries = (codes, fill, stroke) => {
      ctx.beginPath();
      for (const code of codes) for (const rg of land[code] || []) ring(rg);
      ctx.fillStyle = fill;
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    };
    fillCountries(
      Object.keys(land).filter((c) => !lit.has(c)),
      colour.land,
      null
    );
    fillCountries([...lit].filter((c) => c !== picked), colour.lit, colour.edge);
    if (hover && hover !== picked) {
      ctx.globalAlpha = 0.35;
      fillCountries([hover], colour.picked, null);
      ctx.globalAlpha = 1;
    }
    if (picked && lit.has(picked)) fillCountries([picked], colour.picked, colour.edge);

    for (const m of marks) {
      const p = project(view, m.lng, m.lat);
      if (!p.facing) continue;
      const big = m.country === picked;
      ctx.beginPath();
      ctx.arc(cx + p.x * r, cy + p.y * r, big ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = big ? colour.picked : colour.lit;
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = colour.edge;
      ctx.stroke();
    }
    ctx.restore();

    // Light from the upper left, and a rim, so the disc reads as a ball.
    const shade = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r * 1.02);
    shade.addColorStop(0, "rgba(255,255,255,0.28)");
    shade.addColorStop(0.55, "rgba(255,255,255,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colour.edge;
    ctx.stroke();

    canvas.dataset.view = `${view.lng.toFixed(1)},${view.lat.toFixed(1)}`;
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
      const eased = 1 - Math.pow(1 - share, 3);
      view = between(turn.from, turn.to, eased);
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

  function turnTo(target) {
    spin = null;
    if (!view || reducedMotion()) {
      view = { ...target };
      turn = null;
      redraw();
      return;
    }
    turn = { from: view, to: target, start: performance.now() };
    animate();
  }

  // What a point on the canvas lands on: a mark, else a lit country, else "".
  function hitAt(event) {
    if (!view || !land) return "";
    const rect = canvas.getBoundingClientRect();
    const r = rect.width / 2 - 2;
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    let best = null;
    for (const m of marks) {
      const p = project(view, m.lng, m.lat);
      if (!p.facing) continue;
      const d = Math.hypot(p.x * r - x, p.y * r - y);
      if (d <= MARK_REACH && (!best || d < best.d)) best = { d, country: m.country };
    }
    if (best) return best.country;
    const at = invert(view, x / r, y / r);
    if (!at) return "";
    for (const code of lit) {
      if ((land[code] || []).some((rg) => inRing(rg, at.lng, at.lat))) return code;
    }
    return "";
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !view) return;
    canvas.setPointerCapture(e.pointerId);
    spin = null;
    turn = null;
    press = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false, trail: [{ t: e.timeStamp, view }] };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!press) {
      const code = hitAt(e);
      if (code !== hover) {
        hover = code;
        canvas.style.cursor = code ? "pointer" : "grab";
        redraw();
      }
      return;
    }
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < CLICK_SLOP) return;
    press.moved = true;
    canvas.style.cursor = "grabbing";
    const r = canvas.clientWidth / 2 - 2;
    view = dragged(view, (e.clientX - press.lastX) / r, (e.clientY - press.lastY) / r);
    press.lastX = e.clientX;
    press.lastY = e.clientY;
    press.trail.push({ t: e.timeStamp, view });
    while (press.trail.length > 2 && e.timeStamp - press.trail[0].t > FLICK_WINDOW_MS) press.trail.shift();
    redraw();
  });
  const release = (e, cancelled) => {
    if (!press) return;
    const { moved, trail } = press;
    press = null;
    canvas.style.cursor = hover ? "pointer" : "grab";
    if (cancelled) return;
    if (!moved) {
      const code = hitAt(e);
      if (code) onPick(code);
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
  canvas.addEventListener("pointerup", (e) => release(e, false));
  canvas.addEventListener("pointercancel", (e) => release(e, true));
  canvas.addEventListener("pointerleave", () => {
    if (press || !hover) return;
    hover = "";
    redraw();
  });
  new ResizeObserver(redraw).observe(canvas);
  // The theme's colours change under it.
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-genre"] });
  document.documentElement.addEventListener("transitionend", (e) => {
    if (e.target === document.documentElement) redraw();
  });

  loadLand()
    .then((l) => {
      land = l;
      redraw();
    })
    .catch(() => {
      canvas.hidden = true;
    });

  return {
    /**
     * @param {{lit: string[], marks: {lng: number, lat: number, country: string}[], picked: string, home: {lng: number, lat: number}|null}} next
     */
    set(next) {
      lit = new Set(next.lit);
      marks = next.marks;
      const was = picked;
      picked = next.picked;
      const pickedMarks = marks.filter((m) => m.country === picked);
      if (!view) {
        view = pickedMarks.length ? centreOf(pickedMarks) : next.home || centreOf(marks);
        redraw();
      } else if (picked && picked !== was && pickedMarks.length) {
        turnTo(centreOf(pickedMarks));
      } else redraw();
    },
  };
}
