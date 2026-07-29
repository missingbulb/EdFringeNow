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

## The site is two front-ends — cross-page behaviour goes in `shared/`

The Now page (`index.html` + `js/app.js`) and the planner (`plan/` + `plan/plan.js`)
are separate front-ends, and `plan/lib/` is the planner's own engine, not a common
library. But both are now ES modules, so **anything that must behave the same on
both pages belongs in `shared/`** and is imported by each — never copy-pasted.
Both pages spell the import the same way (`../shared/geo.js` resolves to
`/shared/geo.js` from either), so moving a value there is a small change.

Do not add a second copy and a check to keep the copies honest: a duplicated
constant that drifts is a bug the architecture should make impossible, not one to
detect after the fact. `UK_BOUNDS` used to live twice and is the worked example —
it is one export in `shared/geo.js` now.

What is still genuinely twinned (untangled the same way when next touched): the
header `debug v<version>` pill, the Now/Plan nav, and the haversine in
`plan/lib/travel.js` that was ported from `js/app.js`.

A shared module needs **no** `package.json` to mark it as ESM: the pinned Node 22
detects module syntax in a `.js` file by itself, with no warning and no flag, so
`node --check` and the test suite both handle it. Don't add one — `plan/package.json`
predates that detection and its stated reason (silencing a module-detection warning)
no longer applies; it is harmless, so it stays, but do not copy it as a pattern.
`.js` and `.mjs` are both served as `text/javascript` by `python3 -m http.server`,
so the extension is a style choice — use `.js`, matching `plan/lib/`.

The one thing that does need doing: **add a new top-level source dir to
`scripts/verify.sh`'s `git ls-files` list**, or nothing in it is ever parse-checked.
Note that `git ls-files` only sees *tracked* files, so a new file silently sits
outside the syntax sweep until it is committed — the "checked N files" count is
not evidence your new file was among them.

## `.claudinite/shared/` is generated output — never hand-resolve its conflicts

The vendored canon under `.claudinite/shared/` is tracked but generated, exactly
like `data/days/` and `data/venues.json` (see the `edfringe-data` pack). So when
a branch that touched `.claudinite/` is rebased onto a main that has re-vendored,
the conflicts it throws are almost all in that snapshot, and **hand-merging them
is the wrong move**: a merged-by-hand `shared/` matches neither side, drifts from
canon silently, and no check catches it.

Resolve such a rebase in this order:

1. Split the conflicts —
   `git diff --name-only --diff-filter=U | grep -v '^\.claudinite/shared/'`.
   Whatever that prints is the only part needing judgment; in practice it is
   `.claudinite-checks.json` alone.
2. **Merge the declaration by hand**, taking *both* sides' packs — main's newly
   declared packs plus the branch's, keeping each entry's `config`/`answers`.
   Take main's `claudinite.ref` stamp; re-vendoring rewrites it anyway. Rewrite
   the file with `ensure_ascii=False` if you round-trip it through Python's
   `json` — the default escapes the em-dashes the answers are full of.
3. Resolve *everything* under `.claudinite/shared/` to the rebase target's side
   wholesale (`git checkout --ours`, `git rm` for delete/modify pairs), finish
   the rebase, then **re-run the vendor tool** so the snapshot is rebuilt from
   canon rather than patched. Amend the result into the same commit.

Before vendoring, confirm the stamped `claudinite.ref` is an ancestor of the
canon checkout's HEAD (`git merge-base --is-ancestor`) — vendoring from an older
canon silently rewinds the whole tree.
