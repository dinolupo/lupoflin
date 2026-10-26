# Autopilot: work through the task files without stopping

This replaces the "summary, then stop" start of `/task` and the "one part per session" rule: you work step
after step, task after task, until a stop condition below. Everything else in `AGENTS.md` still applies.
The state is in the repository, so if your session ends for any reason, a new session with this same prompt
continues where you stopped.

## Branches (you manage them; Dino does not)
| Branch | Who writes it | What |
|---|---|---|
| `master` | **only the reviewer (Claude)** | reviewed code. Never commit, merge or switch-and-edit on it |
| `develop` | you, only by merging a finished task branch | integration of finished tasks, waiting for review |
| `task/<task file name without .md>` (e.g. `task/T3-home-polish`) | you | the steps of one task file |

## Start
1. `git status --short`: if anything is uncommitted, stop and report (it is not yours to commit or discard).
2. Get on the right branch:
   - `git branch --list develop` empty → `git branch develop master`.
   - `git branch --no-merged develop --list 'task/*'` not empty → an unfinished task branch exists: `git switch` to
     it and continue there (resume after an interrupted session).
   - otherwise `git switch develop`.
3. Read `AGENTS.md`, then `docs/ref/lightning.md`, then the Progress log (`tail -25 docs/PLAN.md`) and
   `git log --oneline -20`.
4. Run `npm run check > .tmp/check.log 2>&1; echo $?`. If it is not 0 **before you changed anything**, stop and
   report: never build on a broken base.
5. The work queue is the task files in `docs/tasks/` in name order (`T1-...`, `T2-...`). A task file is done
   when all its steps have their commit `lupoflix: step S.N - ...` **on `develop`**. Take the first task file
   not done. If you are on `develop`, create its branch: `git switch -c task/<task file name> develop`.

## Loop, for each step
1. Re-read that step's section of its task file (scope, files, check). Read only the source files it needs.
2. Make the change in small edits. Respect the task's "You may create/change" list exactly.
3. Run the step's check command exactly as written, then `npm run check`, then `npm run check:regress`
   (all earlier scenarios, ~1 min). All must pass. Up to 3 attempts with different fixes; on the 3rd failure
   write the log row with `BLOCKED` and what you tried, commit only the log row, and stop.
4. **Self-review before committing** (this is where most mistakes are caught):
   a. `git diff --stat` and `git diff`. For **every** changed hunk, name the sentence of the step that asks
      for it. A hunk you cannot match to a sentence is an unrequested change: revert it
      (`git checkout -p -- <file>` or edit it back), even if you think it is an improvement. Put the idea in
      your final report under "da proporre".
   b. If the step changes what is on screen: open the screenshot(s) your check saved in `.tmp/ui/` and look
      at them. Write 1-2 lines of what you actually see (cut text? overlapping? empty area? wrong image?) and
      compare with the step's description. If they disagree, the step is not done, even if the check passed.
   c. Add the step's check scenario to `test/ui/scenarios.json` (key `S.N-short-name`, the same ui-check
      steps without `shot:`). Edit an existing scenario only if your task says the layout changes; then list
      the edited scenario names in the commit body.
5. Append the Progress log row to `docs/PLAN.md` (step, `(this)`, check command, real result, date), then
   commit the step's files, the scenario and that row together, with this message:
   ```
   lupoflix: step S.N - <what>

   Requirements -> changes:
   - <sentence of the step> -> <file>: <what changed>
   - ...
   Screenshot: <what you saw in .tmp/ui/<name>.png>
   Scenarios: added <name>[; edited <names> because <reason from the task>]
   Other changes: none
   ```
   "Other changes: none" must be true: step 4a guarantees it.
6. Continue with the next step immediately, **unless the task file has the line `Mode: one step at a time`**: then
   stop after the commit of this step and write the step report (below). Do not start the next step, not even a
   small part of it. Dino starts a new conversation with the same prompt for the next step: the state is in the
   repository ("Where you are"). After the **last** step of such a task, do the gate and the merge ("End of a
   task file") in the same session before the report.

### Step report in one-step mode (Italian, 12 lines at most)
Step, commit hash, the check commands with their real result, what you saw in each screenshot (name the file),
the files changed (`git show --stat`), "Non verificato", and the next step's number. Nothing else.

## End of a task file (gate and merge)
1. On the task branch: `npm run check` and `npm run check:regress` must both pass. Add the log row
   `Gate S | (this) | npm run check + check:regress | <real result>` and commit it: `lupoflix: gate S`.
2. Merge into develop, keeping the task visible as one unit:
   `git switch develop && git merge --no-ff task/<name> -m "lupoflix: merge task/<name>"`.
   A merge conflict: `git merge --abort`, `git switch task/<name>`, stop and report. Never resolve it yourself.
3. On `develop` run `npm run check` again. Not 0: stop and report (do not try to fix on develop).
4. Keep the task branch (the reviewer reads it). Go on with the next task file from `develop` (start step 5),
   if its "Prerequisite" section is satisfied; otherwise stop.

## Stop conditions (then write the final report)
- No task file left, or a task's prerequisite is not met.
- A step is `BLOCKED`.
- A step needs the TV, Dino, a new dependency, or a file outside its list.
- You notice you are about to guess (an API, a field, a Lightning property) and the docs/spec cannot confirm it.

## Never
- TV commands of any kind: `npm run tv`, `ui-check --tv`, `ares-*`, `npm run package`. The TV is in use.
- Change a check to make it pass: thresholds in `visible:`/`expect:`/`until:`, tests you did not write in this
  step, existing scenarios in `test/ui/scenarios.json` (unless the task says the layout changes),
  `scripts/ui-check.mjs`, `scripts/regress.mjs`, `scripts/api-smoke.mjs` (except adding checks when the task says so).
- "Improve" code the step does not ask for, even in files you may edit.
- Work around a file you may not edit (subclass it, copy its code into an allowed file): that is the stop
  condition "needs a file outside its list". (25/10/2026: `ResumeRow` copied `Row._init` into `HomeView`.)
- Edit `AGENTS.md`, `docs/AUTOPILOT.md`, `docs/JUDGE.md`, `.agents/`, task files, or the stages of `docs/PLAN.md`.
- Commit, merge or edit anything on `master`. `git commit --amend`, `rebase`, `reset`, `push`, `cherry-pick`,
  `branch -D`, `stash`, deleting branches or history. The only branch commands you use are those in
  "Branches", "Start" and "End of a task file".
- Write in the log or the report a result you did not obtain in this session.

## Final report (in Italian)
Branch you are on and what is merged into `develop` (`git log --oneline master..develop | head -30`),
steps done (commit hash each), steps not done and why, the checks you ran last and their result, anything
you were unsure about ("Non verificato"). Keep it under 30 lines.
