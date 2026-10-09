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
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

const REPO_ROOT = path.join(__dirname, "..", "..", "..", "..");
// The served tree. The fake origin's "/" is the published site's root, not the
// repo's — the repo around it holds the scraper, the mount and the tooling, none
// of which a page can reach in production either.
const SITE_ROOT = path.join(REPO_ROOT, "site");
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

// The released version is stamped into every published page, so the number the
// footer popup and the debug pill show would otherwise move on every release and
// take every golden with it. Serving the pages through here pins it: one
// substitution, applied to whatever the stamp currently says, so the goldens
// record the product rather than the day they were rendered.
const PINNED_VERSION = "0.0.0-spec";
const VERSION_STAMP = /title="version [^"]*"/g;

function fulfillPage(route, filePath) {
  if (!filePath.endsWith(".html")) return fulfillFile(route, filePath);
  const html = fs.readFileSync(filePath, "utf8").replace(VERSION_STAMP, `title="version ${PINNED_VERSION}"`);
  return route.fulfill({ status: 200, contentType: MIME[".html"], body: html });
}

// The hosts the frozen festival blocks name for their shows' pictures.
let imageHosts = null;
function showImageHosts() {
  if (imageHosts) return imageHosts;
  imageHosts = new Set();
  const root = path.join(FIXTURES_DIR, "data", "festivals");
  for (const festival of fs.readdirSync(root, { withFileTypes: true })) {
    if (!festival.isDirectory()) continue;
    for (const file of fs.readdirSync(path.join(root, festival.name))) {
      if (!file.endsWith(".json")) continue;
      const block = JSON.parse(fs.readFileSync(path.join(root, festival.name, file), "utf8"));
      for (const event of block.events || []) {
        if (event.imageUrl) imageHosts.add(new URL(event.imageUrl).hostname);
      }
    }
  }
  return imageHosts;
}

// The routing table: URL → bytes, worked out once for the whole suite.
//   - our fake origin: fixtures override, then vendor, then the repo tree;
//   - Google Fonts CSS + unpkg Leaflet/markercluster: the committed vendor copies;
//   - OSM tiles: one committed fixture tile, whatever the coordinates;
//   - the geocoder: the committed fixture response (cases exercise "found");
//   - a festival site's show picture: one committed stand-in image;
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
      // Live data is replaced wholesale by the committed fixture snapshot.
      if (withIndex.startsWith("data/")) {
        const fixture = path.join(dataDir, withIndex.slice("data/".length));
        if (fs.existsSync(fixture)) return fulfillFile(route, fixture);
        return route.fulfill({ status: 404, contentType: "text/plain", body: "no fixture" });
      }
      const onDisk = path.join(SITE_ROOT, withIndex);
      if (fs.existsSync(onDisk) && fs.statSync(onDisk).isFile()) return fulfillPage(route, onDisk);
      const asDir = path.join(SITE_ROOT, withIndex, "index.html");
      if (fs.existsSync(asDir)) return fulfillPage(route, asDir);
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
    // A show's picture from a festival's own site: one committed stand-in,
    // whatever the show. Edinburgh's image host is not among them, so the
    // Fringe pages keep drawing their cards without pictures.
    if (showImageHosts().has(hostname)) {
      return fulfillFile(route, path.join(FIXTURES_DIR, "show-image.png"));
    }
    return route.abort();
  });
}

// ------------------------------------------------------------- font jail --
// The web fonts are vendored, but they are not the only fonts on the page: any
// character they don't carry — an emoji, an arrow, a Cyrillic show title — is
// drawn by whatever the *machine* has installed. That made the goldens a
// record of the renderer's font set, and CI's set is not the sandbox's: the
// walk-time line ("🚶 5 min · £16") measured a different width there and
// wrapped, making every card one line taller.
//
// So the harness gives Chromium its own fontconfig world: a generated config
// whose only font directory is `vendor/systemfonts/`, with the generic
// families aliased into it. Nothing installed on the host can reach the page.
const SYSTEM_FONTS_DIR = path.join(VENDOR_DIR, "systemfonts");

