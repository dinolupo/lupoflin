---
name: lupoflix-autopilot
description: Work through the Lupoflix task files in docs/tasks step by step without stopping, browser only, following docs/AUTOPILOT.md. Use when asked to run the autopilot, continue the plan, or do the next task.
---

# Lupoflix autopilot

1. Read `AGENTS.md` (project rules) and `docs/AUTOPILOT.md` (the procedure) in full, in that order.
2. Follow `docs/AUTOPILOT.md` exactly: branches (you create `task/*` from `develop` and merge them back into
   `develop` yourself; never touch `master`), start checks, the loop with one commit per step, the gate and
   merge at the end of each task file, until a stop condition.
3. Before every commit do the self-review of `docs/AUTOPILOT.md` step 4: every diff hunk must match a
   sentence of the step (otherwise revert it), look at the screenshots, add the scenario, write the
   "Requirements -> changes" commit body ending with "Other changes: none".
4. Do not ask for confirmation between steps. Never use the TV (`npm run tv`, `ui-check --tv`, `ares-*`,
   `npm run package`): it is in use.
5. When you stop, write the final report in Italian as described at the end of `docs/AUTOPILOT.md`.
