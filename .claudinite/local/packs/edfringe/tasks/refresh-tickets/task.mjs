// edfringe task: refresh-tickets — the in-festival availability refresh.
//
// Scope note (#249): this refreshes ticket status for today AND every remaining
// festival date, not just today, and it writes through the master so the
// planner's availability sidecar is regenerated too. One listing pass covers the
// whole window — every page returns every performance of the shows on it — so
// widening it cost nothing.
//
// ONCE A DAY, not hourly. It ran hourly through August until the churn was
// judged not worth the freshness: every firing that moved a single status
// rewrote `availability.min.json` and committed it, so a festival day put up to
// sixteen commits into the default branch's history and expired every browser's
// copy of the day file sixteen times over — for data that is already a snapshot
// by the time anyone reads it. Daily keeps the same freshness *shape* (a
// morning snapshot the site serves all day) at a sixteenth of the commits.
//
// `daily+1h`, not plain `daily`, for two reasons: the anchor slot (04:00 UTC) is
// `refresh-shows`, and availability should be refreshed AFTER the catalogue
// top-up that may have added the shows it is about; and it keeps the repo's two
// data-committing tasks in separate scheduler runs rather than sharing one
// checkout, which is the arrangement worker.sh's branch guard exists to survive.
// So the pass lands at 05:00 UTC — 06:00 Edinburgh, before the day's audience
// looks at it.
//
// This started life as the "Refresh today's ticket status (hourly)" workflow,
// deleted when this file was added. That workflow hand-spelled SIXTEEN cron lines to get
// "hourly during August, 08:00–23:00 Edinburgh time, on a jittered minute":
// `9 7 * 8 *`, `12 8 * 8 *`, `7 9 * 8 *`, … `8 22 * 8 *`. The Claudinite
// scheduler is now the repo's only cron, and the migration rule is to declare
// the frequency and put any irregularity in the PRECONDITION: the schedule says
// *when to evaluate*, the precondition says *whether to act*. The daily hours
// gate is gone with the hourly cadence — a once-a-day slot has exactly one
// evaluation to spend, and an 08:00–23:59 window would reject the 06:00 one
// every time, silencing the task outright. What remains is the August gate,
// which is the part that was ever about the data: ticket status only moves while
// the festival is on.
//
// `agent_model: 'none'` — the whole job is deterministic, so there is no agent
// and no dispatch issue: the scheduler runs `prework` as a subprocess
// and that is the entire task. A non-zero exit converges the task to one open
// `needs-human` issue, replacing the old workflow's `report-failure` job.
//
// Self-contained (imports nothing). `edinburghClock` and `ticketWindow` are
// exported beside the declaration so the window is unit-tested directly
// (window.test.mjs) rather than only reasoned about.

// The only calendar gate left: the festival month, read on the Edinburgh clock.
export const FESTIVAL_MONTH = 8;

// Europe/London is UTC+1 for the ENTIRE window, so the conversion is a fixed
// one-hour shift and needs no timezone database. British Summer Time runs from
// the last Sunday in March to the last Sunday in October, so August lies strictly
// inside it with months of margin on both sides — there is no DST boundary
// anywhere near this window, and any instant whose Edinburgh wall clock reads
// August is necessarily under BST. (Instants that shift into any other month are
// rejected by the month test regardless, so the offset cannot matter there.)
// The scheduler's slot math is UTC, so this shift is what decides the month at
// the two instants where UTC and Edinburgh disagree about it — 23:xx UTC on 31
// July and on 31 August, which are already the 1st locally. The daily slot never
// lands there, but the gate is a pure function of any instant and is tested as
// one, so it reads the local clock rather than relying on where the slot falls.
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
  // No hour gate: the cadence is once a day, so the hour is whatever the slot is
  // and gating on it could only ever reject the single evaluation the day gets.
  return { run: true, reason: `in-festival — ${clock}; refreshing the day's ticket status` };
}

export default {
  id: 'refresh-tickets',
  frequency: 'daily+1h',           // 05:00 UTC — an hour after refresh-shows' anchor slot; the precondition decides whether to act
  precondition_signals: [],        // the gate is the calendar, not repo state
  agent_model: 'none',             // pure code; the work is the preprocessing subprocess below
  expected_outcome: 'none',        // it commits today's ticket statuses straight to the default branch, as the workflow did
  agent_instructions: 'worker.sh', // vestigial for an agentless task; the real work is the command below
  prework: 'bash worker.sh',
  prework_timeout: 900, // the retired workflow's `timeout-minutes: 15`, in seconds

  precondition() {
    return ticketWindow(new Date());
  },
};
