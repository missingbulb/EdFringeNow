# edfringe — rule rationale

One entry per referenced rule or check in this pack's `RULES.md`, keyed by the citing file's
own marker. Written for the periodic re-validation pass, never for daily agentic work — no rule
sends its reader here.

- **(RULES-1)** A wiki-growth research pass capturing 12 competitor-UI screenshots (PR #568,
  2026-09-01, issue #567) hit `net::ERR_CONNECTION_RESET` from `chromium.launch()` on every
  off-allowlist host, including after retrying with the proxy passed explicitly — the same
  Chromium-can't-tunnel-the-proxy gap already documented for `unpkg.com`/Leaflet, confirmed here
  to generalize to any external host. Routing every request through `page.route` fulfilled by
  `curl` (`shot-via-curl.mjs`) produced working screenshots for all 12 sites. Retire once the
  sandbox proxy lets headless Chromium tunnel to an arbitrary host directly.
- **(RULES-2)** The same pass dispatched several parallel research subagents (session
  `26ae9aec-41c3-56e6-b289-00b96b2f07a2`, issue #567); one died with zero output when the
  session hit its rate limit mid-run, losing that territory's research entirely and costing a
  ~1.5h full re-dispatch. Re-issuing the identical brief with an added "prefer finishing over
  exhaustive digging" budget avoided a repeat on the retry. Retire once a subagent killed by a
  rate limit can hand back partial output instead of none.
