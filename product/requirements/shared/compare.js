// The pixel comparator: a rendered actual against its committed golden, at
// ZERO tolerated difference. The harness pins every nondeterministic input, so
// any differing pixel is a real change to the product's surface — if rendering
// ever proves unstable, the fix is more determinism (fonts, clock, fakes),
// never a threshold.
"use strict";

const fs = require("node:fs");
const { decode, encode, isAnimated } = require("./png");
const { artifactPath } = require("./artifacts-dir");

/**
 * Compare a freshly rendered PNG buffer to the committed golden at
 * `expectedPath`. On any difference, writes `<name>.actual.png` and (when
 * dimensions allow) `<name>.diff.png` into the artifacts dir and returns a
 * failure description; returns { ok: true } on an exact match.
 */
function compareToGolden(name, actualBuffer, expectedPath) {
  if (!fs.existsSync(expectedPath)) {
    const actualPath = artifactPath(`${name}.actual.png`);
    fs.writeFileSync(actualPath, actualBuffer);
    return {
      ok: false,
      reason: `no committed golden at ${expectedPath} — proposed render written to ${actualPath}; ` +
        "a new golden is owner-approved via the refresh lane, never silently adopted",
    };
  }

  const expectedBuffer = fs.readFileSync(expectedPath);
  if (expectedBuffer.equals(actualBuffer)) return { ok: true };

  // An animated golden is compared on byte-identity alone: the pixel differ
  // reads a single still image, so diffing one frame of a flow would describe
  // the wrong thing. Both files are written for the owner to play side by side.
  if (isAnimated(actualBuffer) || isAnimated(expectedBuffer)) {
    const actualPath = artifactPath(`${name}.actual.png`);
    fs.writeFileSync(actualPath, actualBuffer);
    return {
      ok: false,
      reason:
        `${name}: the animated golden changed (${expectedBuffer.length} bytes committed, ` +
        `${actualBuffer.length} rendered). Play ${actualPath} against ${expectedPath}. ` +
        "If the change is intended, the re-baselining procedure applies: surface both to " +
        "the owner and refresh only on approval.",
    };
  }

  // Byte-different: decode and diff pixel-by-pixel so the artifact shows where.
  const actual = decode(actualBuffer);
  const expected = decode(expectedBuffer);
  const actualPath = artifactPath(`${name}.actual.png`);
  fs.writeFileSync(actualPath, actualBuffer);

  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      ok: false,
      reason:
        `${name}: size changed — expected ${expected.width}x${expected.height}, ` +
        `got ${actual.width}x${actual.height}. Actual at ${actualPath}.`,
    };
  }

  // Identical pixels encoded differently still count as a pass — the assertion
  // is about the rendered surface, not the encoder's filter choices.
  const { width, height } = actual;
  const diff = Buffer.alloc(width * height * 4);
  let diffPixels = 0;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const same =
      actual.rgba[o] === expected.rgba[o] &&
      actual.rgba[o + 1] === expected.rgba[o + 1] &&
      actual.rgba[o + 2] === expected.rgba[o + 2] &&
      actual.rgba[o + 3] === expected.rgba[o + 3];
    if (same) {
      // Faded expected pixel as context.
      diff[o] = 255 - ((255 - expected.rgba[o]) >> 2);
      diff[o + 1] = 255 - ((255 - expected.rgba[o + 1]) >> 2);
      diff[o + 2] = 255 - ((255 - expected.rgba[o + 2]) >> 2);
      diff[o + 3] = 255;
    } else {
      diffPixels++;
      diff[o] = 255;
      diff[o + 1] = 0;
      diff[o + 2] = 0;
      diff[o + 3] = 255;
    }
  }
  if (diffPixels === 0) return { ok: true };

  const diffPath = artifactPath(`${name}.diff.png`);
  fs.writeFileSync(diffPath, encode({ width, height, rgba: diff }));
  return {
    ok: false,
    reason:
      `${name}: ${diffPixels} of ${width * height} pixels differ ` +
      `(${((diffPixels / (width * height)) * 100).toFixed(2)}%). ` +
      `See ${actualPath} and ${diffPath}. If the change is intended, the re-baselining ` +
      "procedure applies: surface actual/expected/diff to the owner and refresh only on approval.",
  };
}

module.exports = { compareToGolden };
