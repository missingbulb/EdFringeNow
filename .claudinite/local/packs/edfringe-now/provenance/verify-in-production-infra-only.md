## 2026-09-21 · born · verify-in-production is for infra here, not feature work (#819)
- **Source:** the owner in chat, "We don't need a verify in production task for feature (UI)
  changes. This is more relevant to non-user-facing infra changes."
- **Reason:** the canon skill rules a change out only by its generic "could you watch it work now?"
  test, and never by class. This repo has a standing answer for the whole feature/UI class — the
  golden lane, `npm run test:ui` and a look at the served page all run before the merge — so the
  test always comes out the same way and re-deriving it per change costs a filing nobody wanted.
- **Actor:** @missingbulb (owner).
- **Model:** claude-opus-5
- **Mechanism:** prose in the local pack's RULES.md rather than a check — the moment it must fire
  is a judgment made after a merge, which no file edit predicts. Promoting it to the canon's basics
  pack is the growth lifecycle's separate call.
- **Rejected:** narrowing it further to "a verification whose failure would be benign" — the owner
  confirmed #791, a benign-failure CI-wiring verification, was correctly filed, so benignity is not
  the discriminator here.
- **Retire when:** a feature/UI change lands whose effect genuinely cannot be seen before the merge
  — a render that only appears once the site is deployed — so the class stops having one answer.
- **Landed:** #819

## 2026-09-24 · reworded · trimmed to trigger and action
- **Reason:** the owner asked to trim rule prose to zero story ("Trim to zero, unless crucial to
  understand severity"); the incident history lives on this file.
- **Actor:** @missingbulb (owner).
