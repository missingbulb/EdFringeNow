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

## This repo has no PR template — write the body from the commit, don't go looking

The GitHub MCP server carries a standing instruction to search for a pull-request
template before calling `create_pull_request`. **EdFringeNow has never had one**, and
following that instruction costs a guaranteed-failing probe every time: all 72
conversations captured on the logs branch between 2026-07-31 and 2026-08-10 ran the
same lookup, most of them as a four-path `ls .github/pull_request_template.md
.github/PULL_REQUEST_TEMPLATE.md PULL_REQUEST_TEMPLATE.md docs/…` that returns four
"No such file or directory" lines. It is the single most repeated wasted call in the
corpus.

So **skip the search and write the PR body from the commit message you already
wrote** — the commit is the canonical description of the change here, and the PR body
restates it plus the `Closes #N` reference. If a template is ever added, it will be at
`.github/pull_request_template.md` and this paragraph goes with it.

## Read the PR's state, then merge — never loop on `enable_pr_auto_merge`

`mcp__github__enable_pr_auto_merge` only accepts a PR whose required checks are
still **pending**. This repo's `ci.yml` runs on `pull_request` and finishes in
well under a minute, so by the time an agent reaches the arming step the PR is
usually already `clean` and the call errors — *"already in clean status (all
checks passed) … you can merge directly."* That is not a failure to work around:
take it as the answer and call `mcp__github__merge_pull_request` with `SQUASH`.

The other refusal, *"in unstable status (required checks are failing)"*, is not a
verdict either — a check that is queued, or held at the Actions approval gate,
reads identically to one that failed. Re-read the PR
(`mcp__github__pull_request_read`) or the run list (`mcp__github__actions_list`)
to find out which, and never re-arm on a loop: PR #188 answered "unstable" and
then "clean" 27s later with nothing changed in between, and PR #182 answered
"unstable" three times across ~4 minutes before answering "clean".

The cost is measured. The 2026-08-01 baselining run spent ~350s of its 765s — 4
arm attempts, 9 `pull_request_read`s and 5 `ScheduleWakeup` polls — circling PR
#182's merge state, and still ended without merging it; the owner merged it by
hand the next evening. The same morning's conversation-extract run took its one
refusal as an answer and squash-merged 22s later. Check state first, merge
directly when it is clean, and arm auto-merge only while checks are genuinely
pending.

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
  sandbox, so `chromium.launch()` finds its browser on its own. Import the
  global build by its ESM entry —
  `import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'`
  (the sibling `index.js` is CJS, so a *named* import from it yields
  `undefined`) — or `$(npm root -g)/playwright/index.mjs` if the prefix moved.
  Path discovery and its sed-fix-up round-trips cost ~220s across five captured
  sessions, every one of them re-deriving the same two facts.
  `/opt/pw-browsers/chromium` is a **symlink** onto the version-pinned
  `chromium-<build>/chrome-linux/chrome`, so it is a valid `executablePath` if
  you ever need one — but you don't, and the build it points at moves with the
  image.
