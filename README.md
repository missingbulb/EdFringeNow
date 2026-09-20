# EdFringeNow

Website to help find a fringe show — **Fringe Discover**.

🌐 **Live site:** https://www.edfringenow.com/

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

No build step. The published site is `site/` — serve that directory rather than
the repo root, and over HTTP rather than as a file, because the pages fetch their
data:

```
cd site && python3 -m http.server 8000
# then open http://localhost:8000
```

## Tech

- Plain HTML, CSS and vanilla JavaScript (no framework, no build tools)
- [Leaflet](https://leafletjs.com/) + OpenStreetMap tiles for the map (no API key)
- Real Edinburgh Fringe show data via the scraper pipeline (see `scraper/README.md`)

## Structure

Everything the site serves lives under `site/`, and nothing else does — that
directory is the publish boundary, so a file outside it cannot reach a visitor.

```
site/index.html        page markup
site/css/styles.css    styling
site/js/app.js         data loading, map, show list, journey, editable cards
site/js/places.js      non-show places: Nominatim geocoding + partner booking links
site/data/             the wire files the browser fetches (scraper/normalize.py writes them)
data/                  the pipeline's own working files — the master and the price cache
data/shows.json        mock Edinburgh Fringe shows, still loaded by design-concepts/
```

## Tests & CI

Node's built-in test runner covers the site's own code and the requirements
harness's logic/coverage lanes — no dependencies, no install:

```
npm test          # node --test across the site's own code and the requirements harness's logic/coverage lanes
npm run verify    # npm test, plus JS/Python syntax checks and the Claudinite conformance sweep
```

`npm run verify` is the single gate: it runs the unit tests, syntax-checks every
JavaScript source under `site/`, `scripts/`, `product/` and `design-concepts/`,
byte-compiles the `scraper/` Python, runs the normalizer and Jerusalem-parser
self-tests, and finishes with the Claudinite conformance sweep. The
pull-request gate (`.github/workflows/ci.yml`) runs exactly this script on
every push to `main` and every pull request, and a **pre-commit hook** runs it
locally so nothing red is committed. Enable the hook once per clone:

```
npm run setup-hooks   # git config core.hooksPath .githooks
```

(Bypass a single commit with `git commit --no-verify`.)

## Deploying

The site is served from **Cloudflare**, as a Workers static-assets deployment:
`wrangler.jsonc` names `site/` as the published tree and claims `edfringenow.com`
and `www.edfringenow.com`. Nothing here deploys on push — the release is a
scheduled Claudinite task (`cloudflare-site/site-release`) that cuts the next
version, stamps it into the published pages, pushes that bump to `main` and
uploads the tree. To publish immediately rather than wait for the nightly run,
dispatch the scheduler with `wake=cloudflare-site/site-release`.

## Development

Shared Claude working guidelines are vendored into this repo as committed files
via [Claudinite](https://github.com/missingbulb/Claudinite) and refreshed by its
nightly maintenance — no session-time fetch. Session hooks and the
`Claudinite checks` CI workflow run the conformance sweep from the committed
snapshot, so every branch judges by the version it carries. How the vendored
mount works lives in the Claudinite repo (`mount/DESIGN.md`).
