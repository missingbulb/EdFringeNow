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

Once the hook has already fired, the remedy is a plain `git commit --amend` on
the latest commit — the finding's own `Fix:` text says exactly that. On
2026-08-07 (#251) a session instead wrote a custom `msg-filter` script and ran
`git filter-branch` across all 5 commits since `origin/main` to backdate the
issue reference into every one, verified the resulting tree was byte-identical,
then force-pushed — history-rewriting machinery for a finding a single amend
already satisfies, and needless risk (a wrong regex, a bad force-push) for no
benefit over the one-line fix.

## `Comment class:` arms rules — repo tooling is never a `feature` here

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

## `npm run verify` green is not CI green — the UI lane runs elsewhere

Since #347 `scripts/verify.sh` runs `check_the_world.mjs` itself, so the local
gate and the pre-commit hook now cover the conformance findings CI blocks on.
It still does **not** cover `npm run test:ui` — the separate `ui-requirements`
workflow, real Chromium against the committed goldens — nor `build-site.sh` or
the assemble-site dry run. So anything that can move a rendered pixel (`js/`,
`plan/`, `shared/`, `index.html`, the CSS, the fixtures) is unverified until
`npm run test:ui` has been run locally, however green `verify` is.

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

## Get the browser's own evidence before guessing a repro for a live-data bug report

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
stale-vs-fresh cache generation mismatch — see
`.claudinite/local/packs/edfringe-data/RULES.md`).

This site has three caching layers (the browser's own HTTP cache, the
`caches` API in `shared/data-cache.js`, and `localStorage` TTL stamps), and
only the browser's own evidence disambiguates which one is actually in play.
Ask for a screenshot of DevTools' Network tab and Application → Cache Storage
panel as the *first* response to a "the live site shows wrong data" report,
before building a speculative local repro.

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

## GitHub MCP call shapes that cost round-trips here

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
- **`list_pull_requests`'s `merged` field still always reads `false`, but
  `merged_at` now populates.** Reconfirmed 2026-08-23: five recently-merged
  PRs (#480, #472, #469, #466, #464) all listed with `merged: false` and a
  real `merged_at` timestamp, `fields` or not — `merged` is still unusable for
  landed-ness, but `merged_at`'s presence is new (it used to read `null` on
  every row, merged or not). Don't switch to reading it in place of a
  targeted check, though: this run only confirmed it's populated for PRs that
  really are merged, not that it stays `null` for one that's closed unmerged,
  so it isn't proven as a bulk-listing substitute yet. For landed-ness, grep
  `origin/main`'s commit subjects for the squash-merge's `(#N)`, or call
  `pull_request_read get` on the one PR you actually care about — confirmed
  today on #480: `merged: true`, `merged_at` populated, both correct.
- **`get_job_logs` needs more than a bare `run_id`.** It rejects with "job_id
  is required when failed_only is false" unless you pass `failed_only: true`
  for a whole-run summary, or fetch a `job_id` first via
  `actions_list method=list_workflow_jobs`. It also 404s for a job still
  `in_progress` — wait for the job to finish before calling it.
