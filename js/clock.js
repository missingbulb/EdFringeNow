/* Clock helpers for the Now page.
 *
 * The whole page is scoped to "the next few hours", so what "now" is matters
 * more here than anywhere else. Once the app switches off its testing pre-set
 * and onto the device's real clock (a confirmed in-UK location does that), that
 * clock has to keep moving — these are the two bits of the ticker that are pure
 * enough to test on their own. Everything else about the tick is DOM work and
 * lives in app.js.
 */

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
