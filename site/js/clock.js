/* Clock helpers for the Now page.
 *
 * The whole page is scoped to "the next few hours", so what "now" is matters
 * more here than anywhere else. Once the app switches off its testing pre-set
 * and onto the device's real clock (a confirmed in-UK location does that), that
 * clock has to keep moving — these are the bits of the ticker that are pure
 * enough to test on their own. Everything else about the tick is DOM work and
 * lives in app.js.
 *
 * Every time the app *shows* is Edinburgh wall-clock: show times arrive that
 * way from the scraper (see scraper/normalize.py's local_date_start), and the
 * clock they're compared against is read the same way here rather than off the
 * device's zone. That's the whole point — a doors-at-19:30 show is 19:30 on
 * the page whoever is looking, and "on now" means on now at the venue, not on
 * now wherever the phone thinks it is.
 */

/* The festival's zone. Everything below reads a Date through this by default. */
export const FESTIVAL_TZ = "Europe/London";

/* Milliseconds from `date` to the very next turn of the minute.
 *
 * The ticker re-arms with this rather than a flat 60 000 ms so it fires ON the
 * minute instead of drifting a little later with every hop — the displayed
 * clock changes when the real one does. Exactly on the minute returns a whole
 * minute (the next boundary), never 0, so a timer can't spin. */
export function msToNextMinute(date) {
  const elapsed = date.getSeconds() * 1000 + date.getMilliseconds();
  return 60000 - elapsed;
}

/* An instant read as Edinburgh wall-clock, as the pieces the app displays and
 * compares: { date: "2026-08-14", time: "15:44", minutes: 944 } plus the raw
 * hour/minute. `minutes` is minutes since local midnight, which is the unit
 * every "is it on yet / can I still get there" comparison uses.
 *
 * `timeZone` is overridable for tests; callers in the app never pass one.
 *
 * If the environment has no such zone (an ancient browser, a stripped ICU), it
 * falls back to the device's own clock — the old behaviour, right in the UK
 * and no worse than it was anywhere else. */
export function festivalNow(date, timeZone = FESTIVAL_TZ) {
  let y, mo, d, h, mi;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(date)
      .reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
    [y, mo, d, h, mi] = [parts.year, parts.month, parts.day, parts.hour, parts.minute]
      .map(Number);
    if ([y, mo, d, h, mi].some(Number.isNaN)) throw new Error("unparsable parts");
  } catch (err) {
    [y, mo, d, h, mi] = [date.getFullYear(), date.getMonth() + 1, date.getDate(),
                         date.getHours(), date.getMinutes()];
  }
  const p2 = (n) => String(n).padStart(2, "0");
  return {
    year: y, month: mo, day: d, hour: h, minute: mi,
    date: `${y}-${p2(mo)}-${p2(d)}`,
    time: `${p2(h)}:${p2(mi)}`,
    minutes: h * 60 + mi,
  };
}

/* The inverse: the instant whose Edinburgh reading is `local`, given as
 * "YYYY-MM-DDTHH:MM" (a datetime-local input's value, and the form the debug
 * clock picker round-trips through festivalNow above).
 *
 * Read the wall-clock as if it were UTC to get a first guess, then correct by
 * however far that guess actually lands from the target in Edinburgh. Twice,
 * because a guess sitting near a DST boundary can be corrected across it and
 * need a second, smaller nudge; the second pass is a no-op the rest of the
 * year. Returns an Invalid Date for input a Date can't be made from, which is
 * what callers already test for. */
export function festivalDate(local, timeZone = FESTIVAL_TZ) {
  let guess = new Date(`${local}Z`);
  if (isNaN(guess.getTime())) return guess;
  const targetMs = Date.parse(`${local}Z`);
  for (let pass = 0; pass < 2; pass++) {
    const got = festivalNow(guess, timeZone);
    const drift = Date.parse(`${got.date}T${got.time}Z`) - targetMs;
    if (!drift) break;
    guess = new Date(guess.getTime() - drift);
  }
  return guess;
}

/* Short name of a time zone at a given moment — "BST" / "GMT" for the UK. The
 * label beside the clock; `timeZone` defaults to the device's own zone.
 *
 * Returns "" if the browser won't say, so callers can keep whatever label they
 * were showing rather than blanking it. */
export function timeZoneLabel(date, timeZone) {
  try {
    const opts = { timeZoneName: "short" };
    if (timeZone) opts.timeZone = timeZone;
    const part = new Intl.DateTimeFormat("en-GB", opts)
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName");
    return part ? part.value : "";
  } catch (err) {
    return "";
  }
}
