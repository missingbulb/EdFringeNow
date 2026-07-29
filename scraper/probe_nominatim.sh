#!/usr/bin/env bash
# THROWAWAY PROBE — deleted before the PR (see .claude/skills/probe-edfringe-api).
#
# Captures real Nominatim (OpenStreetMap geocoder) responses for representative
# Edinburgh queries, so js/__tests__ fixtures are recorded from the live API
# rather than hand-written. The sandbox egress proxy blocks
# nominatim.openstreetmap.org, so this runs on a GitHub Actions runner and the
# job log is the return channel.
#
# Nominatim usage policy: identify the app and stay ≤1 request/second — hence
# the User-Agent and the sleep between queries.
set -euo pipefail

UA="EdFringeNow test-fixture capture (https://github.com/missingbulb/EdFringeNow)"
VIEWBOX="-3.46,56.0,-3.02,55.87" # lng,lat corners bounding greater Edinburgh

# Round 2: bounded=1 proved to search only amenity tags inside the box — it
# missed Edinburgh Waverley for "Waverley station" and found no "The Piemaker"
# at all. This round: viewbox as a ranking bias WITHOUT bounded, expecting the
# app to filter to the Edinburgh box client-side.
for q in "Waverley station" "Edinburgh Waverley" "The Piemaker" "Camera Obscura" "Malmaison" "BrewDog" "zzzqqqxyzzy"; do
  echo "=== BEGIN ${q} ==="
  curl -sS --max-time 30 -A "$UA" --get "https://nominatim.openstreetmap.org/search" \
    --data-urlencode "q=${q}" \
    --data-urlencode "format=jsonv2" \
    --data-urlencode "limit=5" \
    --data-urlencode "addressdetails=1" \
    --data-urlencode "viewbox=${VIEWBOX}"
  echo ""
  echo "=== END ${q} ==="
  sleep 2
done
