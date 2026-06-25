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

Shared Claude guidelines are mounted at `.claudinite/` via [Claudinite](https://github.com/missingbulb/Claudinite).

These are synced over plain HTTPS by a `SessionStart` hook
(`.claude/hooks/sync-claudinite.sh`), which fetches the latest `main` as a
tarball into a gitignored `.claudinite/` each session. No git submodule or
credential is needed (the submodule clone 403s in Claude Code on the web, where
the git credential is scoped to this repo only).

To populate `.claudinite/` manually outside a Claude session, just run the hook:

```
.claude/hooks/sync-claudinite.sh
```

Set `CLAUDINITE_REF` to a tag or SHA to pin a specific version instead of
tracking `main`.
