import { test } from "node:test";
import assert from "node:assert/strict";

import { project, invert, dragged, glide, spun, inRing, centreOf, between } from "../globe.js";

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

test("the point the globe faces is drawn at its centre, and the far side faces away", () => {
  const view = { lng: 35, lat: 31 };
  const c = project(view, 35, 31);
  near(c.x, 0, "x");
  near(c.y, 0, "y");
  assert.equal(c.facing, true);
  assert.equal(project(view, -145, -31).facing, false);
});

test("north is up and east is right", () => {
  const view = { lng: 0, lat: 0 };
  assert.ok(project(view, 0, 10).y < 0);
  assert.ok(project(view, 10, 0).x > 0);
});

test("inverting a projected place gives the place back", () => {
  const view = { lng: -3, lat: 50 };
  for (const [lng, lat] of [[-3.2, 55.9], [35.2, 31.8], [-40, 20], [10, 80]]) {
    const p = project(view, lng, lat);
    const back = invert(view, p.x, p.y);
    near(back.lng, lng, "lng");
    near(back.lat, lat, "lat");
  }
  assert.equal(invert(view, 0.9, 0.9), null);
});

test("dragging moves the surface with the pointer and never past a pole", () => {
  const view = { lng: 0, lat: 0 };
  const right = dragged(view, 0.1, 0);
  assert.ok(project(right, 0, 0).x > 0, "dragged right, what was at the centre moved right");
  const down = dragged(view, 0, 0.1);
  assert.ok(project(down, 0, 0).y > 0, "dragged down, it moved down");
  assert.equal(dragged(view, 0, 100).lat, 80);
});

test("a flick glides, slowing, and stops", () => {
  let spin = { lng: 0.3, lat: 0 };
  let view = { lng: 0, lat: 0 };
  let frames = 0;
  let last = Infinity;
  while (spin) {
    view = spun(view, spin, 16);
    assert.ok(spin.lng < last, "slows every frame");
    last = spin.lng;
    spin = glide(spin, 16);
    frames++;
  }
  assert.ok(frames > 30 && frames < 400, `stopped after ${frames} frames`);
  assert.notEqual(view.lng, 0);
});

test("a ring holds the places inside it", () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10, 0, 0];
  assert.equal(inRing(square, 5, 5), true);
  assert.equal(inRing(square, 15, 5), false);
});

test("the centre of places, and the short way between two views", () => {
  const c = centreOf([{ lng: 170, lat: 0 }, { lng: -170, lat: 0 }]);
  near(Math.abs(c.lng), 180, "across the antimeridian");
  near(Math.abs(between({ lng: 170, lat: 0 }, { lng: -170, lat: 10 }, 0.5).lng), 180, "half way the short way");
});
