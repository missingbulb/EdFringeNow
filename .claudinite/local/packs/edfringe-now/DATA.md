# edfringe-now - the data-pipeline checks

The data-pipeline section of `RULES.md` carries the judgment for the edfringe.com scrape
(`scraper/`) and the committed data it produces (`data/`, `site/data/`). What has a signature is
enforced by a check:

- `edfringe-lookup-indices` - every positional reference in the wire files resolves in
  `site/data/venues.json`.
- `edfringe-normalizer-selftest-in-verify` - `scripts/verify.sh` runs `normalize.py --selftest`
  as a command, not only as a step label.
- `edfringe-data-dir-is-generator-output` - every file under `data/` and `site/data/` has a
  generator's shape.

## `edfringe-lookup-indices`

`lookup-indices.mjs` asserts that every positional reference in the committed wire files resolves
inside `site/data/venues.json`'s lookup lists: the day files' `genre` / `room` / `subs` / `ts` and
`shows.min.json`'s `g` / `rm` / `sg` / `ar` / `p[].t` (`-1` is the producer's "unknown" and
passes). Its red-first fixture is `data-checks.test.mjs`, run by `npm test` / `scripts/verify.sh`;
the last fixture runs the rule over this repo's real committed data, so the check is a live gate on
every scrape commit and not just a unit test of itself.
