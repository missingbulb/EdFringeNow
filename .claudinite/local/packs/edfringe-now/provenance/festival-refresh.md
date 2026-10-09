## 2026-10-02 · born · rapid refresh beyond the Fringe
- **Source:** the owner's ask to generalise stage 4 to every festival whose tools expose
  availability.
- **Actor:** @missingbulb (owner).
- **Model:** Claude Opus 5.5
- **Mechanism:** an agentless scheduled task with no cadence term, so it asks at every tick, gated
  by a local term that holds while an edition with an availability-role tool is within three weeks
  of opening or running; ordered after festival-update. A run whose fetches moved only fetch times
  delivers nothing.
- **Rejected:** a per-edition refresh field, since the source roles already say which tools carry
  availability.
