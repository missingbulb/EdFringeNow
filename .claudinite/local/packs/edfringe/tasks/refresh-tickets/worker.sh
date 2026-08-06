#!/usr/bin/env bash
#
# refresh-tickets worker — the ported body of the retired "Refresh today's ticket
# status (hourly)" workflow's job.
#
# The Claudinite scheduler runs this as its `agent_preprocessing` subprocess with
# cwd = this task directory and a hard kill at `agent_preprocessing_timeout`, so
# the first thing it does is move to the repo root the scheduler hands it. There
# is no agent: a non-zero exit is the failure signal, and the scheduler converges
# that to one open `needs-human` issue (the old job's `report-failure` twin).
#
# It only reaches here when task.mjs's precondition says the Edinburgh clock is in
# August, between 08:00 and 23:59 — that gate is the whole of the retired
# workflow's sixteen cron lines. The script itself stays a no-op on any date with
# no day file, so a mis-timed run costs nothing.
#
# Python: the scheduler workflow is a vendored thin shim and cannot carry a
# `setup-python` step, so this uses the runner's own `python3` rather than the
# retired workflow's pinned 3.11. The scraper is standard-library only, so any
# maintained 3.x satisfies it; the guard below fails loudly if there is none.
set -euo pipefail

cd "${CLAUDINITE_REPO_ROOT:-$(git rev-parse --show-toplevel)}"

if ! command -v python3 >/dev/null 2>&1; then
  echo "refresh-tickets: no python3 on the runner" >&2
  exit 1
fi

# The retired workflow exposed a `date` dispatch input for testing; a task has no
# inputs, so the scheduled default (today, Europe/London) is the only mode. A
# one-off is still available by hand:
# `python3 scraper/refresh_ticket_status.py --date 2026-08-10`.
python3 scraper/refresh_ticket_status.py

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add data/days data/venues.json
if git diff --staged --quiet; then
  echo "No ticket-status changes this hour."
else
  git commit -m "Refresh today's ticket status"
  # Explicit refspec: the scheduler's `actions/checkout` leaves the checked-out
  # branch with no upstream, so a bare `git push` aborts ("no upstream branch",
  # exit 128) and every hourly run files a needs-human issue (#231).
  git push origin HEAD:main
fi
