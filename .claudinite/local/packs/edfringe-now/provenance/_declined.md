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
