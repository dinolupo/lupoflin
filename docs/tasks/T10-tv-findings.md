# Task: Stage 12 - fixes from the review and the TV test (25/10/2026)

## Goal
Dino tried the app on the LG TV and confirmed defects that the browser checks could not see. Six remain to fix.
Each one was seen by Dino on the TV: the symptom is certain, the cause is given where it was verified.

## Already fixed by the reviewer (do NOT redo, do NOT touch)
Already on `develop` (`judge 6-10` commits): the sort/filter pill text colour in `GridView`, the title logos'
transparency (`hasAlpha` on the logo textures of `Billboard` and `DetailsView`), the user picture in the header
(`mapAuth` + cached login take `PrimaryImageTag`), "Gestisci profili" never falling back to another profile,
`clearAll` removing the per-user caches, "Segna come visto" width. Do not look at other branches
(`git log --all`, `git diff <branch>`): only `develop`.
If a step below turns out to be already done, say so in the report and write nothing for it.

## Scope
- Target: browser build checked by `scripts/ui-check.mjs`. **No TV.**
- You may create/change: `src/App.js`, `src/lib/jellyfin.js`, `test/jellyfin.test.mjs`, `src/lib/playback.js`,
  `test/playback.test.mjs`, `src/views/HomeView.js`, `src/views/GridView.js`, `src/views/DetailsView.js`,
  `src/views/PlayerView.js`, `src/views/ProfilesView.js`, `src/views/AvatarPickerView.js`, `src/components/`
  (any file), `src/theme.js` (new sizes/colours only), `test/ui/scenarios.json` (add scenarios only),
  `docs/ref/lightning.md` (add a fact), `docs/PLAN.md` (Progress log rows only).
- Forbidden: everything in `AGENTS.md` "Hard rules". Do not change anything the "Already fixed" list names.

## Before you start
Procedure: `docs/AUTOPILOT.md`. Look at the screenshots your checks save: every step below is a defect that a
green check did not catch. Write what you really see in the "Screenshot:" line of the commit.

## Prerequisite
Task T9 is merged into `develop` and the reviewer's `judge 6-10` commits are on it
(`git log --oneline develop | grep -c "judge 6-10"` is at least 1).

## Where you are
`tail -25 docs/PLAN.md` and `git log --oneline -20`. Continue from the first step `12.N` without its commit.

## Required result, per step
**12.1 "Cerca" readable when focused.** In the home header the focused "Cerca" pill is white with white text, so
the word disappears (the grid bar had the same defect and is already fixed). The focused text must use the
same dark colour as the other focused pills (`colors.background`). Both pills (header "Cerca", grid "Ordina" and
"Filtro") also report in `probe.focus` two fields, `textColor` and `fillColor` (the numbers actually set),
so a check can compare them.
- Check: scenario `12.1-pill-contrast`: home, `key:Up key:Up key:Left`, `"expect:s.focus.label==='Cerca' &&
  s.focus.textColor!==s.focus.fillColor"`, `visible:20`, `shot:search-focus`; and on the grid
  `key:Up "expect:s.focus.textColor!==s.focus.fillColor"`. Look at `search-focus.png`: the word "Cerca" is dark on white.

**12.2 Profile pictures with transparency.** The profile squares on "Chi vuole guardare?" have a green border
(Dino saw it on the TV); user pictures are PNG with transparent corners whose hidden colour is green
(71, 112, 76). Verified cause: with `useImageWorker: false` (`settings.json`) Lightning gives a texture an
alpha channel only if the URL contains `.png` (`loadSrcTexture`, `lightning.esm.js` ~11827); Jellyfin URLs
never do. The texture object accepts `hasAlpha: true`, e.g. `texture: { ...Img(url).contain(w, h), hasAlpha: true }`
(already used for the logos). Apply it to every place that draws a user picture (profiles screen, header avatar,
avatar picker header and confirmation dialog) and to the GetAvatar icons. Add the fact to
`docs/ref/lightning.md` "Traps" (numbered next after the last one).
- Check: `npx lng build > .tmp/build.log 2>&1; node scripts/ui-check.mjs --brief profile:dev wait:home
  "until:s.data.rows && s.data.rows.length>1" reload wait:profiles visible:5 shot:profiles-alpha`. Look at it: no
  coloured border around the squares (the corners show the dark background). Also
  `grep -rn "userImageUrl" src | cut -c1-160 | head -20` and say how many call sites you changed.

