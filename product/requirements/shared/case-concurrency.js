// How many cases the UI lanes run at once.
//
// A case's render does not depend on wall-clock timing — the clock, location,
// randomness, fonts and network are all fixed by the harness — so running
// several at once cannot move a pixel, only the wall time. Each case still gets
// its own browser context, which is what isolates one from another.
//
// Sized from the machine rather than pinned, because the lane runs on both a
// CI runner and a developer's box. Two per core: a case spends much of its life
// waiting on the browser rather than burning CPU, so one page per core leaves
// the machine idle.
"use strict";

const os = require("node:os");

const MAX = 8;

const CASE_CONCURRENCY = Number(process.env.REQUIREMENTS_CONCURRENCY) || Math.min(MAX, Math.max(2, os.cpus().length * 2));

module.exports = { CASE_CONCURRENCY };
