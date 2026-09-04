# Trip planner mockups

Design mockups for a festival trip planner (issue #587).
The published canvas: https://claude.ai/code/artifact/d0a157cc-7186-48fa-a57d-712206c727a2

## v2 — the illustrated wizard (current)

`v2/` holds the second pass, after the owner judged the first too much like
an enterprise app. Three designers each produced four standalone screens in
a different direction (`postcard/`, `journey/`, `bigquestion/`), two reviews
ranked them (`REVIEW-ux.md`, `REVIEW-users.md`), and the winner was revised
into the six-screen lead set in `main/`. Each folder's `REPORT.md` is the
designer's own account; `BRIEF.md` is what they worked to.

Every screen is a self-contained HTML file, 1440px wide, with inline SVG
clipart. `v2/assemble-v2.sh` converts them into canvas artboards
(`to-artboard.mjs`) and seeds the canvas laid out by `v2/canvas.json`; it
needs the design skill's helper (`SEED`) and template (`TEMPLATE`) paths.

## v1 — superseded

The top-level `*.body.html` + `*.css` artboards are the first pass, kept
for the record; `assemble.sh` still builds them.
