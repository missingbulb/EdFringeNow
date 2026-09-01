# Competitor UI screenshots

UI evidence for the feature comparison on
[competitor-landscape/](../../competitor-landscape/README.md). Kept because
these products change or vanish season to season (one is invite-walled, one
runs on a stale catalogue, one is a solo side project), so the pages cited
there may not show next year what they showed on capture day.

Provenance, all captured 2026-09-01:

- `2026-09-01-<name>-landing.{png,jpg}` — first-hand screenshots of each
  tool's public landing page: headless Chromium 1280×900, every network
  request served through this environment's egress proxy via curl (the
  browser cannot tunnel the proxy itself), page settled for 5–10s before
  capture. JPEG where a photographic background made PNG oversized.
- `2026-09-01-planmyfestivals-guide-p*.png` — pages 7, 8 and 10 of the
  vendor's own published
  [user guide PDF](https://www.planmyfestivals.com/static/guide/PlanMyFestivals-User-Guide.pdf)
  rendered at 100dpi (`pdftoppm`), kept because the app itself sits behind
  invitation-only registration, so the guide's figures are the only view of
  its logged-in UI: the show chooser (p7), the built schedule with travel
  legs (p8), and the gap finder with cross-festival pills (p10).
- `2026-09-01-edfringenow-{now,plan}.png` — our own two surfaces, same
  method, captured as the comparison's reference points.
