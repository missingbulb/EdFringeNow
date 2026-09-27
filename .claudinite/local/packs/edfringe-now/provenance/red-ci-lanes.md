## 2026-08-14 · born · Claudinite growth: extract lessons (#353)
- **Source:** the conversation logs captured 2026-08-11 to 2026-08-13.
- **Reason:** on 2026-08-11 a session burned the artifact download, re-probed the proxy about 4.5
  minutes later for the same image, and ended with the golden undiagnosed.
- **Actor:** the growth-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a harness trap in `edfringe-requirements`' RULES.md.
- **Rejected:** a check - none of the run's three lessons was convertible.
- **Landed:** #353, Refs #352

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612

## 2026-09-13 · reworded · the download is a method of actions_get (#694)
- **Source:** live re-probes on 2026-09-13.
- **Reason:** `download_workflow_run_artifact` is no longer a tool of its own; the substance was not
  re-probed.
- **Actor:** the rule-revalidation run, merged by @missingbulb (owner).
- **Landed:** #694, Refs #687

## 2026-09-24 · moved · into the requirements-harness skill
- **Reason:** the owner chose to move the data-pipeline and harness sections out of RULES.md into
  skills ("Move data/harness to skills"), so they load only when their paths are edited; trimmed to
  trigger and action in the same move.
- **Actor:** @missingbulb (owner).
- **Mechanism:** a guideline of the requirements-harness skill, force-loaded on edits to
  product/requirements.md and product/requirements/.

## 2026-09-27 · reaffirmed · artifact-storage hosts still denied
- **Source:** 2026-09-27 probe: `productionresultssa0.blob.core.windows.net`,
  `results-receiver.actions.githubusercontent.com` and
  `pipelinesghubeus1.actions.githubusercontent.com` all refused the CONNECT with a policy 403,
  confirming the artifact-storage hosts a red `ui-requirements` download depends on are still denied
  — the substance the 2026-09-13 pass left un-reprobed.
- **Actor:** the rule-revalidation run, work item #926.
