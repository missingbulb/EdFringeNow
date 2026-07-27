# EdFringeNow — project working rules

Lessons captured while working in this repo, layered on the shared Claudinite
canon. Terse and concrete; read the matching one before working in that area.

## Verifying UI changes visually (the `index.html` page and everything under `plan/`)

Visual verification of the pages **is** available in this sandbox. Don't skip it
or downgrade to "verified by logic review only" claiming no browser exists — a
browser is here, and a UI change isn't done until it has been looked at.

- Serve the repo and drive it with the preinstalled Chromium (or Playwright):
  `python3 -m http.server 8000`, then screenshot / click through
  `http://localhost:8000`. The app fetches `data/shows.json`, so it must be
  served over HTTP rather than opened as a file — and `localhost` bypasses the
  agent proxy, so the browser reaches the page even though external hosts need
  the proxy.
- **Launch Playwright with no `executablePath`, and import from `index.mjs`.**
  `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is already exported in this
  sandbox, so `chromium.launch()` finds its browser on its own. Every captured
  session instead hand-wrote a path and paid for it: `/opt/pw-browsers/chromium`
  is a *directory*, and the real binary sits under a version-pinned
  `chromium-<build>/chrome-linux/chrome` that moves with the image. Import the
  global build by its ESM entry —
  `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
  (the sibling `index.js` is CJS, so a *named* import from it yields
  `undefined`) — or `$(npm root -g)/playwright/index.mjs` if the prefix moved.
  Path discovery and its sed-fix-up round-trips cost ~220s across five captured
  sessions, every one of them re-deriving the same two facts.
- **Keep one browser driver script per session and re-point it.** Authoring a
  fresh throwaway Playwright script per screenshot cost 29 heredoc writes and
  ~7 minutes of wall clock across the captured sessions (one session alone: 16
  writes, 4.5 min). Write the driver once into the scratchpad, take the URL,
  selector and output path from `process.argv`, and re-run it — a re-run is
  seconds where a rewrite is 15–20s.
- To build a `/plan` favourites list for the render, a plain slug-per-line text
  file is accepted by the parser — pick shows spanning the statuses (and some
  same-day doubles) you want to eyeball.
- **Never chain `pkill -f "http.server …"` with the rest of a command.** `-f`
  matches full command lines, so the pattern matches the very shell running the
  `pkill`: the shell kills itself (exit 144) and everything after the `;` or
  `&&` — the commit, the verify run, the curl — silently never happens. Every
  such call in this repo's captured sessions died this way, once misdiagnosed as
  a heredoc bug. Bracket a character so the pattern can't match its own command
  line (`pkill -f "[h]ttp.server 8099"`), or just leave the server up and serve
  the next run on a fresh port.
- **Known-noisy console output from the served page.** A page driven off
  `python3 -m http.server` reliably logs a `favicon.ico` 404 (the repo ships
  none) and often `net::ERR_CONNECTION_RESET` as the browser tears down. Neither
  is an application error — filter both out of a smoke script's error assertion
  so that a red run means something, rather than sending you chasing a phantom
  404 through extra browser runs.
- To match edfringe.com's live styling (e.g. the ticket-availability colours on
  the `/plan` grid), fetch the official site's CSS with `curl` through the agent
  proxy and read the palette out of it. `WebFetch` returns rendered text without
  the CSS, and headless Chromium cannot tunnel the proxy to reach an external
  host — `curl` is the one path that works for off-box assets.

## The site is two independent front-ends — cross-page behaviour lives twice

The Now page (`index.html` + `js/app.js`) and the planner (`plan/` + `plan/plan.js`)
share no code: no modules, no globals, and `plan/lib/` is the planner's own engine,
not a common library. So anything that must behave the same on both pages exists as
**two copies**, and changing one is only half the change — the UK-bounding-box
location guard and the debug menu it gates, the header `debug v<version>` pill, and
the Now/Plan nav each live in both files today.

The mirrored `UK_BOUNDS` box is now enforced: the `edfringe-cross-page-mirrors`
check parses the declaration out of both files and fails if the values disagree
(canon's `shared-constants` can't hold it — it rejects a case whose files are all
import-capable, and these two only look it — `index.html` loads `js/app.js` as a
classic script, so it can't import anything). Everything else on that list is
still on you: grep the other file for the twin before calling a cross-page change
done, because nothing else will fail a test or a parse check.
