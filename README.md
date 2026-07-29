# EdFringeNow
Website to help find a fringe show — **Fringe Discover**.

🌐 **Live site:** https://missingbulb.github.io/EdFringeNow/

A single-page site for finding the nearest Edinburgh Fringe show happening
right now ("Fringe Rush"): editable constraint cards (genre, travel mode, next
constraint), an interactive map of venues, and a gamified "discovery journey".

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
Python. The **CI** workflow (`.github/workflows/ci.yml`) runs it on every push
to `main` and every pull request, and a **pre-commit hook** runs the same gate
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
