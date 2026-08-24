# Version history

Records for `local/packs/edfringe-requirements`'s own automatic changes, one row per change a
growth task made to it — a prose rule added or removed, a check created, a rule corrected against
a probe or deleted as irrelevant. A local pack is neither versioned nor distributed, so this is the
record at the only granularity it has.

| Date | Task | Change |
|---|---|---|
| 2026-08-24 | `rule-revalidation` | Corrected: "`download_workflow_run_artifact` hands back a `*.blob.core.windows.net` URL and the egress proxy denies it at CONNECT" — `ToolSearch` confirms no such tool (or equivalent) exists in the GitHub MCP server's current tool set at all, so the artifact can't be fetched by any GitHub MCP call, not merely one that then hits a blocked host. The backup fact (`*.blob.core.windows.net` itself is proxy-denied at CONNECT) still holds and is kept as supporting reasoning. |
