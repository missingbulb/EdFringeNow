# edfringe-now — this repo's own rules

Lessons this repo paid for once. A lesson that would hold in another repo belongs in the
Claudinite canon instead. The data pipeline's rules are the `data-pipeline` skill and the
requirements harness's are the `requirements-harness` skill; each loads when its paths are edited.

## Delivering work

- **Asking how to fix a structural or architectural complaint via `AskUserQuestion`** — offer
  restructuring itself as one option, not only mechanism-level tweaks to the existing shape; the
  owner's free-text answers have named the restructure nobody offered.
  (askuserquestion-structural-option)

- **Opening a PR for a work item's own issue** (a bot-filed `[claudinite-work]` item or a person's
  marked ad-hoc issue) — reference it without `Closes #N`: GitHub's auto-close beats
  `converge-item.mjs` and leaves the issue closed but still wearing its live status label.
  (never-closes-n-own-issue)

- **Writing a PR body** — this repo has no PR template, so write it from the commit message
  without searching for one. (no-pr-template)

- **Reaching for `verify-in-production` after merging a change to what the site renders or
  does** — file nothing: the goldens, `npm run test:ui` and a look at the served page run before
  the merge. Reserve it for non-user-facing infra whose effect first appears in a deploy, a
  scheduler slot or a CI lane. (verify-in-production-infra-only)

- **Writing a duration or before/after number into a commit or PR body** — compute it from real
  timestamps, never a felt sense of elapsed time around unconsumed background sleeps.
  (measured-duration-real-timestamps)

- **Landing a lesson that tells a session to retry, ignore or explain away a permission, security
  or classifier denial** — don't, however much retry evidence backs it: a checked-in rule is a
  standing bypass every unattended session loads. Report a recurring denial to the owner instead.
  (no-denial-bypass-rules)

## Verifying a change

- **Calling a change under `site/` or the requirements fixtures done** — run `npm run test:ui`
  locally: `npm run verify` never compares the goldens, and CI's `ui-requirements` lane skips them
  on a diff outside `site/` and `product/`. (test-ui-before-pixel-change)

- **Verifying a UI change** — look at it: serve `site/` (not the repo root) with
  `python3 -m http.server 8000` and drive `http://localhost:8000` with the preinstalled
  Chromium; the pages fetch their data, so a `file://` open fails. For `/plan`, a slug-per-line
  text file works as a favourites list. (serve-site-to-look)

- **Scripting Playwright** — import the global build by its ESM entry and launch with no
  `executablePath`; `PLAYWRIGHT_BROWSERS_PATH` already points at the matching browser.
  (launch-playwright-executablepath)

  ```js
  import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
  ```

- **A bare `import 'playwright'` failing with `ERR_MODULE_NOT_FOUND`** — use the absolute import
  above rather than `npm i playwright`: a fresh install pulls a newer Playwright that wants a
  browser build the image doesn't ship, and in the repo root it dirties `package.json`.
  (npm-playwright-scratchpad)

- **The Now page throwing `L is not defined` under Playwright** — Leaflet loads from `unpkg.com`,
  which the browser can't reach here; route `https://unpkg.com/**` to the matching file in
  `product/requirements/shared/harness/vendor/leaflet/` before navigating. (site-index-htmls)

- **Asserting a driven page logged no errors** — filter failed requests to off-box hosts (Google
  Fonts, map tiles, anything the browser can't tunnel to); they fail on every run and are not
  application errors. (known-noisy-console)

- **A "the live site shows wrong data" report** — ask first for screenshots of DevTools' Network
  tab and Application → Cache Storage panel, before building a local repro: three caching layers
  can produce the identical symptom, and only the browser's evidence says which is in play.
  (live-data-bug-browser-evidence)

## The sandbox and its network

- **About to report a capability as unavailable** — probe it in this session first, whatever
  this file says; the egress policy changes from day to day. (report-capability-unavailable)

  ```sh
  curl -sS -o /dev/null -w "%{http_code}\n" --max-time 15 https://<host>/
  ```

- **Reading a 403 from the proxy** — `curl -v` tells you whose it is: `CONNECT tunnel failed,
  response 403` is a policy denial, the same code after a negotiated tunnel is the origin
  refusing you. `curl -sS "$HTTPS_PROXY/__agentproxy/status"` lists recent policy rejections.
  (reading-403-proxy)

- **Checking what the deployed site serves** — `curl https://www.edfringenow.com/…` rather than
  reasoning from the working tree, but the response is CDN-cached: re-check after a delay before
  reading a stale 200 as a failed deploy. (checking-deployed-site)

- **Needing a screenshot of an off-box site headless Chromium can't tunnel to** — route every
  request through `page.route('**/*', …)` fulfilled by `curl`, where the probe shows `curl`
  reaches the host. (offsite-screenshot-via-curl)

- **Building a command or poll on `gh`** — it is not installed here; use the GitHub MCP tools,
  and never suppress a poll condition's stderr, which is what would have said so.
  (no-gh-cli)

## GitHub and CI

- **Calling `actions_list` for workflow runs** — always pass `perPage`; without it the call
  overflows the tool-result limit on this repo's history. (actionslist-listworkflowruns-overflows)

- **Checking whether a PR merged via `list_pull_requests`** — read `merged_at` for non-null; the
  `merged` field decodes `false` even for a merged PR. (listpullrequestss-merged-field)

- **`pull_request_read method=get_files` overflowing** — retry at a smaller `perPage` (10 works
  where 100 overflows), or answer from `get` plus `get_commits`. (pullrequestread-method-getfiles)

- **A CI job stuck `queued` until it auto-cancels, or dying in "Prepare all required actions"** —
  that is a GitHub outage, not this PR's failure: say what local `verify`/`test:ui` covers, and
  don't recommend waiting it out. (ci-infra-outage-tells)

- **A `[claudinite-task]` needs-human issue piling up bot comments** — the watchdog is nagging
  about one unexecuted slot, not reporting a recurring failure; count what landed
  (`git log --grep=<worker's commit subject>`) and read that slot's job log before shipping a fix.
  (needs-human-one-slot)

## The site's code

- **Writing behaviour more than one page needs** — put it in `site/shared/` and import it from
  each page; never copy it. `site/plan/lib/`'s DOM-free engine (`engine.js`, `travel.js`,
  `itinerary.js`, `availability.js`) is shared with `site/planNG/`, so it never learns one
  festival's specifics. (cross-page-in-shared)

## Product research and design

- **Researching a competitor for a `wiki-growth` pass** — fetch the competitor's page first, and
  fall back to `WebSearch` only once the fetch fails, citing the snippet's publisher.
  (competitor-fetch-first)

- **Dispatching a research subagent for a long, multi-round wiki pass** — give it an explicit
  budget ("finish with a few NOT FOUNDs rather than dig exhaustively"): a subagent killed
  mid-run hands back no report at all. (research-subagent-budget)

- **Building a first-pass UI/UX mockup** — default to graphics-first, minimal-text, wizard-style
  screens that hide answered questions; the owner rejects generic buttons-and-prose screens.
  (mockup-graphics-first)
