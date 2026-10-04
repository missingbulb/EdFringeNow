## 2026-10-04 · born · the npm-install half of npm-playwright-scratchpad, converted (item #1015)
- **Source:** npm-playwright-scratchpad.md.
- **Reason:** a fresh Playwright install pulls a build the image has no browser for, and in the repo
  root dirties package.json. The earlier "not a tree signature" verdict missed that the mark is a
  Bash call's input, which an action-scope check sees before it runs. Deletion test: the check's fix
  line carries the absolute import, so the rule's paragraph was deleted whole.
- **Actor:** the prose-to-checks-sweep run, item #1015.
- **Model:** Claude Sonnet 5.5
- **Mechanism:** a declared action-scope check (guardToolCalls) in declared-checks.json, blocking an
  `npm i|install|add` of playwright; patterns over one command need no module.
- **Retire when:** the image ships a Playwright whose version a fresh install matches.