**12.3 Detail buttons sized by their text.** On the film details page the buttons ("Riproduci", "+ La mia
lista", "Segna come visto"; with resume: "Riprendi da …", "Dall'inizio", …) have different widths chosen by
hand and sometimes overlap. Required: each button is as wide as its label plus 40 px padding on each side, and
the gap between two buttons is 20 px, whatever the label (e.g. "✓ Nella mia lista", "Riprendi da 1:38:15").
Lightning 2.20 has flex layout (`flex`, `flexItem`): check it exists with a grep in `lightning.esm.js` before
using it, otherwise lay the buttons out from the measured label width. Probe: `probe.data('buttons', [{ label,
x, w }])` after layout.
- Check: scenario `12.3-details-buttons`: open a film (`query:item={{movieId}}` `profile:dev wait:details`) and
  `"expect:s.data.buttons.every((b,i,a)=>i===0||a[i-1].x+a[i-1].w+20<=b.x)"`, `visible:20`, `shot:details-buttons`.
  Do it also for a film with a resume point if the fixtures allow it; if not, say so under "Non verificato".

**12.4 Grid: first row not hidden by the header.** In the library grid the focus border of the first row is
partly covered by the header bar. Move the grid content down so the border of the focused card in the first row
is fully visible (the border is drawn outside the card: leave at least 12 px between the bottom of the sort/filter
bar and the top of the border). Nothing else in the grid changes; paging and virtualisation must keep working.
- Check: `2.x`/`7.4`/`10.2` scenarios stay green (`npm run check:regress`); new scenario `12.4-grid-first-row`:
  "Film" grid, `"until:s.data.loaded>0"`, `visible:20`, `shot:grid-first-row`. Look at it: the first row's white
  border is complete on all four sides.

**12.5 Profile menu hides the home.** Opening "Cambia profilo" from the header avatar leaves the home visible
and moving behind a half-transparent layer, partly covered by the menu. The menu must cover the home completely:
the screen shows only the menu on the dark background while it is open, and nothing behind it moves.
Back or "Annulla" closes it and the home is as before (same focus). Only `ProfileMenu` changes (other
overlays: report them under "da proporre", do not touch them).
- Check: scenario `12.5-profile-menu-cover`: `profile:dev wait:home "until:s.data.rows && s.data.rows.length>1"
  key:Up "expect:s.focus.area==='header'" key:Enter "expect:s.data.dialog==='profile'" visible:3 shot:profile-menu`
  then `key:Back "expect:s.view==='home' && s.focus.area==='header'"`. `visible:3` because the screen is nearly all
  background; look at `profile-menu.png`: no poster, no row, no billboard can be seen.

**12.6 Errors that end in a black screen.** (a) `PlayerView`: if `playbackInfo()` / `item()` fail in
`_startPlayback`, or the video reports an irrecoverable error, the screen stays black with no message (the
catch only logs to the probe). Required: show a message "Impossibile riprodurre il titolo" with a single
"Indietro" button and go back with Back/OK; probe event `player_error`. (b) `App.$profileSelected`: a network
error or 5xx (not 401) when the saved token is tried is thrown out of an event handler and nothing is shown;
call `$fatal('Accesso non riuscito', message)` like the other login errors.
- Check: L0 for any pure helper you add (`playback.js`); UI for (a): the fixtures `{{hevcMovieId}}` or an
  episode do not play in headless Chromium, so `query:item={{hevcMovieId}} profile:dev wait:details key:Enter
  "until:s.events.some(e=>e.type==='player_error')" visible:5 shot:player-error`; if that case does not fail
  in your run, say so under "Non verificato" and prove the path with an L0 test of the helper. (b) is checked by
  reading: say which line handles the non-401 case.

## How to work
As in `docs/AUTOPILOT.md`. One commit per step with the "Requirements -> changes" body and the
`Screenshot:` line. In every log row write the real result.

## Delivery
Per step: files and checks with results; the 3 main difficulties; "Non verificato / da proporre".
