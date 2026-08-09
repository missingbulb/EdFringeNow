// The one reference instant every requirements case renders at, and the fixed
// fake inputs that surround it. Fixture data is authored relative to this
// moment; goldens are only comparable because nothing ever reads another clock.
//
// Saturday 15 August 2026, 19:30 in Edinburgh (BST = UTC+1): mid-festival, a
// busy evening, with shows still to start tonight and the fringe day (06:00 →
// 06:00) far from rolling over.
"use strict";

const REFERENCE_NOW_LOCAL = "2026-08-15T19:30";
const REFERENCE_NOW_UTC_MS = Date.UTC(2026, 7, 15, 18, 30, 0);

// The app adopts the device clock (our fixed time) only when geolocation
// reports an in-UK position — so the fake location is central Edinburgh,
// exactly the app's own USER_DEFAULT, which also keeps the debug pill hidden.
const GEOLOCATION = { latitude: 55.9523946827963, longitude: -3.188258484671504 };

const TIMEZONE = "Europe/London";
const LOCALE = "en-GB";

// The fringe date REFERENCE_NOW falls on (19:30 is inside the 06:00–06:00 day).
const REFERENCE_FRINGE_DATE = "2026-08-15";

// The app's own built-in simulated "now" (js/app.js), in force whenever
// geolocation does NOT confirm an in-UK position — the state the
// geolocation-denied case renders in.
const PRESET_FRINGE_DATE = "2026-08-14";

module.exports = {
  REFERENCE_NOW_LOCAL,
  REFERENCE_NOW_UTC_MS,
  REFERENCE_FRINGE_DATE,
  PRESET_FRINGE_DATE,
  GEOLOCATION,
  TIMEZONE,
  LOCALE,
};
