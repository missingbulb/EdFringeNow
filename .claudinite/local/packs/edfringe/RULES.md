# EdFringeNow — project working rules

Lessons captured while working in this repo, layered on the shared Claudinite
canon. Terse and concrete; read the matching one before working in that area.

## The owner asks in plain words — open the issue yourself, before the first commit

Work here arrives as a chat request ("Maybe we can just put a 'Show list/Show Map'
toggle selector just under the filter…"), never as a filed issue. The
`task-lifecycle` check still wants a commit on the branch to reference one, so
**open the issue as your first step and put `Closes #N` in the original commit
message** — write it from the owner's own words, since it is the only record of
what was asked.

Leaving it to the stop hook is the expensive path, and it is the path every
session took: 7 of the 12 sessions captured on 2026-07-29 declared the work done,
got blocked, and then paid create-issue + `git commit --amend` +
`git push --force-with-lease` + a second reply that added nothing (#134 33s,
#150 45s, #152 35s, #154 43s, #156 43s, #158 57s, #160 20s — ~4.6 min of pure
rework). Worse, by then the PR is already open, so the fix rewrites the commit
underneath it.

## A dispatched run still has to classify its trigger comment

The `comment-classification` check reads the last message addressed to you and
wants a `Comment class:` line in the reply to it. In a scheduled run that message
is the executor prompt ("Execute the Claudinite executor: …"), not anything the
owner wrote — but the check does not distinguish them, and it is BLOCKING at the
Stop hook. 19 of the sessions captured across 2026-07-29…07-31 were stopped by
exactly this finding, every one of them citing the dispatch prompt, and each paid
an extra closing reply to clear it (the two runs where the block lands at the end
and the cost is cleanly isolable: #183 115s, #160 121s).

So **close a dispatched run's final reply with an explicit `Comment class:` line
classifying the dispatch itself** — `process-change` for an executor/scheduled-task
prompt — instead of discovering the requirement at Stop. On a real owner comment
the classification is the substance; on a dispatch it is a formality, but it is
far cheaper paid up front than as a second reply.

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

What is still genuinely twinned (untangled the same way when next touched): the
header `debug v<version>` pill, the Now/Plan nav, and the haversine in
`plan/lib/travel.js` that was ported from `js/app.js`.

A shared module needs **no** `package.json` to mark it as ESM: the pinned Node 22
detects module syntax in a `.js` file by itself, with no warning and no flag, so
`node --check` and the test suite both handle it. `plan/package.json` predates
that detection and its stated reason (silencing a module-detection warning) no
longer applies; it is harmless, so it stays, but do not copy it as a pattern —
the `edfringe-no-stray-package-json` check flags any other one.
`.js` and `.mjs` are both served as `text/javascript` by `python3 -m http.server`,
so the extension is a style choice — use `.js`, matching `plan/lib/`.

A new top-level source dir must be added to `scripts/verify.sh`'s `git ls-files`
list, or nothing in it is ever parse-checked — the `edfringe-verify-sh-covers-source-dirs`
check catches an omission. Note that `git ls-files` only sees *tracked* files, so
a new file silently sits outside the syntax sweep until it is committed — the
"checked N files" count is not evidence your new file was among them.

## `.claudinite/shared/` is generated output — never hand-resolve its conflicts, always take the fresher version

## A pack rule or check encodes a *work procedure*, never product behaviour

Rules and checks in `.claudinite/local/packs/` are about **how work is done here**
— the gate that must stay wired, the tool that must be launched a certain way, the
files that must move together. **Product behaviour is not a rule.** What the site
does — which ticket statuses count as unavailable, what the Now page shows, how
far "walkable" reaches — is a **requirement**, and it belongs in the requirements
spec (`product/requirements.md`, the `executable-requirements` pack) and its
tests, never in a pack's `rules`.

The trap is that product behaviour reads exactly like a good check candidate: it
is deterministic, statically detectable, and genuinely worth enforcing, so a
prose-to-checks sweep will happily convert it. The 2026-07-30 sweep did: it turned
the `ticketStatus`-not-`soldOut` rule into an `edfringe-ticket-status-unavailable`
check, with a clean scoped parse and a see-it-fail proof against mutated real repo
content — a well-built check of the wrong kind, which the owner rejected on sight
("Rules shouldn't be about product requirements, only work procedures"). The
sibling conversion in the same PR, `edfringe-normalizer-selftest-in-verify` ("the
offline self-test must stay wired into `verify.sh`"), was the right kind and
stayed.

Apply the test **before** writing the check, since the build quality of the check
tells you nothing about whether it belongs: *if the product changed its mind
tomorrow, would this rule be wrong?* If yes it is a requirement — a red check
would then be reporting a product decision as a process violation, and the
requirements spec is where that decision is already supposed to live. If instead
it would still hold because it describes how we work regardless of what the
product does, it is a rule. Prose in a `RULES.md` gets the same test: the
`ticketStatus` paragraph in the `edfringe-data` pack is background a scraper
editor needs, not a rule, and it is not convertible.
