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

for q in "The Piemaker" "Waverley station" "Camera Obscura" "Malmaison" "BrewDog" "Summerhall" "zzzqqqxyzzy"; do
  echo "=== BEGIN ${q} ==="
  curl -sS --max-time 30 -A "$UA" --get "https://nominatim.openstreetmap.org/search" \
    --data-urlencode "q=${q}" \
    --data-urlencode "format=jsonv2" \
    --data-urlencode "limit=5" \
    --data-urlencode "addressdetails=1" \
    --data-urlencode "bounded=1" \
    --data-urlencode "viewbox=${VIEWBOX}"
  echo ""
  echo "=== END ${q} ==="
  sleep 2
done
