## 2026-09-26 · born · a CSS-transition assertion must sample every frame, not one delayed sample (#906)
- **Source:** PR #890 (growth-extract window, item #906), case `planng-theme-fade.23.10.case.js`: a
  first fix replaced a bare `waitForTimeout(150)` with a `waitForFunction` on the state change plus
  a further `waitForTimeout(100)`, which still wasn't robust; the commit that actually landed ("The
  23.10 fade case now samples every frame of the fade rather than one moment, which a loaded machine
  could miss") replaced it with a `MutationObserver`/`requestAnimationFrame` loop collecting every
  frame across a bounded window and asserting some frame lies strictly between the start/end values.
- **Reason:** the reusable part is the sampling *technique* (continuous rAF sampling vs. a single
  delayed sample gated on the state change), not this specific fade — the next animated
  custom-property transition in this harness will face the same choice. Not already covered: the
  `requirements-harness`/`css-freeze-does` guidance covers frozen clocks and `element.animate`
  surviving a freeze, nothing about transition-sampling strategy.
- **Mechanism:** a bullet in the `requirements-harness` skill's "Traps the harness already paid for"
  list; a testing-judgment call about async sampling strategy, not a static shape a check could
  assert.
- **Retire when:** the harness grows a shared helper that does this sampling generically, at which
  point the guidance moves to "use that helper" rather than restating the technique per case.
- **Actor:** the growth-extract run, item #906.
