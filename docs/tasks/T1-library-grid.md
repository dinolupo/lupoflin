# Task: Stage 1 - library grid

## Goal
From the home "Le tue librerie" row, Enter opens a full-screen grid of that library's titles (Netflix style),
navigable with the remote, with paging, and Back returns to the home exactly where the user was.

## Scope
- Target: the browser build checked by `scripts/ui-check.mjs` (the TV comes in Stage 3).
- You may create/change: `src/views/GridView.js` (new), `src/lib/paging.js` (new), `test/paging.test.mjs` (new),
  `src/App.js`, `src/views/HomeView.js`, `src/theme.js` (only new grid sizes), `docs/PLAN.md` (Progress log
  rows only).
- Read-only: everything else. `src/components/Tile.js` and `src/components/Row.js` are **reused, not changed**.
- Forbidden: new dependencies, HTML elements, changes to `src/lib/jellyfin.js` (it already has
  `items(userId, view, { startIndex, limit })`), push.
- Authorized: `npm test`, `npx lng build`, `node scripts/ui-check.mjs`, `npm run check`, commits.

## Material (read in this order, only when the step needs it)
- `docs/ref/lightning.md` - patterns and the 6 traps. Read it fully once at the start.
- `src/views/HomeView.js` (122 lines): `_populate` builds rows (library entries at line ~60, `kind: 'library'`),
  `$rowSelect` only logs a probe event today, `_rowIndex` and each `Row.index` hold the focus.
- `src/App.js` (123 lines): `_show(Type, props, name)` swaps the view; `_showHome(session)` at line ~76;
  App does not keep `session` yet.
- `src/components/Row.js` (73 lines): how a horizontal list positions `Tile`s and scrolls with `setSmooth`.
- `src/lib/jellyfin.js`: `client.items(userId, view, { startIndex, limit })` returns `{ items, total }`; `view`
  must have `id` and `collectionType`. `client.imageUrl(id, { tag, maxHeight })`.
- Key hint: `items()` needs the library's `collectionType` (movies → `Movie`, tvshows → `Series`), so the
  library entry in `HomeView` must carry it.

## Where you are
Progress is in the repository. First read the "Progress log" table at the end of `docs/PLAN.md`
(`tail -15 docs/PLAN.md`) and `git log --oneline -10`. A step is done when it has its commit
`lupoflix: step 1.N - ...`. Do the first part whose steps are not all done, and say which one in your summary.
If all are done, report and stop.

## Required result, per step
**1.1 Open the grid.**
- `HomeView` library entries also carry `collectionType`; `$rowSelect` with `entry.kind === 'library'` calls
  `this.fireAncestors('$openLibrary', { id, name, collectionType })`. Item entries keep the probe event.
- `App.$openLibrary(view)` shows `GridView` with `{ client, session, view }` (store `this.session` in `_showHome`).
- `GridView`: header with the library name (same style as the home header), poster `Tile`s with labels in
  7 columns (`layout.poster` size, gap `layout.tileGap`, row height = poster h + 70), first page of 60 items.
  Must have `_handleBack()` (even if empty in 1.1) so Back never reaches the SDK.
- Probe: `probe.view('grid', { library, total, loaded })`, then `probe.data('loaded', n)` after each page,
  `probe.focus({ index, label })` on every move.
- Check: `npx lng build > .tmp/build.log 2>&1; node scripts/ui-check.mjs --brief profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" key:Enter wait:grid "until:s.data.loaded>0" shot:grid`
  → `"ok":true`. Then `npm test 2>&1 | tail -3`.

**1.2 Navigate.** Left/Right move by 1 inside the row (stop at the edges), Up/Down by 7 (stop at the first and
last item), the container scrolls so the focused row stays fully visible (`setSmooth('y', ...)`, 0.2 s).
- Check: `... key:Enter wait:grid "until:s.data.loaded>0" key:Down key:Down key:Right "expect:s.focus.index===15" shot:grid-nav`

**1.3 Back with memory (navigation stack).** Back in the grid returns to the home with the same row and card
focused. Build it as a small stack in `App`, because Stage 2 reuses it for the details page:
- `App._push(Type, props, name)`: before replacing the current view, store `{ Type, props, name, state }` where
  `state` is `currentView.navState` (a getter each view may define; `undefined` if it does not).
- `App.$back()`: pop the last entry and show it again with `{ ...props, navState: state }`.
- `HomeView` defines `get navState()` → `{ row, index }` and, when created with `navState`, restores that row
  and index after `_populate`. `GridView._handleBack()` calls `this.fireAncestors('$back')`.
- Login screens are not pushed: `$loggedIn` and `$showProfiles` clear the stack.
- Check: `... wait:home "until:s.data.rows && s.data.rows.length>1" key:Right key:Enter wait:grid key:Back wait:home "until:s.focus && s.focus.row===0 && s.focus.index===1"`

**1.4 Paging.** Pure helper in `src/lib/paging.js`: `needsNextPage({ focusIndex, loaded, total, columns,
marginRows })` → boolean (true when the focused row is within `marginRows` of the last loaded row and
`loaded < total`), with tests in `test/paging.test.mjs` (edges: empty library, exactly one page, last page
partially filled, total already loaded). `GridView` loads the next 60 with `startIndex = loaded`, never two
requests at once, and appends tiles.
- Check: `npm test 2>&1 | tail -8` (`# fail 0`) and, on the "Film" library (row 0, index 2 today):
  `... key:Right key:Right key:Enter wait:grid "until:s.data.loaded>0" key:Down key:Down key:Down key:Down key:Down key:Down key:Down key:Down key:Down "until:s.data.loaded>60"`

## Parts (one session per part; stop at the end of each part)
**Part A**: steps 1.1, 1.2. **Part B**: steps 1.3, 1.4.

## How to work
- First step: task summary, then stop (done by `/task`). In autopilot mode (`docs/AUTOPILOT.md`) do not stop.
- New method names: run the reserved-name grep from `docs/ref/lightning.md` before using them.
- After each step: full `npm run check > .tmp/check.log 2>&1; echo $?` must still print 0, then add the
  Progress log row (step, `(this)`, check, result, date) and commit it with the step: `lupoflix: step 1.N - <what>`.
- If a ui-check fails: rerun without `--brief`, read `steps` and `appErrors` (they include a stack), look at the
  screenshot only if you can read images.

## Delivery
Briefly: what each step changed (files, lines), the checks you ran with their result, the 3 main difficulties,
what is not verified. Then stop.
