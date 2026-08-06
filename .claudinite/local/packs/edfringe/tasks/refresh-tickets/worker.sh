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

# Return the checkout to `main` before touching anything. The scheduler runs
# EVERY due task in ONE checkout, and `basics/baselining`'s deliver() does
# `git checkout -B <maintenance branch>` and never switches back — so a task
# ordered after a delivering baselining inherits a branch that has no upstream,
# which is what killed the push with exit 128 in #231 and #141 (both slots where
# baselining delivered first). Switching back here — BEFORE the scraper writes
# anything — puts the commit on the branch it was always meant to land on.
# Not `git push origin HEAD:main`: from a polluted checkout that would push
# baselining's unreviewed converge straight to main, past its maintenance PR.
current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "refresh-tickets: checkout was left on '$current_branch' — returning to main." >&2
  git checkout main
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
  # `main` is the branch actions/checkout created and set tracking on, so a bare
  # push resolves correctly; the guard above is what guarantees we are on it.
  git push
fi
