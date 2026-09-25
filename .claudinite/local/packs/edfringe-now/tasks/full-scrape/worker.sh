#!/usr/bin/env bash
#
# full-scrape worker: fetch every show, rebuild the master and every derived
# file from the fresh raw pages, and commit. Parameters ride the item's Context
# as `key: value` bullets — `per`, `min_delay`, `max_delay`, and `commit: false`
# to fetch and rebuild without committing.
set -euo pipefail

cd "$CLAUDINITE_REPO_ROOT"
source .claudinite/local/packs/edfringe-now/tasks/worker-lib.sh

if ! command -v python3 >/dev/null 2>&1; then
  echo "full-scrape: no python3 on the runner" >&2
  exit 1
fi

# One executor run drains several items through one checkout, and an earlier
# task may have left it on its own branch.
git fetch -q origin main
git checkout -q main
git reset -q --hard origin/main

per="$(context_param per 50)"
min_delay="$(context_param min_delay 4)"
max_delay="$(context_param max_delay 9)"
commit="$(context_param commit true)"

python3 scraper/fetch_shows.py --recently-added ANY \
  --per "$per" --min-delay "$min_delay" --max-delay "$max_delay"
python3 scraper/normalize.py

python3 -c "import json; d=json.load(open('site/data/days/index.json')); print('shows:',d['shows'],'venues:',d['venues'],'days:',len(d['dates']))" \
  || echo "summary: n/a"

if [ "$commit" = "false" ]; then
  echo "commit: false — leaving the rebuilt data uncommitted."
  exit 0
fi
commit_regenerated "Update Fringe data (full scrape)" "python3 scraper/normalize.py" \
  data/normalized site/data
