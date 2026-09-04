#!/usr/bin/env bash
# Assembles each *.body.html fragment with _common.css into a self-contained
# <Name>.dc.html artboard (artboards share nothing at runtime, so the CSS is
# inlined into every one).
set -euo pipefail
cd "$(dirname "$0")"
for body in *.body.html; do
  name="${body%.body.html}"
  {
    cat <<'HEAD'
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
HEAD
    cat _common.css
    if [ -f "$name.css" ]; then cat "$name.css"; fi
    echo "  </style>"
    echo "</helmet>"
    cat "$body"
    echo "</x-dc>"
    echo "</body>"
    echo "</html>"
  } > "$name.dc.html"
done
echo "assembled: $(ls *.dc.html | tr '\n' ' ')"
