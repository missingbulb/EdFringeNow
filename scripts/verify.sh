#!/usr/bin/env bash
#
# The repo's single verification gate: unit tests, JavaScript parse-checks,
# Python byte-compilation, and the Claudinite conformance sweep. Both the
# pre-commit hook (.githooks/pre-commit) and the pull-request gate
# (.github/workflows/ci.yml) run *this* script, and nothing else — so passing
# locally and passing on GitHub now mean the same thing.
#
# The conformance sweep is here because it was the one CI step this script did
# not cover, and the gap was not theoretical: a commit that passed `npm run
# verify` went red on GitHub for a blocking `claudinite-isolation` finding, and
# cost an extra round trip to notice and a third commit to fix. A gate you can
# pass and still break CI is not a gate. It is the slowest step by an order of
# magnitude, so it runs last — a syntax error should still fail in a second.
#
# Still NOT the whole of CI: `npm run test:ui` — the ui-requirements job, real
# Chromium against the committed goldens — runs beside this script rather than
# inside it. Green here means the fast lane is green.
#
# A few seconds and dependency-free — everything uses the node / python already
# needed to work on the project.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Unit tests — node --test"
# The shared/ helpers both front-ends import, the Now page's own js/ tests, the
# planner's own tests, plus the local pack's task tests — one glob for the shared
# task declaration test, one for the per-task tests beside each task. Those tests
# import every task declaration, so they are also what parse-checks that tree
# (the syntax sweep below deliberately stays off the .claudinite mount). The
# pack's Go checks have their own step after the conformance sweep.
# Keep in step with the "test" script in package.json.
# product/requirements/ contributes its default-lane gates here: the coverage
# bijection, the gallery gate, and the pure logic cases. The browser-driven
# screen/behavior lanes are `npm run test:ui` (CI's ui-requirements job), not
# this fast path.
node --test site/shared/__tests__/*.test.mjs site/js/__tests__/*.test.mjs site/plan/lib/__tests__/*.test.mjs site/plan2/lib/__tests__/*.test.mjs site/planNG/lib/__tests__/*.test.mjs product/requirements/*.test.js product/requirements/logic/logic.test.js .claudinite/local/packs/edfringe-now/tasks/*.test.mjs .claudinite/local/packs/edfringe-now/tasks/*/*.test.mjs

step "JavaScript syntax — node --check"
# Only our own tracked source: everything the site ships (site/), the scripts/
# tooling, the requirements harness and the design concepts. Never the vendored
# .claudinite mount (not our code) or the plan/design/ mock (HTML).
js_files=$(git ls-files 'site' 'api' 'scripts' 'product' 'design-concepts' | { grep -E '\.m?js$' || true; } | { grep -v '^site/plan/design/' || true; })
# `node --check` takes one file per process, and ~170 sequential node startups
# was the bulk of this script's runtime (4.5s of 7s). xargs -P fans them across
# the cores instead; -n 1 because the flag genuinely accepts only one path.
# xargs exits 123 if any invocation failed, which `set -e` turns into a failure.
if [ -n "$js_files" ]; then
  printf '%s\n' "$js_files" | xargs -P "$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)" -n 1 node --check
  echo "checked $(printf '%s\n' "$js_files" | wc -l | tr -d ' ') JavaScript file(s)"
else
  echo "no JavaScript sources found — skipping"
fi

step "Python syntax — py_compile"
py_files=$(git ls-files 'scraper/*.py')
if [ -z "$py_files" ]; then
  echo "no Python sources found — skipping"
elif command -v python3 >/dev/null 2>&1; then
  # shellcheck disable=SC2086
  python3 -m py_compile $py_files
  echo "checked $(printf '%s\n' $py_files | wc -l | tr -d ' ') Python file(s)"
else
  echo "python3 not installed — skipping (CI always has it)" >&2
fi

step "Normalizer self-test — normalize.py --selftest"
# Exercises the raw→master→day-file→shows.min.json transforms on a fixture (no
# network / no raw data), so the packer and the day-file builder are covered here
# and the round-trip decoder is covered by site/plan/lib/__tests__/hydrate.test.mjs.
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/normalize.py --selftest
else
  echo "python3 not installed — skipping (CI always has it)" >&2
fi

step "Festival data — tool sets, fetcher parse self-tests, converter self-test, serving drift check"
# registry.py --check refuses an edition that names no tool set, and a stale
# editions plan. The fetchers' network half can only be checked against the live
# sites, by the update task or a person; each one's parsing half runs offline and
# is the only verification a fetcher change gets here. The converter's --check
# re-derives every committed serving file from the committed raw and fails on any
# difference, so neither side of that pair can be edited alone.
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/festivals/registry.py --check
  python3 scraper/festivals/migrate_edition_tools.py --selftest
  python3 scraper/festivals/update.py --selftest
  python3 scraper/festivals/common.py --selftest
  for parser in scraper/festivals/*/sources/*/parse.py; do
    [ -e "$parser" ] || continue
    python3 "$parser" --selftest
  done
  python3 scraper/festivals/platforms/eventotron.py --selftest
  python3 scraper/festivals/platforms/spektrix.py --selftest
  python3 scraper/festivals/platforms/eventer.py --selftest
  python3 scraper/festivals/platforms/eventact.py --selftest
  python3 scraper/festivals/platforms/cinematheque.py --selftest
  python3 scraper/festivals/platforms/smarticket.py --selftest
  python3 scraper/festivals/platforms/pdf_grid.py --selftest
  python3 scraper/festivals/platforms/forms_wizard.py --selftest
  python3 scraper/festivals/platforms/eventive.py --selftest
  python3 scraper/festivals/platforms/pretalx.py --selftest
  python3 scraper/festivals/platforms/sched.py --selftest
  python3 scraper/festivals/platforms/nominatim.py --selftest
  python3 scraper/convert/to_serving.py --selftest
  python3 scraper/convert/to_serving.py --check
else
  echo "python3 not installed — skipping (CI always has it)" >&2
fi

step "Festival finder — self-test, the lists' shape, nothing dropped since main"
# The finder's lists only grow; --growth compares against where this branch left
# origin/main, and skips on a checkout that has no origin/main.
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/finder/finder.py --selftest --check --growth origin/main
else
  echo "python3 not installed — skipping (CI always has it)" >&2
fi

step "City data — opening-hours self-test, converter self-test, serving drift check"
# The same contract as the festivals': the sightseeing fetch is by hand, and
# --check re-derives site/data/cities/ from the committed raw.
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/cities/opening_hours.py --selftest
  python3 scraper/cities/to_serving.py --selftest
  python3 scraper/cities/to_serving.py --check
else
  echo "python3 not installed — skipping (CI always has it)" >&2
fi

step "Claudinite conformance — cn check world"
# The same sweep CI's claudinite-ci workflow runs, without its pull-request
# guard. World scope: the rules that audit repo state as it is now (the
# work-scope half runs from the Stop hook). Blocking findings exit non-zero
# and fail this script; advisories print and pass.
sh .claudinite/launch check world

step "Local pack checks — go vet and go test"
# The pack's Go checks, against the SDK of the pinned cn the sweep above
# just installed; includes their live gates over this repo's own tree.
sh .claudinite/local/packs/edfringe-now/checks/test.sh

printf '\n\033[32m✓ all checks passed\033[0m\n'
