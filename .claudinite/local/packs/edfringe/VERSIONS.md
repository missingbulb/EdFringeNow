# Version history

Records for `local/packs/edfringe`'s own automatic changes, one row per change a growth task made
to it — a prose rule added or removed, a check created, a rule corrected against a probe or
deleted as irrelevant. A local pack is neither versioned nor distributed, so this is the record at
the only granularity it has.

| Date | Task | Change |
|---|---|---|
| 2026-08-30 | `rule-revalidation` | Corrected the Leaflet-stub bullet: `curl` gets `403` at CONNECT for `unpkg.com`, `cdn.jsdelivr.net` and `cdnjs.cloudflare.com`, so the recipe now vendors from `registry.npmjs.org` (byte-identical files). |
| 2026-08-30 | `rule-revalidation` | Added: Chromium's proxy allowlist is narrower than `curl`'s, so browser reachability can't be inferred from a successful `curl` — split out of the Leaflet bullet, which had buried it. |
| 2026-08-30 | `rule-revalidation` | Corrected the egress-allowance paragraph: the allowance covers more than `*.edfringenow.com`, so the rule now says to probe the host you need rather than trusting the list. |
| 2026-08-30 | `rule-revalidation` | Merged the two token-overflow bullets: `per_page`/`perPage` is not a size lever on either call, and the remedy (read the spill file, or don't request the bulk) is one rule. |
| 2026-08-30 | `rule-revalidation` | Corrected the response-shrinking bullet: `pull_request_read` carries no `fields`-style parameter and no tool here carries `minimal_output`. |
| 2026-08-30 | `rule-revalidation` | Corrected the PR-landed bullet: `merged_at` is populated and correct where `merged` is not, so it is the field to read. |
| 2026-08-23 | `growth-dedup` | Removed: "The sandbox checkout is shallow — unshallow before comparing branch history" — now the general rule in local dress; covered by `git-github`'s `git-github-advanced` skill ("The sandbox checkout can be shallow, and a shallow history breaks `git merge-base`" — same trigger, same `git rev-parse --is-shallow-repository` check, the identical unshallow fetch command). |
| 2026-08-23 | `growth-dedup` | Removed: "A deleted workflow file's old runs keep the workflow listed…" bullet — now duplicated near-verbatim by `git-github`'s `git-github-advanced` skill ("A deleted workflow's old runs outlive it, and no session tool can clear them"). |
| 2026-08-23 | `growth-dedup` | Removed: "`pull_request_read method=get_status` is a dead signal on this repo" bullet — covered by `git-github`'s `git-github-advanced` skill ("To read a PR's CI result, look at its check runs — `get_status` misses Actions"). |
| 2026-08-23 | `growth-dedup` | Removed: "Don't `curl` `api.github.com` directly for a run's status…" bullet — covered by `git-github`'s `git-github-advanced` skill ("Don't `curl` the run's status instead: … `api.github.com` is proxy-blocked and returns an error body that never matches a success pattern…"). |
| 2026-08-23 | `growth-dedup` | Removed: "`get_job_logs` needs more than a bare `run_id`" bullet — now duplicated near-verbatim by `git-github`'s `git-github-advanced` skill (same bullet, same wording). |
