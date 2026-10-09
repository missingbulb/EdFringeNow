/* The arithmetic of the year's globe: an orthographic view of the earth
 * turned to face a point, and the spin a flick leaves it with.
 *
 * A view is { lng, lat }, the point at the globe's centre, in degrees; a
 * point on screen is relative to the globe's centre, y growing downwards, in
 * units of the globe's radius.
 *
 * Pure: no DOM, no clock.
 */

const RAD = Math.PI / 180;

/** Where a place lands: its screen point, and whether it faces the reader. */
export function project(view, lng, lat) {
  const phi = lat * RAD;
  const phi0 = view.lat * RAD;
  const dl = (lng - view.lng) * RAD;
  const cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(dl);
  const y = -(Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * cosPhi * Math.cos(dl));
  const facing = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * cosPhi * Math.cos(dl) >= 0;
  return { x, y, facing };
}

/** The place under a screen point, or null off the globe. */
export function invert(view, x, y) {
  const rho = Math.hypot(x, y);
  if (rho > 1) return null;
  if (rho === 0) return { lng: view.lng, lat: view.lat };
  const c = Math.asin(rho);
  const phi0 = view.lat * RAD;
  const up = -y;
  const lat = Math.asin(Math.cos(c) * Math.sin(phi0) + (up * Math.sin(c) * Math.cos(phi0)) / rho) / RAD;
  const lng =
    view.lng + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(phi0) - up * Math.sin(c) * Math.sin(phi0)) / RAD;
  return { lng: wrapLng(lng), lat };
}

export function wrapLng(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

const MAX_TILT = 80;

/** The view after the surface is dragged by (dx, dy), in radii: the surface
 * follows the pointer, and the globe never tips past its poles. */
export function dragged(view, dx, dy) {
  return {
    lng: wrapLng(view.lng - dx / RAD),
    lat: Math.max(-MAX_TILT, Math.min(MAX_TILT, view.lat + dy / RAD)),
  };
}

/* A flick's spin loses this share of its speed every millisecond, so it
 * glides for a second or two; below the floor it has stopped. */
const DRAG_PER_MS = 0.0025;
const STOP_BELOW = 0.002;

/** The spin, in degrees per millisecond, after `ms` more of gliding, or
 * null once it has stopped. */
export function glide(spin, ms) {
  const keep = Math.exp(-DRAG_PER_MS * ms);
  const next = { lng: spin.lng * keep, lat: spin.lat * keep };
  return Math.hypot(next.lng, next.lat) < STOP_BELOW ? null : next;
}

/** The view after gliding for `ms` at a spin. */
export function spun(view, spin, ms) {
  return {
    lng: wrapLng(view.lng + spin.lng * ms),
    lat: Math.max(-MAX_TILT, Math.min(MAX_TILT, view.lat + spin.lat * ms)),
  };
}

/** Whether a place lies inside a ring of [lng, lat] pairs, flattened. */
export function inRing(ring, lng, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const xi = ring[i];
    const yi = ring[i + 1];
    const xj = ring[j];
    const yj = ring[j + 1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The point a set of places is best seen from: their mean direction. */
export function centreOf(points) {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    const phi = p.lat * RAD;
    const lambda = p.lng * RAD;
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  }
  if (!x && !y && !z) return { lng: 0, lat: 0 };
  return { lng: Math.atan2(y, x) / RAD, lat: Math.atan2(z, Math.hypot(x, y)) / RAD };
}

/** The view part of the way from one to another, the short way round. */
export function between(from, to, share) {
  const dl = wrapLng(to.lng - from.lng);
  return { lng: wrapLng(from.lng + dl * share), lat: from.lat + (to.lat - from.lat) * share };
}
