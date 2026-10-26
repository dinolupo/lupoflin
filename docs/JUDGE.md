# Judge review (Claude, at the end of each part or stage)

Purpose: catch what a local model gets wrong without noticing: invented facts, claimed-but-not-run checks,
scope drift, slow accumulation of complexity. The judge **re-runs and reads**, it does not trust the log.
Output: `docs/reviews/<date>-<stage>-<part>.md`, short, in Italian.

## Inputs
- The agent works on `task/*` branches merged into `develop`; `master` holds reviewed code only.
  Range to review: `git log --oneline --first-parent master..develop` (one merge per task) and
  `git log --oneline master..develop` (all steps); `git diff --stat master..develop`.
- Unmerged work in progress: `git branch --no-merged develop --list 'task/*'`.
- The Progress log rows of those steps in `docs/PLAN.md`; the task file of the stage.

## Checks, in this order
1. **Log ↔ commits.** Every new log row (commit column `(this)`) is in the commit `lupoflix: step S.N` it
   describes (`git log -p --grep "step S.N" -- docs/PLAN.md`), and every step commit has a row. Results written as numbers are reproducible (step 3).
   Every path that `AGENTS.md` and the task files tell the agent to read is tracked:
   `grep -ohE '(docs|src|scripts|test)/[A-Za-z0-9_./-]+\.(md|js|mjs|json)' AGENTS.md docs/tasks/*.md | sort -u | xargs -n1 git ls-files --error-unmatch > /dev/null`
   may only complain about files a task marks as "(new)" and has not created yet (on 24/10/2026 a
   `.gitignore` rule had silently excluded the whole `docs/ref/`).
2. **Scope.** Per commit, `git show --stat`: only files the task allows; no new dependency in `package.json`;
   no HTML for UI (`git diff <range> -- src | grep -n "document\.\|createElement\|innerHTML"` → none);
   no secrets (`git diff <range> | grep -niE "192\.168\.|password|token-[^t]|AccessToken\""` → only tests/fakes).
3. **Re-run.** `npm run check` and `npm run check:regress` on a clean build, plus the step's own check.
   Compare each commit body's "Requirements -> changes" with its diff: a hunk not listed there is a finding
   (unrequested change), and so is "Other changes: none" when it is false.
   Any difference from the log is a finding.
4. **Hallucination hunt.**
   - Every Jellyfin path, parameter or field added: query `ref/jellyfin-openapi.json` (snippets in
     `docs/ref/jellyfin-api.md`). Missing → finding, severity high.
   - Every Lightning/SDK API used for the first time: grep it in `node_modules/@lightningjs/core/dist/lightning.esm.js`
     or the SDK `src/`. Missing → high.
   - New `_methods` against the reserved list (`docs/ref/lightning.md`, trap 1).
   - Claims like "not needed", "already handled", "equivalent" in commit messages or the log: find the line
     that proves it or mark it unproven.
5. **Behaviour.** Look at the screenshots of the steps (`.tmp/ui/*.png` after the re-run): layout, focus
   visible, nothing overlapping, Italian text. The probe can be right while the picture is wrong.
6. **Drift and debt.** Files over ~200 lines, copy-pasted blocks that should reuse `Tile`/`Row`, magic numbers
   outside `src/theme.js`, timers not cleared in `_detach`, `docs/ref` not updated when a new fact was used.
7. **Tests that test nothing.** New tests must fail if the code is broken: for one of them, break the code
   locally (do not commit), run it, restore.

## After the verdict
- OK: `git switch master && git merge --ff-only develop` (fixes of the judge go on `develop` first, then the
  fast-forward). Never push unless Dino asks.
- FIX / STOP: the fix (or the revert) is committed on `develop` by the judge, or a fix task is written; `master`
  moves only when the verdict is OK.

## Verdict
| Verdict | Meaning | Next |
|---|---|---|
| OK | All checks pass, no high finding | Next part / stage |
| FIX | Medium findings | A short fix task (`docs/tasks/T<n>-fix-<m>.md`) before going on |
| STOP | High finding (invented API, broken check, secret, scope breach) | Revert to the last good commit, rewrite the task where it was ambiguous |

Also note what the **task** did wrong (ambiguity, too big a part, missing hint): improving the next task file is
half of the value of the review. Recurrent issues go into `AGENTS.md` or `docs/ref/` as a rule.
