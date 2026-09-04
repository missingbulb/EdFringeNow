#!/usr/bin/env bash
# Converts every direction's standalone screens into canvas artboards named
# <Direction><Screen>.dc.html (stems must be unique across the canvas), then
# seeds the design canvas from canvas.json. Requires the design skill's helper
# path in $SEED (seed-canvas.mjs) and $TEMPLATE (payload.template.html).
set -euo pipefail
cd "$(dirname "$0")"
declare -A NAME=( [postcard]=Postcard [journey]=Journey [bigquestion]=BigQuestion [main]=Main )
declare -A SCREEN=( [01-opening]=Opening [02-question]=Question [03-schedule]=Schedule [04-correct]=Correct )
args=()
for dir in postcard journey bigquestion main; do
  [ -d "$dir" ] || continue
  for f in "$dir"/0[1-4]-*.html; do
    base="$(basename "$f" .html)"
    stem="${NAME[$dir]}${SCREEN[$base]}"
    # The lead direction's schedule screen is the canvas entry artboard.
    if [ "$dir" = main ] && [ "$base" = 03-schedule ]; then stem=Main; fi
    node to-artboard.mjs "$f" "$stem.dc.html"
    args+=(--artboard "$stem.dc.html")
  done
done
node "$SEED" --template "$TEMPLATE" --out festival-trip-planner.html --title "Festival Trip Planner" "${args[@]}" --canvas canvas.json
node "$SEED" --check festival-trip-planner.html
