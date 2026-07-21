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
data/shows.json   mock Edinburgh Fringe shows
```

## Development

Shared Claude working guidelines are vendored into this repo as committed files
via [Claudinite](https://github.com/missingbulb/Claudinite) and refreshed by its
nightly maintenance — no session-time fetch. Session hooks and the
`Claudinite checks` CI workflow run the conformance sweep from the committed
snapshot, so every branch judges by the version it carries. How the vendored
mount works lives in the Claudinite repo (`mount/DESIGN.md`).
