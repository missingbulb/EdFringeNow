#!/bin/sh
# Vets and tests this pack's Go checks against the check SDK of the repo's
# pinned cn, offline: `cn check sdk --out` writes the SDK and the go.mod
# stanza that replaces it, and the checks are copied into a module made for
# this run only, so nothing is written into the repo.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../../../.." && pwd)
cn="$repo/.claudinite/bin/cn"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

"$cn" check sdk --out "$tmp/sdk" >/dev/null
mkdir "$tmp/mod"
{
  printf 'module edfringe.test\n\ngo 1.24\n\n'
  cat "$tmp/sdk/go.mod.stanza"
} >"$tmp/mod/go.mod"
cp "$here"/*.go "$tmp/mod/"
cd "$tmp/mod"
# The live-gate tests run the checks over this repo itself.
export EDFRINGE_REPO="$repo"
GOFLAGS=-mod=mod GOPROXY=off go vet .
GOFLAGS=-mod=mod GOPROXY=off go test "$@" .
