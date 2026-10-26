# Task: Stage 2 - title details page

## Goal
Enter on a poster (home rows or library grid) opens a Netflix-style details page: full-screen backdrop, title,
meta line, overview and a focused "Riproduci" button (no playback yet). Series also show seasons and episodes.
Back returns to the screen that opened it, with the same focus.

## Scope
- Target: the browser build checked by `scripts/ui-check.mjs`. **No TV** in this stage.
- You may create/change: `src/views/DetailsView.js` (new), `src/components/Button.js` (new),
  `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks only), `src/App.js`,
  `src/views/HomeView.js`, `src/views/GridView.js`, `src/theme.js` (new sizes/colours only),
  `docs/ref/jellyfin-api.md` (only if you use something new, verified), `docs/PLAN.md` (Progress log rows only).
- Read-only: everything else. Reuse `Tile` and `Row`, do not change them.
- Forbidden: new dependencies, HTML elements, playback code (Stage 4), TV commands, push.
- Authorized: `npm test`, `npx lng build`, `node scripts/ui-check.mjs`, `npm run check`, `npm run check:api`, commits.

## Prerequisite
Stage 1 is done: every step 1.1-1.4 has its commit, and `App` has the navigation stack of step 1.3
(`_push`, `$back`, `navState`). If not, stop: this task builds on it.

## Material
- `docs/ref/jellyfin-api.md`, section "Verified for Stage 2": endpoints, parameters and fields you need are
  already checked against the spec. Use exactly those names.
- `docs/ref/lightning.md` (patterns, traps). `src/components/ExitDialog.js` shows the focused-button style
  (white background, dark text) to copy into `Button`.
- `src/views/HomeView.js` `$rowSelect`: item entries (`kind: 'item'`) only log a probe event today.

## Where you are
Read the Progress log at the end of `docs/PLAN.md` (`tail -20 docs/PLAN.md`) and `git log --oneline -15`.
A step is done when it has its commit `lupoflix: step 2.N - ...`. Continue from the first step without one.

## Required result, per step
**2.1 Client.** In `src/lib/jellyfin.js`: `urls.item(base, userId, itemId)`, `urls.seasons(base, userId,
seriesId)`, `urls.episodes(base, userId, seriesId, seasonId)`, `mapDetails(raw)` → `{ id, name, type, year,
overview, minutes, genres, rating, communityRating, backdrop: { itemId, tag } | null, seriesId }` (`minutes` =
`Math.round(RunTimeTicks / 600000000)` or `null`; backdrop from `BackdropImageTags[0]`, else from
`ParentBackdropItemId` + `ParentBackdropImageTags[0]`), and client methods `item`, `seasons`, `episodes`.
- Check: new L0 tests (mapping with and without backdrop, parent backdrop, missing runtime; URLs) → `npm test`
  `# fail 0`; add an `itemDetails` check to `api-smoke.mjs` (first item of the first `movies` library has a
  name and `minutes > 0`) → `npm run check:api` exit 0.

**2.2 Details page for a film.** `DetailsView` (props `client`, `session`, `itemId`): backdrop 1920x1080
(`imageUrl(backdrop.itemId, { type: 'Backdrop', tag, maxWidth: 1920 })`), a dark gradient over the left half
(rect with `colorLeft: 0xf0141414`, `colorRight: 0x00141414`), title (64 px), meta line
`year · N min · rating` (skip missing parts), overview (30 px, `wordWrapWidth: 900`, `maxLines: 4`), focused
`Button` "Riproduci". Enter on it → `probe.event('play_requested', { id })`. Back → `this.fireAncestors('$back')`.
Home poster Enter → `App` pushes `DetailsView`. Probe: `probe.view('details', { id, name, type })`,
`probe.focus({ label: 'Riproduci' })`.
- Check: `npx lng build > .tmp/build.log 2>&1; node scripts/ui-check.mjs --brief profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" key:Down key:Enter wait:details sleep:1500 visible:20 shot:details key:Enter "expect:s.events.some(e=>e.type==='play_requested')" key:Back wait:home "expect:s.focus.row===1 && s.focus.index===0"`

**2.3 From the grid too.** Grid poster Enter opens the same page; Back returns to the grid with the same
focused card (grid `navState` = `{ index, loaded }`; reloading the needed pages on restore is fine).
- Check: `... key:Enter wait:grid "until:s.data.loaded>0" key:Right key:Right key:Enter wait:details key:Back wait:grid "until:s.focus && s.focus.index===2"`

**2.4 Series.** For `type === 'Series'`, below the button: a seasons row (poster tiles, labels) and, after
Enter on a season, an episodes row (wide tiles `layout.wide`, label `"N. Title"`). Down/Up move between button,
seasons and episodes. Probe data: `seasons` (count), `episodes` (count).
- Check: on the "Serie TV" library (home row 0, index 3): `... key:Right key:Right key:Right key:Enter wait:grid "until:s.data.loaded>0" key:Enter wait:details "until:s.data.seasons>0" key:Down key:Enter "until:s.data.episodes>0" sleep:1000 visible:20 shot:series`

## How to work
- After each step: `npm run check > .tmp/check.log 2>&1; echo $?` must print 0, then add the Progress log row
  (step, `(this)`, check, result, date) and commit it with the step: `lupoflix: step 2.N - <what>`.
- New `_methods`: reserved-name grep first (`docs/ref/lightning.md`). New Jellyfin field or parameter: only from
  the verified table; anything else, query the spec and add the row in the same commit.

## Delivery
Per step: files and checks with results. The 3 main difficulties, what is not verified. Then stop.
