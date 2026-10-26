# Task: Stage 8 - home and title page, Netflix/Jellyfin best of breed

## Goal
The comforts people expect: a big billboard on top of the home, "Prossimi episodi", "La mia lista", watched
marks, title logos instead of plain text, "Altri titoli simili", and clearer "Continua a guardare" cards.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `scripts/api-smoke.mjs` (add checks
  only), `src/views/HomeView.js`, `src/views/DetailsView.js`, `src/components/` (any file; new components
  welcome: `DetailsView.js` is over 300 lines, move parts into `src/components/DetailsHeader.js`,
  `src/components/ActionButtons.js` or similar while you touch them), `src/lib/homeCache.js`,
  `test/homeCache.test.mjs`, `src/theme.js` (new sizes/colours only), `test/ui/scenarios.json`, `docs/PLAN.md`
  (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". Tests change Dino's real data only when they put it back
  (see 8.3).

## Before you start
Procedure: `docs/AUTOPILOT.md`. Endpoints: `docs/ref/jellyfin-api.md` "Verified for Stages 4, 6-10" (rows marked 8).

## Prerequisite
Task T6 is merged into `develop` (the TV certification of playback is not needed to start).

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `8.N` without its commit.

## Required result, per step
**8.1 Billboard.** Top of the home, above the rows: one title picked at random each start from the latest
films and series that have a backdrop and a `Logo` image. Backdrop 1920 wide with a bottom/left dark gradient,
the logo image (max 600x220, `ImageTags.Logo`), 2 lines of overview, buttons "Riproduci" and "Altre info".
It is focusable (Up from the first row); "Altre info" opens the details page; "Riproduci" opens the player
(as the details button does). When the rows get the focus, the billboard shrinks away like on Netflix (the
rows move up, 0.25 s). Probe: `probe.data('billboard', { id, name })`, focus `{ area: 'billboard', label }`.
- Check: `... profile:dev wait:home "until:s.data.billboard && s.data.billboard.id" sleep:1500 visible:30 shot:billboard key:Up "expect:s.focus.area==='billboard'" key:Right key:Enter wait:details`.
  Existing scenarios start with the focus on the first row: the focus must still start there. If this is
  not possible, it is the case where you update the scenarios (list them).

**8.2 Next episodes and better resume cards.** Row "Prossimi episodi" (`/Shows/NextUp`, `limit: 20`) after
"Continua a guardare", hidden when empty. In both rows an episode shows the series' wide image when the
episode has none, and the label `"<series> · S1:E2"`; a film keeps its name.
- Check: L0 (NextUp URL; label mapping for episode and film); UI: `"until:s.data.rows.some(r=>r.title==='Prossimi episodi' && r.count>0)"`, `visible:20`, `shot:nextup`.

**8.3 La mia lista and watched.** Details page: buttons after "Riproduci": "+ La mia lista" / "✓ Nella mia
lista" (toggle, `UserFavoriteItems`) and "Segna come visto" / "Visto" (toggle, `UserPlayedItems`). Home row
"La mia lista" (`/Items` with `isFavorite: true, recursive, includeItemTypes: Movie,Series`) after
"Prossimi episodi", hidden when empty. Cards of watched titles show a small check badge (top right).
Probe events `favorite` / `played` with `{ id, value }`. Button order: play button(s) from Stage 4, then
"La mia lista", then "Visto" (`browserPlayableId` is a film nobody started, so it has one play button).
- Check: L0; UI (puts things back):
  `"query:item={{browserPlayableId}}" profile:dev wait:details key:Right key:Enter "until:s.events.some(e=>e.type==='favorite' && e.value===true)" key:Enter "until:s.events.some(e=>e.type==='favorite' && e.value===false)" visible:20 shot:mylist`.

**8.4 More like this and title logo.** Details page: the `Logo` image (or the parent series' logo for an
episode, `ParentLogoItemId`) replaces the text title when present, max 640x200; the text title stays for
the probe and when there is no logo. Below the buttons (films) or the episodes (series): row "Altri titoli
simili" (`/Items/{itemId}/Similar`, `limit: 12`); Enter opens that title.
- Check: `"query:item={{movieId}}" profile:dev wait:details "until:s.data.similar>0" sleep:1500 visible:20 shot:details-logo`
  plus the regress scenarios `2.2`, `5.1`, `5.3` unchanged and green.

## How to work
As in `docs/AUTOPILOT.md`. Look at every screenshot: billboard text readable on bright backdrops, buttons aligned.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre".
