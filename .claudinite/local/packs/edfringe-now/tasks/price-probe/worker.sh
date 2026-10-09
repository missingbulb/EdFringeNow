#!/usr/bin/env bash
#
# price-probe worker: print one show's raw performancePrices payload into the run
# log. The show is the item's Context bullet `slug: <edfringe slug>`.
set -euo pipefail

cd "$CLAUDINITE_REPO_ROOT"
source .claudinite/local/packs/edfringe-now/tasks/worker-lib.sh

slug="$(context_param slug '')"
if [ -z "$slug" ]; then
  echo "claudinite-needs-human: action — add a Context bullet \`slug: <edfringe slug>\` naming the show to probe"
  exit 1
fi

python3 scraper/fetch_prices.py --slug "$slug" --print-raw --out "$(mktemp -d)/cache.json"
