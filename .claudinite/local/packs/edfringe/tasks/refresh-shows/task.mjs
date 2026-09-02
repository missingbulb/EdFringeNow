// edfringe task: refresh-shows — the Fringe data top-up, currently OFF.
//
// `frequency: 'manual'` is the off switch: a manual task has no occurrence, so
// the scheduler never instantiates it and it runs only from a work item created
// by hand. The site's scraping is off — the owner's call, the festival being
// over — and everything below is intact, so turning it back on is one token.
//
// REPLACES the "Refresh edfringe shows (daily)" workflow, deleted in the same
// commit that added this file. That workflow carried its own `cron: "20 5 * * *"`;
// the Claudinite scheduler is now the repo's only cron, so the cadence lives in
// the frequency below and the workflow's steps in `worker.sh`.
//
// `agent_model: 'none'` — the whole job is deterministic (fetch, merge,
// regenerate, commit), so there is no agent and no dispatch issue: the scheduler
// runs `code_work` as a subprocess and that is the entire task. A
// non-zero exit converges the task to one open `needs-human` issue, which is the
// replacement for the old workflow's `report-failure` job.
//
// Self-contained (imports nothing): the whole contract is this default export.

export default {
  id: 'refresh-shows',
  frequency: 'manual',             // OFF — no occurrence; a hand-created work item is the only way it runs
  agent_model: 'none',             // pure code; the work is the preprocessing subprocess below
  expected_outcome: 'none',        // it commits regenerated data straight to the default branch, as the workflow did — it never opens a PR
  agent_instructions: 'worker.sh', // vestigial for an agentless task; the real work is the command below
  code_work: 'bash worker.sh',
  code_work_timeout: 1800, // the retired workflow's `timeout-minutes: 30`, in seconds

  // `none` — the empty precondition, whose trigger is the calendar (or, while this
  // is `manual`, the work item somebody filed). The thing this task reacts to —
  // shows added or edited on edfringe.com — leaves no trace in this repo, so there
  // is no signal to gate on: the cadence itself is the only honest gate, exactly as
  // the retired daily cron was. The run is cheap and self-limiting (one paged
  // `recentlyAdded=LAST_SEVEN_DAYS` pass) and commits nothing when nothing moved.
  preconditions: ['none'],
};
