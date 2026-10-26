# CLOSED 25/10/2026 (Dino: the browser error dialog is not needed; the OK-after-Home bug cannot be reproduced). Kept only as a record; do not run.

# Task: Stage 15 - second round of TV findings (25/10/2026)

## Goal
Dino tried the Stage 12 build on the LG TV. Five of the six fixes were confirmed. Four defects remain or are new (two of them were then fixed by the reviewer, see below).
Each was seen by Dino on the TV; the symptom is certain, the cause is given only where it was verified.

## Already done (do NOT redo, do NOT touch)
By the reviewer on `develop` (commit "judge 12"): steps 15.1 (search keyboard: Right moves inside a row and leaves it only
at the last key; keys 74x92, font 36; scenario `15.1-search-keyboard`) and 15.2 (`ExitDialog` `zIndex: 10`; scenario
`15.2-exit-on-top`). **Skip both**; they stay in this file only for the numbering. Only 15.3 and 15.4 remain.
Everything of Stage 12 (`T10-tv-findings`) is on `master` and `develop`: pill contrast, user picture alpha, detail
buttons sized by their label, grid first row, `ProfileMenu` covering the home. Do not look at other branches
(`git log --all`, `git diff <branch>`): only `develop`. If a step below turns out to be already done, say so in
the report and write nothing for it.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.** What only the TV can show goes in the report.
- You may create/change: `src/components/Keyboard.js`, `src/views/SearchView.js`, `src/views/ServerView.js` (only if
  it uses `Keyboard`: keep it working), `src/App.js`, `src/components/ExitDialog.js`, `src/views/PlayerView.js`
  (only the error path of 15.4), `src/lib/probe.js` (only the key trace of 15.3), `src/index.js`,
  `scripts/ui-check.mjs` (only the new step of 15.4), `src/theme.js` (new sizes only), `test/ui/scenarios.json`
  (add scenarios only), `test/*.test.mjs` (add tests only), `docs/ref/webos.md` and `docs/ref/lightning.md`
  (add a fact), `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". No new dependencies. No change to the search request itself
  (`client.search`), only to the screen.

## Before you start
Procedure: `docs/AUTOPILOT.md`. For 15.1 read the whole of `src/components/Keyboard.js` (209 lines) and the
`$keyboard*` handlers of `SearchView.js`. Look at the screenshots: Dino found these because the earlier checks
read data and did not look at the picture. Write what you really see in the `Screenshot:` line.

## Prerequisite
`git log --oneline develop | grep -c "merge task/T10-tv-findings"` is 1.

## Required result, per step

**15.1 Search keyboard: keys and movement, tested properly.** On the TV the on-screen keyboard of "Cerca" does
not move correctly and the keys do not work as expected. Known fact: in `Keyboard.js`, `_handleRight` returns
`false` at once when `mode === 'search'`, so Right never moves between keys of a row (it was probably meant to
leave the keyboard at the **last** key of a row to reach the results, not at every key). Find any other cause
yourself by pressing keys in the browser. Required behaviour:
- Left/Right move inside a row, and stop at the left edge. Right on the **last key of a row** goes to the results
  when there are results, otherwise stays. Up/Down keep the nearest column.
- OK on a letter, digit or symbol appends it; "Spazio", "Cancella" (one char) and "Svuota" (all) work; the search
  box and the results follow. Typing with the PC keyboard keeps working (it is how `ui-check` types).
- Press a key and the result must be visible on the same frame sequence: `probe.data('query')` changes.
- **Bigger keyboard**: today it fills a small part of the screen (compact: keys 64x56 px, whole keyboard about
  730x300). Use the left half of the screen well: keys of at least 88x72 px, font at least 32, the keyboard
  vertically centred under the search box, results on the right as now. Nothing overlaps (box, keyboard,
  results). The `ServerView` keyboard (not compact) must look as before.
- Probe: `probe.focus({ area: 'keyboard', key, row, col })`.
- Check: L0 for any pure helper you add (for example `nextKeyPosition(rows, row, col, direction)` in a new
  `src/lib/keyboardNav.js` with `test/keyboardNav.test.mjs`: edges, last key of every row, rows with different
  lengths, the action row). UI scenario `15.1-search-keyboard`: `profile:dev wait:home`, open Cerca, then a
  **sequence of real key presses, not `type:`**: `key:Right key:Right key:Enter` must append the third key of
  the first row (`s.data.query==='3'`), `key:Down key:Enter` appends the key below, then move to "Spazio" and
  press it, "Cancella" removes one character, "Svuota" empties; at the end of the first row Right does not
  leave the row; `visible:20`, `shot:search-keyboard`. Look at it and describe it: size, centring, no overlap.
  Also a scenario with a query that gives results and `key:Right` from the last key of a row lands in the
  results (`s.focus.area==='results'`) and `key:Left` comes back to the same key.

**15.2 Exit dialog behind the posters.** On the home, Back opens "Vuoi uscire da Lupoflix?" but its buttons
("Esci", "Annulla") appear **behind** the posters. Verified cause: `ExitDialog` and its container `Dialog` in
`App.js` have no `zIndex`, while home tiles use `zIndex` 1 to 5 (`ProfileMenu` was fixed with `zIndex: 10`).
Give the container the same treatment `ProfileMenu` has (read how it did it in step 12.5 and be consistent), so
the dimmed layer and the box cover everything on every screen (home, grid, details, search). Do not change any
other overlay.
- Check: scenario `15.2-exit-on-top`: `profile:dev wait:home "until:s.data.rows && s.data.rows.length>1"
  key:Back "expect:s.data.dialog==='exit'" visible:3 shot:exit-dialog` (`visible:3`: the screen must be almost
  all dark, no poster visible through or above the box). Look at it. Then `key:Back
  "expect:!s.data.dialog"` and the same on the grid view of a library.

**15.3 OK stops working after the webOS Home button.** On the TV: press the Home button of the remote (webOS
launcher), open Lupoflix again from the recently used apps: Left/Right/Up/Down work, but **OK (Enter) does
nothing**. Cause unknown; do not guess. Step 1: add a **key trace**: when the config has `telemetry` (see
`src/lib/probe.js` and `docs/ref/webos.md`), or always while the URL has `?keytrace=1`, record every `keydown`
and `keyup` the app receives as a probe event `key` with `{ type, key, keyCode }` (keep the last 30; no key
names that identify typed text beyond the code). Also record `visibilitychange` and the webOS events
`webOSRelaunch` / `webOSLaunch` as probe events `lifecycle` with the state. Step 2: with that data **and what
you know of webOS** (`docs/ref/webos.md`; do not browse the web), implement the most likely fix **only if the
cause is certain from the data**. In the browser you can simulate `visibilitychange` (hidden then visible) and a
page `blur`/`focus`; if with that simulation OK still works, the cause is TV-only: then the step ends with the
trace in place, a section "Come raccogliere i dati" in `docs/ref/webos.md` (how the reviewer reads the trace
after a Home-and-back on the TV) and the log row `needs-TV`, not `BLOCKED`. Do not add workarounds that are not
tied to a verified cause (for example do not call `window.focus()` or re-create the stage "to see if it helps").
- Check: L0 for the trace buffer (keeps 30, drops the oldest); scenario `15.3-lifecycle`: dispatch
  `visibilitychange` hidden then visible through `ui-check` (add a step `lifecycle:hide-show` if needed, in
  `scripts/ui-check.mjs`), then `key:Enter` on a focused home tile must still open the details
  (`wait:details`).

**15.4 See the player error screen.** Stage 12.6 added the dialog "Impossibile riprodurre il titolo" but nobody
has seen it: no scenario makes playback fail. Add to `scripts/ui-check.mjs` a step `fail:<url fragment>` that makes
the browser abort every request whose URL contains the fragment (Playwright/Puppeteer request interception; use
whatever the script already uses, no new dependency), for example `fail:PlaybackInfo`. Then a scenario
`15.4-player-error`: `fail:PlaybackInfo "query:item={{browserPlayableId}}" profile:dev wait:details key:Enter
"until:s.events.some(e=>e.type==='player_error')" visible:5 shot:player-error`. Look at `player-error.png`: the
message and the single "Indietro" button are centred and readable; the page behind is not a white screen on the
TV (in headless Chromium the page is white behind video, known artefact: say so and judge only the dialog).
`key:Enter "until:s.view==='details'"` goes back. If you see a defect in the dialog, fix it inside this step and
say what; if the dialog never appears with this interception, find out why (playback info is also called from
elsewhere?) and fix the cause.
- Check: the scenario above passes and `player-error.png` exists and is described.

## How to work
As in `docs/AUTOPILOT.md`. One commit per step with the "Requirements -> changes" body and the `Screenshot:`
line. In every log row write the real result. Order: 15.4, then 15.3.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre". List for the
reviewer what only the TV can show: the real remote on the keyboard (feel of the movement, key size at 3 m),
the Home-and-back sequence with the key trace, (the keyboard and the exit dialog on top are certified by the reviewer).
