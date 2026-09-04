// refresh-tickets' own precondition term: the festival window, read on the
// Edinburgh clock. Task-local because its subject is the INSTANT rather than a
// window of repo activity — nothing in the shared vocabulary reads a clock, and
// nothing in the signal bundle carries one.

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

export const terms = {
  'in-festival': {
    // No signals: the verdict is a pure function of the instant, and the engine
    // hands that in rather than the term reading a process clock — which is what
    // keeps `ticketWindow` testable at a chosen moment (window.test.mjs).
    signals: [],
    holds(_signals, { now }) {
      // `now` arrives from claudinite-tasks 60902.4. Until this repo's mount
      // carries that version the key is absent, and a term that errored there
      // would park a run over a key the member cannot yet be given — so the
      // process clock is the transitional answer. Drop this fallback once the
      // stamp reads 60902.4 or later.
      const { run, reason } = ticketWindow(now ?? new Date());
      return { holds: run, reason };
    },
  },
};
