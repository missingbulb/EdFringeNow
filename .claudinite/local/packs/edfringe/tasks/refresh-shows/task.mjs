// edfringe task: refresh-shows — the daily Fringe data top-up.
//
// REPLACES the "Refresh edfringe shows (daily)" workflow, deleted in the same
// commit that added this file. That workflow carried its own `cron: "20 5 * * *"`;
// the Claudinite scheduler is now the repo's only cron, so the schedule moves here
// as `frequency: 'daily'` and the workflow's steps move into `worker.sh`.
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
  frequency: 'daily',              // the dailyHour anchor (.claudinite-checks.json → taskScheduler.dailyHour = 4)
  precondition_signals: [],        // nothing in the repo's own state gates it — the trigger is upstream data
  agent_model: 'none',             // pure code; the work is the preprocessing subprocess below
  expected_outcome: 'none',        // it commits regenerated data straight to the default branch, as the workflow did — it never opens a PR
  agent_instructions: 'worker.sh', // vestigial for an agentless task; the real work is the command below
  code_work: 'bash worker.sh',
  code_work_timeout: 1800, // the retired workflow's `timeout-minutes: 30`, in seconds

  // Unconditional, exactly as the retired daily cron was. The thing this task
  // reacts to — shows added or edited on edfringe.com — leaves no trace in this
  // repo, so there is no signal to precondition on: the only honest gate is the
  // schedule itself. The run is cheap and self-limiting (one paged
  // `recentlyAdded=LAST_SEVEN_DAYS` pass) and commits nothing when nothing moved.
  precondition() {
    return { run: true, reason: 'the daily top-up is unconditional — upstream show edits leave no signal in this repo' };
  },
};
