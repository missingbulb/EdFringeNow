// edfringe task: refresh-tickets — the in-festival, live-ish availability refresh.
//
// REPLACES the "Refresh today's ticket status (hourly)" workflow, deleted in the
// same commit that added this file. That workflow hand-spelled SIXTEEN cron lines to get
// "hourly during August, 08:00–23:00 Edinburgh time, on a jittered minute":
// `9 7 * 8 *`, `12 8 * 8 *`, `7 9 * 8 *`, … `8 22 * 8 *`. The Claudinite
// scheduler is now the repo's only cron, and the migration rule for a cron whose
// shape has no frequency token is to declare the frequency and put the
// irregularity in the PRECONDITION: the seven cron tokens say *when to evaluate*,
// the precondition says *whether to act*. So this is `frequency: 'hourly'` with
// an August / 08:00–23:00-Edinburgh gate below. The hand-rolled minute jitter is
// dropped outright — the repo's hashed scheduler minute (:49) already staggers
// this repo against the rest of the fleet, which is all the jitter was for.
//
// `agent_model: 'none'` — the whole job is deterministic, so there is no agent
// and no dispatch issue: the scheduler runs `agent_preprocessing` as a subprocess
// and that is the entire task. A non-zero exit converges the task to one open
// `needs-human` issue, replacing the old workflow's `report-failure` job.
//
// Self-contained (imports nothing). `edinburghClock` and `ticketWindow` are
// exported beside the declaration so the window is unit-tested directly
// (window.test.mjs) rather than only reasoned about.

// August, and the local hours the retired crons covered. The old lines fired at
// UTC hours 7…22 inclusive — sixteen firings — which is local 08:xx…23:xx.
export const FESTIVAL_MONTH = 8;
export const FIRST_LOCAL_HOUR = 8;
export const LAST_LOCAL_HOUR = 23;

// Europe/London is UTC+1 for the ENTIRE window, so the conversion is a fixed
// one-hour shift and needs no timezone database. British Summer Time runs from
// the last Sunday in March to the last Sunday in October, so August lies strictly
// inside it with months of margin on both sides — there is no DST boundary
// anywhere near this window, and any instant whose Edinburgh wall clock reads
// August is necessarily under BST. (Instants that shift into any other month are
// rejected by the month test regardless, so the offset cannot matter there.)
// This is the correction the port had to get right: the scheduler's slot math is
// UTC, and reading the UTC hour as if it were local would shift the whole
// festival window an hour early.
const BST_OFFSET_MS = 60 * 60 * 1000;

// The Edinburgh wall-clock month (1–12) and hour (0–23) at UTC instant `now`.
export function edinburghClock(now) {
  const local = new Date(new Date(now).getTime() + BST_OFFSET_MS);
  return { month: local.getUTCMonth() + 1, hour: local.getUTCHours() };
}

// The precondition's verdict as a pure function of the instant — `{ run, reason }`.
export function ticketWindow(now) {
  const { month, hour } = edinburghClock(now);
  const clock = `${String(hour).padStart(2, '0')}:xx Edinburgh, month ${month}`;
  if (month !== FESTIVAL_MONTH) {
    return { run: false, reason: `outside the festival — ${clock}; ticket status only moves during August` };
  }
  // The upper bound is the last hour of the day, so it excludes nothing a
  // 0–23 hour could be; it is stated so the window's intent survives an edit.
  if (hour < FIRST_LOCAL_HOUR || hour > LAST_LOCAL_HOUR) {
    return { run: false, reason: `outside the daily window — ${clock}; the box office moves between ${FIRST_LOCAL_HOUR}:00 and ${LAST_LOCAL_HOUR}:59` };
  }
  return { run: true, reason: `in-festival and in-window — ${clock}` };
}

export default {
  id: 'refresh-tickets',
  frequency: 'hourly',             // evaluate every hour; the precondition decides whether to act
  precondition_signals: [],        // the gate is the calendar and the clock, not repo state
  agent_model: 'none',             // pure code; the work is the preprocessing subprocess below
  expected_outcome: 'none',        // it commits today's ticket statuses straight to the default branch, as the workflow did
  agent_instructions: 'worker.sh', // vestigial for an agentless task; the real work is the command below
  agent_preprocessing: 'bash worker.sh',
  agent_preprocessing_timeout: 900, // the retired workflow's `timeout-minutes: 15`, in seconds

  precondition() {
    return ticketWindow(new Date());
  },
};
