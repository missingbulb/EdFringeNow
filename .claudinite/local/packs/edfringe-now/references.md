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
- **(RULES-3)** This file asserted "general egress is still closed … a single-domain window,
  not open internet" from an August 2026 observation. On 2026-09-04 (issue #608) a session
  read that as current state, answered a vendor-research question from model knowledge alone,
  and wrote the owner a prompt to hand to a different session — while `maze.co`,
  `www.lyssna.com` and `fringeplan.com` all returned 200 from that same session. The rules had
  the discipline for the reverse case ("confirm the allowance is live in your session") and
  not for this one. Retire once the egress policy is fixed for the lifetime of the repo, or a
  mechanism reports it to the session directly.
- **(RULES-4)** Six competitor domains all failed `EGRESS_BLOCKED` in one run on 2026-08-09
  (#300), which the rule turned into a standing ban on the first fetch attempt; `fringeplan.com`
  fetched fine on 2026-09-04. A first-hand page beats a search snippet, and one attempt costs
  less than the staleness. Retire alongside (RULES-3).
- **(RULES-5)** On 2026-09-04 (issue #587, the trip-planner design pass) the owner rejected the
  first mockup draft as looking "like a collection of buttons or an enterprise app" rather than
  "a vacation planner," named minimal text as a mistake the drafts "often" make, and asked for
  graphics-led wizard screens that hide a question once it's answered. The redo (three designer
  subagents plus two reviews) won a clear owner pick and shipped as PR #589. Retire once a
  future pass ships a graphics-first, minimal-text first draft without needing this correction.
