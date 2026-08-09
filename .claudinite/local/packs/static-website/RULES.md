# Static website

Serving a site with no server you control — GitHub Pages, S3, a bare CDN — where
`Cache-Control` is set by the host and can't be varied per file, so the freshness
policy has to live in the client. Portable: nothing here is specific to one site.

## Client caching

- **A TTL is a guess about how fast a file changes; a published manifest is a
  fact — prefer the fact.** Handing each file a lifetime ("the catalogue turns
  over rarely, hold it four days; availability moves hourly, hold it one")
  reprices the same bet on every file and gets it wrong in both directions at
  once: too long and visitors read stale data, too short and they re-download
  something that never changed. Publish one small manifest listing every
  downloadable asset and a hash of its contents, fetch **that** on each load, and
  evict exactly the entries whose hash moved. You get longer caching *and*
  fresher data, which no TTL can offer together, and the eviction is driven by
  what actually changed rather than by how fast you guessed it would.

- **Nothing can attest to its own freshness — the expected hash has to come from
  a file you just fetched.** A stale copy carries a perfectly valid hash *of
  itself*, and a version field inside a file says what generation it is, never
  whether that generation is still current. So the manifest is the one asset that
  must never be cached with a TTL of its own. Caching it doesn't save a
  round-trip; it moves the staleness up one level and hides it better.

- **Size is not a freshness check.** It catches a truncated write, which a guarded
  read catches anyway, and nothing else. A correction applied uniformly across a
  file is routinely byte-length-neutral: rewriting every `16:25` to `17:25` for a
  timezone fix changed **0 bytes** of the 3,140,534-byte catalogue it was applied
  to, while changing the meaning of every record in it. Content-Length agreeing is
  not evidence of anything.

- **Record the hash you stored; don't re-hash the cached body to check it.** Write
  the manifest hash into the cache's bookkeeping beside the entry, and the
  freshness check is a string compare. Re-hashing means reading megabytes through
  a digest on every page load, on the critical path, to answer a question the
  bookkeeping already knows. Hash the body only to detect corruption — a different
  question, better answered by guarding the read.

- **A manifest mismatch during a deploy is normal — retry once, don't fail.**
  Between fetching the manifest and fetching an asset, a deploy can land and the
  asset legitimately won't match. Refetch and continue; only a mismatch that
  survives fresh copies of both is a real fault worth surfacing.

## Files that are read together

- **Two files cached on different clocks and then joined *will* be joined across
  generations — design for it, or the join fails silently.** This isn't an edge
  case; it's the steady state. Whenever a payload is split so each half can be
  cached on its own schedule, every visitor eventually holds one half from Tuesday
  and the other from Thursday, and any key that isn't stable across a regeneration
  quietly matches nothing. Content-addressed keys ("name the row by its date and
  time, not its position") survive rows being *added and removed*, which is what
  they're usually chosen for, and not a systematic *correction* to the key itself
  — a timezone fix, a rounding change, a rename — which moves every key at once.
  Either make the halves a verified set (each records the generation of the other,
  and a mismatch forces a refetch) or don't split them.

- **A partial join is silent by construction — measure the join rate and refuse
  an implausible one.** A key that matches nothing returns "no data for this row",
  which is indistinguishable from a row that genuinely has no data yet. Downstream,
  "unknown" almost always collapses into some concrete default — unavailable, zero,
  empty — and the page renders a confident falsehood with nothing logged. So assert
  on coverage, not on the presence of a single match: a check that passes on "at
  least one row joined" passes at 6%.

## Degrading

- **Don't ship a fallback for missing data without checking what the code does
  with it.** "It'll just show as unknown, which we already handle" is a claim
  about the whole downstream, and it's usually wrong — an absent value that
  reaches a boolean, a comparison, or a status lookup is very often
  indistinguishable from a real negative. Follow the missing value all the way to
  the pixel before deciding a failure is survivable. Where it isn't, treat the
  data as required and show the error state: a wrong answer with no error is worse
  than an error, because the visitor acts on it.
