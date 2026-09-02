# Trip planner mockups

Design mockups for a festival trip planner (issue #587): choose the festival,
set trip preferences, correct a draft schedule, and the content chooser.
The published canvas: https://claude.ai/code/artifact/d0a157cc-7186-48fa-a57d-712206c727a2

Each artboard is `<Name>.body.html` plus `<Name>.css`, sharing `_common.css`
(tokens lifted from `plan/plan.css`). `./assemble.sh` produces the
`<Name>.dc.html` artboards; `canvas.json` lays them out. The schedule is
`Main` because the canvas opens on it.
