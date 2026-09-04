#!/usr/bin/env bash
#
# The repo's single verification gate: unit tests, JavaScript parse-checks,
# Python byte-compilation, and the Claudinite conformance sweep. Both the
# pre-commit hook (.githooks/pre-commit) and the pipeline's PR gate
# (.github/workflows/static-site-ci.yml, which runs it as the test_command named
# in .github/site.config) run *this* script.
#
# The conformance sweep is here because it was the one CI step this script did
# not cover, and the gap was not theoretical: a commit that passed `npm run
# verify` went red on GitHub for a blocking `claudinite-isolation` finding, and
# cost an extra round trip to notice and a third commit to fix. A gate you can
# pass and still break CI is not a gate. It is the slowest step by an order of
# magnitude, so it runs last — a syntax error should still fail in a second.
#
# CI runs the sweep again in its own earlier step (that workflow is vendored
# from the static-website pack and re-vendored on refresh, so it is not ours to
# trim). The duplicate costs CI ~9s and buys separate attribution there; the
# point of this copy is the pre-commit and local path, where nothing ran it.
#
# Still NOT the whole of CI: `npm run test:ui` (the ui-requirements job),
# scripts/build-site.sh and the assemble-site dry run are outside this script.
# Green here means the fast lanes are green, not that GitHub will be.
#
# A few seconds and dependency-free — everything uses the node / python already
# needed to work on the project.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Unit tests — node --test"
# The shared/ helpers both front-ends import, the Now page's own js/ tests, the
# planner's own tests, plus the local packs' — one glob for each pack's own
# pack.test.mjs (its checks' red-first fixtures), one for the shared task
# declaration test, one for the per-task tests beside each task. Those tests import
# every pack manifest and task declaration, so they are also what parse-checks that
# tree (the syntax sweep below deliberately stays off the .claudinite mount).
# Keep in step with the "test" script in package.json.
# product/requirements/ contributes its default-lane gates here: the coverage
# bijection, the gallery gate, and the pure logic cases. The browser-driven
# screen/behavior lanes are `npm run test:ui` (CI's ui-requirements job), not
# this fast path.
node --test shared/__tests__/*.test.mjs js/__tests__/*.test.mjs plan/lib/__tests__/*.test.mjs product/requirements/*.test.js product/requirements/logic/logic.test.js .claudinite/local/packs/*/*.test.mjs .claudinite/local/packs/edfringe-now/tasks/*.test.mjs .claudinite/local/packs/edfringe-now/tasks/*/*.test.mjs

step "JavaScript syntax — node --check"
# Only our own tracked source: the js/ app, the plan/ planner, the shared/
# code both import, and the scripts/ tooling. Never the vendored .claudinite
# mount (not our code) or the plan/design/ mock (HTML).
js_files=$(git ls-files 'js' 'plan' 'scripts' 'shared' 'product' 'design-concepts' | { grep -E '\.m?js$' || true; } | { grep -v '^plan/design/' || true; })
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
# and the round-trip decoder is covered by plan/lib/__tests__/hydrate.test.mjs.
if command -v python3 >/dev/null 2>&1; then
  python3 scraper/normalize.py --selftest
else
  echo "python3 not installed — skipping (CI always has it)" >&2
fi

step "Claudinite conformance — check_the_world.mjs"
# The same command CI's "Conformance sweep" step runs. World scope: the rules
# that audit repo state as it is now (the work-scope half runs from the Stop
# hook). Blocking findings exit non-zero and fail this script; advisories print
# and pass. `--root .` rather than letting it fall back to CLAUDE_PROJECT_DIR,
# so the sweep always covers the tree this script already cd'd into.
#
# Naming a path inside the mount is the one thing claudinite-isolation forbids
# outside the wiring files; it is excused by name in .claudinite-checks.json's
# `accept` list, with the reason, rather than left to slip through the rule's
# unquoted-path blind spot.
node .claudinite/shared/engine/checks/check_the_world.mjs --root .

printf '\n\033[32m✓ all checks passed\033[0m\n'
