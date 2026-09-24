## 2026-07-27 · born · Claudinite growth: conversation extract (#114)
- **Source:** the nine captured conversation logs, 2026-07-21 to 2026-07-23.
- **Reason:** the favicon 404 and `net::ERR_CONNECTION_RESET` appeared in every headless smoke run;
  one session read the 404 as a regression on a merge head and spent about 75s and two extra
  Playwright scripts proving it was the favicon.
- **Actor:** the conversation-extract run, merged by @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** a RULES.md rule in the "Verifying UI changes visually" section, which already owned
  the activity.
- **Rejected:** a check - the check surface reasons over repo files and owner turns, not the agent's
  own Bash invocations.
- **Landed:** #114, Refs #103

## 2026-09-05 · moved · into edfringe-now (#613)
- **Reason:** the three local packs merged into one; see `_pack`.
- **Actor:** @missingbulb (owner).
- **Model:** Claude
- **Mechanism:** the same carrier, now in `edfringe-now`.
- **Landed:** #613, Closes #612
