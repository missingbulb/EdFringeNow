#!/usr/bin/env bash
#
# The repo's single verification gate: unit tests, JavaScript parse-checks, and
# Python byte-compilation. Both the pre-commit hook (.githooks/pre-commit) and
# CI (.github/workflows/ci.yml) run *this* script, so "green locally" and
# "green on GitHub" mean exactly the same thing.
#
# Fast (well under a second) and dependency-free — everything uses the node /
# python already needed to work on the project.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Unit tests — node --test"
node --test plan/lib/__tests__/*.test.mjs

step "JavaScript syntax — node --check"
# Only our own tracked source: the js/ app and the plan/ planner. Never the
# vendored .claudinite mount (not our code) or the plan/design/ mock (HTML).
js_files=$(git ls-files 'js' 'plan' | { grep -E '\.m?js$' || true; } | { grep -v '^plan/design/' || true; })
js_count=0
for f in $js_files; do
  node --check "$f"
  js_count=$((js_count + 1))
done
echo "checked ${js_count} JavaScript file(s)"

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

printf '\n\033[32m✓ all checks passed\033[0m\n'
