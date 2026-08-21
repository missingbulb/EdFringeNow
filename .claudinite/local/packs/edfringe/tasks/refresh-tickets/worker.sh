#!/usr/bin/env bash
#
# refresh-tickets worker — refreshes ticket status and commits the result.
#
# The Claudinite scheduler runs this as its `code_work` subprocess with
# cwd = this task directory and a hard kill at `code_work_timeout`, so
# the first thing it does is move to the repo root the scheduler hands it. There
# is no agent: a non-zero exit is the failure signal, and the scheduler converges
# that to one open `needs-human` issue.
#
# It only reaches here when task.mjs's precondition passes; the script itself
# stays a no-op on any date with no day file, so a mis-timed run costs nothing.
#
# Python: the scheduler workflow is a vendored thin shim and cannot carry a
# `setup-python` step, so this uses the runner's own `python3`. The scraper is
# standard-library only, so any maintained 3.x satisfies it; the guard below
# fails loudly if there is none.
set -euo pipefail

cd "${CLAUDINITE_REPO_ROOT:-$(git rev-parse --show-toplevel)}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "refresh-tickets: no python3 on the runner" >&2
  exit 1
fi

# Return the checkout to `main` before touching anything: the scheduler runs
# every due task in one checkout, and an earlier task may have left it on
# another branch (#231). Switching back BEFORE the scraper writes anything puts
# the commit on the branch it must land on. Not `git push origin HEAD:main`:
# from a polluted checkout that would push another task's unreviewed work
# straight to main.
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "refresh-tickets: checkout was left on '$current_branch' — returning to main." >&2
  git checkout main
fi

# The scheduled default: today onward, Europe/London. A one-off for a single
# date is available by hand — `refresh_ticket_status.py --date 2026-08-10`.
python3 scraper/refresh_ticket_status.py

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
# `data/normalized` is what makes this reach the planner at all: the script
# writes fresh statuses through the master and regenerates from it, so the file
# the planner actually loads (availability.min.json) is in this commit (#249).
# Files the regeneration reproduces byte-for-byte simply never enter the diff.
git add data/normalized data/days data/venues.json
if git diff --staged --quiet; then
  echo "No ticket-status changes today."
else
  git commit -m "Refresh ticket status"
  # `main` is the branch the checkout set tracking on, so a bare push resolves
  # correctly; the guard above is what guarantees we are on it.
  git push
fi
