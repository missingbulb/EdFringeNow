## 2026-07-23 · declined · an ad-hoc PR with no linked issue leaves the capture nothing to anchor to (#85)
- **Source:** four captured conversation logs, in the conversation-extract pass of #85.
- **Reason:** fleet-wide canon workflow ergonomics, not an EdFringeNow lesson; it belongs to the
  promote stage, not a local pack.
- **Actor:** the conversation-extract run, merged by @missingbulb (owner).

## 2026-07-27 · declined · the scraper's stdout-buffering fix as a rule (#124)
- **Source:** #99, in the conversation-extract pass of #124.
- **Reason:** the `line_buffering` call sits at its usage site in `fetch_shows.py` and
  `normalize.py`, which is where a call-site gotcha belongs.
- **Actor:** the conversation-extract run, merged by @missingbulb (owner).

## 2026-08-18 · declined · recovering from a classifier-blocked workflow commit through the API tools (#402)
- **Source:** a 2026-08-07 conversation log, in the pass of #402 (#400).
- **Reason:** a rule teaching a route around a safety or permission denial is barred whatever its
  framing; reported to the owner instead.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).

## 2026-08-20 · declined · retry a classifier-blocked git push once before escalating (#420)
- **Source:** #351, in the pass of #420 (#419).
- **Reason:** the same shape of standing route-around-a-denial instruction already reverted once
  (#359, #361); flagged for the owner instead.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).

## 2026-09-25 · declined · agentless task.json wrongly carried `agent_instructions` (#877)
- **Source:** conversation-logs capture `pr-873` (growth-extract window, ~2026-09-25T11:45Z): the
  owner interrupted mid-merge ("Agend instructions have to be an MD file. What's going on here?")
  after `agent_instructions: "worker.sh"` was set on five `agent_model: "none"` task.json files, and
  `declarations.test.mjs` had itself asserted the wrong invariant.
- **Reason:** the correction is a Claudinite task-schema/contract detail (what `agent_instructions`
  means under `agent_model: "none"`) — that contract belongs to the canon `claudinite-tasks` pack
  and its `writing-tasks` skill, not to an EdFringeNow project rule; this pass's local packs never
  capture engine/task-contract plumbing.
- **Actor:** the growth-extract run, item #877.

## 2026-09-25 · declined · `worktree-git-standalone` is not a checkable candidate (#877)
- **Source:** the prose-to-checks upgrade pass over this run's own new rule (item #877).
- **Reason:** its mark is a live Bash call's shape under worktree isolation, and the engine's own
  isolation guard already enforces it at PreToolUse with a hard refusal — a local declared or
  action-scope check would duplicate enforcement that already exists upstream, adding nothing; the
  rule stays prose as a composition habit, not a new constraint.
- **Actor:** the growth-extract run, item #877.

## 2026-09-26 · declined · foreground-polling a job already launched with `run_in_background` (#906)
- **Source:** conversation-logs capture `pr-896` (growth-extract window, item #906): a scraper
  background run (`cities/fetch.py`) completed at 14:23:01Z with its own notification, but a
  separate foreground `until pgrep …; do sleep 10; done` poll launched at 14:20:10Z never
  recognized that and ran to the Bash tool's 600s cap, blocking ~7 minutes past the point the
  real result was already in hand.
- **Reason:** already covered — both by this pack's own `no-denial-bypass`-adjacent "Polling with
  an `until` loop" basics rule (write a condition naming the state actually awaited) and, more
  directly, by the harness's own tool-contract guidance that a `run_in_background` job's
  notification is the thing to wait for, never a second foreground poll. Landing it again here
  would restate a rule this repo already carries at the tool-contract level.
- **Actor:** the growth-extract run, item #906.

## 2026-09-27 · declined · designing #917/#918/#919's schema additions to tolerate each other landing in any order (#940)
- **Source:** PRs #917, #918, #919 (growth-extract window, item #940) — three concurrent
  project-thread sessions each added a `festival.toml`/registry field (`subtypes`, `[ticketing]`) or
  referenced ones not yet merged, explicitly designed additive and order-independent ("main ignores
  both until those land"), and all three merged cleanly within the same 15-minute span.
- **Reason:** an already-correct decision each session reasoned out on its own, not a mistake to
  steer away from next time — a rule can't sharpen a choice already reached correctly, and nothing
  here is checkable; additive-schema practice is already the `basics` pack's general
  migration/legacy-tolerance guidance.
- **Actor:** the growth-extract run, item #940.

## 2026-09-27 · declined · parallel worktree subagents conflicting on data-dir-is-generator-output.mjs's shared allowlist (#940)
- **Source:** PR #918 (growth-extract window, item #940) — three dispatched worktree subagents
  (Abu Gosh, Oud, ISRA) each appended their festival's raw-to-generator mapping to the same array;
  cherry-picking their commits into the parent branch produced a git conflict in that one file,
  resolved in under a minute by merging the entries by hand.
- **Reason:** a gotcha tied to one call site (`data-dir-is-generator-output.mjs`'s allowlist)
  belongs as a comment there, not a pack rule — and this pass's write surface never reaches source
  comments.
- **Actor:** the growth-extract run, item #940.

## 2026-09-27 · declined · rebasing PR #920 onto three sibling merges before landing (#940)
- **Source:** PR #920 (growth-extract window, item #940) — the last of four same-morning PRs to
  merge hit a real conflict in `site/planNG/planNG.js` against the three that landed first; the
  session merged main, resolved the code conflict, regenerated the touched festivals'
  `to_serving.py` output plus `index.json`, refreshed one golden, and re-ran the full `npm run
  test:ui` twice (~5 minutes total) before committing.
- **Reason:** already covered — regenerating rather than hand-patching derived output is the
  `data-pipeline` skill's and `working-with-generated-files`'s existing rule, and re-running
  `test:ui` before a merge is `test-ui-before-pixel-change`'s. Nothing here needed guidance the repo
  doesn't already carry.
- **Actor:** the growth-extract run, item #940.
