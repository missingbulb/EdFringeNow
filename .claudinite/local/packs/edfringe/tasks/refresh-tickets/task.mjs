// edfringe task: refresh-tickets — the in-festival availability refresh.
//
// Refreshes ticket status for today and every remaining festival date, writing
// through the master so every derived file regenerates from one source (#249).
//
// `schedule_after: ['edfringe/refresh-shows']` rather than a bare `daily` anchor:
// it runs after refresh-shows' catalogue top-up, and the two data-committing
// tasks never share a checkout.
//
// `agent_model: 'none'` — the whole job is deterministic, so there is no agent
// and no dispatch issue: the scheduler runs `code_work` as a subprocess and that
// is the entire task. A non-zero exit converges to one open `needs-human` issue.
//
// Self-contained (imports nothing). `edinburghClock` and `ticketWindow` are
// exported beside the declaration so the gate is unit-tested directly
// (window.test.mjs) rather than only reasoned about.

// The calendar gate: the festival month, read on the Edinburgh clock.
export const FESTIVAL_MONTH = 8;

// Europe/London is UTC+1 for the ENTIRE window, so the conversion is a fixed
// one-hour shift and needs no timezone database. British Summer Time runs from
// the last Sunday in March to the last Sunday in October, so August lies strictly
// inside it with months of margin on both sides — there is no DST boundary
// anywhere near this window, and any instant whose Edinburgh wall clock reads
// August is necessarily under BST. (Instants that shift into any other month are
// rejected by the month test regardless, so the offset cannot matter there.)
// The shift is what decides the month at the instants where UTC and Edinburgh
// disagree about it — the last hours of 31 July and 31 August.
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
  // No hour gate: an hours window on a task with one evaluation per slot could
  // only ever silence it.
  return { run: true, reason: `in-festival — ${clock}; refreshing ticket status` };
}

export default {
  id: 'refresh-tickets',
  frequency: 'daily',              // the anchor; schedule_after below is what actually orders it after refresh-shows
  schedule_after: ['edfringe/refresh-shows'],
  precondition_signals: [],        // the gate is the calendar, not repo state
  agent_model: 'none',             // pure code; the work is the preprocessing subprocess below
  expected_outcome: 'none',        // it commits refreshed statuses straight to the default branch — no PR
  agent_instructions: 'worker.sh', // vestigial for an agentless task; the real work is the command below
  code_work: 'bash worker.sh',
  code_work_timeout: 900,

  precondition() {
    return ticketWindow(new Date());
  },
};
