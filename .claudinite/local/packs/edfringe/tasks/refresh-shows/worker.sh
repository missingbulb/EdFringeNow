#!/usr/bin/env bash
#
# refresh-shows worker — the ported body of the retired
# "Refresh edfringe shows (daily)" workflow's job.
#
# The Claudinite scheduler runs this as its `agent_preprocessing` subprocess with
# cwd = this task directory and a hard kill at `agent_preprocessing_timeout`, so
# the first thing it does is move to the repo root the scheduler hands it. There
# is no agent: a non-zero exit is the failure signal, and the scheduler converges
# that to one open `needs-human` issue (the old job's `report-failure` twin).
#
# Lightweight top-up: fetch only shows added/updated in the last seven days,
# merge them into the existing normalized master, regenerate the venue + per-day
# files, and commit any changes.
#
# This is a CATALOGUE top-up, and only that. `--recently-added LAST_SEVEN_DAYS`
# never re-reads a show the festival hasn't touched, so it is not — and was never
# — a source of fresh ticket status for the existing catalogue (#249). That job
# belongs to refresh-tickets, which runs hourly during August and now covers
# every remaining date rather than only today. Widening this task's window would
# duplicate that work at a much higher fetch cost.
#
# Python: the scheduler workflow is a vendored thin shim and cannot carry a
# `setup-python` step, so this uses the runner's own `python3` rather than the
# retired workflow's pinned 3.11. The scraper is standard-library only, so any
# maintained 3.x satisfies it; the guard below fails loudly if there is none.
set -euo pipefail

cd "${CLAUDINITE_REPO_ROOT:-$(git rev-parse --show-toplevel)}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "refresh-shows: no python3 on the runner" >&2
  exit 1
fi

# The retired workflow exposed a `window` dispatch input; a task has no inputs, so
# the scheduled default is the only mode. A one-off wider sweep is still available
# by hand: `python3 scraper/fetch_shows.py --recently-added ANY`.
python3 scraper/fetch_shows.py --recently-added LAST_SEVEN_DAYS --min-delay 4 --max-delay 9
python3 scraper/normalize.py --merge

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add data/normalized data/venues.json data/days
if git diff --staged --quiet; then
  echo "No data changes today."
else
  git commit -m "Refresh Fringe data (daily top-up)"
  git push
fi
