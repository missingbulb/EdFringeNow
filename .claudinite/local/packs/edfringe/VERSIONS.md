# Version history

Records for `local/packs/edfringe`'s own automatic changes, one row per change a growth task made
to it — a prose rule added or removed, a check created, a rule corrected against a probe or
deleted as irrelevant. A local pack is neither versioned nor distributed, so this is the record at
the only granularity it has.

| Date | Task | Change |
|---|---|---|
| 2026-08-24 | `rule-revalidation` | Corrected: "`list_pull_requests` never reports a PR as merged … `merged_at` is never populated" — live probe (list_pull_requests on #493/#483/#480, confirmed merged via `origin/main`) showed `merged_at` is now populated for a genuinely merged PR even though `merged` still reads `false`; a closed-unmerged PR (#433/#427/#426) still reads `merged_at: null`, so it's now a usable signal. |
| 2026-08-23 | `growth-dedup` | Removed: "The sandbox checkout is shallow — unshallow before comparing branch history" — now the general rule in local dress; covered by `git-github`'s `git-github-advanced` skill ("The sandbox checkout can be shallow, and a shallow history breaks `git merge-base`" — same trigger, same `git rev-parse --is-shallow-repository` check, the identical unshallow fetch command). |
| 2026-08-23 | `growth-dedup` | Removed: "A deleted workflow file's old runs keep the workflow listed…" bullet — now duplicated near-verbatim by `git-github`'s `git-github-advanced` skill ("A deleted workflow's old runs outlive it, and no session tool can clear them"). |
| 2026-08-23 | `growth-dedup` | Removed: "`pull_request_read method=get_status` is a dead signal on this repo" bullet — covered by `git-github`'s `git-github-advanced` skill ("To read a PR's CI result, look at its check runs — `get_status` misses Actions"). |
| 2026-08-23 | `growth-dedup` | Removed: "Don't `curl` `api.github.com` directly for a run's status…" bullet — covered by `git-github`'s `git-github-advanced` skill ("Don't `curl` the run's status instead: … `api.github.com` is proxy-blocked and returns an error body that never matches a success pattern…"). |
| 2026-08-23 | `growth-dedup` | Removed: "`get_job_logs` needs more than a bare `run_id`" bullet — now duplicated near-verbatim by `git-github`'s `git-github-advanced` skill (same bullet, same wording). |
