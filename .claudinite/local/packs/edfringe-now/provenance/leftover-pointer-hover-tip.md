## 2026-09-26 · born · a leftover pointer after a click/drag opens a stray hover-tip in a capture (#906)
- **Source:** PR #900 (`// Off the fare, whose own label would otherwise open over the picture.`)
  and PR #901 (`// Off the button, whose own label would otherwise open over the days.`),
  growth-extract window, item #906: after a click/drag reflows the layout, the pointer can end up
  resting on the element that slides underneath it, whose own hover-tip then renders over the
  capture — non-deterministically, since it depends on exact timing (fine locally, different in
  CI).
- **Reason:** recurred 3 times across 2 PRs; distinct failure mode from the already-landed
  `hover-driven-ui` rule (that one is scroll-triggered `mouseleave` between `drive()`/`capture()`;
  this is a leftover hover-tip from an unrelated preceding gesture), fixed the same way each time by
  parking the pointer at `(0, 0)`.
- **Mechanism:** a bullet in the `requirements-harness` skill's "Traps the harness already paid for"
  list, beside the other capture gotchas it groups with.
- **Retire when:** the harness's `capture()` helper itself parks the pointer automatically before
  every capture, making the per-case comment unnecessary.
- **Actor:** the growth-extract run, item #906.