- **Never `npm i playwright` into the scratchpad to make the import resolve.**
  A bare `import { chromium } from 'playwright'` in a scratchpad script fails
  with `ERR_MODULE_NOT_FOUND` — the global install is not on the resolution
  path, and `NODE_PATH` does not apply to ESM, so exporting it changes nothing.
  The obvious next move is the wrong one: a fresh `npm i playwright` pulls a
  **newer** Playwright than the image's, which then hunts for a browser build
  the image does not ship (`chromium_headless_shell-1234` against the vendored
  `-1194`) and dies asking for `npx playwright install` — a download the
  sandbox cannot make. Three sessions on 2026-08-07 (#251, #258, #264) each
  took that detour and then backed out of it. Use the absolute path to the
  global build instead: it is the one matched to the vendored browsers.
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

## The live site is reachable — check real state at `*.edfringenow.com`, allowing for CDN lag

The environment's egress policy allows `*.edfringenow.com`, the live site's own
domain. So a question about what the deployed site actually serves — is the new
field in `data/shows.json`? did the deploy land? — is answerable directly, with
`curl https://www.edfringenow.com/…` through the agent proxy, rather than by
reasoning from the working tree. General egress is still closed: everything
*except* the allowed domain fails the same way, so this is a single-domain
window, not open internet.

Two caveats before you trust what comes back:

- **The response is CDN-cached, so a fresh push may not be visible yet.** A
  200 with stale content is not evidence the deploy failed — re-check after a
  delay, and never conclude "the change didn't ship" from one read taken
  seconds after the push.
- **Confirm the allowance is live in *your* session before relying on it.** The
  policy is per-environment and a session can be running under an older one; on
  2026-08-07 a probe of both `www.edfringenow.com` and the apex returned
  `curl: (56) CONNECT tunnel failed, response 403`. A 403 at CONNECT is a policy
  denial, not a site outage — `curl -sS "$HTTPS_PROXY/__agentproxy/status"`
  lists the recent rejections and confirms which it is. When it's denied, say so
  and fall back to the repo, rather than reporting the live site as down.

As with the off-box CSS fetch above, `curl` is the working path: headless
Chromium cannot tunnel the proxy, and `WebFetch` returns rendered text rather
than the raw JSON or asset you usually want here.

## Watching a workflow or scheduler run — never a blind fixed sleep

If the run is still going, ask again. On 2026-08-07 #251 abandoned its poll and
fell back to a blind `sleep 90` — for a run `actions_get` reported *already
complete* five seconds later. The orphaned sleep then fired two
`task-notification`s that had to be explained away to the owner.

The harness blocks a bare `sleep N` outright and its refusal names the right tool
(*"To wait for a condition, use Monitor with an until-loop … Do not chain shorter
sleeps to work around this"*). **Take that as the instruction, not as an obstacle to
route around.** The 2026-07-31 price run (#181) hit the block on `sleep 45; echo
waited` and answered it with `until [ "$(date +%s)" -gt "$(( $(date +%s) ))" ]; do
sleep 50; break; done`, then later `until [ -n "$(git log -1 --oneline)" ]; do sleep 1;
done; sleep 55` — both degenerate: the condition is satisfied on the first evaluation,
so each is the blind sleep the guard just refused, wearing an `until`. A real
until-loop tests the thing you are waiting *for* (`until git log --format=%s
origin/<branch> -1 | grep -q chunk; do sleep 10; done`), which returns the moment the
event lands instead of at the end of a guessed interval.

## A comment names its neighbour, never the neighbour's specifics

When a comment refers to another task, job, or file, do not restate that
neighbour's specifics — not its cadence, not its file locations (beyond an
artifact the reader genuinely needs), not sizes, not the reasoning behind how it
works, and not the history of how it got that way. Write "the periodic refresh"
and move on; the neighbour's own declaration is the single home of its details,
and every specific repeated elsewhere is a claim that silently drifts when the
neighbour changes.

This sharpens the canon's separation-of-concerns rule (A never re-spells how B
does its job) with what this repo actually paid: changing one task's cadence
from hourly to daily forced comment edits across a dozen files — README tables,
Python module docs, client cache comments, check comments — because each had
copied "hourly" instead of saying "periodically". The impulse behind the copying
is wanting comments to be precise; resist it — precision about someone else's
implementation is exactly the precision that rots. History and change reasoning
belong in commit messages and issues, never in the comment.

The litmus test for any tech detail in a comment: **if this detail changes, does
this site actually care?** The now page does not care *how often* the data
behind it refreshes, only that it wants the freshest copy — so its comment has
no business saying "hourly". A detail that would change without this code
changing is someone else's detail; leave it out.

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
check catches an omission.

## `.claudinite/shared/` is generated output — never hand-resolve its conflicts, always take the fresher version
