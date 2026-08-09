// Capture tools for screen cases: a golden should show the smallest surface
// that proves its requirement — an element, a clipped region, or a small
// composite — never the whole page. render-case.js hands these to a case's
// `capture(page, tools)`; the same tools serve the runner and the refresh
// lane, so a golden can't be produced one way and checked another.
"use strict";

const { decode, encode, encodeAnimated } = require("./png");

const SHOT_OPTS = { animations: "disabled" };

// The neutral ground behind a stitch seam and behind animation padding.
const GAP_RGB = [226, 228, 233];

// Bounding box of the first match, in DOCUMENT coordinates.
//
// boundingBox() answers in viewport coordinates, which go stale the moment
// anything scrolls — and Playwright scrolls an element into view before
// clicking it, so a rect measured before a click means something else after
// one. Converting here, once, at the moment of measurement, makes every rect
// in this module document-space and immune to later scrolling.
async function rectOf(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) throw new Error(`no visible element for ${selector}`);
  const { sx, sy } = await page.evaluate(() => ({ sx: window.scrollX, sy: window.scrollY }));
  return { x: box.x + sx, y: box.y + sy, width: box.width, height: box.height };
}

function union(rects) {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.width));
  const y1 = Math.max(...rects.map((r) => r.y + r.height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// Pad a rect a little so borders/shadows aren't shaved mid-pixel.
function pad(rect, px = 6) {
  return { x: Math.max(0, rect.x - px), y: Math.max(0, rect.y - px), width: rect.width + 2 * px, height: rect.height + 2 * px };
}

// Pad a document-space rect a whisker (so shadows and descenders aren't
// shaved) and clamp it to the page's bounds — a clip outside the rendered
// image is an error, not a crop.
async function padToPage(page, rect, px = 6) {
  const m = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  // Whole pixels: a layout rect is fractional, and letting a fractional clip
  // reach the screenshot leaves the rounding to the renderer — where a
  // half-pixel either way is a different image.
  const x = Math.max(0, Math.floor(rect.x - px));
  const y = Math.max(0, Math.floor(rect.y - px));
  return {
    x,
    y,
    width: Math.min(m.w, Math.ceil(rect.x + rect.width + px)) - x,
    height: Math.min(m.h, Math.ceil(rect.y + rect.height + px)) - y,
  };
}

function makeTools(page) {
  // fullPage so a clip below the fold is still inside the rendered image;
  // padToPage converts the boundingBox rect into document space.
  const clip = async (rect) => page.screenshot({ clip: await padToPage(page, rect, 0), fullPage: true, ...SHOT_OPTS });
  return {
    rectOf: (sel) => rectOf(page, sel),
    union,
    pad,
    clip,
    async element(sel) {
      return clip(await padToPage(page, await rectOf(page, sel)));
    },
    // The union of several elements' boxes, as one clip.
    async unionClip(selectors, padding = 6) {
      const rects = [];
      for (const s of selectors) rects.push(await rectOf(page, s));
      return clip(pad(union(rects), padding));
    },
    stitchV: (buffers, gap = 10) => stitch(buffers, "v", gap),
    stitchH: (buffers, gap = 10) => stitch(buffers, "h", gap),
    animate,
  };
}

// How long each frame of a flow is held, in milliseconds. Long enough to read
// the state before it changes; the last frame holds longer so the loop doesn't
// snap back the instant the story lands.
const FRAME_HOLD_MS = 1400;
const LAST_FRAME_HOLD_MS = 2200;

/**
 * Compose captured frames into one animated golden (APNG — see png.js for why
 * not GIF). Frames of differing sizes are padded to the largest, top-left, on
 * the same neutral ground the stitches use, so a region that grows or shrinks
 * between frames still animates in place instead of jumping scale.
 */
function animate(buffers, { holdMs = FRAME_HOLD_MS, lastHoldMs = LAST_FRAME_HOLD_MS } = {}) {
  const images = buffers.map((b) => decode(b));
  const width = Math.max(...images.map((i) => i.width));
  const height = Math.max(...images.map((i) => i.height));
  const frames = images.map((img, i) => {
    const rgba = Buffer.alloc(width * height * 4);
    for (let p = 0; p < width * height; p++) {
      const o = p * 4;
      rgba[o] = GAP_RGB[0];
      rgba[o + 1] = GAP_RGB[1];
      rgba[o + 2] = GAP_RGB[2];
      rgba[o + 3] = 255;
    }
    for (let y = 0; y < img.height; y++) {
      img.rgba.copy(rgba, (y * width) * 4, y * img.width * 4, (y + 1) * img.width * 4);
    }
    return { rgba, holdMs: i === images.length - 1 ? lastHoldMs : holdMs };
  });
  return encodeAnimated(frames, { width, height });
}

// Compose crops into one golden, on a neutral gap so the seams are visible.
function stitch(buffers, direction, gap) {
  const images = buffers.map((b) => decode(b));
  let width, height;
  if (direction === "v") {
    width = Math.max(...images.map((i) => i.width));
    height = images.reduce((a, i) => a + i.height, 0) + gap * (images.length - 1);
  } else {
    width = images.reduce((a, i) => a + i.width, 0) + gap * (images.length - 1);
    height = Math.max(...images.map((i) => i.height));
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = GAP_RGB[0];
    rgba[i + 1] = GAP_RGB[1];
    rgba[i + 2] = GAP_RGB[2];
    rgba[i + 3] = 255;
  }
  let ox = 0, oy = 0;
  for (const img of images) {
    for (let y = 0; y < img.height; y++) {
      const src = y * img.width * 4;
      const dst = ((oy + y) * width + ox) * 4;
      img.rgba.copy(rgba, dst, src, src + img.width * 4);
    }
    if (direction === "v") oy += img.height + gap;
    else ox += img.width + gap;
  }
  return encode({ width, height, rgba });
}

module.exports = { makeTools, padToPage };