function fontconfigFile() {
  const dir = path.join(os.tmpdir(), "edfringe-req-fontconfig");
  const cache = path.join(dir, "cache");
  fs.mkdirSync(cache, { recursive: true });
  const alias = (from, to) =>
    `  <alias binding="strong"><family>${from}</family><prefer><family>${to}</family></prefer></alias>`;
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${SYSTEM_FONTS_DIR}</dir>
  <cachedir>${cache}</cachedir>
${[
  alias("sans-serif", "DejaVu Sans"),
  alias("serif", "DejaVu Sans"),
  alias("monospace", "DejaVu Sans"),
  alias("system-ui", "DejaVu Sans"),
  alias("emoji", "Noto Color Emoji"),
  // The product's metric-matched fallback faces are `src: local("Arial")`.
  alias("Arial", "Liberation Sans"),
  alias("Helvetica", "Liberation Sans"),
].join("\n")}
</fontconfig>
`;
  const file = path.join(dir, "fonts.conf");
  fs.writeFileSync(file, conf);
  return file;
}

// A case that installs a winding clock has the frames themselves under its
// control: Playwright's clock fakes requestAnimationFrame along with the timers,
// so a frame-driven wait never resolves on such a page. Waits ask here rather
// than infer it from the clock's behaviour.
const pausedClockPages = new WeakSet();

function hasPausedClock(page) {
  return pausedClockPages.has(page);
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
        env: { ...process.env, FONTCONFIG_FILE: fontconfigFile() },
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
 *   colorScheme  the device's colour-scheme preference ("light" by default)
 *   timezone   override the device's IANA zone (defaults to TIMEZONE)
 *   localStorage {key: value} seeded on the fake origin before any page script
 *   nowUtcMs   override the pinned instant (rarely; the reference time is shared)
 *   advanceableClock  install a winding clock instead of a fixed one, for a
 *     case that proves something the passage of time is supposed to change
 *   failData   URL substrings whose requests must fail, to drive an error state
 */
async function newPage(opts = {}) {
  const browser = await launchBrowser();
  const geolocation = opts.geolocation === undefined ? GEOLOCATION : opts.geolocation;
  const context = await browser.newContext({
    viewport: VIEWPORTS[opts.viewport || "mobile"],
    deviceScaleFactor: 1,
    locale: LOCALE,
    // What the device asks for, which a page may follow and a reader may
    // override. Light unless a case says otherwise, so every existing golden
    // keeps the scheme it was rendered in.
    colorScheme: opts.colorScheme || "light",
    // The device's zone. Overridable so a case can prove the product reads
    // Edinburgh's clock rather than the device's — a context's zone is fixed at
    // creation, so showing two zones means two pages.
    timezoneId: opts.timezone || TIMEZONE,
    ...(geolocation
      ? { geolocation, permissions: ["geolocation"] }
      : { permissions: [] }),
  });
  await routeAll(context, {
    dataDir: opts.dataDir || path.join(FIXTURES_DIR, "data"),
    failData: opts.failData,
  });

  const page = await context.newPage();
  const now = opts.nowUtcMs || REFERENCE_NOW_UTC_MS;
  if (opts.advanceableClock) {
    // Time still stands still, but the page's timers exist and can be wound
    // forward deliberately (page.clock.fastForward) — how a case proves
    // something the passage of time is supposed to change.
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    pausedClockPages.add(page);
  } else {
    await page.clock.setFixedTime(now);
  }
  // A promise that rejects with nobody waiting fires no error event, so a
  // failure inside an async callback leaves no trace at all — and a case then
  // reports a page that never arrived, with nothing to say why. Route it to
  // the console, which the runner reads back on a failure.
  await page.addInitScript(`
    window.addEventListener("unhandledrejection", (e) => {
      console.error("unhandled rejection:", (e.reason && e.reason.stack) || String(e.reason));
    });
  `);
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
  // The CSS freeze sets `scroll-behavior: auto`, but a call that names
  // `behavior: "smooth"` itself outranks the stylesheet — so the product's own
  // smooth scrolls stayed animated, and a scroll in flight is invisible to a
  // wait that watches the DOM. Land every scroll instantly instead, the same
  // way element.animate is landed on its end state above.
  await page.addInitScript(`
    (() => {
      const instant = (options) =>
        options && typeof options === "object" ? { ...options, behavior: "auto" } : options;
      for (const target of [window, Element.prototype]) {
        for (const name of ["scroll", "scrollTo", "scrollIntoView", "scrollBy"]) {
          const original = target[name];
          if (typeof original !== "function") continue;
          target[name] = function (...args) {
            return original.apply(this, [instant(args[0]), ...args.slice(1)]);
          };
        }
      }
    })();
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

module.exports = { newPage, closeBrowser, launchBrowser, hasPausedClock, ORIGIN, VIEWPORTS, PINNED_PLAYWRIGHT };
