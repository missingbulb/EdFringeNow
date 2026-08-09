// Kind: screen — a rendered page state, pixel-exact against a committed golden
// beside the case (cases/<slug>.<id>.png). The default and most common kind:
// the case drives the real page (in the pinned, fully-faked harness browser)
// to one resting state, the runner captures it, and the golden is the
// assertion the owner reviews by sight.
// Runner: screen.test.js (the `test:ui` lane). Refresh: shared/refresh.js.
"use strict";

module.exports = { image: true };
