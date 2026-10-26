# Task: Stage 7 - fast browsing with many categories

## Goal
The home and the grids stay fast however many rows ("categorie") and titles there are: rows of genres are
added, their content is fetched only when they come near, only the elements near the focus exist, images
are prefetched just ahead of the focus, and the home appears instantly from a cache at the next start.
Every claim is measured with probe counters, not assumed.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV** (fps on the TV is the reviewer's L3).
- You may create/change: `src/lib/probe.js` (counters only), `src/components/Tile.js`, `src/components/Row.js`,
  `src/views/HomeView.js`, `src/views/GridView.js`, `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`,
  `src/lib/homeCache.js` (new) + `test/homeCache.test.mjs` (new), `src/lib/session.js` (`clearAll` also clears
  the caches), `test/session.test.mjs`, `scripts/api-smoke.mjs` (add checks only), `src/theme.js` (new
  sizes/colours only), `test/ui/scenarios.json`, `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". Do not change the look of existing rows and cards.

## Before you start
Procedure: `docs/AUTOPILOT.md`. Read `docs/ref/lightning.md` "Facts for the next stages": textures already load
only near the screen; what costs is the number of elements.

## Prerequisite
Task T4b is merged into `develop` (`probe.count` and the `tiles`/`images` counters may already exist from
it: reuse them, then 7.1 only records the baseline).

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `7.N` without its commit.

## Required result, per step
**7.1 Counters (no behaviour change).** `probe.count(name, delta)` keeps `s.data.counters[name]`. `Tile`
counts `tiles` (+1 in `_init`, -1 in `_detach`) and `images` (+1 on `txLoaded`). Record the baseline in the
log row: counters after the home is ready, and after 10 `key:Down` on the home and on the "Film" grid.
- Check: `npx lng build > .tmp/build.log 2>&1; node scripts/ui-check.mjs profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" sleep:2000 "expect:s.data.counters.tiles>0 && s.data.counters.images>0" | tail -40`
  (full report: read `final.data.counters`), then the same with 10 `key:Down`.

**7.2 Genre rows, loaded on demand.** After the "Aggiunti di recente" rows, for each `movies` and `tvshows`
library one row per genre (`/Genres` with `userId, parentId, sortBy: 'SortName'`), titled
`"<genre> · <library>"`. A genre row is created with 6 placeholder cards (grey, no image) and fetches its
items (`/Items` with `genreIds, parentId, recursive, includeItemTypes` as the library, `sortBy: 'Random'`,
`limit: 20`) only when the focus is within 2 rows of it; then the cards are replaced in place. Probe:
`rows[i].count` and `rows[i].loaded` (bool). The genre requests go in `src/lib/jellyfin.js` (`genres`,
`items` with a `genreId` option) with L0 URL tests.
- Check: L0; `... wait:home "until:s.data.rows && s.data.rows.length>8" "expect:s.data.rows.filter(r=>r.loaded===false).length>3"`
  then 8 `key:Down` and `"until:s.data.rows[8].loaded===true"`, `visible:20`, `shot:genres`.

**7.3 Virtual home.** Only rows from focus-1 to focus+2 exist as elements; the others are data. Moving the
focus creates and removes rows; each row remembers its horizontal index when it comes back. The rows
container has `boundsMargin` so images one card to the right are prefetched. `navState` still restores row
and index.
- Check: from the home, 12 `key:Down`, `"expect:s.data.counters.tiles<=90"`, `visible:20`, `shot:home-deep`, then
  12 `key:Up` and `"expect:s.focus.row===0"`. Write the counters before/after (7.1 numbers vs now) in the log row.

**7.4 Virtual grid.** `GridView` keeps elements only for the visible rows ±2; data and paging stay as they are.
Back restores the focused card (scenario `2.3-grid-details-back` must stay green).
- Check: on "Film": `... key:Down key:Right key:Right key:Enter wait:grid "until:s.data.loaded>0"` + 12 `key:Down`,
  `"expect:s.focus.index===84 && s.data.counters.tiles<=80"`, `visible:20`.

**7.5 Instant home.** `src/lib/homeCache.js` (pure, storage injected): `saveHome(storage, userId, rows)` /
`loadHome(storage, userId)` with only the fields drawn (title, id, label, imageTag, progress...), at most
150 KB (drop the tail rows if bigger). The home draws the cached rows at once, then refreshes from the
server and replaces rows whose content changed, without moving the focus. Probe event `home_ready` gets
`fromCache: true|false`.
- Check: L0 (round trip, size cap, other user's cache not returned); `... profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" sleep:2000 reload wait:profiles key:Enter wait:home "expect:s.events.some(e=>e.type==='home_ready' && e.fromCache===true)" visible:20`.

## How to work
As in `docs/AUTOPILOT.md`. Every log row of this task writes the counters it measured.

## Delivery
Per step: files and checks with results (counters before/after); the 3 main difficulties; "Non verificato / da proporre".
