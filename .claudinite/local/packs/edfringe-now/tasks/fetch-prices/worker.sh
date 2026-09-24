#!/usr/bin/env bash
#
# fetch-prices worker: price shows into data/prices.json for up to a time budget,
# fold the prices into the site data, commit, and requeue this item while shows
# remain. The whole pass takes hours; one run has under one. The cache is
# resumable, so each run continues where the last one committed.
#
# Parameters ride the item's Context as `key: value` bullets: `slug` (price one
# show), `limit` (stop after N newly priced shows, and do not continue),
# `batch_size`, `min_delay`, `max_delay`, and `commit: false`.
set -euo pipefail

cd "$CLAUDINITE_REPO_ROOT"
source .claudinite/local/packs/edfringe-now/tasks/worker-lib.sh

if ! command -v python3 >/dev/null 2>&1; then
  echo "fetch-prices: no python3 on the runner" >&2
  exit 1
fi

git fetch -q origin main
git checkout -q main
git reset -q --hard origin/main

slug="$(context_param slug '')"
limit="$(context_param limit '')"
batch_size="$(context_param batch_size 25)"
min_delay="$(context_param min_delay 1)"
max_delay="$(context_param max_delay 2.5)"
commit="$(context_param commit true)"

python3 scraper/fetch_prices.py --selftest

# Leaves room under code_work_timeout for the listing before the loop and the
# regeneration and push after it.
args=(--batch-size "$batch_size" --min-delay "$min_delay" --max-delay "$max_delay" --time-budget 2400)
if [ -n "$slug" ]; then args+=(--slug "$slug"); else args+=(--all); fi
if [ -n "$limit" ]; then args+=(--limit "$limit"); fi

log="$(mktemp)"
set +e
python3 scraper/fetch_prices.py "${args[@]}" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
set -e

# Even after a failed fetch: the cache holds every show that was priced, and the
# committed site data must not lag the committed cache.
python3 scraper/normalize.py --minify-from-master

python3 - <<'PY' || echo "summary: n/a"
import json
shows = list(json.load(open('data/prices.json'))['shows'].values())
per = [s for s in shows if s.get('perfs')]
print('priced shows:', len(shows), '| per performance:', len(per),
      '| legacy whole-show:', len(shows) - len(per))
print('performances priced:', sum(len(s['perfs']) for s in per))
PY

if [ "$commit" != "false" ]; then
  commit_regenerated "Update ticket prices" "python3 scraper/normalize.py --minify-from-master" \
    data/prices.json data/normalized site/data
fi

# A run stopped by its time budget has shows left: come back for them. Shows that
# failed in this run are unpriced, so a later run retries them, and the run that
# finishes the pass reports its own failures.
if grep -q "time budget reached" "$log"; then
  echo "claudinite-requeue: $(date -u +%Y-%m-%dT%H:%M:%SZ) shows remain unpriced"
  exit 0
fi
exit "$status"
