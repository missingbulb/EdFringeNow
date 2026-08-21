# EdFringeNow

<!-- claudinite:packs -->
![basics](.claudinite/shared/packs/basics/badge.svg "basics") ![claudinite-lifecycle](.claudinite/shared/packs/claudinite-lifecycle/badge.svg "claudinite-lifecycle") ![barriers](.claudinite/shared/packs/barriers/badge.svg "barriers") ![git-github](.claudinite/shared/packs/git-github/badge.svg "git-github") ![html](.claudinite/shared/packs/html/badge.svg "html") ![tidy-repo](.claudinite/shared/packs/tidy-repo/badge.svg "tidy-repo") ![claudinite-growth](.claudinite/shared/packs/claudinite-growth/badge.svg "claudinite-growth") ![executable-requirements](.claudinite/shared/packs/executable-requirements/badge.svg "executable-requirements") ![spec-driven-product](.claudinite/shared/packs/spec-driven-product/badge.svg "spec-driven-product") ![static-website](.claudinite/shared/packs/static-website/badge.svg "static-website") ![product-wiki](.claudinite/shared/packs/product-wiki/badge.svg "product-wiki") ![claude-code-web-users-support](.claudinite/shared/packs/claude-code-web-users-support/badge.svg "claude-code-web-users-support")<!-- /claudinite:packs -->
Website to help find a fringe show — **Fringe Discover**.

🌐 **Live site:** https://missingbulb.github.io/EdFringeNow/

A single-page site for finding the nearest Edinburgh Fringe show happening
right now ("Fringe Rush"): editable constraint cards (genre, travel mode, next
constraint), an interactive map of venues, and a gamified "discovery journey".

## The executable spec

What the UI must render and how it must behave is specified leaf by leaf in
[product/requirements.md](product/requirements.md) — a numbered spec where
every requirement is proven by exactly one executable case (a pixel-exact
golden, a driven-gesture assertion, or a pure-rule test). The framework, its
lanes and the owner-approval contract live in
[product/requirements/README.md](product/requirements/README.md).

## Running

No build step. Because the app fetches `data/shows.json`, serve the folder over
HTTP rather than opening the file directly:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Tech

- Plain HTML, CSS and vanilla JavaScript (no framework, no build tools)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles for the map (no API key)
- Mock show data in `data/shows.json`

## Structure

```
index.html        page markup
css/styles.css    styling
js/app.js         data loading, map, show list, journey, editable cards
js/places.js      non-show places: Nominatim geocoding + partner booking links
data/shows.json   mock Edinburgh Fringe shows
```

## Tests & CI

The planner's computation engine (`plan/lib/`) is unit-tested with the built-in
Node test runner — no dependencies, no install:

```
npm test          # node --test plan/lib/__tests__/*.test.mjs
npm run verify     # tests + JS parse-checks (node --check) + Python py_compile
```

`npm run verify` is the single gate: it runs the unit tests, syntax-checks every
JavaScript source under `js/` and `plan/`, and byte-compiles the `scraper/`
Python. The release pipeline's PR gate (`.github/workflows/static-site-ci.yml`)
runs it as the repo's `test_command` on every push to `main` and every pull
request, and a **pre-commit hook** runs the same gate
locally so nothing red is committed. Enable the hook once per clone:

```
npm run setup-hooks   # git config core.hooksPath .githooks
```

(Bypass a single commit with `git commit --no-verify`.)

## Development

Shared Claude working guidelines are vendored into this repo as committed files
via [Claudinite](https://github.com/missingbulb/Claudinite) and refreshed by its
nightly maintenance — no session-time fetch. Session hooks and the
`Claudinite checks` CI workflow run the conformance sweep from the committed
snapshot, so every branch judges by the version it carries. How the vendored
mount works lives in the Claudinite repo (`mount/DESIGN.md`).
