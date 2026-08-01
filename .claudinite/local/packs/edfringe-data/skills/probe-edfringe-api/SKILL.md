---
name: probe-edfringe-api
description: Get a fact out of the live edfringe.com GraphQL API (a field's real shape, an enum's full value set, one show's payload) from a session that cannot reach it, by running a throwaway probe on a GitHub Actions runner. Use when scraper/SCRAPING.md doesn't already record the answer and guessing would be a guess.
---

# Probe the live edfringe API from a session that can't reach it

The sandbox egress proxy blocks `equhost.com`, and `edfringe.com` 403s
`WebFetch` — so the API is only reachable from an **open-network GitHub Actions
runner**. This is the procedure for one-off questions (schema introspection, a
single show's payload, the real value set behind an enum). Bulk data is not this
skill's job: that is the `Scrape edfringe shows (full)` workflow
(`.github/workflows/scrape.yml`) or the `refresh-shows` scheduled task.

**First: check whether the answer is already recorded.**
`scraper/SCRAPING.md` holds the operations table, the full `EventDetail` field
surface, the `attributes[]` bag, and the pricing/`ticketStatus` findings — all of
it captured by exactly this procedure. Probing for something already written
there burns a runner for nothing.

## The procedure

1. **Write the probe as a script under `scraper/`** — a few dozen lines, reusing
   `fetch_shows.py`'s `get_token` / `fetch_events_page` and its
   `DEFAULT_USERNAME` / `DEFAULT_PASSWORD` (the site's public anonymous
   credentials) rather than re-deriving auth. Print the answer to stdout; the job
   log is your return channel.
2. **Add a workflow that runs it on push to your branch**, path-filtered to that
   script so it cannot fire on anything else, `permissions: contents: read`, and
   `actions/setup-python@v5` (the scraper is stdlib-only — no install step).
3. **Push, then read the run's job logs** through the Actions API
   (`mcp__github__actions_list` → `mcp__github__get_job_logs`). Iterate on the
   query by pushing again; each push is one runner-minute.
4. **Record what you learned in `scraper/SCRAPING.md`** — the point of the probe
   is that the next session doesn't have to repeat it.
5. **Delete the probe script and its workflow before opening the PR.** They are
   scaffolding, and a push-triggered workflow left in the tree is a live wire —
   the `edfringe-push-workflow-pinned-to-main` check catches the workflow half of
   that (nothing catches an orphaned probe script, so delete both).

## Guardrails

- **Rate-limit like the real scraper.** `fetch_shows.py` sleeps a random 4–9 s
  between requests; a probe that hammers the API from a datacentre IP is how the
  anonymous credentials stop working for everyone.
- **`performancePrices` is per performance** — there is no bulk price endpoint.
  A probe that loops it over a whole day is thousands of calls; sample one show.