- **Don't `curl` `api.github.com` directly for a run's status — it returns a
  look-alike JSON error, not real data.** A raw REST call there comes back
  `{"message":"GitHub access is not enabled for this session..."}` — valid
  JSON, no thrown exception, but with no `status`/`conclusion` field. A poll
  loop that greps for one of those fields silently never matches and just
  sleeps forever with nothing surfacing the failure (measured: 13m35s on
  2026-08-07/#249, caught only because the user said "I think it's done").
  Poll through the GitHub MCP tools (`actions_get`/`actions_list`) instead —
  they're the credentialed path.
- **`pull_request_read method=get_status` is a dead signal on this repo.** It
  reports the legacy commit-status API, not check runs, and can read
  `{"state":"pending","total_count":0}` on a PR whose checks have already
  succeeded — which looks exactly like "CI hasn't started" if it's the first
  thing you check. Use `method=get_check_runs` for the real answer.
- **`pull_request_read method=get_files` overflows the same way
  `actions_list` does, on an ordinary large PR — treat it as "skip the diff,"
  not something to retry.** PR #207 (46 files, +2554/-274) blew the token
  limit on `get_files` at `perPage: 100`, spilling its output to a side file
  instead of truncating. For a landed-status judgment the file-level diff
  usually isn't needed — `get` (title/body) plus `list_commits` is normally
  enough; don't chase the spill or retry at a lower `perPage`.
- **A deleted workflow file's old runs keep the workflow listed in the Actions
  tab, and no session tool can clear them.** Removing a `.yml` from every
  branch doesn't remove its run history, and clearing the ghost registration
  needs `DELETE /repos/.../actions/runs/{run_id}` — an `actions: write`
  endpoint the GitHub MCP server's toolset doesn't expose (read/list/get-logs/
  dispatch only). Hand it to the owner (their own UI cleanup, or a one-time
  owner-sanctioned cleanup workflow) rather than hunting for a session-side
  fix that doesn't exist.

## `subscribe_pr_activity` gets denied here when used mid-session — poll directly, don't retry

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

## A dispatched subagent's work is void if you don't actually wait for it

On 2026-08-09 (#296) the executor backgrounded a `growth-dedup` subagent
(model `opus`) and stated it would act on the subagent's completion
notification — then, before that notification arrived, independently made the
same three prune edits to this file itself, committed, pushed, and opened
PR #304 at 04:59:14. The subagent's own report, reaching the identical
three-item conclusion, didn't land until 04:59:58 — by then entirely
redundant, its ~4m46s run wasted. After stating a wait-for-subagent plan,
actually stop: don't perform the same mutation yourself in the same session
before its notification (or your own scheduled wakeup) fires.

## The sandbox checkout is shallow — unshallow before comparing branch history

`git rev-parse --is-shallow-repository` reads `true` here by default (one run
measured 53 commits on `git log --oneline` against a real 454, two grafts).
Every branch that predates the shallow graft then fails `git merge-base`
against `main`, and `single-branch-status`'s own step 4 reads that failure as
**orphaned — a human must look**. Left unfixed this silently turns a routine
tidy-branches pass into "37 orphaned branches, escalate all" — caught once by
luck (2026-08-16, #375) before it was written to the tracker. Before any
cross-branch history comparison:
`git fetch origin '+refs/heads/*:refs/remotes/origin/*' --prune && git fetch --unshallow`,
then confirm `is-shallow-repository` reads `false`.

## A `[claudinite-task]` needs-human issue is one failed slot, not proof of a recurring failure

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

**Don't resolve that by pointing at a path inside `.claudinite/`.** On
2026-08-12 (#341) the sweep applying this very rule replaced a trimmed
comment in `scraper/README.md` with "see the declarations under
`.claudinite/local/packs/edfringe/tasks/`" — which is exactly what the
`claudinite-isolation` check bars (a consumer file referencing an internal
`.claudinite` path) and turned CI red on the very next commit. Point at the
pack's own repo-level docs instead, or say nothing.

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

## A `wiki-growth` pass's competitor research is WebSearch, not WebFetch

Direct `WebFetch` calls to a third-party Fringe-planner site are a predictable
dead end, not a defensible first attempt: on 2026-08-09 (#300) six different
competitor domains (`fringe-finder.netlify.app`, `edfringeplanner.co.uk`,
`fringeplan.com`, `planyourfringe.com`, `www.edinburghfestivalcity.com`,
`www.edfringeplanner.co.uk`) all failed `EGRESS_BLOCKED` in the same run,
while `WebSearch` snippets supplied every feature/claim/pricing detail the
page itself would have. Go straight to `WebSearch` for an external
competitor's product and cite the snippet's publisher, per the product-wiki
pack's own sourcing rule, rather than trying a direct fetch first.

## A capture pass must never land a rule that teaches routing around a safety or permission denial

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
