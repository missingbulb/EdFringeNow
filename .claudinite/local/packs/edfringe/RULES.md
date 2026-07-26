# EdFringeNow — project working rules

Lessons captured while working in this repo, layered on the shared Claudinite
canon. Terse and concrete; read the matching one before working in that area.

## Verifying UI changes visually (the `index.html` page and everything under `plan/`)

Visual verification of the pages **is** available in this sandbox. Don't skip it
or downgrade to "verified by logic review only" claiming no browser exists — a
browser is here, and a UI change isn't done until it has been looked at.

- Serve the repo and drive it with the preinstalled Chromium (or Playwright):
  `python3 -m http.server 8000`, then screenshot / click through
  `http://localhost:8000`. The app fetches `data/shows.json`, so it must be
  served over HTTP rather than opened as a file — and `localhost` bypasses the
  agent proxy, so the browser reaches the page even though external hosts need
  the proxy.
- To build a `/plan` favourites list for the render, a plain slug-per-line text
  file is accepted by the parser — pick shows spanning the statuses (and some
  same-day doubles) you want to eyeball.
- **Never chain `pkill -f "http.server …"` with the rest of a command.** `-f`
  matches full command lines, so the pattern matches the very shell running the
  `pkill`: the shell kills itself (exit 144) and everything after the `;` or
  `&&` — the commit, the verify run, the curl — silently never happens. Every
  such call in this repo's captured sessions died this way, once misdiagnosed as
  a heredoc bug. Bracket a character so the pattern can't match its own command
  line (`pkill -f "[h]ttp.server 8099"`), or just leave the server up and serve
  the next run on a fresh port.
- **Known-noisy console output from the served page.** A page driven off
  `python3 -m http.server` reliably logs a `favicon.ico` 404 (the repo ships
  none) and often `net::ERR_CONNECTION_RESET` as the browser tears down. Neither
  is an application error — filter both out of a smoke script's error assertion
  so that a red run means something, rather than sending you chasing a phantom
  404 through extra browser runs.
- To match edfringe.com's live styling (e.g. the ticket-availability colours on
  the `/plan` grid), fetch the official site's CSS with `curl` through the agent
  proxy and read the palette out of it. `WebFetch` returns rendered text without
  the CSS, and headless Chromium cannot tunnel the proxy to reach an external
  host — `curl` is the one path that works for off-box assets.
