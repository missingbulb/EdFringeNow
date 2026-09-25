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
