## 2026-09-04 · born · Date the packs' egress observations instead of asserting closure (#609)
- **Source:** #608.
- **Reason:** the pack asserted "general egress is still closed" from an August 2026 observation. On
  2026-09-04 a session read that as current state, answered a vendor-research question from model
  knowledge alone and wrote the owner a prompt for a different session, while `maze.co`,
  `www.lyssna.com` and `fringeplan.com` all returned 200 from that same session. The rules had the
  discipline for the reverse case and not for this one.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5
- **Mechanism:** a RULES.md rule keyed on the act, under a new "Reaching the network" section that
  dates every observation; the incident narrative went to the references doc rather than the rule.
- **Retire when:** the egress policy is fixed for the lifetime of the repo, or a mechanism reports
  it to the session directly.
- **Landed:** #609, Closes #608

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-13 · reaffirmed · the policy swung back (#694)
- **Source:** live re-probes on 2026-09-13.
- **Reason:** six hosts open on 2026-09-04 were denied at CONNECT on 2026-09-13, which is the case
  the rule argues for; the observation was added to the section and the rule left unchanged.
- **Actor:** the rule-revalidation run, merged by @missingbulb (owner).
- **Landed:** #694, Refs #687
