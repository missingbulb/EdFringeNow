## 2026-09-26 · born · onboarding a new scraper against reconstructed markup needs a real-fetch pass (#906)
- **Source:** PR #903 and PR #904 (growth-extract window, item #906), independently, same window:
  both the Acco and the Haifa festival scrapers were first written with parsers and sample fixtures
  reconstructed from a WebFetch summary while the real hosts were unreachable; once egress opened, a
  real fetch on each showed the reconstructed markup was wrong and both parsers needed near-full
  rewrites.
- **Reason:** recurred twice, independently, in one window across two unrelated sources — a
  repeatable onboarding gotcha for this repo's own scraper practice, distinct from the generic canon
  rule that a summarizing fetch isn't a source (which the sessions already knew and still fell into
  at the commit/fixture level).
- **Mechanism:** a bullet in the `data-pipeline` skill, next to the existing live-verification rule
  it extends; not checkable — nothing structural distinguishes a reconstructed sample from a real
  one.
- **Retire when:** the scraper onboarding flow itself gates a new source's commit on a real fetch
  having run, making the provisional-marking judgment call moot.
- **Actor:** the growth-extract run, item #906.
