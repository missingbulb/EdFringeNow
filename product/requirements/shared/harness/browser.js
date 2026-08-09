// The requirements harness's browser: pinned Playwright Chromium, a hermetic
// fake origin served from disk, and every nondeterministic input replaced —
// clock, location, randomness, network (fonts, Leaflet, map tiles, geocoding,
// live data). Every UI case (screen and behavior kinds alike) gets its page
// from here, so "deterministic" is decided once, not per case.
//
// The page is served from a FAKE origin (http://edfringenow.req/), fulfilled
// entirely from the repo working tree + committed fixtures via route
// interception — no HTTP server process, no port, nothing off-disk. Any request
// the routing table doesn't recognise is aborted, so a new external dependency
// in the product breaks the suite loudly instead of adding hidden network.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..");
const VENDOR_DIR = path.join(__dirname, "vendor");
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");
const { REFERENCE_NOW_UTC_MS, TIMEZONE, LOCALE, GEOLOCATION } = require("../reference-now");

// Rendering is only comparable against the committed goldens when the exact
// same Chromium rasterises it. This is the Playwright whose vendored browser
// the goldens were rendered with; the runner refuses to compare with any other.
const PINNED_PLAYWRIGHT = "1.56.1";

// https, not http: geolocation only exists on secure origins. Routes are
// fulfilled before any real connection, so no certificate is involved.
const ORIGIN = "https://edfringenow.req";

// The two committed viewports. A case says `viewport: "desktop"`; everything
// else about the screen (DPR 1, no touch) is fixed here.
const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  desktop: { width: 1280, height: 900 },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// Playwright resolves differently per environment: CI installs it into
// node_modules (a plain import), the Claude sandbox ships it globally beside a
// pre-provisioned browser. Try the local install first, then the global build
// by its ESM entry (the CJS index.js yields undefined named exports).
async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    /* no local install — fall through to the global build */
  }
  const guesses = ["/opt/node22/lib/node_modules/playwright/index.mjs"];
  try {
    guesses.push(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright", "index.mjs"));
  } catch {
    /* npm unavailable — the hardcoded guess still stands */
  }
  for (const g of guesses) {
    if (fs.existsSync(g)) return import(pathToFileURL(g).href);
  }
  throw new Error(
    "Playwright not found. Install the pinned version locally: npm i --no-save playwright@" +
      PINNED_PLAYWRIGHT +
      " && npx playwright install chromium"
  );
}

function playwrightVersion() {
  const candidates = [
    path.join(REPO_ROOT, "node_modules", "playwright", "package.json"),
    "/opt/node22/lib/node_modules/playwright/package.json",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, "utf8")).version;
  }
  return null;
}

// Deterministic Math.random for the page: mulberry32, fixed seed. Runs before
// any page script.
const SEEDED_RANDOM = `
  (() => {
    let s = 0xedf12026;
    Math.random = function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
`;

// Freeze every visual in flight: CSS animations/transitions land on their end
// state, the text caret never blinks, smooth scrolling is instant. Injected at
// document start so nothing renders un-frozen.
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

function fulfillFile(route, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase();
  return route.fulfill({
    status,
    contentType: MIME[ext] || "application/octet-stream",
    body: fs.readFileSync(filePath),
  });
}

// The routing table: URL → bytes, worked out once for the whole suite.
//   - our fake origin: fixtures override, then vendor, then the repo tree;
//   - Google Fonts CSS + unpkg Leaflet/markercluster: the committed vendor copies;
//   - OSM tiles: one committed fixture tile, whatever the coordinates;
//   - the geocoder: the committed fixture response (cases exercise "found");
//   - anything else: aborted.
async function routeAll(context, { dataDir, failData }) {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const { hostname, pathname } = url;

    // Simulated outage: a case may declare URL substrings that must fail, to
    // drive the product's error states (a dead geocoder, a failed catalogue).
    if (failData && failData.some((s) => url.href.includes(s))) {
      return route.abort("failed");
    }

    // Vendored assets, on ANY host: the fonts CSS is served from the Google
    // Fonts URL, so its url(/__vendor/…) references resolve against that host.
    if (pathname.startsWith("/__vendor/")) {
      const v = path.join(VENDOR_DIR, pathname.slice("/__vendor/".length).replace("fonts/", "fonts" + path.sep));
      if (fs.existsSync(v)) return fulfillFile(route, v);
      return route.abort();
    }

    if (`${url.protocol}//${hostname}` === ORIGIN) {
      const rel = decodeURIComponent(pathname.replace(/^\/+/, "")) || "index.html";
      const withIndex = rel.endsWith("/") || rel === "" ? `${rel}index.html` : rel;
      // The version the footer/debug pill shows must not drift with releases.
      // (Stored as .fixture so no stray package.json lands in the tree.)
      if (withIndex === "package.json") {
        return route.fulfill({
          contentType: MIME[".json"],
          body: fs.readFileSync(path.join(FIXTURES_DIR, "package.json.fixture")),
        });
      }
      // Live data is replaced wholesale by the committed fixture snapshot.
      if (withIndex.startsWith("data/")) {
        const fixture = path.join(dataDir, withIndex.slice("data/".length));
        if (fs.existsSync(fixture)) return fulfillFile(route, fixture);
        return route.fulfill({ status: 404, contentType: "text/plain", body: "no fixture" });
      }
      const onDisk = path.join(REPO_ROOT, withIndex);
      if (fs.existsSync(onDisk) && fs.statSync(onDisk).isFile()) return fulfillFile(route, onDisk);
      const asDir = path.join(REPO_ROOT, withIndex, "index.html");
      if (fs.existsSync(asDir)) return fulfillFile(route, asDir);
      return route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
    }

    if (hostname === "fonts.googleapis.com") {
      return fulfillFile(route, path.join(VENDOR_DIR, "fonts", "fonts.css"));
    }
    if (hostname === "unpkg.com") {
      if (pathname.includes("/dist/images/")) {
        const img = path.join(VENDOR_DIR, "leaflet", "images", path.basename(pathname));
        if (fs.existsSync(img)) return fulfillFile(route, img);
      }
      const known = {
        "leaflet.css": "leaflet.css",
        "leaflet.js": "leaflet.js",
        "MarkerCluster.css": "MarkerCluster.css",
        "leaflet.markercluster.js": "leaflet.markercluster.js",
      }[path.basename(pathname)];
      if (known) return fulfillFile(route, path.join(VENDOR_DIR, "leaflet", known));
      return route.abort();
    }
    if (hostname.endsWith("tile.openstreetmap.org")) {
      return fulfillFile(route, path.join(FIXTURES_DIR, "tile.png"));
    }
    if (hostname === "photon.komoot.io" || hostname === "nominatim.openstreetmap.org") {
      return fulfillFile(route, path.join(FIXTURES_DIR, "geocode.json"));
    }
    return route.abort();
  });
}

