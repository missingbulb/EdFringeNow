# edfringe-now — this repo's own rules

The lessons this repo has paid for once, across its three surfaces: working in the repo at
all, the data pipeline behind `scraper/` and `data/`, and the executable-requirements harness
that runs `product/requirements.md` as tests. A lesson that would hold in another repo does
not belong here — propose it to the Claudinite canon instead, where every repo gets it.

## Working in this repo

Lessons captured while working in this repo, layered on the shared Claudinite
canon. Terse and concrete; read the matching one before working in that area.

### The owner asks in plain words — open the issue yourself, before the first commit

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

Once the hook has already fired, the remedy is a plain `git commit --amend` on
the latest commit — the finding's own `Fix:` text says exactly that. On
2026-08-07 (#251) a session instead wrote a custom `msg-filter` script and ran
`git filter-branch` across all 5 commits since `origin/main` to backdate the
issue reference into every one, verified the resulting tree was byte-identical,
then force-pushed — history-rewriting machinery for a finding a single amend
already satisfies, and needless risk (a wrong regex, a bad force-push) for no
benefit over the one-line fix.

### `Comment class:` arms rules — repo tooling is never a `feature` here

The class is machinery, not a label. `feature` arms `feature-requirements-first`,
which demands a commit touching `product/requirements.md` **before** any code
commit — and this repo's spec cannot hold a build-tooling requirement. Its scope
is "what the site's two front-ends must render and how they must behave", and
its coverage gate is a bijection: every backticked leaf needs exactly one case of
kind `screen`/`behavior`/`logic`. A `verify.sh` wiring assertion is none of
those, so adding a real leaf for it fails the gate (measured: `# fail 1`). The
remedy the finding prescribes is simply not available.

So **classify what the owner's message actually is**, and reserve `feature` for a
change to what the two front-ends render or do. "Merge these two gates and speed
one up" is `process-change`; "that reason is bad" is `correction`. The class
**cannot be retracted** once declared (basics), so the first reply is the only
place this is cheap.

And when you have already mislabelled: **don't launder it.** Do not rebase a
token spec commit in front of the code, and do not add an `accept` entry — its
`path` would have to be `(branch)`, which disables doc-first for every future
real feature. On 2026-08-13 a session labelled the verify/pre-commit change
`feature`, armed the rule, and then spent ~35 minutes and three
`AskUserQuestion` rounds — the first two rejected outright by the owner —
offering a menu of ways out of a finding it had created by mislabelling. The
owner's answer was "leave it red". Naming the mistake once and leaving the
work-scope finding red is the cheap ending; the Stop hook will re-fire on it,
and that is not an instruction to keep trying.

### `npm run verify` green is not CI green — the UI lane runs elsewhere

Since #347 `scripts/verify.sh` runs `check_the_world.mjs` itself, so the local
gate and the pre-commit hook now cover the conformance findings CI blocks on.
It still does **not** cover `npm run test:ui` — the separate `ui-requirements`
workflow, real Chromium against the committed goldens — nor `build-site.sh` or
the assemble-site dry run. So anything that can move a rendered pixel (`js/`,
`plan/`, `shared/`, `index.html`, the CSS, the fixtures) is unverified until
`npm run test:ui` has been run locally, however green `verify` is.

### This repo has no PR template — write the body from the commit, don't go looking

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

### Verifying UI changes visually (the `index.html` page and everything under `plan/`)

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
  The same footgun exists one level up, in the **repo root**: `npm i -D
  playwright` there doesn't hit the version-mismatch failure (npm happens to
  resolve a working revision), but it dirties `package.json`,
  `package-lock.json` and `node_modules/`, needing a manual `git checkout
  package.json && rm -rf node_modules package-lock.json` before committing —
  paid twice in one session on 2026-08-07 (#267), once to re-verify after a
  refactor. Nothing here ever needs an install, scratchpad or repo root.
- **`index.html`'s Leaflet map loads from `unpkg.com`, which the sandbox proxy
  blocks — stub it before driving the page.** A Playwright-driven browser
  fails every `unpkg.com` request with `net::ERR_TUNNEL_CONNECTION_FAILED`
  (the same proxy restriction as any other off-allowlist host — `curl`
  confirms `403` at CONNECT) and the page throws `L is not defined`. Two
  sessions on 2026-08-07 (#256, #267) hit this independently while driving the
  same constraint-picker fix. Work around it by grepping `js/app.js` for the
  `L.*` calls actually used (`L.map`, `L.marker`, `L.circle`, `L.divIcon`,
  `L.markerClusterGroup`, `L.polyline`, `L.tileLayer`) and route-stubbing a
  minimal no-op replacement before navigating. When the case needs the map
  itself to render (markers, clustering, popups), the no-op stub isn't enough
  — `curl` reaches `unpkg.com` fine through the agent proxy (confirmed:
  `curl -sS -o leaflet.js https://unpkg.com/leaflet@1.9.4/dist/leaflet.js`
  pulled 147552 bytes, `leaflet.css` 14806 bytes) even though headless
  Chromium's own request to the same host fails (`net::ERR_CONNECTION_RESET` —
  Chromium can't tunnel the proxy for any non-allowlisted host, same gap that
  sends an in-page link to `www.edfringe.com` to `chrome-error://chromewebdata/`
  instead of navigating). Curl the real `leaflet.js`/`leaflet.css` into the
  scratchpad once and route-intercept `unpkg.com/leaflet@*` to serve them from
  disk instead — a real, working map that never needs updating when `js/app.js`
  starts calling a new `L.*` method (#318). The same proxy gap hits
  `fonts.googleapis.com` (`ERR_CONNECTION_RESET`) — same fix if a case ever
  needs real fonts loaded.
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

### Reaching the network

The egress policy is per-environment and moves, so every note here is a dated observation and
not the current state. Settle the question with a probe:

```sh
curl -sS -o /dev/null -w "%{http_code}\n" --max-time 15 https://<host>/
```

Observed so far: `*.edfringenow.com` allowed from 2026-08, denied at CONNECT on 2026-08-07,
and general egress open on 2026-09-04 with `WebSearch` and `WebFetch` reaching arbitrary hosts.

- **About to report a capability as unavailable** — probe it in this session first, whatever
  this file says. A note that a door was shut is not evidence it is shut, and only the probe
  distinguishes a policy that has changed from one that hasn't. (3)

- **Reading a 403 from the proxy** — `curl -v` tells you whose it is: `CONNECT tunnel failed,
  response 403` is a policy denial, the same code after a negotiated tunnel is the origin
  refusing you. `curl -sS "$HTTPS_PROXY/__agentproxy/status"` lists recent policy rejections.

- **Checking what the deployed site serves** — `curl https://www.edfringenow.com/…` answers it
  rather than reasoning from the working tree, but the response is CDN-cached: a 200 with stale
  content is not evidence a deploy failed, so re-check after a delay before concluding anything.

As with the off-box CSS fetch above, `curl` is the working path: headless
Chromium cannot tunnel the proxy, and `WebFetch` returns rendered text rather
than the raw JSON or asset you usually want here.

### Get the browser's own evidence before guessing a repro for a live-data bug report

A locally-built reproduction can converge on a plausible but wrong root cause
that produces the *identical* visible symptom the owner reported. On
2026-08-09 (#309) the owner reported the live planner showing every favourite
as unavailable ("no way all of those shows aren't available"). The first
hypothesis — a Playwright harness's self-signed HTTPS origin making
`shared/data-cache.js`'s `cache.put()` throw — reproduced the exact same
all-red "📅 No dates" grid and shipped a fix (PR #310) for a bug that wasn't
the owner's bug. It was overturned only ~12 minutes later when the owner
supplied a screenshot of the browser's Network tab (zero requests for the four
data files), and a further ~9 minutes after that when a second screenshot of
the Application → Cache Storage panel finally pointed at the real cause (a
stale-vs-fresh cache generation mismatch — see the data-pipeline section
below).

This site has three caching layers (the browser's own HTTP cache, the
`caches` API in `shared/data-cache.js`, and `localStorage` TTL stamps), and
only the browser's own evidence disambiguates which one is actually in play.
Ask for a screenshot of DevTools' Network tab and Application → Cache Storage
panel as the *first* response to a "the live site shows wrong data" report,
before building a speculative local repro.

### Watching a workflow or scheduler run — never a blind fixed sleep

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

A PR's check runs are the exception, and it is the one that keeps producing
degenerate loops: their state is readable only through
`mcp__github__pull_request_read`, so there is **no shell condition to test** and
no real `until` to write. On 2026-08-14 both executor sessions had to wait out
`ci` + `ui-requirements` (~2.5 min here) and neither could; one ran
`sleep 45 && echo done` under `run_in_background`, the other
`until [ "$(date -u +%s)" -ge 0 ] && false; do :; done`, a busy loop that cannot
terminate and was killed by the Bash timeout 122s later having waited for
nothing. When the thing you are waiting on lives behind an MCP tool, wait with a
short bounded `run_in_background` command whose result you actually consume,
call it a poll interval, and re-read over MCP after it — a faked shell condition
buys none of the responsiveness the guard exists to get you.

A bare `wait` in its own Bash call is another way to fake that consume step —
each Bash invocation is a fresh shell, so there is no earlier background job
left in it to wait on, and the call just returns immediately. On 2026-08-16
(#368) a session polled PR #388's checks nine times this way: it requested
sleeps totalling 1,170s, but every `wait` returned in under 2.3s (~18s of real
waiting spread across 146s of actual MCP polling) — then, worse, concluded its
own perfectly fine MCP reads were "stale cached status" rather than noticing
the waits it asked for had never happened. The nine orphaned sleeps also each
fired a `task-notification`, several mid-convergence — the exact interruption
this section already warns about. `run_in_background` plus `Monitor` (or an
MCP re-read on the tick after) is the real version of that pattern; a follow-up
`wait` alone is not it.

**The `gh` CLI is not installed in this sandbox — a poll built on it fails
silently, not loudly.** On 2026-08-08 (#290) a session built
`until gh run list ... 2>/dev/null | grep -q "completed"; do sleep 10; done`;
because `gh` doesn't exist here and the stderr that would have said so was
suppressed, the loop could never succeed or explain why, and it spun for the
Bash tool's full 120s default timeout before being force-backgrounded. It then
dispatched a second doomed attempt (a `Monitor` call built the same way, on
`gh api ...`) before finally running `which gh` and getting `command not
found`. Check a tool exists before building a loop's condition on it, and never
suppress a poll condition's stderr — go straight to the GitHub MCP tools
(`actions_get`/`actions_list`/`pull_request_read`) for anything about a run or
a PR's checks.

A run that never executed any of the repo's own steps is not a CI failure to
wait out — it's infrastructure, and re-running or waiting only spends more of
it. Two tells, both cheap to check: a check stuck `queued` that auto-cancels
around 15 minutes with `get_job_logs` then returning 404, or a job that dies in
"Prepare all required actions" with "Failed to resolve action download info …
Service Unavailable". Two sessions hit the same outage the same evening
(2026-08-14): one (#239) kept offering "Keep waiting for CI (Recommended)"
through two `AskUserQuestion` rounds and took 3h27m end to end, including 14
blind sleeps totalling 60.6 minutes of real waiting on top of legitimate
polling; the other (#237), same outage, put the honest options to the owner
without recommending more waiting and closed in 42 minutes. Recognise the
pattern, say plainly what local `verify`/`test:ui` already covers, and don't
put "keep waiting" forward as the recommended choice.

**A `Monitor` loop built on `curl … api.github.com/…/check-runs` can give a
false-positive "done" signal in under a second**, not only the already-
documented infinite hang. On 2026-08-13 (#349) a `Monitor` polling a PR's
checks via curl hit the credentialed-403 look-alike JSON body (see below),
computed a pending-count of 0 from that error, and fired "all checks
concluded" about one second after starting — while `ci`/`ui-requirements`
were still `in_progress` and didn't actually finish for another ~2.5 minutes.
Caught only because the session cross-checked `pull_request_read
get_check_runs` before merging. Build a `Monitor` loop's exit condition on the
GitHub MCP tools directly, or verify any curl-based result against them before
acting on it — an empty/error body can satisfy "no pending checks" as easily
as a real answer can.

Don't fire a new bounded `run_in_background` sleep before the previous one's
result is in hand, either. The same #349 session, having just been burned by
the false positive above, over-corrected by launching 8 separate
`sleep N; echo done` background commands (60/90/180/240/240/240/300/300s) in
82 seconds while also re-polling `get_check_runs` directly in between — the
checks concluded via a plain poll a few seconds later, so most of the 8 were
never needed, and each still queues its own later `task-notification`. One
bounded sleep at a time, consumed before the next is fired, is the pattern
above; a burst of overlapping ones doesn't wait faster, it just adds noise.

A dispatched subagent's `completed` notification can mean only that its
*turn* ended, not that its task did. When a subagent itself starts a
`Monitor` to wait on a PR's checks and its turn ends there, the notification's
final text can be a one-line placeholder ("Waiting for the checks-monitor to
report completion.") rather than the structured report the task needs —
reading `completed` as "done" and moving on skips the real report. On
2026-08-11 (#332) the executor had to `SendMessage` an explicit "give me your
full final status" nudge twice, ~85s apart, before the subagent produced real
output — and by the second nudge the executor had *already* independently
queried the same PR's checks over MCP and had the answer, so it just handed
the subagent that answer rather than let it re-discover it. Read a
"completed" subagent's actual final text before trusting it as a report; if
it's a placeholder, nudge with `SendMessage` and hand it any answer you
already have rather than let both sides poll the same state twice.

### GitHub MCP call shapes that cost round-trips here

- **`actions_list`/`list_workflow_runs` overflows the tool-result token limit
  on this repo's history, and lowering `per_page` does not fix it.** Proven:
  one session retried the same call at `per_page` 25, 10, 3, 2 and 1 and got a
  byte-identical ~100–390K-character response every time. When it overflows,
  read the spilled tool-result file yourself (`python3`/`jq`) and project out
  only the fields you need — don't follow the overflow error's "read it in
  sequential chunks" advice on a single-line JSON blob, and don't burn retries
  lowering `per_page` first.
- **`search_issues`, `list_pull_requests`, `pull_request_read` do shrink — with
  `fields`/`minimal_output`.** Pass one from the start; 28+ calls carrying it
  across the corpus have never overflowed, typically 100–250 bytes back
  instead of six figures.
- **`list_pull_requests` never reports a PR as merged.** Its `merged` field
  decodes `false` (absent from the response) and `merged_at` is never
  populated, `fields` or not — confirmed live when it read PR #385 as
  `merged: false` while `0e8ec17 … (#385)` was already `origin/main`'s HEAD.
  For landed-ness, grep `origin/main`'s commit subjects for the squash-merge's
  `(#N)`, or call `pull_request_read get` on the one PR you actually care
  about.
- **`pull_request_read method=get_files` overflows the same way
  `actions_list` does, on an ordinary large PR — treat it as "skip the diff,"
  not something to retry.** PR #207 (46 files, +2554/-274) blew the token
  limit on `get_files` at `perPage: 100`, spilling its output to a side file
  instead of truncating. For a landed-status judgment the file-level diff
  usually isn't needed — `get` (title/body) plus `list_commits` is normally
  enough; don't chase the spill or retry at a lower `perPage`.

### `subscribe_pr_activity` gets denied here when used mid-session — poll directly, don't retry

Calling `mcp__github__subscribe_pr_activity` while actively driving a PR to
green in the same turn has been denied by the owner every time it's been
tried in this repo: three times waiting on one PR's checks (#335, 16:03/
16:08/16:13) and again on a different PR the next day (#341, 10:56). Each
denial silently stalled the turn until the owner noticed and sent "Continue
from where you left off" roughly 5 minutes later — real idle wall time for
nothing, since the very next action every time was to poll
`pull_request_read method=get_check_runs` directly, which works fine. This
doesn't contradict the owner's standing preference to use `subscribe_pr_activity`
when *asked* to watch/babysit a PR — it's specifically the pattern of reaching
for it as a substitute for synchronous polling of your own in-flight work.
When you're actively waiting on your own PR's checks in the same turn, poll
the GitHub MCP tools directly from the start; don't call `subscribe_pr_activity`
first and retry after a denial.

### A dispatched subagent's work is void if you don't actually wait for it

On 2026-08-09 (#296) the executor backgrounded a `growth-dedup` subagent
(model `opus`) and stated it would act on the subagent's completion
notification — then, before that notification arrived, independently made the
same three prune edits to this file itself, committed, pushed, and opened
PR #304 at 04:59:14. The subagent's own report, reaching the identical
three-item conclusion, didn't land until 04:59:58 — by then entirely
redundant, its ~4m46s run wasted. After stating a wait-for-subagent plan,
actually stop: don't perform the same mutation yourself in the same session
before its notification (or your own scheduled wakeup) fires.

### A `[claudinite-task]` needs-human issue is one failed slot, not proof of a recurring failure

The pile of bot comments that accumulates on a stuck `[claudinite-task]` issue
is the stale-dispatch watchdog nagging that nobody executed it — not the
underlying job re-failing every cycle. Before accepting a "this has been
failing every hour since X" framing and shipping a fix, count what actually
landed (`git log --grep="<the worker's own commit subject>"`) and read that
slot's own scheduler job log; the flagged run may be a single one-off (e.g. a
manual `FORCE_TASKS` invocation), not a pattern. On 2026-08-06 a session
(#237) accepted an owner's framing that `refresh-tickets` had been "failing
every hour since 2026-08-05", shipped a one-line `git push origin HEAD:main`
fix which the owner merged (PR #235), then an hour later — answering an
unrelated question — read the actual run log and found the framing wrong:
tracking was set the whole time, the bare push had landed 24 hourly commits
including after the flagged slot, and the issue behind it (#231) was a single
`FORCE_TASKS=baselining` run. Its own shipped fix would have pushed
`baselining`'s unreviewed converge commit straight to `main`. The real defect
(`actions/checkout` leaving the shared clone on no upstream) already has its
fix as the `edfringe-worker-restores-main` check; this rule guards the
diagnosis step, not that bug.

### A comment names its neighbour, never the neighbour's specifics

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

**Don't resolve that by pointing at a path inside `.claudinite/`.** On
2026-08-12 (#341) the sweep applying this very rule replaced a trimmed
comment in `scraper/README.md` with "see the declarations under
`.claudinite/local/packs/edfringe/tasks/`" — which is exactly what the
`claudinite-isolation` check bars (a consumer file referencing an internal
`.claudinite` path) and turned CI red on the very next commit. Point at the
pack's own repo-level docs instead, or say nothing.

### The site is two front-ends — cross-page behaviour goes in `shared/`

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

### Researching a competitor's product for a `wiki-growth` pass

Fetch the competitor's page, and fall back to `WebSearch` only once a fetch actually fails —
citing the snippet's publisher, per the product-wiki pack's sourcing rule. Whether the fetch
succeeds moves with the egress policy above, so the attempt is what tells you. (4)

### Needing a real screenshot of a site headless Chromium can't tunnel to

Route every request through Playwright's `page.route('**/*', …)`, fulfilled by `curl` —
the sandbox proxy blocks a direct `chromium.launch()` request to an off-allowlist host
even with the proxy passed explicitly, but allows `curl`. (1)

### Dispatching a research subagent for a long, multi-round wiki pass

Give it an explicit budget ("finish with a few NOT FOUNDs rather than dig exhaustively") —
a subagent killed by a session rate-limit mid-run hands back no report at all, not a
partial one. (2)

### Building a first-pass UI/UX mockup for this product

Default to graphics-first, minimal-text, wizard-style screens that hide answered questions —
the owner has rejected a first pass that read as generic enterprise-app buttons-and-prose as a
recurring mistake, not a one-off. (5)

### A capture pass must never land a rule that teaches routing around a safety or permission denial

On 2026-08-15 the growth-extract subagent (dispatched for issue #359) merged a rule into this
file instructing every future session to treat the Claude Code auto-mode classifier's permission
denials as "non-deterministic noise," never explain them, and just retry the blocked command —
backed by real retry evidence (five denials, all five succeeded on an identical retry). It shipped
through this task's own no-human-review delivery path. Within a minute, the outer executor
session's own harness flagged the merged change as a likely instruction-poisoning attempt; the
outer session verified the flag, reverted it (PR #361, `8710afe`), and converged issue #359 to
`needs-human` instead of closing it clean. The retry evidence was real and the rule still should
never have landed: a checked-in instruction telling every future session — this one included, via
CLAUDE.md — to retry past a permission/security classifier without asking is a standing bypass
instruction with no user consent behind it, however solid the "it works on retry" data looks.

So: before this task lands anything that tells a future session to retry, ignore, explain away, or
otherwise route around a permission, security, or classifier denial — don't. That shape of lesson
never clears the bar no matter how much retry evidence backs it. Report a recurring denial to the
owner instead of scripting a workaround into a rule every future unattended session loads
unquestioned.

## The data pipeline (`scraper/` and `data/`)

The domain of this pack: getting show data out of edfringe.com and into the
committed files the site serves. Read it before touching `scraper/` or anything
under `data/`. The API's own field reference lives in
[scraper/SCRAPING.md](../../../../scraper/SCRAPING.md) and the file layout in
[scraper/README.md](../../../../scraper/README.md) — this is the working
judgment those two don't carry.

### Verifying a scraper change against the live API

Reaching `edfringe-tikketr-web-api.equhost.com` is a live question — it was denied at the
CONNECT in 2026-08 and answered a server-side 403 on 2026-09-04 — so probe it (the `edfringe`
pack's egress section) rather than repeat either answer. Reaching the host is still not the
same as being able to drive it, so anything that must touch the API runs through a sanctioned
workflow: the `Scrape edfringe shows (full)` workflow
(`.github/workflows/scrape.yml`), `Fetch ticket prices (one-off)`
(`prices.yml`), or the `refresh-shows` / `refresh-tickets` scheduled tasks.
Never "verify" a scraper change by reasoning about what the API probably
returns — either have a sanctioned workflow run it, or say plainly that it is
unverified.

For one-off API questions (a field's shape, an enum's value set, whether an
operation exists at all), `scraper/SCRAPING.md` is the reference. When it falls
short there is one legitimate source short of asking the owner:
**`www.edfringe.com` itself is reachable**, and its Next.js bundles carry the
client's complete GraphQL operation set — every query, mutation and fragment,
with full field selections. Recipe in SCRAPING.md ("Reaching it from a Claude
Code web session"). That is reading a public asset from an allowed host, and it
is how the "no bulk price endpoint" claim was finally settled. It tells you what
a query would look like, never what it returns — so a change checked only that
way is still unverified against live data and must be reported as such. If that
doesn't answer it either, ask the repo owner rather than building a bypass.

`python3 scraper/normalize.py --selftest` is the one transform check that runs
offline; it exercises raw→master→day-file→`shows.min.json` on a fixture, so a
normalizer change is verifiable here even though a fetch change is not. Because
it is the only offline verification a scraper change can get, it must stay wired
into `scripts/verify.sh` — the `edfringe-normalizer-selftest-in-verify` check
enforces that (a step *label* naming the self-test does not count; only a command
line does).

### `ticketStatus`, never the `soldOut` boolean

"Can I get a ticket" comes from the per-performance `ticketStatus`, not the
`soldOut` flag: a performance can be `soldOut: false` and still have nothing to
sell online (`NO_ALLOCATION_CONTACT_VENUE`). The site treats `SOLD_OUT` and
`NO_ALLOCATION_CONTACT_VENUE` as unavailable and everything else as available
(`NO_TICKETS_STATUSES` in `js/app.js`), and unknown means available. Any new
availability logic — client or scraper — keys off `ticketStatus`; `soldOut` is
carried through for display only.

### A price belongs to a performance, not to a show

The same run sells at several prices: previews cheaper than the main run,
weekends dearer than weekdays. The first price pass didn't know that — it
called `performancePrices` for **one** performance per show and filed the answer
under the show. Pre-festival the performance it picked was almost always the
earliest, i.e. a preview, so **1,016 of 3,664 priced shows (28%) published their
cheapest night as their price**: Alfie Brown's £15/£16 run shipped as £8.50.

The fix is not a rule about previews, and adding a "skip previews" or
"price after date X" heuristic re-creates the same class of bug from a different
angle — it still picks one performance and hopes it represents the rest.
**Price every performance.** There is no bulk price *field*, but GraphQL aliases
make one request carry a whole show's run (`fetch_prices.prices_query`), so full
per-night pricing costs roughly the same ~3,700 requests as the old pass. There
is no call budget to economise against here, so don't design as if there were.

Which payload gets which number is the load-bearing distinction:

| payload | question it answers | price |
|---|---|---|
| `shows.min.json` (planner) | what does this *show* cost? | run-wide `priceMin`..`priceMax` |
| `data/days/*.json` (Now page) | what does it cost *tonight*? | that performance's own `pm` |

A performance the cache has no entry for gets **no `pm` at all** — "Price TBC" —
rather than the show's minimum. Borrowing a neighbouring night's figure is
exactly the bug above, and a lower bound presented as the price is a lie about
money even when every number in it is real.

### Prices are fetched once, and "unknown" is a third state the encoding must keep

`data/prices.json` is a fetch-once cache (`scraper/fetch_prices.py`), off the
nightly path: a show's price bands are set when it goes on sale, unlike its
ticket status. `refresh-shows` reads the cache and carries the amounts through
untouched — it never re-fetches them. So the festival keeps adding shows the
cache has never seen, and **a show with no price is a normal, permanent state of
the data**, not a gap the pipeline should close.

The cache carries two entry shapes and both must stay readable: current entries
have `sets` + `perfs` (per performance), and entries from the old pass have a
bare whole-show `min`/`max`. The migration completes one show per re-run, so
dropping the legacy shape — or emptying the cache to "start clean" — would blank
every price on the site until a full pass finished. `price_sets` reads both.

Which means the encoding carries three states, not two, and every stage has to
preserve the distinction:

| state | master | wire |
|---|---|---|
| costs nothing | `priceMin: 0` | `pm: 0` |
| priced | `priceMin: 22.5` | `pm: 22.5` |
| unknown | `priceMin: null` | no `pm` key at all |

`priceMin: 0` and `free: true` are **not** the same claim and don't always agree.
The flag comes from the listing; the £0 can also come from the price API, which
returns a single `Price band 1` at £0.00 for a handful of shows the listing
doesn't flag free — pay-what-you-want, or a box office that never set a price
(10 of 3,664 in the first full run). Both readings are honest about what a ticket
costs, so the price path keys off `priceMin`, and `free` stays what the *listing*
said. Don't "fix" one to match the other.

Never encode unknown as `0`, and never let a decoder default it to one: a stage
that collapses three states into two is lying about money, and nothing
downstream can recover the difference. What the site then *does* with an unknown
price is a product decision, not a pipeline one — it lives in `shared/price.js`.

Two traps in the raw price payload, both already handled and both worth not
re-introducing: amounts arrive as **strings**, and nearly every show carries a
£0.00 "Personal Assistant" concession (a carer's companion ticket) that must not
be read as the cheapest price. See the pricing section of
[scraper/SCRAPING.md](../../../../scraper/SCRAPING.md).

### The API stamps performances in UTC — cross the zone once, at the edge

The listing API's `dateTime` is a real UTC instant (`"2026-08-06T11:45:00.000Z"`),
**not** Edinburgh wall-clock with a decorative `Z`. Slicing the digits out of that
string is the trap: it looks like it works — every date and time in it is
plausible — and in August it is silently an hour wrong for the whole catalogue.
That is exactly what shipped, and what #275 cost to undo: 60,115 performances
listed an hour early, with the tell being shows that name their own time (a 10am
"Shakespeare for Breakfast" sitting at 09:00).

The pipeline has **one** time-zone crossing, and it is `normalize.local_date_start`.
`refresh_ticket_status.py` and `fetch_prices.py` share it so a performance is keyed
by the same local date and start everywhere. Everything written after it — the
master, `data/days/*.json`, `availability.min.json`, `shows.min.json` — is already
Edinburgh wall-clock, so **no stage downstream parses, converts, or re-offsets a
time**. Treating a stored value as UTC a second time is the same bug from the other
end.

Two consequences to hold on to when touching this:

- **A "now" compared against these times is read in Edinburgh too** — `js/clock.js`
  (`festivalNow` / `festivalDate`), never the device clock. A UK visitor cannot see
  the difference, which is why a device clock survives review; a visitor planning
  from another zone reintroduces the whole drift.
- **A conversion change is a full-snapshot change.** The committed data is generator
  output, so the fix is not complete until the master is rebuilt through the new
  conversion and every derived artifact regenerated from it. Shifting the boundary
  moves performances between day files (two late 31 Aug performances now fall into
  1 Sep, outside the August day files, and live only in the master and the planner's
  catalogue) — expect that and check it, rather than reading it as data loss.

### Two client-cached files joined by key need a fingerprint, or a generation split breaks the join

`shows.min.json` (catalogue) and `availability.min.json` (ticket-status
sidecar) are cached independently in the browser and joined client-side by
performance key (venue + date + time). The UTC time-shift fix (`c1bc2a6`,
above) moved every one of those keys by an hour — a browser still holding the
pre-fix sidecar cached alongside a post-fix catalogue joined at 6.2%
(3,751/60,115) instead of 100%, rendering every planner favourite "No dates."
even though both files were individually correct (#309). A per-file TTL has
no way to detect that two files it's serving came from incompatible backend
generations.

The fix is `join_fingerprint(master)` in `scraper/normalize.py`, mirrored
exactly as `joinFingerprint()` in `plan/lib/hydrate.js` (same algorithm in
both languages — `normalize.py`'s self-test asserts they agree, and that a
moved start time changes the fingerprint while a price change doesn't),
carried as the sidecar's `k` field. `plan/plan.js` compares its own
`joinFingerprint()` of the catalogue it holds against the sidecar's `k` and
calls `evictCached()` on both URLs on a mismatch, forcing a refetch of the
matching pair. Any future backend change that moves a performance's join key
needs this same fingerprint-and-evict shape — a plain TTL bump doesn't cover
it, because both files can be individually "fresh enough" by TTL and still
belong to different generations.

### The committed data is generated output — regenerate it, never hand-edit it

`data/raw_pages/` is a git-ignored regenerable cache. `data/normalized/`,
`data/venues.json` and `data/days/` **are** committed, because the browser
fetches them — but they are still generator output. Fix the data by fixing
`scraper/normalize.py` and re-running it (`--merge` for a top-up, no flag for a
full rebuild from the raw cache); a hand-edit is silently overwritten by the next
`refresh-shows` run and leaves the bug in the generator.

`data/prices.json` is the one exception, and it is an exception to the *direction*
rather than the rule: it is committed, but it is normalize.py's **input**, written
by `scraper/fetch_prices.py`. Nothing regenerates it on a schedule, so nothing
overwrites a hand-edit either — which is precisely why editing it by hand is still
wrong: the edit survives, silently disagreeing with the box office forever. Re-run
the fetch. The `edfringe-data-dir-is-generator-output` check allows it **by name**,
so a second file can't ride in on its shape.

### A long-running workflow that commits generated data will race the hourly refresh

Any workflow that writes to `data/normalized/`, `data/venues.json` or `data/days/`
and can run for more than about an hour is racing `refresh-tickets`, which pushes
to `main` every hour through the festival. A plain `git push` at the end of such a
run is not occasionally rejected — it is *guaranteed* to be, so the commit step has
to expect it. `#292` lost a full 2h39m price-fetch pass this way: the commit
existed only on the runner, and by the time it tried to push, `main` had moved.

Recovery has to **re-derive, not merge** — every contested file is generator
output from both writers, so a rebase would conflict on generated bytes whose only
correct value is "whatever the generator says now," not either side's stored
version. `prices.yml`'s commit step (`.github/workflows/prices.yml`, the retry
loop in its "Commit prices and regenerated data" step) is the worked fix: on a
rejected push, fetch `origin/main`, take its generated files, regenerate from that
master plus this workflow's own non-generated input, retry. A new long-running
workflow that writes these paths needs the same shape from the start, not a
bespoke recovery discovered the same way after the fact.

### Changing the wire format is a four-file change

The day files and `shows.min.json` reference `data/venues.json`'s global lists
**by position** (`genre`, `room`, `subs`, `ts`; `g`, `rm`, `sg`, `ar`). That
encoding has one producer and two decoders, and they must move together:

- producer — `scraper/normalize.py` (`build_lookups` / `build_day_files` /
  `minify_master` / `build_availability`)
- decoder 1 — `js/app.js` `adaptShow`, for the day files
- decoder 2 — `plan/lib/hydrate.js` `rehydrateShows`, the exact inverse of
  `minify_master`, round-tripped against the real committed files by
  `plan/lib/__tests__/hydrate.test.mjs`

Add or drop an indexed field and all three change in the same commit. That the
indices still *resolve* is enforced by the `edfringe-lookup-indices` check — it
catches a lookup list regenerated without its day files, but nothing can catch a
decoder left reading the old key, so check both decoders by hand.

Two properties of that encoding are load-bearing for caching, and both fail
silently:

- **The lookup lists are append-only** (`extend_lookup`). The browser holds
  `shows.min.json` for four days and `venues.json` for one, so a stale catalogue
  is routinely decoded against a newer lookup file. An entry that changed index
  would relabel shows' genres and rooms with no error anywhere. Entries are never
  dropped, even once the master stops using them.
- **`shows.min.json` carries nothing that changes through the day.** Ticket
  status lives in `availability.min.json` (its own status list, indexing into
  nothing, so `refresh-tickets` can rewrite it alone). Putting a status back in
  the catalogue would tie that bulky download to the ticket refresh *and*
  freeze availability for anyone holding a cached copy — the bug in #249,
  re-created from the other end.
  `hydrate.test.mjs` asserts each wire performance carries only `d` and `s`.

The same three-way move applies to plain (non-indexed) wire keys such as the
price fields `pm` / `px`, with one extra hazard: the round-trip test compares the
rehydrated record to the master **as JSON**, so a new master key has to appear in
the *same position* in `normalize_event`'s dict and in `rehydrateShows`'s object
literal. Adding it in one place and appending it in the other fails the
round-trip on key order alone, which reads as a data bug and isn't one.

## The requirements harness

How this repo runs its spec (`product/requirements.md`) as tests. The framework
conventions are the `executable-requirements` pack; the judgment layer is
`spec-driven-product` + the `writing-tests` skill. This pack carries only what
those don't: the mechanics of a **real-headless-browser** golden harness (the
canon's worked examples render with satori/jsdom or Flutter — this repo is the
first Playwright port) and the local approval/fixture policy. Layout, lanes and
commands live in [product/requirements/README.md](../../../../product/requirements/README.md)
— don't restate them; this file is the judgment and the traps.

### The document reads as pictures

- `product/requirements.md` is scanned by sight: under each visual leaf its
  golden is **visible, uncollapsed**; every textual expansion (acceptance
  notes, proof pointers) is **collapsed** in a `<details>` block. An optimal
  requirements document has almost no words on the page.
- **A visual leaf's statement is a line, not a paragraph.** The golden already
  carries the exact copy, counts, colours and placement — restating them in
  prose only competes with the picture. Say what is being asserted; let the
  image say how it looks. Anything genuinely not visible (a threshold, a rule
  behind the state, a condition that produced it) goes in a collapsed
  **Notes** block, never in the statement.
- **A golden is the smallest surface that proves its leaf** — an element crop,
  a clipped region, or a stitched composite (e.g. one grid lane narrowed to a
  few days, recomposed with its label and verdict columns, no header) — never
  the whole page or even the whole control. The capture recipe lives on the
  case (`capture: "<selector>"` or `capture(page, tools)`; see
  `shared/capture-tools.js`); whole-page capture is a deliberate exception,
  not a default. Scoping is judgment: crop to what the leaf asserts, keep just
  enough surroundings to orient.
- **A change over time is an animation, not a coded assertion.** When a
  requirement is about what an action *changes* — a dismissal that sticks, a
  pick that swaps one card for another — capture the same region before and
  after (and after a reload, where persistence is the point) and play the
  frames as one animated golden (`tools.animate`). A flow is shown as a flow.
  Reserve `stitchV`/`stitchH` for things that are genuinely side by side rather
  than sequential.
- **An animated golden is an APNG, never a GIF.** It animates in GitHub
  markdown exactly like a GIF. The encoder is `shared/png.js`'s
  `encodeAnimated`; the comparator detects an animated golden and compares
  bytes only, since a pixel differ reads one still frame and would describe
  the wrong thing.

### A requirement is a feature, not a module

The spec is organised by what the product *does*, never by how the code is
arranged. "Shared code" is not a requirement category: a rule both front-ends
follow is one feature, and its picture shows **both** the Now page and the
planner — a rule only half the site follows is not the feature. Those
cross-page features sit in their own part **after** the two page-by-page
segments, so each page reads as a whole first.

Cross-page proof is ordinary: a case may navigate between the pages (or open a
second page, when something fixed at context creation — a device timezone —
has to differ) and stitch or animate the surfaces into one golden.

### Prefer several pictures over one coded leaf

Before routing a leaf to `behavior` or `logic`, ask whether it **decomposes
into observable states**. A statement joined by "and" usually does, and each
part is then its own numbered sub-leaf with its own picture — the parent
becomes a heading. The time wheel went this way: "5-minute steps, opens at
now + 2 h, ends at 29:55" was one coded leaf and is now `3.7.1`–`3.7.3`, three
crops anyone can check by eye. Sub-leaves are cheap; a coded assertion the
owner has to read code to trust is not.

Reserve the coded kinds for what genuinely has no picture:

- **`behavior`** — a gesture's outgoing consequence (a URL built, bytes
  downloaded, storage written), or a fact the OS paints rather than the page
  (a native `title` tooltip, a cursor — neither can appear in a screenshot).
- **`logic`** — a pure rule with no rendered surface at all. When the rule is
  about *how values are written*, prefer a **table** over prose: a case may
  declare `table: { columns, rows }`, the gallery renders it into the spec, and
  its `verify()` proves every row against the shipped code — so the table a
  reader sees is generated evidence, not a hand-typed claim.

When a leaf lands in a coded kind *because* the product makes it invisible,
say so in its Notes and name what product change would make it visual — that
is a real finding about the UI, not just a testing limitation.

### The browser is part of the expected

- A golden is only comparable under the **exact Chromium that rendered it**.
  The harness pins the Playwright version and refuses any other
  (`shared/harness/browser.js`); CI installs that pin per run, the Claude
  sandbox ships it globally. **Bumping the pin re-renders every golden** — it
  is a re-baselining, done deliberately and approved like one, never a drive-by
  upgrade.
- When the comparison ever flaps, the fix is **more determinism, not a
  tolerance**: the comparator stays at zero diff. The determinism levers are
  all in one place (the harness): fixed clock via `page.clock`, fixed
  geolocation, seeded `Math.random`, route-fulfilled network, frozen
  animations, `--font-render-hinting=none --force-color-profile=srgb`.

### Traps this harness already paid for (don't re-derive)

- **Geolocation exists only on secure origins.** The fake origin is `https://`
  — route interception fulfils before any TLS, so no certificate is involved.
  On plain http the app silently keeps its built-in simulated clock and the
  whole render lands on the wrong day.
- **The app adopts the device clock only on an in-UK geolocation fix** — the
  harness's fixed location is central Edinburgh precisely so the pinned clock
  is what renders; deny geolocation (or move abroad) and you are rendering the
  app's own pre-set simulated moment instead, a different day file entirely.
- **A CSS freeze does not stop Web-Animations-API animations.** The planner's
  FLIP board diff runs through `element.animate` — the harness stubs it to
  land on end states; without the stub, captures race the animation.
- **Fonts arrive via the Google Fonts CSS URL**, so the vendored `fonts.css`'s
  `url(/__vendor/…)` references resolve against `fonts.googleapis.com` — the
  vendor route must match on path, host-agnostic, or every glyph silently
  falls back and all text shifts by a pixel.
- **Vendoring the web fonts is only half the font problem.** Every character
  they don't carry — an emoji, `▾`, `≤`, a Cyrillic show title — is drawn from
  the fonts *installed on the machine*, so the goldens quietly become a record
  of the renderer's font set. It cost a red CI lane: the walk-time line
  (`🚶 5 min · £16`) measured wider on the GitHub runner, wrapped, and every
  show card came out 21px taller. The harness now launches Chromium under a
  generated `FONTCONFIG_FILE` whose only font directory is
  `harness/vendor/systemfonts/` — the host's fonts cannot reach the page. A new
  emoji or script in the product or the fixtures needs that subset rebuilt
  (see the folder's README), or it renders as tofu.
- **Reproducing a golden-flake locally: use the harness's own pixel comparator
  (`compare.js`), not a raw byte/hash compare.** On 2026-08-11 (#335) a first
  repro script hashed the rendered PNG's bytes across repeated cold renders
  and found a hash difference — looked like a reproduction of the flake, but
  `compare.js` (pixelmatch, zero tolerated diff) passed the identical images
  at 0 pixels differing. A byte-hash compare is strictly tighter than what CI
  actually enforces (bit-exact *pixels*, not encoder bytes), so it manufactures
  false positives; the real comparator is what settles whether a flake is real.
- **A red CI lane's diff image is unreachable from a session — reproduce it
  locally.** `ui-requirements` uploads a `requirements-failure-artifacts`
  artifact, but `download_workflow_run_artifact` hands back a
  `*.blob.core.windows.net` URL and the egress proxy denies it at CONNECT
  (`curl: (56) CONNECT tunnel failed, response 403`). On 2026-08-11 a session
  burned the download and then came back ~4.5 minutes later to re-probe the
  proxy for the same image; the golden it was chasing ended the session
  undiagnosed. Use `get_job_logs` with a large `tail_lines` to learn *which*
  case failed, then re-run that case locally — `npm run test:ui` writes the
  `.actual.png` / `.diff.png` into `shared/.artifacts/` itself.
- **A floating popup dies under a full-page screenshot** (the capture scrolls,
  and scroll dismisses tips/legends/optimizer pops). A popup-state case sets
  `viewportOnly: true` and captures the viewport crop.
- **"Ready" is not `networkidle`.** The pages settle their async work into
  observable state — the footer version popup's text, the search placeholder's
  show count. Wait on those (`case-helpers.js`), plus `document.fonts.ready`.
- **Hover-driven UI must be opened inside `capture()`, not `drive()`.** The
  runner settles the scroll between the two, and scrolling moves an element out
  from under the pointer — which fires `mouseleave` and closes anything the
  hover opened. That is correct product behaviour; the capture just has to
  happen on the right side of it.

### The fixture freeze

- `shared/fixtures/data/` is a snapshot of the **real committed data**, cast by
  the committed builder for state variety (sold-out / free / price-unknown /
  tight / every planner verdict). It is **frozen**: the nightly data refresh
  never touches it, and no case may reach for `data/` live files.
- Every deviation from the source bytes is documented as an `ADJUST` in the
  builder — a fixture edit without one is hand-invented data.
- Re-running the builder re-casts every golden. That is a re-baselining: run it
  only with the owner's approval, and land builder + fixtures + goldens +
  gallery in one reviewed change.

### Golden approval, concretely

- Surface the committed golden alongside `shared/.artifacts/<case>.actual.png`
  and `.diff.png`, and ask the owner (AskUserQuestion popup, per-item, per the
  owner's preferences).
- Say so in the PR body — the goldens are the review surface.
- An intended UI change lands as: spec edit (doc-first, red) → implementation →
  `npm run refresh:ui` → the refreshed PNGs ride the same diff.
