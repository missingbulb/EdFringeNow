// How many cases the UI lanes run at once.
//
// A case's render does not depend on wall-clock timing — the clock, location,
// randomness, fonts and network are all fixed by the harness — so running
// several at once cannot move a pixel, only the wall time. Each case still gets
// its own browser context, which is what isolates one from another.
//
// Sized from the machine rather than pinned, because the lane runs on both a
// CI runner and a developer's box, and at ONE page per core. Two per core is
// faster and measurably less stable: over 495 renders of the whole screen set
// on a 4-core box, two cases came out different at eight pages and none did at
// four. An oversubscribed machine starves the renderer at the moment a case
// captures, which is the one thing the goldens cannot tolerate.
"use strict";

const os = require("node:os");

const MAX = 8;

const CASE_CONCURRENCY = Number(process.env.REQUIREMENTS_CONCURRENCY) || Math.min(MAX, Math.max(2, os.cpus().length));

module.exports = { CASE_CONCURRENCY };