let browserPromise = null;

async function launchBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const version = playwrightVersion();
      if (version && version !== PINNED_PLAYWRIGHT) {
        throw new Error(
          `Playwright ${version} found, but the goldens are rendered with ${PINNED_PLAYWRIGHT}. ` +
            "Rendering with a different Chromium makes every pixel comparison meaningless — install the pinned version."
        );
      }
      const { chromium } = await loadPlaywright();
      return chromium.launch({
        args: [
          "--font-render-hinting=none",
          "--force-color-profile=srgb",
          "--disable-lcd-text",
          "--hide-scrollbars",
          // Shadow/blur rasterisation varies run-to-run without these: partial
          // raster reuses tiles whose seams land in blur corners.
          "--disable-partial-raster",
          "--disable-skia-runtime-opts",
          "--disable-gpu",
        ],
      });
    })();
  }
  return browserPromise;
}

async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise;
    await b.close();
    browserPromise = null;
  }
}

/**
 * A fresh, fully-faked page for one case.
 * opts:
 *   viewport   "mobile" (default) | "desktop"
 *   dataDir    fixture data root (defaults to the committed snapshot)
 *   geolocation  override the fixed fake location, or null for "denied"
 *   localStorage {key: value} seeded on the fake origin before any page script
 *   nowUtcMs   override the pinned instant (rarely; the reference time is shared)
 */
async function newPage(opts = {}) {
  const browser = await launchBrowser();
  const geolocation = opts.geolocation === undefined ? GEOLOCATION : opts.geolocation;
  const context = await browser.newContext({
    viewport: VIEWPORTS[opts.viewport || "mobile"],
    deviceScaleFactor: 1,
    locale: LOCALE,
    timezoneId: TIMEZONE,
    ...(geolocation
      ? { geolocation, permissions: ["geolocation"] }
      : { permissions: [] }),
  });
  await routeAll(context, {
    dataDir: opts.dataDir || path.join(FIXTURES_DIR, "data"),
    failData: opts.failData,
  });

  const page = await context.newPage();
  await page.clock.setFixedTime(opts.nowUtcMs || REFERENCE_NOW_UTC_MS);
  await page.addInitScript(SEEDED_RANDOM);
  // The CSS freeze can't stop Web Animations API animations (the planner's
  // FLIP board diff) — stub element.animate so every WAAPI animation lands on
  // its end state instantly.
  await page.addInitScript(`
    Element.prototype.animate = function () {
      const anim = {
        finished: Promise.resolve(),
        onfinish: null,
        cancel() {}, finish() {}, play() {}, pause() {}, reverse() {},
        addEventListener(type, fn) { if (type === "finish") setTimeout(fn, 0); },
        removeEventListener() {},
      };
      setTimeout(() => { if (typeof anim.onfinish === "function") anim.onfinish(); }, 0);
      return anim;
    };
  `);
  await page.addInitScript(
    `document.addEventListener("DOMContentLoaded", () => {
       const s = document.createElement("style");
       s.textContent = ${JSON.stringify(FREEZE_CSS)};
       document.head.appendChild(s);
     });`
  );
  if (opts.localStorage) {
    await page.addInitScript(
      `for (const [k, v] of Object.entries(${JSON.stringify(opts.localStorage)})) localStorage.setItem(k, v);`
    );
  }
  return { page, context, origin: ORIGIN };
}

module.exports = { newPage, closeBrowser, launchBrowser, ORIGIN, VIEWPORTS, PINNED_PLAYWRIGHT };
