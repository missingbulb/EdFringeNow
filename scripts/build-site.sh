#!/usr/bin/env bash
#
# The site's build step — everything that must happen to the tree before the
# publish set is assembled. Named by `build_command` in .github/site.config, so
# the release pipeline and the pull-request gate run exactly this, and a change
# here is exercised on the PR before it can reach a deploy.
#
# These were two inline steps of the hand-rolled pages.yml the static-website
# pack replaces; the logic is unchanged and it produces the same two files.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# The build stamp the debug pill shows: the last commit's time, in the timezone
# the festival is followed from, so "when was this built" reads the way a user
# expects rather than in UTC.
TIME=$(TZ='Asia/Jerusalem' git log -1 --date=format-local:'%Y-%m-%d %H:%M' --format=%cd)
printf 'window.__BUILD__ = { time: "%s" };\n' "$TIME" > js/build-info.js
echo "Stamped build time $TIME (Israel) into js/build-info.js"

# The Cloudflare Web Analytics beacon token, declared in site.config's build_vars
# and exported into this script's environment by the pipeline.
#
# On the pipeline the else-branch is unreachable: a declared build_var with no
# value fails the run before the build starts, precisely so a deploy can never
# publish a page whose beacon is silently dead. The branch is here for the OTHER
# caller — a local run or a fork, where the variable legitimately does not exist
# and leaving the placeholder in place (analytics no-ops) is the right outcome.
if [ -n "${CLOUDFLARE_ANALYTICS_TOKEN:-}" ]; then
  sed -i "s#REPLACE_WITH_CLOUDFLARE_WEB_ANALYTICS_TOKEN#${CLOUDFLARE_ANALYTICS_TOKEN}#" js/analytics.js
  echo "Injected the Cloudflare Web Analytics token from CLOUDFLARE_ANALYTICS_TOKEN."
else
  echo "CLOUDFLARE_ANALYTICS_TOKEN is not set (local run or fork) — analytics stays off, placeholder retained."
fi
