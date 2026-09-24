// Kind: scale — a real page driven against the REAL committed data
// (site/data/), not the frozen fixture, and held to bounds that stay true
// whatever the day's data holds: how many rows a list draws, how long a render
// takes, how many elements the page carries. It is the one kind that reads live
// files, because what it proves is that the page survives the real programme's
// size, which a sample cannot show; and it is coded, because a bound is a
// number and a picture of the whole programme would move with every refresh.
// No PNG may live in this folder (the coverage gate enforces it).
// Runner: scale.test.js (the `test:ui` lane).
"use strict";

module.exports = { image: false };
