# Task: Stage 6b - profile icon picker (GetAvatar plugin), designed for hundreds of icons

## Goal
Netflix "Scegli un'icona": each profile picks its picture from the server's GetAvatar collection (951
icons in 5 categories on Dino's server). The screen must open at once and scroll smoothly however many
icons and categories there are: the list is fetched once, icons are created only near the focus, images
are loaded only when they are about to appear, and nothing is loaded twice.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `src/lib/avatarGrid.js` (new, pure:
  window and layout maths) + `test/avatarGrid.test.mjs` (new), `src/views/AvatarPickerView.js` (new),
  `src/components/` (any file; new: `CategoryTabs.js`, `ConfirmDialog.js`), `src/components/ProfileMenu.js`,
  `src/views/ProfilesView.js`, `src/views/HomeView.js` (header avatar only), `src/App.js`, `src/lib/probe.js`
  (`count` only, if Stage 7 did not add it yet), `scripts/api-smoke.mjs` (add checks only), `src/theme.js`
  (new sizes/colours only), `test/ui/scenarios.json`, `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". **Tests never change a real profile picture**: UI
  checks stop at the confirmation and answer "No"; the real change is certified by the reviewer with Dino.

## Before you start
Procedure: `docs/AUTOPILOT.md`. Read `docs/ref/jellyfin-api.md` section "Plugin GetAvatar" (endpoints are not
in the OpenAPI spec: that section is the source) and `docs/ref/lightning.md` "Facts for the next stages"
(textures load only near the screen; `boundsMargin`; elements are what costs).

## Prerequisite
Task T4 is merged into `develop` (per-user tokens, `ProfileMenu`).

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `6b.N` without its commit.

## Required result, per step
**6b.1 Client and maths.** `client.avatars()` → `[{ id, name, category, url }]` (absolute `url`), `null` on 404
(plugin missing); `client.setAvatar(avatarId)` (POST, body `{ AvatarId }`, the current token's user).
`src/lib/avatarGrid.js`: `groupByCategory(list)` → `[{ name, items }]` in the order Netflix, then the others
alphabetically, empty category names as "Altre"; `visibleWindow({ index, columns, rowsVisible, extraRows,
total })` → `{ first, last }` of the items that must exist as elements (visible rows plus `extraRows` above and
below). `probe.count(name, delta)` keeps `s.data.counters[name]` (skip if present).
- Check: L0 (URLs and bodies; 404 → `null`; grouping and order; window at the start, middle, end, with fewer
  items than a screen); `api-smoke` check `avatars` (count and categories, or "plugin missing" as ok).

**6b.2 Picker screen.** `AvatarPickerView` (props `client`, `user`): top: the current picture and "Scegli
un'icona per <nome>"; `CategoryTabs` (one tab per category with its count, e.g. "Netflix · 320"); below, a grid
of the selected category: 8 columns, round icons 150 px, 30 px gaps. Focus starts on the first tab; Down enters
the grid, Up from the first grid row goes back to the tabs, Left/Right on the tabs switches category (the grid
rebuilds at index 0). Performance rules, all required:
1. `client.avatars()` is called once per app session; the result is kept in `App` (no second request when the
   screen is opened again).
2. Only the items of `visibleWindow` (3 rows visible + 1 extra above and below = at most 40 elements) exist;
   moving the focus recycles elements (patch `x`, `y`, image of existing ones instead of destroying and creating
   many). `Tile` counts `tiles` like Stage 7 (`+1` in `_init`, `-1` in `_detach`) if it does not already.
3. Images: `Img(url).cover(150, 150)` on the element; the grid container has `boundsMargin` of one row below
   so the next row is fetched before it appears; a placeholder (dark circle with the initial) until `txLoaded`,
   then a 0.2 s fade. Count `images` on `txLoaded`.
4. Keys held down must not queue work: moving the focus only updates positions; image changes happen once the
   window changes.
Probe: `probe.view('avatars', { categories: [names], total })`, `probe.data('category', name)`,
`probe.focus({ area: 'tabs'|'grid', index, label })`.
Entry point added in this step: `ProfileMenu` gets "Cambia icona" as its **second** button (order: "Cambia
profilo", "Cambia icona", "Disconnetti", "Annulla"). This moves "Disconnetti" down by one: update the 6.4
disconnect scenario in `test/ui/scenarios.json` with one more `key:Down` (the only scenario edit allowed;
list it in the commit body).
- Check: `npx lng build > .tmp/build.log 2>&1; node scripts/ui-check.mjs --brief profile:dev wait:home "until:s.data.rows && s.data.rows.length>1" key:Up key:Enter key:Down key:Enter wait:avatars "until:s.data.counters.images>=16" sleep:800 visible:20 shot:avatars`
  then 13 `key:Down` (the first one enters the grid) and `"expect:s.focus.index===96 && s.data.counters.tiles<=60"`
  (the home is no longer on screen, so its tiles are gone), `shot:avatars-deep`; then 12 `key:Up`, `key:Up`
  (tabs), `key:Right`, `"expect:s.focus.area==='tabs' && s.data.category"`.
  Look at both screenshots: icons round, aligned, no empty holes in the visible rows after 1 s.

**6b.3 Choose and apply.** Enter on an icon → `ConfirmDialog` "Usare questa icona?" with the old and the new
picture side by side, buttons "Sì" / "No" (focus on "No"). "Sì" → `client.setAvatar(id)`, then refresh the user
(`me()`) so the new `PrimaryImageTag` is used everywhere (home header, profiles) and go back; failure → message
"Icona non salvata", stay. Entry points: `ProfileMenu` "Cambia icona" (current profile), and on the profiles
screen a "Gestisci profili" button under the avatars: in that mode each avatar shows a pencil badge and Enter
opens the picker for that profile (using that profile's saved token; if there is none, log it in first with the
empty password as in 6.3). The plugin missing (`null`) → neither entry is shown.
- Check: L0 for the refresh of the image tag (mapping); UI: open the picker as in 6b.2, then `key:Down key:Enter "expect:s.data.dialog==='avatar-confirm' && s.focus.label==='No'" visible:20 shot:avatar-confirm key:Enter "expect:s.view==='avatars'"`
  and from the profiles screen: `... wait:profiles` + the keys to "Gestisci profili" + `key:Enter key:Up key:Enter wait:avatars`.

## How to work
As in `docs/AUTOPILOT.md`. Write the counters (tiles, images) you measured in every log row of 6b.2.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre".
