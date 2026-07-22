#!/usr/bin/env bash
#
# Point git at the repo's tracked hooks in .githooks/, enabling the pre-commit
# verification gate. Run once per clone:  npm run setup-hooks  (or bash directly)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config core.hooksPath .githooks
echo "core.hooksPath → .githooks — pre-commit verification is now enabled."
echo "(Bypass a single commit with: git commit --no-verify)"
