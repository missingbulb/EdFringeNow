#!/usr/bin/env bash
#
# The site's build step — everything that has to happen to the tree before the
# publish set is assembled. Named by `build_command` in .github/site.config, so
# the release pipeline and the pull-request gate run exactly this, and a change
# here is exercised on the PR before it can reach a deploy.
#
# It was two inline steps of the hand-rolled pages.yml the static-website pack
# replaced; the logic is unchanged, and it produces the same two files.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# The build stamp the debug pill shows. The last commit's time, in the timezone
# the festival runs in, so "when was this built" reads the way a user in
# Edinburgh-via-Tel-Aviv expects rather than in UTC.
TIME=$(TZ='Asia/Jerusalem' git log -1 --date=format-local:'%Y-%m-%d %H:%M' --format=%cd)
printf 'window.__BUILD__ = { time: "%s" };\n' "$TIME" > js/build-info.js
echo "Stamped build time $TIME (Israel) into js/build-info.js"

# The Cloudflare Web Analytics beacon token is public (it ships to every
# visitor), so it lives in a repo *variable*, not a secret — and the pipeline
# exports every repo variable into this script's environment. Unset (a fork, a
# local run) leaves the placeholder in place and analytics.js no-ops, which is
# the safe outcome: no beacon rather than a broken one.
if [ -n "${CLOUDFLARE_ANALYTICS_TOKEN:-}" ]; then
  sed -i "s#REPLACE_WITH_CLOUDFLARE_WEB_ANALYTICS_TOKEN#${CLOUDFLARE_ANALYTICS_TOKEN}#" js/analytics.js
  echo "Injected the Cloudflare Web Analytics token from CLOUDFLARE_ANALYTICS_TOKEN."
else
  echo "CLOUDFLARE_ANALYTICS_TOKEN is not set — analytics stays off (placeholder retained)."
fi
