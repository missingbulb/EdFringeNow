# EdFringeNow
Website to help find a fringe show — **Fringe Discover**.

🌐 **Live site:** https://missingbulb.github.io/edfringenow/

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

Shared Claude guidelines are mounted at `.claudinite/` via [Claudinite](https://github.com/missingbulb/Claudinite).

This is a git submodule, so it is not pulled automatically. After cloning, run:

```
git submodule update --init --recursive
```

(or clone with `git clone --recurse-submodules`). A `SessionStart` hook runs this automatically for Claude Code sessions.
