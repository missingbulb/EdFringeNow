# refresh-tickets

## Why the declaration reads as it does

Carried over from the declaration's comments when it became task.json.

edfringe task: refresh-tickets — the in-festival availability refresh,
currently OFF.

`frequency: 'manual'` is the off switch: a manual task has no occurrence, so
the scheduler never instantiates it and it runs only from a work item created
by hand. The site's scraping is off — the owner's call, the festival being
over — and everything below is intact, so turning it back on is one token.
`ticketWindow` stays the calendar gate a restored cadence would run under.

Refreshes ticket status for today and every remaining festival date, writing
through the master so every derived file regenerates from one source (#249).

`schedule_after: ['edfringe/refresh-shows']` rather than a bare cadence anchor:
it runs after refresh-shows' catalogue top-up, and the two data-committing
tasks never share a checkout.

`agent_model: 'none'` — the whole job is deterministic, so there is no agent
and no dispatch issue: the scheduler runs `code_work` as a subprocess and that
is the entire task. A non-zero exit converges to one open `needs-human` issue.

Self-contained (imports nothing): the whole contract is this default export.
The calendar gate itself lives in `preconditions.mjs` beside it, where the
engine resolves a task-local term — and where it stays directly unit-tested
(window.test.mjs) rather than only reasoned about.
OFF — no occurrence; a hand-created work item is the only way it runs
pure code; the work is the preprocessing subprocess below
it commits refreshed statuses straight to the default branch — no PR
vestigial for an agentless task; the real work is the command below
