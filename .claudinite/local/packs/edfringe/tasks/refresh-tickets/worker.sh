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
# inputs, so the scheduled default (today onward, Europe/London) is the only mode.
# A one-off is still available by hand:
# `python3 scraper/refresh_ticket_status.py --date 2026-08-10`.
python3 scraper/refresh_ticket_status.py

git config user.name "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
# `data/normalized` is what makes this reach the planner at all: the script now
# writes fresh statuses through the master and regenerates from it, so the file
# the planner actually loads (availability.min.json) is in this commit. Staging
# only the day files — as this did until #249 — meant the hourly refresh
# succeeded every hour and changed nothing the planner could see.
#
# The bulky catalogue is staged too but will not normally appear in the diff:
# it carries no ticket status any more, so regenerating it over an unchanged
# master reproduces it byte-for-byte. That is deliberate — a catalogue that
# stopped churning hourly is what lets the browser cache it for days.
git add data/normalized data/days data/venues.json
if git diff --staged --quiet; then
  echo "No ticket-status changes this hour."
else
  git commit -m "Refresh ticket status"
  git push
fi
